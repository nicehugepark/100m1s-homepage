// wave1 fix 3종 검증 (2026-06-11, R24 잔존 — DOC-20260611-HANDOFF-001)
//   ① 픽바 상태 D-카운터 하드 클립 0건 (.slice(0,24) 폐기 + status no-shrink)
//   ② 결과 pill 청산일 "(YYYY-MM-DD)" 줄쪼갬 0건 (.pm320-rec-mark-date nowrap 원자화)
//   ③ "외 N종 보유 중" 보조설명 1줄 노출 (하루 1픽 누적 취지)
//   검증 = bbox 수치 (눈대중 금지). 4모드(라이트/다크 × 장전 portal/과거 rec) + 최장 텍스트 조합.
//   real render path: 정적 서버 + 실 renderer.js + 실 builder(_buildPrevPickChipHtml/_buildRunningHoldingsHtml).
//
// 실행: PW_PKG=<playwright 절대경로> node scripts/tests/test_wave1_pm320_fixes.mjs  (repo 루트)
const _pwSpec = process.env.PW_PKG || 'playwright';
const _pw = await import(_pwSpec);
const chromium = _pw.chromium || (_pw.default && _pw.default.chromium);
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(join(fileURLToPath(import.meta.url), '../../..'));
const SHOTS = process.env.SHOTS_DIR || '/tmp/wave1-pm320-shots';
await mkdir(SHOTS, { recursive: true });
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml',
};
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/pm320.html';
    const full = normalize(join(ROOT, p));
    if (!full.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const body = await readFile(full);
    res.writeHead(200, { 'Content-Type': MIME[extname(full)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
const PORT = 8761;
await new Promise((r) => server.listen(PORT, r));

let failures = 0;
const assert = (cond, msg) => {
  if (cond) { console.log(`  PASS  ${msg}`); }
  else { console.log(`  FAIL  ${msg}`); failures++; }
};

const browser = await chromium.launch();

// ─────────────────────────────────────────────────────────────────────────────
// 시나리오 A — 장전(portal) 픽바: 최장 상태("⏳ 진입 당일 · 성과 집계 전 (D+0/+3)")
//             + "외 2종 보유 중"(최장 name 조합) + 보조설명 노출.
// ─────────────────────────────────────────────────────────────────────────────
async function scenarioA(viewport, themeAttr, tag) {
  const page = await browser.newPage({ viewport });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.route('**/data/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto(`http://localhost:${PORT}/pm320.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window._syncPickBar === 'function', null, { timeout: 8000 });
  await page.waitForTimeout(400);
  if (themeAttr) await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), themeAttr);

  await page.evaluate(() => {
    // 실 builder 호출 — 최장 조합: running d_offset=0 (진입 당일 · 성과 집계 전 (D+0/+3)) + 보유 3종.
    const mkInterp = (code, name, dOffset) => ({
      code, name,
      pm320_pick: {
        is_pick: true, current_state: 'running', d_offset: dOffset,
        current_pnl_pct: 0.0, entry_price: 12345, watering_target_price: 11555,
        take_profit_target_price: 12740, expiry_date: '2026-06-16', pick_date: '2026-06-10',
      },
    });
    const m = new Map([['헤드라인종목', mkInterp('000001', '헤드라인종목', 0)]]);
    const chipHtml = _buildPrevPickChipHtml(m, '2026-06-10');
    const running = [
      { code: '000001', name: '헤드라인종목', date: '2026-06-10', pk: mkInterp('000001', '헤드라인종목', 0).pm320_pick },
      { code: '000002', name: '보유종목둘', date: '2026-06-09', pk: mkInterp('000002', '보유종목둘', 1).pm320_pick },
      { code: '000003', name: '보유종목셋이름긴경우', date: '2026-06-08', pk: mkInterp('000003', '보유종목셋이름긴경우', 2).pm320_pick },
    ];
    const holdingsHtml = _buildRunningHoldingsHtml(running, '000001', 3);
    const portal = document.getElementById('pm320-prepick-portal');
    portal.innerHTML = chipHtml + holdingsHtml;
    portal.hidden = false;
    // 스크롤 가능하게 필러 (IntersectionObserver 가 칩 이탈 시 픽바 노출).
    const filler = document.createElement('div');
    filler.style.height = '3000px';
    document.body.appendChild(filler);
    window._syncPickBar();
  });
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(400);

  const r = await page.evaluate(() => {
    const bar = document.getElementById('pm320-pickbar');
    const status = bar.querySelector('[data-pickbar-status]');
    const name = bar.querySelector('[data-pickbar-name]');
    const arrow = bar.querySelector('.pm320-pickbar-arrow');
    const note = document.querySelector('.cal-pre-prev-pick-holdings-note');
    const label = document.querySelector('.cal-pre-prev-pick-holdings-label');
    const bb = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right }; };
    return {
      visible: bar.classList.contains('pm320-pickbar--visible'),
      statusText: status.textContent,
      nameText: name.textContent,
      barBox: bb(bar), statusBox: bb(status), arrowBox: bb(arrow),
      statusScrollW: status.scrollWidth, statusClientW: status.clientWidth,
      statusRects: status.getClientRects().length,
      noteText: note ? note.textContent : null,
      noteBox: note ? bb(note) : null,
      labelText: label ? label.textContent : null,
    };
  });

  console.log(`\n[시나리오 A · ${tag}] viewport=${viewport.width}x${viewport.height}`);
  console.log(`  status="${r.statusText}" bbox=${JSON.stringify(r.statusBox)} bar=${JSON.stringify(r.barBox)}`);
  assert(r.visible, `픽바 visible (${tag})`);
  // R25 P0-1/P0-2 (2026-06-11) — D-카운터 분모 동적(fixture 만기 SSOT: 6/10→6/16 영업일 = +4)
  //   + 분자 라이브 계산(스냅샷 동결 차단) + 스냅샷 손익 "집계 기준 MM/DD" caption.
  //   고정 verbatim("/+3" 하드코딩 — fixture 만기와 자기모순이던 종전 기대값) 대신 형태 검증(실행일 비의존).
  assert(/^⏳ (진입 당일 · 성과 집계 전|보유 중 ((\+|-)?[\d.,]+%|—)) \(D\+\d+\/\+4\)( · 집계 기준 \d{2}\/\d{2})?$/.test(r.statusText),
    `① 상태 형태 정합 — 동적 분모 +4 + 절단 0 (실측 "${r.statusText}")`);
  assert(/\(D\+\d+\/\+4\)/.test(r.statusText), `① D-카운터 토큰 완전 "(D+n/+4)" (만기 SSOT 분모)`);
  assert(r.statusScrollW <= r.statusClientW + 1, `① 상태 내부 클립 0 (scrollW ${r.statusScrollW} ≤ clientW ${r.statusClientW})`);
  assert(r.statusBox.right <= r.barBox.right + 0.5, `① 상태 bbox 바 내부 (status.right ${r.statusBox.right.toFixed(1)} ≤ bar.right ${r.barBox.right.toFixed(1)})`);
  assert(r.statusRects === 1, `① 상태 단일 라인 (rects=${r.statusRects})`);
  assert(r.arrowBox.right <= r.barBox.right + 0.5, `① 화살표 바 내부`);
  assert(/· 외 2종$/.test(r.nameText), `① name "외 2종" 병기 (실측 "${r.nameText}")`);
  assert(r.labelText === '외 2종 보유 중', `③ 보유 라벨 (실측 "${r.labelText}")`);
  assert(r.noteText === '추천은 하루 1종목 — 각 픽을 만기까지 보유해 기간이 겹치면 여러 종목을 함께 보유합니다', `③ 보조설명 1줄 노출`);
  assert(pageErrors.length === 0, `pageerror 0건 (${pageErrors.length})`);

  await page.screenshot({ path: `${SHOTS}/A-pickbar-${tag}-${viewport.width}.png` });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/A-portal-${tag}-${viewport.width}.png` });
  await page.close();
}

// ─────────────────────────────────────────────────────────────────────────────
// 시나리오 B — 과거 날짜(rec) 모드: 익절(물타기)+청산일+MDD 최장 결과 pill.
//   (1) 매매 pill 좁은 박스(266px) wrap 시 날짜 토큰 단일 라인 (줄쪼갬 0)
//   (2) 픽바 mirror 공백 정합 ("+3.20% (2026-06-09) · 장중 -5.10%")
//   주입 markup = renderer.js _buildPm320RecRow/_buildPm320TodayRecCard 신규 출력 형식 verbatim.
// ─────────────────────────────────────────────────────────────────────────────
async function scenarioB(viewport, themeAttr, tag) {
  const page = await browser.newPage({ viewport });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.route('**/data/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto(`http://localhost:${PORT}/pm320.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window._syncPickBar === 'function', null, { timeout: 8000 });
  await page.waitForTimeout(400);
  if (themeAttr) await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), themeAttr);

  await page.evaluate(() => {
    let cc = document.getElementById('cal-content');
    if (!cc) { cc = document.createElement('div'); cc.id = 'cal-content'; document.body.appendChild(cc); }
    const markInner = '✅ 익절 (물타기) +3.20%'
      + '<span class="pm320-rec-mark-date">(2026-06-09)</span>'
      + '<span class="pm320-rec-mark-mdd">· 장중 -5.10%</span>';
    cc.innerHTML = `
      <div class="cal-pm320-today-rec" role="group" aria-label="이날의 추천 테스트종목명긴경우 123456">
        <div class="cal-pm320-today-rec-head">
          <span class="cal-pm320-today-rec-headlabel">이날의 추천</span>
          <span class="cal-pm320-today-rec-name">테스트종목명긴경우</span>
        </div>
        <div class="cal-pm320-today-rec-result cal-pm320-today-rec-result--profit">${markInner}</div>
        <button class="cal-pm320-today-rec-more" type="button" data-rec-jump="123456">상세 보기</button>
      </div>
      <div style="width:266px; border:1px solid #ccc; margin-top:20px;">
        <div class="pm320-rec-row" data-rec-state="taken_profit">
          <button class="pm320-rec-toggle" type="button" aria-expanded="false" style="width:100%;">
            <span class="pm320-rec-toggle-label"><span class="pm320-rec-toggle-text">매매</span></span>
            <span class="pm320-rec-result-mark pm320-rec-result-mark--profit">${markInner}</span>
          </button>
        </div>
      </div>`;
    const filler = document.createElement('div');
    filler.style.height = '3000px';
    document.body.appendChild(filler);
    window._syncPickBar();
  });
  await page.evaluate(() => window.scrollTo(0, 2200));
  await page.waitForTimeout(400);

  const r = await page.evaluate(() => {
    const bar = document.getElementById('pm320-pickbar');
    const status = bar.querySelector('[data-pickbar-status]');
    const pillDate = document.querySelector('.pm320-rec-result-mark .pm320-rec-mark-date');
    const pillMdd = document.querySelector('.pm320-rec-result-mark .pm320-rec-mark-mdd');
    const recDate = document.querySelector('.cal-pm320-today-rec-result .pm320-rec-mark-date');
    const pill = document.querySelector('.pm320-rec-result-mark');
    const bb = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width, right: b.right }; };
    return {
      visible: bar.classList.contains('pm320-pickbar--visible'),
      statusText: status.textContent,
      statusScrollW: status.scrollWidth, statusClientW: status.clientWidth,
      barRight: bar.getBoundingClientRect().right, statusRight: status.getBoundingClientRect().right,
      pillDateRects: pillDate.getClientRects().length,
      pillMddRects: pillMdd.getClientRects().length,
      recDateRects: recDate.getClientRects().length,
      pillBox: bb(pill), pillDateBox: bb(pillDate),
      pillLines: Math.round(pill.getBoundingClientRect().height / parseFloat(getComputedStyle(pill).lineHeight || '17')),
    };
  });

  console.log(`\n[시나리오 B · ${tag}] viewport=${viewport.width}x${viewport.height}`);
  console.log(`  pill date bbox=${JSON.stringify(r.pillDateBox)} (pill ${JSON.stringify(r.pillBox)}) / pickbar status="${r.statusText}"`);
  assert(r.pillDateRects === 1, `② 매매 pill 청산일 토큰 단일 rect — 줄쪼갬 0 (rects=${r.pillDateRects}, 266px wrap 강제)`);
  assert(r.recDateRects === 1, `② 요약카드 결과 청산일 토큰 단일 rect (rects=${r.recDateRects})`);
  assert(r.pillMddRects === 1, `② MDD 칩 단일 rect 무회귀 (rects=${r.pillMddRects})`);
  assert(r.visible, `픽바 visible (rec mirror, ${tag})`);
  assert(r.statusText === '✅ 익절 (물타기) +3.20% (2026-06-09) · 장중 -5.10%', `① mirror 공백 정합 (실측 "${r.statusText}")`);
  assert(r.statusScrollW <= r.statusClientW + 1, `① rec-모드 상태 내부 클립 0 (scrollW ${r.statusScrollW} ≤ clientW ${r.statusClientW})`);
  assert(r.statusRight <= r.barRight + 0.5, `① rec-모드 상태 bbox 바 내부 (${r.statusRight.toFixed(1)} ≤ ${r.barRight.toFixed(1)})`);
  assert(pageErrors.length === 0, `pageerror 0건 (${pageErrors.length})`);

  await page.screenshot({ path: `${SHOTS}/B-pickbar-${tag}-${viewport.width}.png` });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/B-pill-${tag}-${viewport.width}.png` });
  await page.close();
}

// 4모드 (라이트/다크 × 장전 portal/과거 rec) × 모바일(390, R23 기준) + 데스크탑(1280) bbox 재측정.
await scenarioA({ width: 390, height: 844 }, 'light', 'light');
await scenarioA({ width: 390, height: 844 }, 'dark', 'dark');
await scenarioA({ width: 1280, height: 800 }, 'light', 'light');
await scenarioB({ width: 390, height: 844 }, 'light', 'light');
await scenarioB({ width: 390, height: 844 }, 'dark', 'dark');
await scenarioB({ width: 1280, height: 800 }, 'light', 'light');

await browser.close();
server.close();
console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURES`} — screenshots: ${SHOTS}/`);
process.exit(failures === 0 ? 0 : 1);
