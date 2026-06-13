// Q-20260612-154 ④ — 미장 wire 한국어 인과 해석 frontend 노출 가드.
//   대표 verbatim (2026-06-12 23:14): "타이틀이 영어로 되어 있는건 한국어로 번역을 하고, 단순히
//   헤드라인을 번역만 하지말고 … 국내장 뉴스처럼 인과의 흐름을 설명해줘."
//   real render path: 정적 서버로 pm320.html 로드 → 실 renderer.js 의 _splitWireNews /
//   _buildKrMacroChip / _buildNightlyUsHtml 직접 호출 (합성 fixture — 날짜·실데이터 비의존).
//   검증 축:
//     (1) ko_title 우선 본문 + EN 원문 부 표기 1줄 (.wire-ko-en)
//     (2) causal_summary + causal_chain(→) 노출 — [해석] 내부 태그 (사실/해석 2존, R46 W2 기단정)
//     (3) direction·impact_tags = 기존 .cal-chip-kind 재사용 (muted 해석 계열 — --fact 아님)
//         R49 라이더 3-1 개정 — direction 토큰은 비중립(호재/악재)만, [중립]·불확실 무표기
//     (4) body_fetched=false → 보수 표기 1줄 (.wire-ko-basis)
//     (5) ko 필드 전무 = 기존 영문 그대로 (graceful — .wire-ko-* 0건, 빈 칸 색칠 0)
//     (6) Q-20260613-158 ①② 개정 — ko 칩 = details 접힘 디폴트 (한 줄 summary, 머리 태그 무표기 =
//         사실 디폴트) + 원문 직링크는 펼침 본문 .wire-ko-srclink a[href][_blank] (법무 딥링크 보존)
//
// 실행: node scripts/tests/test_wire_ko_chips.mjs  (repo 루트에서)
//   playwright 미설치 시 PW_PKG 환경변수(절대경로)로 해소.
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
    if (p === '/') p = '/pm320.html';
    const full = normalize(join(ROOT, p));
    if (!full.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const body = await readFile(full);
    res.writeHead(200, { 'Content-Type': MIME[extname(full)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
const PORT = 8767;
await new Promise((r) => server.listen(PORT, r));

let failures = 0;
const assert = (cond, msg) => {
  if (cond) { console.log(`  PASS  ${msg}`); }
  else { console.log(`  FAIL  ${msg}`); failures++; }
};

// 합성 wire fixture — 4 케이스 (full-ko / ko+body_fetched=false / EN ko 부재 / KR 국내).
const WIRE_FIXTURE = {
  generated_at: '2026-06-13T00:00:00+09:00',
  items: [
    {
      published_at: '2026-06-12T23:00:00+09:00', source: 'SEC',
      title: 'SEC Proposes Rescission of Regulation NMS Rules 611 and 610(e)',
      url: 'https://www.sec.gov/newsroom/x1',
      ko_title: 'SEC, 주식 주문보호 규정(NMS 611) 폐지 추진',
      causal_summary: '미 증권거래위원회가 주문보호 규정 폐지를 제안했다. 거래비용 구조가 바뀔 전망이다.',
      causal_chain: '규제 폐지 추진 → 거래비용 감소 → 증시 효율성 제고',
      impact_tags: ['금융규제', '증시제도'], direction: '호재', body_fetched: true,
    },
    {
      published_at: '2026-06-12T22:00:00+09:00', source: 'Federal Reserve',
      title: 'Fed Announces Data Standards Final Rule',
      url: 'https://www.federalreserve.gov/x2',
      ko_title: 'Fed, 금융 규제 데이터 표준화 확정',
      causal_summary: '연준이 데이터 표준을 확정했다. 감시 체계 현대화 가능성이 주시된다.',
      causal_chain: '데이터 표준화 → 정보 호환성 강화 → 감시 체계 현대화',
      // Q-20260613-165 ① — 본 항목은 basis(body_fetched=false) 표기 검증용. 시장무관 hide
      //   규칙(tags=[] && 중립)에 걸리지 않도록 tag 1개 + 비-중립(불확실) 부여 (생존 보장).
      impact_tags: ['금리'], direction: '불확실', body_fetched: false,
    },
    {
      published_at: '2026-06-12T21:00:00+09:00', source: 'White House',
      title: 'Remarks at the National Prayer Breakfast',
      url: 'https://www.whitehouse.gov/x3',
      // ko 필드 전무 — 해석 실패분 graceful 케이스. impact_tags·direction 부재(=undefined)이므로
      //   ① hide(tags=[] && direction==='중립') 미해당 → 생존 (graceful 칩으로 렌더).
    },
    {
      // Q-20260613-165 ① — 시장무관 hide 케이스 (대표 12:50). interpret_wire 가 의례성 발표를
      //   impact_tags=[] + direction='중립'으로 산출 → 표시 제외 (라이브 WH 5건 전건 동형).
      published_at: '2026-06-12T20:30:00+09:00', source: 'White House',
      title: 'Presidential Message on the 250th Anniversary',
      url: 'https://www.whitehouse.gov/x5',
      ko_title: '독립 250주년 기념 대통령 성명',
      impact_tags: [], direction: '중립', body_fetched: true,
    },
    {
      published_at: '2026-06-12T20:00:00+09:00', source: '연합뉴스',
      title: '국고채 금리 일제히 하락…3년물 연 2.8%',
      url: 'https://www.yna.co.kr/view/x4',
    },
  ],
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });  // 모바일 제1 뷰포트
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
// 실 데이터 fetch 차단 — 빌더 직접 호출이 SSOT (날짜·실데이터 비의존 결정성).
await page.route('**/data/**', (route) => route.fulfill({ status: 404, body: '' }));
await page.goto(`http://localhost:${PORT}/pm320.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window._splitWireNews === 'function' || typeof _splitWireNews === 'function', null, { timeout: 8000 }).catch(() => {});
await page.waitForFunction(() => typeof renderCalExpandContent === 'function', null, { timeout: 8000 });
await page.waitForTimeout(400);

// ── Phase 1 — _splitWireNews ko 필드 carry (타입 가드) ──────────────────────
const split = await page.evaluate((wire) => {
  const r = _splitWireNews(wire);
  return {
    usLen: r.us.length, krLen: r.kr.length,
    us0: r.us[0], us1: r.us[1], us2: r.us[2],
    kr0: r.kr[0],
  };
}, WIRE_FIXTURE);
// Q-20260613-165 ① — 시장무관(tags=[] && 중립) hide 적용 후: SEC(호재)·Fed(불확실)·WH프레이어(ko부재)
//   3건 생존, WH 250주년(tags=[]+중립) 1건 hide → us=3. KR(연합 국고채) 무관 = 1.
assert(split.usLen === 3 && split.krLen === 1, `_splitWireNews 분류 us=3 kr=1 (① hide 후, 실측 us=${split.usLen} kr=${split.krLen})`);
// ① hide 직접 검증 — 250주년(tags=[]+중립) 항목이 어느 열에도 없어야 (수집·데이터 무수정·렌더 제외).
const _allChips = await page.evaluate((wire) => {
  const r = _splitWireNews(wire);
  return r.us.concat(r.kr).map((c) => c.title);
}, WIRE_FIXTURE);
assert(!_allChips.some((t) => t.includes('250th Anniversary')), '① 시장무관(tags=[]+중립) WH 250주년 hide — 어느 열에도 미출현');
assert(_allChips.some((t) => t.includes('SEC Proposes')) && _allChips.some((t) => t.includes('Prayer Breakfast')), '① 시장관련(호재)·필드부재(graceful) 항목은 잔존 — 과잉 hide 0');
assert(split.us0.ko_title === 'SEC, 주식 주문보호 규정(NMS 611) 폐지 추진', 'full-ko: ko_title carry');
assert(split.us0.causal_chain.includes('→') && split.us0.impact_tags.length === 2 && split.us0.direction === '호재', 'full-ko: chain/tags/direction carry');
assert(split.us0.body_fetched === undefined, 'body_fetched=true 는 carry 0 (false 명시분만)');
assert(split.us1.body_fetched === false, 'body_fetched=false carry');
assert(!('ko_title' in split.us2) && !('causal_summary' in split.us2), 'ko 부재 항목 = carry 0 (graceful)');
assert(split.kr0.wire === true && !('ko_title' in split.kr0), 'KR 칩 구조 무회귀 (wire=true, ko 무관)');

// ── Phase 2 — US 인라인 빌더 path (_buildNightlyUsHtml 직접 호출) ───────────
const usHtmlInfo = await page.evaluate((wire) => {
  const us = {
    indices: [{ name: 'NASDAQ', value: 20000, change_pct: 0.5 }],
    news_chips: [{ summary: '미 증시는 반도체 강세로 상승 마감했다. AI 수요 기대가 이어졌다.', url: 'https://example.com/us-sum', source: '' }],
  };
  const html = _buildNightlyUsHtml(us, '2026-06-12', { wireNews: wire });
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  // 접힘 본문 강제 노출 (구조 검증 목적)
  host.querySelectorAll('[hidden]').forEach((el) => el.removeAttribute('hidden'));
  const chips = Array.from(host.querySelectorAll('.cal-macro-chip'));
  const pick = (sel, root) => Array.from(root.querySelectorAll(sel)).map((e) => e.textContent);
  const koChip = chips.find((c) => c.textContent.includes('주문보호'));
  const basisChip = chips.find((c) => c.textContent.includes('데이터 표준화'));
  const plainChip = chips.find((c) => c.textContent.includes('Prayer Breakfast'));
  const out = { total: chips.length };
  if (koChip) {
    out.ko = {
      tag0: (koChip.querySelector('.cal-chip-kind') || {}).textContent,
      tag0Fact: !!koChip.querySelector(':scope > .cal-chip-kind.cal-chip-kind--fact'),
      bodyHasKo: koChip.textContent.includes('SEC, 주식 주문보호 규정(NMS 611) 폐지 추진'),
      en: pick('.wire-ko-en', koChip),
      summary: pick('.wire-ko-summary', koChip),
      chain: pick('.wire-ko-chain', koChip),
      tagTokens: Array.from(koChip.querySelectorAll('.wire-ko-tags .cal-chip-kind')).map((e) => ({ t: e.textContent, fact: e.classList.contains('cal-chip-kind--fact') })),
      basis: pick('.wire-ko-basis', koChip),
      // Q-20260613-158 ① — ko 칩 = details 접힘 디폴트. 직링크는 펼침 본문 .wire-ko-srclink 로 이동.
      isDetails: koChip.tagName === 'DETAILS',
      defaultOpen: koChip.hasAttribute('open'),
      headTagCount: koChip.querySelectorAll('summary .cal-chip-kind').length,
      summaryHasKo: (koChip.querySelector('summary') || { textContent: '' }).textContent.includes('주문보호'),
      srcHref: (koChip.querySelector('.wire-ko-srclink') || { getAttribute: () => null }).getAttribute('href'),
      srcTarget: (koChip.querySelector('.wire-ko-srclink') || { getAttribute: () => null }).getAttribute('target'),
      innerKindIsInterp: (koChip.querySelector('.wire-ko-summary .cal-chip-kind') || {}).textContent,
    };
  }
  if (basisChip) out.basis = { basisLine: pick('.wire-ko-basis', basisChip), tags: pick('.wire-ko-tags .cal-chip-kind', basisChip) };
  // R49 라이더 3-2 — 디폴트 뷰(칩 머리·비-wire 칩 본문) 분류 라벨 0건 가드: 펼침 존(.wire-ko-*) 밖 .cal-chip-kind 전무.
  out.defaultViewKindCount = Array.from(host.querySelectorAll('.cal-chip-kind'))
    .filter((e) => !e.closest('.wire-ko-summary') && !e.closest('.wire-ko-tags')).length;
  if (plainChip) {
    out.plain = {
      koEls: plainChip.querySelectorAll('[class^="wire-ko-"]').length,
      text: plainChip.textContent.trim(),
      dash: /—\s*$/.test(plainChip.textContent.trim()) || plainChip.textContent.includes('— —'),
    };
  }
  host.remove();
  return out;
}, WIRE_FIXTURE);

assert(!!usHtmlInfo.ko, 'US 빌더: full-ko 칩 렌더');
if (usHtmlInfo.ko) {
  const k = usHtmlInfo.ko;
  // Q-20260613-158 ② (대표 08:53 verbatim "대부분 다 사실 — 당연한 걸 잔뜩 표시하니 노이지") —
  //   wire 칩 머리 무표기 = 사실 디폴트 ([해석]만 마킹, R48 W2-3 전 칩 태그 방식 개정).
  assert(k.headTagCount === 0 && !k.tag0Fact, '칩 머리 태그 무표기 (158 ② — 무표기 = 사실 디폴트)');
  // Q-20260613-158 ① (대표 08:53 verbatim "한줄로 나오면 좋겠는데 너무 과하다") — details 접힘 디폴트.
  assert(k.isDetails && !k.defaultOpen && k.summaryHasKo, 'ko 칩 = details 접힘 디폴트 + summary 한 줄 = ko_title (158 ①)');
  assert(k.bodyHasKo, '칩 본문 = ko_title 우선');
  assert(k.en.length === 1 && k.en[0].includes('SEC Proposes Rescission'), 'EN 원문 부 표기 1줄 (.wire-ko-en)');
  assert(k.summary.length === 1 && k.summary[0].includes('거래비용 구조가 바뀔 전망'), 'causal_summary 본문 노출');
  assert(k.innerKindIsInterp === '해석', '해석 존 내부 태그 = [해석] (사실/해석 2존 분리)');
  assert(k.chain.length === 1 && k.chain[0].includes('→'), 'causal_chain(A → B → C) 노출 — 국내 해석 칩 동형');
  assert(k.tagTokens.length === 3 && k.tagTokens[0].t === '호재' && k.tagTokens.every((x) => !x.fact), 'direction+tags 3토큰 = .cal-chip-kind muted (해석 계열, --fact 0)');
  assert(k.basis.length === 0, 'body_fetched=true → 보수 표기 0');
  assert(/^https:\/\/www\.sec\.gov/.test(k.srcHref || '') && k.srcTarget === '_blank', '펼침 본문 .wire-ko-srclink a[href] + _blank (법무 딥링크 보존, 158 ①)');
}
assert(!!usHtmlInfo.basis && usHtmlInfo.basis.basisLine.length === 1 && usHtmlInfo.basis.basisLine[0].includes('보수 해석'), 'body_fetched=false → 보수 표기 1줄');
// R49 라이더 3-1 — direction '불확실' = 무표기 (비중립 호재/악재만 렌더). impact_tags(금리)는 잔존.
//   Q-165 ① 후 본 항목 direction 중립→불확실 (hide 회피용) — 방향 토큰 0건은 동일(불확실도 무표기).
assert(!!usHtmlInfo.basis && usHtmlInfo.basis.tags.length === 1 && usHtmlInfo.basis.tags[0] === '금리', 'direction 불확실 → 방향 토큰 0 + impact_tags(금리) 1건만 (R49 라이더 3-1)');
assert(usHtmlInfo.defaultViewKindCount === 0, '디폴트 뷰 분류 라벨 0건 — [해석]은 펼침 본문 경계 마커만 (R49 라이더 3-2)');
assert(!!usHtmlInfo.plain && usHtmlInfo.plain.koEls === 0, 'ko 부재 EN 칩 = .wire-ko-* 0건 (기존 영문 그대로)');
assert(!!usHtmlInfo.plain && !usHtmlInfo.plain.dash, 'ko 부재 칩에 "—" 색칠 0');

// ── Phase 3 — KR 빌더 path (_buildKrMacroChip 양 끝 동형) ───────────────────
const krInfo = await page.evaluate((wire) => {
  const split = _splitWireNews(wire);
  const krHtml = _buildKrMacroChip(split.kr[0]);
  // US ko 칩을 KR 빌더에 통과 (양 끝 동형 — 미래 KR ko 필드 대비)
  const koViaKr = _buildKrMacroChip(split.us[0]);
  const host = document.createElement('div');
  host.innerHTML = krHtml + koViaKr;
  document.body.appendChild(host);
  const [a, b] = Array.from(host.querySelectorAll('.cal-macro-chip'));
  const out = {
    krKoEls: a.querySelectorAll('[class^="wire-ko-"]').length,
    krText: a.textContent,
    krTag: (a.querySelector('.cal-chip-kind') || {}).textContent,
    koViaKrHasBlock: b.querySelectorAll('.wire-ko-summary, .wire-ko-chain').length,
  };
  host.remove();
  return out;
}, WIRE_FIXTURE);
// 158 ② — KR wire 칩도 머리 무표기 (krTag = undefined, .cal-chip-kind 자체 0건).
assert(krInfo.krKoEls === 0 && krInfo.krText.includes('국고채 금리') && krInfo.krTag === undefined, 'KR 칩 무회귀 (ko 0 + 머리 무표기 = 사실 디폴트, 158 ②)');
assert(krInfo.koViaKrHasBlock === 2, 'KR 빌더도 ko 블록 동형 처리 (FLR-20260428-TEC-001 양 끝)');

assert(pageErrors.length === 0, `콘솔 pageerror 0건 (실측 ${pageErrors.length}건${pageErrors.length ? ': ' + pageErrors[0] : ''})`);

await browser.close();
server.close();
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
