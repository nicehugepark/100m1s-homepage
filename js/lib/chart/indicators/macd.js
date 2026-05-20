/* ───── lib/chart/indicators/macd.js — #8 MACD sub-pane (OFF default) ─────
   cycle22 Phase 2 stub — SPEC §2.2 / 모멘텀 sub-pane (Toss Blue #0064FF variants).
   MACD = EMA(12) - EMA(26) / signal = EMA(9 of MACD) / histogram = MACD - signal.
   Phase 2.2 후행 sub-agent가 EMA 정식 구현 + 3 line + histogram bar 정식 채울 예정.
*/
(function (root) {
  'use strict';

  function render(data, scale, opts = {}) {
    if (!data || !data.length) return '';
    const paneW = (opts.width || 1000);
    const paneH = (opts.height || 100);
    return `<g class="chart-indicator-macd-stub"><text x="${paneW / 2}" y="${paneH / 2}" font-size="9" fill="#0064FF" text-anchor="middle" opacity="0.5">MACD (Phase 2.2 후행 구현)</text></g>`;
  }

  root.ChartIndicatorMACD = { render };
})(typeof window !== 'undefined' ? window : this);
