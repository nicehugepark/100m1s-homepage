/* ───── lib/chart/interaction/toggle-panel.js — Layer 3 toggle UI 13종 (default ON) ─────
   cycle22 Phase 2 — SPEC §2.1 Layer 3 / §5 accordion 인터랙션 / AC-3 localStorage 영구화.

   본질: container 내 .cal-chart-toggle 13개 클릭 시 state[indicator] 반전 + saveState + rerender.
   .cal-chart-close 클릭 시 부모 .cal-feature-card.expanded 해제.
   ESC 키 = close. 키보드 a11y (Enter/Space) wire.
*/
(function (root) {
  'use strict';

  function wire(container, opts = {}) {
    if (!container) return;
    const { getState, setState, rerender } = opts;

    // toggle 13종
    const toggleClickHandler = (e) => {
      const btn = e.target.closest('.cal-chart-toggle');
      if (!btn || !container.contains(btn)) return;
      const key = btn.getAttribute('data-indicator');
      if (!key) return;
      const state = getState();
      state[key] = !state[key];
      setState(state);
      rerender(state);
    };

    // close
    const closeClickHandler = (e) => {
      const closeBtn = e.target.closest('.cal-chart-close');
      if (!closeBtn || !container.contains(closeBtn)) return;
      const card = container.closest('.cal-feature-card');
      if (card) {
        card.classList.remove('chart-expanded');
        card.setAttribute('aria-expanded', 'false');
      }
      // 미니캔들 트리거에 focus 복귀 (a11y)
      const trigger = card && card.querySelector('.cal-feature-candles20[data-expand-trigger]');
      if (trigger) trigger.focus();
    };

    // ESC = close
    const escHandler = (e) => {
      if (e.key !== 'Escape') return;
      const card = container.closest('.cal-feature-card');
      if (!card || !card.classList.contains('chart-expanded')) return;
      card.classList.remove('chart-expanded');
      card.setAttribute('aria-expanded', 'false');
      const trigger = card.querySelector('.cal-feature-candles20[data-expand-trigger]');
      if (trigger) trigger.focus();
    };

    // 1회만 등록 (delegation 패턴 — container 단위)
    if (!container._chartTogglePanelInit) {
      container.addEventListener('click', toggleClickHandler);
      container.addEventListener('click', closeClickHandler);
      // ESC는 document 레벨 (focus 위치 무관)
      document.addEventListener('keydown', escHandler);
      container._chartTogglePanelInit = true;
    }
  }

  root.ChartInteractionTogglePanel = { wire };
})(typeof window !== 'undefined' ? window : this);
