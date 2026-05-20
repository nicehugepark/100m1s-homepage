/* ───── lib/chart/indicators/obv.js — #13 OBV sub-pane (OFF default) ─────
   cycle22 Phase 2 stub — SPEC §2.2 / 시장강도 sub-pane.
   OBV = cumulative (close > prev_close ? +volume : (close < prev_close ? -volume : 0)).
   Phase 2.2 후행 정식 구현.
*/
(function (root) {
  'use strict';

  function render(data, scale, opts = {}) {
    if (!data || !data.length) return '';
    const paneW = (opts.width || 1000);
    const paneH = (opts.height || 100);
    return `<g class="chart-indicator-obv-stub"><text x="${paneW / 2}" y="${paneH / 2}" font-size="9" fill="#8B95A8" text-anchor="middle" opacity="0.5">OBV (Phase 2.2 후행 구현)</text></g>`;
  }

  root.ChartIndicatorOBV = { render };
})(typeof window !== 'undefined' ? window : this);
