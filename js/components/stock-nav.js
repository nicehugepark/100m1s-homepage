/* ───── components/stock-nav.js — 종목 anchor 클릭 + 해시 스크롤 (REQ-001 §3 Phase 2) ─────
   분리 commit: REQ-001 §3 Phase 2. DSN: DOC-20260430-DSN-001-arch-frontend §3.2.
   추출: renderer.js _scrollToHashStockIfAny(1138~1171) + window._stockNav(2212~2235) + capture click handler(2237~2240).
   IIFE + window 전역 등록. 동작 100% 동일 보존.
   REQ-001 §1 디버깅 가시화: console.log 진단 라인 — 사용자 console에서 `_stockNav` 호출 시 trace.
*/
(function (root) {
  'use strict';

  // 해시에 #stock-{code} 있으면 해당 카드로 스크롤 + 강조
  function _scrollToHashStockIfAny() {
    const hash = window.location.hash || '';
    // 하이브리드 형식 #stock-{code}-{name} 또는 기존 #stock-{code} 둘 다 수용 (code만 추출)
    const m = hash.match(/^#stock-([A-Za-z0-9]+)(?:-.+)?$/);
    if (!m) return;
    // 1회만 실행 — 재렌더 시 중간 스크롤 위치로 override되지 않도록
    if (window._scrolledToStockHash === hash) return;
    window._scrolledToStockHash = hash;
    const code = m[1];
    if (typeof console !== 'undefined') {
      console.log('[stock-nav] _scrollToHashStockIfAny: hash=' + hash + ' code=' + code);
    }
    // 렌더가 비동기이므로 약간의 지연 후 시도 (최대 5회)
    let tries = 0;
    const tryScroll = () => {
      const el = document.getElementById('stock-' + code);
      if (el) {
        // CSS scroll-margin-top: 88px이 sticky header + 여유 오프셋 처리.
        if (typeof console !== 'undefined') {
          console.log('[stock-nav] target found, scrollIntoView: code=' + code + ' tries=' + tries);
        }
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('card-highlight');
        setTimeout(() => el.classList.remove('card-highlight'), 2000);
        // 다른 렌더/스크롤 코드가 override할 수 있어 1.5초 뒤 강제 재정렬
        setTimeout(() => {
          const el2 = document.getElementById('stock-' + code);
          if (!el2) return;
          const top = el2.getBoundingClientRect().top;
          if (Math.abs(top - 88) > 30) {
            if (typeof console !== 'undefined') {
              console.log('[stock-nav] re-align scrollIntoView (top=' + top.toFixed(1) + ')');
            }
            el2.scrollIntoView({ behavior: 'auto', block: 'start' });
          }
        }, 1500);
        return;
      }
      if (++tries < 5) setTimeout(tryScroll, 400);
      else if (typeof console !== 'undefined') {
        console.warn('[stock-nav] target NOT found after 5 tries: code=' + code);
      }
    };
    tryScroll();
  }

  // 종목 anchor 클릭 — inline onclick 진입점 (REQ-017 후속 #9 v166)
  function _stockNav(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const a = e && e.currentTarget ? e.currentTarget : (e && e.target ? e.target.closest('.trend-stock-link') : null);
    if (!a) {
      if (typeof console !== 'undefined') {
        console.warn('[stock-nav] _stockNav: anchor not found, target=', e && e.target);
      }
      return false;
    }
    const href = a.getAttribute('href') || '';
    const hashMatch = href.match(/#stock-([A-Za-z0-9_-]+)/);
    const dateMatch = href.match(/[?&]date=([0-9]{4}-[0-9]{2}-[0-9]{2})/);
    if (typeof console !== 'undefined') {
      console.log('[stock-nav] _stockNav: href=' + href + ' hashMatch=' + (hashMatch && hashMatch[0]) + ' dateMatch=' + (dateMatch && dateMatch[1]));
    }
    if (!hashMatch) return false;
    const cardId = hashMatch[0];
    const newDate = dateMatch ? dateMatch[1] : null;
    const curDate = (new URLSearchParams(window.location.search)).get('date');
    const pollScroll = (attempts = 25) => {
      const t = document.querySelector(cardId);
      if (t) {
        if (typeof console !== 'undefined') {
          console.log('[stock-nav] pollScroll hit: cardId=' + cardId + ' remaining=' + attempts);
        }
        t.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (attempts > 0) setTimeout(() => pollScroll(attempts - 1), 200);
      else if (typeof console !== 'undefined') {
        console.warn('[stock-nav] pollScroll exhausted: cardId=' + cardId);
      }
    };
    if (newDate && newDate !== curDate) {
      if (typeof console !== 'undefined') {
        console.log('[stock-nav] date change: ' + curDate + ' → ' + newDate + ' (history.pushState + popstate)');
      }
      history.pushState({}, '', href);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    pollScroll();
    return false;
  }

  // capture phase fallback (inline onclick 미적용 케이스 대응)
  function installCaptureFallback() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('.trend-stock-link');
      if (a && !a.hasAttribute('onclick')) {
        if (typeof console !== 'undefined') {
          console.log('[stock-nav] capture fallback fired for anchor without inline onclick');
        }
        _stockNav({
          preventDefault: () => e.preventDefault(),
          stopPropagation: () => e.stopPropagation(),
          target: e.target,
          currentTarget: a
        });
      }
    }, true);
  }

  // 전역 등록 (renderer.js 잔존 호출부 호환 — _scrollToHashStockIfAny는 renderer 내부 호출)
  root._stockNav = _stockNav;
  root._scrollToHashStockIfAny = _scrollToHashStockIfAny;

  // capture fallback 즉시 설치 (renderer.js 모듈 분리 전 패턴 보존)
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', installCaptureFallback);
    } else {
      installCaptureFallback();
    }
  }
})(typeof window !== 'undefined' ? window : this);
