// R21 P0 — sticky 픽바 라벨 변조·고착 회귀 가드.
//   real render path: 정적 서버로 pm320.html 로드 → 실 renderer.js 실행 → window._syncPickBar() 직접 호출.
//   R21 버그 DOM 을 합성 주입(오늘 PRE_MARKET = "어제의 픽" 칩만, 전일 토글 박스 = 전일 픽 요약 카드).
//   검증: (1) 픽바가 "어제의 픽" 칩을 mirror (전일 카드 "이날의 추천" 변조 없음)
//        (2) [data-pre-prev] 토글 박스 펼침(전일 카드 등장) 후에도 픽바 eyebrow 불변
//        (3) data-pickbar-prev-jump = 전일 픽 code (P1 클릭 보상 wiring).
//
// 실행: node scripts/tests/test_pickbar_prevtoggle_r21.mjs  (repo 루트에서)
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
const PORT = 8743;
await new Promise((r) => server.listen(PORT, r));

let failures = 0;
const assert = (cond, msg) => {
  if (cond) { console.log(`  PASS  ${msg}`); }
  else { console.log(`  FAIL  ${msg}`); failures++; }
};

const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
// 실 데이터 fetch 차단 — 실 렌더 path 가 #cal-content 를 덮어쓰지 않게 (합성 DOM 이 SSOT).
//   renderer.js / pm320.html 정적 자산은 통과, /data/* 만 빈 응답.
await page.route('**/data/**', (route) => route.fulfill({ status: 404, body: '' }));
await page.goto(`http://localhost:${PORT}/pm320.html`, { waitUntil: 'domcontentloaded' });
// renderer.js 로드 대기 (window._syncPickBar 정의 시점).
await page.waitForFunction(() => typeof window._syncPickBar === 'function', null, { timeout: 8000 });
// 실 렌더가 #cal-content 를 만지지 못하도록 잠깐 대기 후 합성 주입 (data 차단으로 렌더 no-op).
await page.waitForTimeout(500);

// R21 버그 DOM 합성: #cal-content 에 (1) 오늘 PRE_MARKET "어제의 픽" 칩 + (2) 전일 데이터 토글 박스.
//   토글 박스 안에는 전일 픽 요약 카드(.cal-pm320-today-rec, 라벨 "이날의 추천") — 변조 유발원.
await page.evaluate(() => {
  let cc = document.getElementById('cal-content');
  if (!cc) { cc = document.createElement('div'); cc.id = 'cal-content'; document.body.appendChild(cc); }
  cc.innerHTML = `
    <div class="cal-pre-prev-pick cal-pre-prev-pick--profit" data-prev-pick-code="123456" role="status">
      <span class="cal-pre-prev-pick-eyebrow">어제의 픽</span>
      <span class="cal-pre-prev-pick-name">테스트종목</span>
      <span class="cal-pre-prev-pick-mark">✅ 익절 +3.20%</span>
    </div>
    <button data-pre-toggle aria-expanded="false">전일 데이터 보기 ▾</button>
    <div class="cal-pre-market-prev" data-pre-prev hidden></div>`;
});

// (1) 토글 접힘 상태 — 픽바가 "어제의 픽" 칩 mirror.
await page.evaluate(() => window._syncPickBar());
let eyebrow = await page.evaluate(() => document.querySelector('[data-pickbar-eyebrow]')?.textContent.trim());
let prevJump = await page.evaluate(() => document.getElementById('pm320-pickbar')?.getAttribute('data-pickbar-prev-jump'));
let hidden = await page.evaluate(() => document.getElementById('pm320-pickbar')?.hidden);
assert(hidden === false, '토글 접힘: 픽바 노출');
assert(eyebrow === '어제의 픽', `토글 접힘: eyebrow="어제의 픽" (실제 "${eyebrow}")`);
assert(prevJump === '123456', `토글 접힘: data-pickbar-prev-jump=전일 code (P1 wiring, 실제 "${prevJump}")`);

// (2) 토글 펼침 시뮬레이션 — 전일 박스에 전일 픽 카드("이날의 추천") 주입 후 재동기.
//   R21 버그: 종전 코드는 이 전일 카드를 mirror 해 eyebrow 가 "이날의 추천" 으로 변조됐다.
await page.evaluate(() => {
  const pb = document.querySelector('[data-pre-prev]');
  pb.hidden = false;
  pb.innerHTML = `
    <div class="cal-pm320-today-rec" role="group">
      <div class="cal-pm320-today-rec-head">
        <span class="cal-pm320-today-rec-headlabel">이날의 추천</span>
        <span class="cal-pm320-today-rec-name">전일종목</span>
      </div>
      <div class="cal-pm320-today-rec-result cal-pm320-today-rec-result--running">⏳ 잠정 +1.00% (D+0/+3)</div>
      <button class="cal-pm320-today-rec-more" data-rec-jump="999999" aria-expanded="false">상세 보기 ↓</button>
    </div>`;
  window._syncPickBar();
});
eyebrow = await page.evaluate(() => document.querySelector('[data-pickbar-eyebrow]')?.textContent.trim());
const name = await page.evaluate(() => document.querySelector('[data-pickbar-name]')?.textContent.trim());
const recJump = await page.evaluate(() => document.getElementById('pm320-pickbar')?.getAttribute('data-rec-jump'));
assert(eyebrow === '어제의 픽', `토글 펼침 후: eyebrow 불변 "어제의 픽" (변조 없음, 실제 "${eyebrow}")`);
assert(name === '테스트종목', `토글 펼침 후: name 불변 "테스트종목" (전일종목 변조 없음, 실제 "${name}")`);
assert(recJump === null, `토글 펼침 후: data-rec-jump 미설정(전일 카드 잠금 안 됨, 실제 "${recJump}")`);

// (3) 토글 접힘 복원 시뮬레이션 — 박스 비움 후 재동기, 칩 mirror 복귀.
await page.evaluate(() => {
  const pb = document.querySelector('[data-pre-prev]');
  pb.hidden = true; pb.innerHTML = '';
  window._syncPickBar();
});
eyebrow = await page.evaluate(() => document.querySelector('[data-pickbar-eyebrow]')?.textContent.trim());
prevJump = await page.evaluate(() => document.getElementById('pm320-pickbar')?.getAttribute('data-pickbar-prev-jump'));
assert(eyebrow === '어제의 픽', `토글 접힘 복원: eyebrow="어제의 픽" (실제 "${eyebrow}")`);
assert(prevJump === '123456', `토글 접힘 복원: prev-jump 복귀 (실제 "${prevJump}")`);

// (4) 토글 펼침 "도중" rename 상태 — 원본 #cal-content → #_cal-content-saved, prevBox → #cal-content.
//   이 순간 _syncPickBar 가 호출되면(전일 렌더 path 의 line ~2700) primary 는 #_cal-content-saved 여야 한다.
//   종전 버그: getElementById('cal-content') = prevBox → 전일 카드 mirror. fix: #_cal-content-saved 우선.
await page.evaluate(() => {
  const cc = document.getElementById('cal-content');     // 합성 1차 콘텐츠(어제의 픽 칩)
  cc.id = '_cal-content-saved';
  const pb = document.querySelector('[data-pre-prev]');
  pb.hidden = false;
  pb.innerHTML = `<div class="cal-pm320-today-rec" role="group">
      <div class="cal-pm320-today-rec-head"><span class="cal-pm320-today-rec-headlabel">이날의 추천</span>
      <span class="cal-pm320-today-rec-name">전일종목</span></div>
      <button class="cal-pm320-today-rec-more" data-rec-jump="999999">상세 보기 ↓</button></div>`;
  pb.id = 'cal-content';                                  // prevBox 임시 rename (전일 카드 보유)
  window._syncPickBar();
});
const eyebrowMid = await page.evaluate(() => document.querySelector('[data-pickbar-eyebrow]')?.textContent.trim());
assert(eyebrowMid === '어제의 픽', `rename 도중: primary=#_cal-content-saved 우선, eyebrow 불변 (실제 "${eyebrowMid}")`);
// rename 원복.
await page.evaluate(() => {
  document.getElementById('cal-content').id = '__pb_tmp_prev';
  document.getElementById('_cal-content-saved').id = 'cal-content';
  document.getElementById('__pb_tmp_prev').removeAttribute('id');
});

assert(pageErrors.length === 0, `console 0 err (실제: ${pageErrors.join(' | ') || '없음'})`);

await browser.close();
server.close();
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
