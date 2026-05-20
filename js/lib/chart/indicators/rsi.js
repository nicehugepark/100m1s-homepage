/* ───── lib/chart/indicators/rsi.js — #9 RSI sub-pane (OFF default) ─────
   cycle22 Phase 2 stub — SPEC §2.2 / 모멘텀 sub-pane.
   RSI(14) = 100 - 100/(1+RS), RS = avg gain / avg loss (Wilder smoothing).
   Phase 2.2 후행 정식 구현. 30/70 horizontal line 표준.
*/
(function (root) {
  'use strict';

  function render(data, scale, opts = {}) {
    if (!data || !data.length) return '';
    const paneW = (opts.width || 1000);
    const paneH = (opts.height || 100);
    return `<g class="chart-indicator-rsi-stub"><line x1="0" x2="${paneW}" y1="${paneH * 0.3}" y2="${paneH * 0.3}" stroke="#0064FF" stroke-dasharray="3 2" opacity="0.4"/><line x1="0" x2="${paneW}" y1="${paneH * 0.7}" y2="${paneH * 0.7}" stroke="#0064FF" stroke-dasharray="3 2" opacity="0.4"/><text x="${paneW / 2}" y="${paneH / 2}" font-size="9" fill="#0064FF" text-anchor="middle" opacity="0.5">RSI (Phase 2.2 후행 구현)</text></g>`;
  }

  root.ChartIndicatorRSI = { render };
})(typeof window !== 'undefined' ? window : this);
