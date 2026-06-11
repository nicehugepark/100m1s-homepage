// PM320 정보 위계 개편 (대표 2026-06-10 결합안) — 섹션 기본 접힘 실 렌더 검증.
// FLR-20260610-TEC-001 정합: runtime 검증(콘솔 error 0 + y 좌표 실측). string grep 금지.
//   검증: (a) 콘솔 error 0  (b) theme-trend/limit-up-trend/theme-tree 기본 접힘(본문 hidden)
//         (c) 미니요약 노출  (d) 토글 펼침 + localStorage 기억  (e) 390px 뉴스/픽 슬롯 y < 1000px(P0 기준)
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
  for (const vp of [{ w: 1280, h: 900, name: 'desktop' }, { w: 390, h: 844, name: 'mobile-390' }]) {
    console.log(`\n=== viewport ${vp.name} (${vp.w}x${vp.h}) ===`);
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);

    const realErrors = errors.filter((t) =>
      !/favicon|service ?worker|sw\.js|Failed to load resource.*404.*\.(png|ico)/i.test(t));
    assert(realErrors.length === 0, `콘솔 error 0 (실측 ${realErrors.length}${realErrors.length ? ': ' + realErrors.slice(0, 3).join(' | ') : ''})`);

    // (b)(c) 3섹션 기본 접힘 + 미니요약
    const sec = await page.evaluate(() => {
      const out = {};
      for (const id of ['nightly-us', 'theme-trend', 'limit-up-trend', 'theme-tree']) {
        const root = document.getElementById(id);
        if (!root) { out[id] = { exists: false }; continue; }
        const body = root.querySelector('.section-collapse-body');
        const sum = root.querySelector('.pm320-section-summary[data-collapse-summary="1"]');
        const header = root.querySelector('[data-collapse-section]');
        out[id] = {
          exists: true,
          collapsed: root.classList.contains('pm320-section-collapsed'),
          bodyHidden: body ? (body.hasAttribute('hidden') || getComputedStyle(body).display === 'none') : null,
          summaryText: sum ? sum.textContent.trim() : null,
          summaryVisible: sum ? getComputedStyle(sum).display !== 'none' : false,
          ariaExpanded: header ? header.getAttribute('aria-expanded') : null,
        };
      }
      return out;
    });
    for (const id of ['theme-trend', 'limit-up-trend', 'theme-tree']) {
      const s = sec[id];
      if (!s.exists) { console.log(`  SKIP: ${id} 미렌더`); continue; }
      assert(s.collapsed && s.bodyHidden, `${id} 기본 접힘 (본문 hidden, aria-expanded=${s.ariaExpanded})`);
      // R26 P1③ (2026-06-11) — 미니요약 '▸ ' prefix 폐기 (chevron ▾ 와 이중 화살표 → 1개).
      assert(!!s.summaryText && !s.summaryText.startsWith('▸') && s.summaryVisible,
        `${id} 미니요약 노출 + ▸ prefix 없음 ("${s.summaryText}")`);
    }

    // (d) 토글 펼침 + localStorage 기억 (theme-trend 으로 검증, 데스크탑만)
    if (vp.name === 'desktop' && sec['theme-trend'].exists) {
      await page.click('#theme-trend [data-collapse-section]');
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => {
        const root = document.getElementById('theme-trend');
        const body = root.querySelector('.section-collapse-body');
        let ls = {};
        try { ls = JSON.parse(localStorage.getItem('pm320SectionExpand') || '{}'); } catch (_) {}
        return {
          collapsed: root.classList.contains('pm320-section-collapsed'),
          bodyVisible: body ? !body.hasAttribute('hidden') && getComputedStyle(body).display !== 'none' : false,
          lsExpanded: ls['theme-trend'] === true,
        };
      });
      assert(!after.collapsed && after.bodyVisible && after.lsExpanded,
        `토글 펼침 → 본문 노출 + localStorage 'pm320SectionExpand' 기억`);
    }

    // (e) 390px — 뉴스/픽 슬롯 y < 1000px (P0 해소 기준, 디자인팀 시뮬 y≈617~900)
    if (vp.name === 'mobile-390') {
      // 두 지표 모두 측정 (거짓 충실성 회피): (1) #cal-content top = lead 명문 기준
      //   (2) 실제 뉴스/픽 콘텐츠 top = 대표 의도(픽 가시) — 둘 다 보고. 둘 다 <1000 이어야 진짜 P0 해소.
      const y = await page.evaluate(() => {
        const cc = document.getElementById('cal-content');
        const sec = document.querySelector('#cal-content .cal-section')
          || document.querySelector('#cal-content .cal-feature-card');
        return {
          ccTop: cc ? Math.round(cc.getBoundingClientRect().top + window.scrollY) : null,
          pickTop: sec ? Math.round(sec.getBoundingClientRect().top + window.scrollY) : null,
        };
      });
      console.log(`  측정: #cal-content top=${y.ccTop}px / 실제 뉴스·픽 콘텐츠 top=${y.pickTop}px`);
      if (y.ccTop == null) {
        console.log('  SKIP: #cal-content y — 슬롯 미렌더');
      } else {
        assert(y.ccTop < 1000, `390px #cal-content y < 1000px (실측 ${y.ccTop}px, lead 명문 기준)`);
        // 실제 픽 콘텐츠도 검증 (대표 의도). FAIL 시 fallback(B안) 발동 신호.
        if (y.pickTop != null) {
          assert(y.pickTop < 1000, `390px 실제 뉴스·픽 콘텐츠 y < 1000px (실측 ${y.pickTop}px, 대표 의도 — 미달 시 fallback B안 필요)`);
        }
      }
    }

    await ctx.close();
  }
  await browser.close();
  console.log(`\n결과: ${process.exitCode ? 'FAIL' : 'ALL PASS'}`);
}

run().catch((e) => { console.error('테스트 실행 실패:', e); process.exit(2); });
