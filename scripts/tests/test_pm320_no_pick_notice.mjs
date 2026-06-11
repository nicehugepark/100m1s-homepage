// DSN-frontend §3.6.8 (2026-06-05) — PM320 추천 부재(보류일) 안내 라인 DOM 검증.
//   real render path: 정적 서버로 news.html 로드 → 실 renderer.js / data-loader.js 실행 →
//   renderCalExpandContent(date, data) 를 통제된 data 로 직접 호출 (proxy 아님, 실 DOM).
//   FLR-AGT-002 정합: pm320NoPick===null(미신뢰) 시 미표시 검증 포함.
//
// 실행: node scripts/tests/test_pm320_no_pick_notice.mjs  (repo 루트에서)
// playwright 가 로컬 미설치면 PW_PKG 환경변수(절대경로)로 해소 (CI/로컬 양립).
const _pwSpec = process.env.PW_PKG || 'playwright';
const _pw = await import(_pwSpec);
const chromium = _pw.chromium || (_pw.default && _pw.default.chromium);
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(join(fileURLToPath(import.meta.url), '../../..'));
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/news.html';
    const full = normalize(join(ROOT, p));
    if (!full.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const body = await readFile(full);
    res.writeHead(200, { 'Content-Type': MIME[extname(full)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

const PORT = 8731;
await new Promise((r) => server.listen(PORT, r));

const TODAY = '2026-06-05'; // 거래일(금) — isMarketClosed=false 가정
let failures = 0;
const assert = (cond, msg) => {
  if (cond) { console.log(`  PASS  ${msg}`); }
  else { console.log(`  FAIL  ${msg}`); failures++; }
};

const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.goto(`http://localhost:${PORT}/news.html`, { waitUntil: 'networkidle' });

// renderCalExpandContent / escapeHtml 가 전역에 로드됐는지 확인
const ready = await page.evaluate(() => typeof renderCalExpandContent === 'function');
assert(ready, 'renderCalExpandContent 전역 로드');

// #cal-content 컨테이너 보장
await page.evaluate(() => {
  if (!document.getElementById('cal-content')) {
    const d = document.createElement('div');
    d.id = 'cal-content';
    document.body.appendChild(d);
  }
});

// 통제된 render 호출 → 반환 HTML 검사
async function renderAndQuery(noPickVal) {
  return page.evaluate(({ date, noPick }) => {
    // 보류일 = 거래대금 상위 종목은 정상 존재(장은 정상 거래) + PM320 추천만 0건.
    //   kiwoom.latest_stocks 가 있어야 renderer 의 empty-state early-return(데이터 부재)을
    //   타지 않고 뉴스요약 섹션이 렌더된다 → 보류일 안내가 그 상단에 표시.
    const data = {
      kiwoom: {
        latest_stocks: [
          { ticker: '005930', code: '005930', name: '삼성전자', last_price: 80000, max_trade_amount: 1000000000, change_pct: 1.2 },
        ],
        daily_top: [], last_snapshot_at: '',
      },
      cafePosts: [], narratives: [], interpretedByName: new Map(),
      macroEvents: [], dataSource: 'kiwoom', generatedAt: '',
      lastSnapshotAt: '', _fallbackDate: null,
      pm320NoPick: noPick,
    };
    renderCalExpandContent(date, data);
    const el = document.querySelector('#cal-content .cal-pm320-no-pick');
    if (!el) return { present: false };
    const cs = getComputedStyle(el);
    return {
      present: true,
      text: el.textContent.trim(),
      bg: cs.backgroundColor,
      color: cs.color,
      role: el.getAttribute('role'),
    };
  }, { date: TODAY, noPick: noPickVal });
}

// (a) 보류일(true) → 문구 표시 + 색 구분
const a = await renderAndQuery(true);
assert(a.present, '(a) 보류일(pm320NoPick=true): 안내 라인 표시');
// R26 P1 (2026-06-11) — 문구 정직화: "추천 없음 (기준 미달)" + 데이터 누락과 구분 보조문.
// 시점 분기: 보는 날짜(TODAY 고정 '2026-06-05')가 실행 시점 기준 과거면 "이날은", 당일이면 "오늘은".
assert(a.present && /(오늘은|이날은) 추천 없음 \(기준 미달\)/.test(a.text), '(a) 문구 = "{오늘은|이날은} 추천 없음 (기준 미달)"');
assert(a.present && a.text.includes('데이터 누락이 아니라'), '(a) 데이터 누락 구분 보조문 포함');
assert(a.present && a.role === 'status', '(a) role=status (a11y)');

// 색 구분: 매크로/내러티브 칩 amber(--am4 #FFF6E5) 와 다른 슬레이트(--neu-bg #F2F4F8) 인지
const amberBg = 'rgb(255, 246, 229)'; // --am4
assert(a.present && a.bg !== amberBg, `(a) 배경색이 amber 칩(${amberBg})과 구분 — 실제 ${a.bg}`);
assert(a.present && a.bg === 'rgb(242, 244, 248)', `(a) 배경 = 중립 슬레이트 --neu-bg(rgb(242,244,248)) — 실제 ${a.bg}`);
// R27 P1① (조니 2심, 2026-06-11) — --neu 3.92:1 (라이트 AA 미달) → --neu-tx-aa #525F78 (5.84:1).
assert(a.present && a.color === 'rgb(82, 95, 120)', `(a) 글자색 = --neu-tx-aa(rgb(82,95,120), AA 5.84:1) — 실제 ${a.color}`);

// (b) 정상 추천일(false) → 미표시(무회귀)
const b = await renderAndQuery(false);
assert(!b.present, '(b) 추천 존재(pm320NoPick=false): 안내 라인 미표시 (무회귀)');

// (c) 데이터 미신뢰(null, 404) → 미표시 (FLR-AGT-002 추정 고지 금지)
const c = await renderAndQuery(null);
assert(!c.present, '(c) 미신뢰(pm320NoPick=null): 안내 라인 미표시 (거짓 충실성 차단)');

assert(pageErrors.length === 0, `pageerror 0건 — 실제 ${pageErrors.length}${pageErrors.length ? ': ' + pageErrors.join(' | ') : ''}`);

await browser.close();
server.close();

console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAIL'}`);
process.exit(failures === 0 ? 0 : 1);
