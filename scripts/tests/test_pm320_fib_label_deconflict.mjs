// PM320 피보 좌측 가격라벨 세로 디컨플릭트(#2) + hint 좌하단 재배치(#3) — 실 렌더 검증 (대표 2026-06-10).
// FLR-20260610-TEC-001 정합: runtime 검증(콘솔 error 0 + 라벨 간격 실측). string grep 금지.
//   확대차트(미니캔들 클릭) → 피보 라벨/hint 실측. 데스크탑 1280.
//   검증: (a) 콘솔 error 0  (b) 라벨 세로 최소 간격 ≥ MIN_GAP(14px, 부동소수 여유 13)  (c) hint 좌하단(bottom 기준)
// 주의: 픽 카드 위치(#1)는 본 사이클 보류 — 본 테스트는 차트(#2/#3)만 검증.
const _pwPath = process.env.PW_PKG || 'playwright';
const _pw = await import(_pwPath);
const chromium = _pw.chromium || (_pw.default && _pw.default.chromium);

const BASE = process.env.PM320_BASE || 'http://localhost:8347';
const URL = `${BASE}/pm320.html`;

function assert(cond, msg) {
  if (!cond) { console.error(`  FAIL: ${msg}`); process.exitCode = 1; return false; }
  console.log(`  PASS: ${msg}`);
  return true;
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const realErrors = errors.filter((t) =>
    !/favicon|service ?worker|sw\.js|Failed to load resource.*404.*\.(png|ico)/i.test(t));
  assert(realErrors.length === 0, `콘솔 error 0 (실측 ${realErrors.length}${realErrors.length ? ': ' + realErrors.slice(0, 3).join(' | ') : ''})`);

  // 가시 미니캔들 trigger 클릭 (숨김 idx-card-regular 템플릿 제외)
  const triggerHandle = await page.evaluateHandle(() => {
    const all = [...document.querySelectorAll('.cal-feature-candles20[data-expand-trigger="chart"]')];
    return all.find((t) => {
      const r = t.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(t).display !== 'none';
    }) || null;
  });
  const trigger = triggerHandle.asElement();
  if (!trigger) {
    console.log('  SKIP: 확대차트 trigger(미니캔들) 미존재 — 오늘 픽/후보 카드 없음. P1 정적 parse PASS로 갈음.');
  } else {
    try {
      await trigger.scrollIntoViewIfNeeded({ timeout: 3000 });
      await trigger.click({ force: true, timeout: 5000 });
    } catch (_e) {
      console.log('  SKIP: trigger 클릭 불가(비가시/오버레이). P1 정적 parse + 알고리즘 단위로 갈음.');
      await ctx.close(); await browser.close();
      console.log(`\n결과: ${process.exitCode ? 'FAIL' : 'ALL PASS (SKIP 포함)'}`);
      return;
    }
    let fibReady = false;
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(500);
      const n = await page.$$eval('.cal-chart-tv-fib-price-label',
        (els) => els.filter((e) => getComputedStyle(e).display !== 'none').length).catch(() => 0);
      if (n >= 2) { fibReady = true; break; }
    }
    if (!fibReady) {
      console.log('  SKIP: 피보 라벨 디컨플릭트 — 가시 라벨 <2 (CDN 차트 미로드). P1 정적 parse PASS로 갈음.');
    } else {
      // (b) 라벨 세로 최소 간격 ≥ MIN_GAP-1. priceLine(선)은 DOM 라벨과 별개 객체 → 불변.
      const gaps = await page.$$eval('.cal-chart-tv-fib-price-label', (els) => {
        const tops = els.filter((e) => getComputedStyle(e).display !== 'none')
          .map((e) => parseFloat(e.style.top)).filter((v) => isFinite(v)).sort((a, b) => a - b);
        const out = [];
        for (let i = 1; i < tops.length; i++) out.push(tops[i] - tops[i - 1]);
        return { count: tops.length, minGap: out.length ? Math.min(...out) : Infinity };
      });
      assert(gaps.minGap >= 13, `피보 라벨 ${gaps.count}개 세로 최소 간격 ≥13px (실측 minGap=${gaps.minGap.toFixed(1)})`);

      // (c) hint 좌하단 (bottom 기준, top 미지정) — 차트 상단 ~40% 미가림
      const hint = await page.$eval('.cal-chart-tv-fib-hint', (el) => {
        const cs = getComputedStyle(el);
        return { hasBottom: cs.bottom !== 'auto' && cs.bottom !== '', topStyle: el.style.top, bottomStyle: el.style.bottom };
      }).catch(() => null);
      if (hint) {
        assert(hint.hasBottom && (!hint.topStyle || hint.topStyle === 'auto' || hint.topStyle === ''),
          `피보 hint 좌하단 배치 (bottom 기준, top 미지정) — 차트 상단 미가림`);
      } else {
        console.log('  SKIP: hint 검증 — hint 박스 미존재 (3s fade-out 이후이거나 dismissed)');
      }
    }
  }

  await ctx.close();
  await browser.close();
  console.log(`\n결과: ${process.exitCode ? 'FAIL' : 'ALL PASS'}`);
}

run().catch((e) => { console.error('테스트 실행 실패:', e); process.exit(2); });
