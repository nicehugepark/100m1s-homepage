/* ───── lib/chart/interaction/crosshair.js — Layer 3 crosshair + tooltip ─────
   cycle22 Phase 2 stub — SPEC §2.1 Layer 3 / §5.3 트랜지션 (crosshair instant).
   mousemove + touchmove 시 X 위치 기준 일자 + OHLC tooltip 표시.
   Phase 2.2 후행 sub-agent가 정식 wire-up (mousemove 위치 → 최근 candle 매칭 → tooltip render).

   본 단발 = expose API skeleton (Phase 2.2가 본체 채움).
*/
(function (root) {
  'use strict';

  function wire(container, opts = {}) {
    // Phase 2.2 후행 — 본 단발 = no-op (stub)
    // 호출부: ChartInteractionCrosshair.wire(container, { data, scale })
    return;
  }

  root.ChartInteractionCrosshair = { wire };
})(typeof window !== 'undefined' ? window : this);
