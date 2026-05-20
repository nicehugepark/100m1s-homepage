/* ───── lib/chart/indicators/value-bars.js — #7 거래대금 sub-pane (OFF default) ─────
   cycle22 Phase 2 — SPEC §2.2 / 시장강도 sub-pane.
   거래대금 (KRW) = close × volume (raw). 일별 막대.
*/
(function (root) {
  'use strict';

  function render(data, scale, opts = {}) {
    if (!data || !data.length) return '';
    const { paddingX, slot } = scale;
    const paneH = opts.height || 100;
    const paddingY = 4;
    const innerH = paneH - paddingY * 2;
    const values = data.map(d => d.tv || (d.c * d.v) || 0).filter(v => v > 0);
    if (!values.length) return '<g class="chart-indicator-value-empty"></g>';
    const maxV = Math.max(...values);
    const bodyW = Math.max(1, slot * 0.65);
    const bars = data.map((d, i) => {
      const tv = d.tv || (d.c * d.v) || 0;
      if (!(tv > 0)) return '';
      const xc = paddingX + slot * (i + 0.5);
      const xBar = xc - bodyW / 2;
      const h = (tv / maxV) * innerH;
      const yBar = paddingY + innerH - h;
      return `<rect x="${xBar.toFixed(1)}" y="${yBar.toFixed(1)}" width="${bodyW.toFixed(1)}" height="${h.toFixed(1)}" fill="#8B95A8" fill-opacity="0.65"/>`;
    }).join('');
    return `<g class="chart-indicator-value-bars">${bars}</g>`;
  }

  root.ChartIndicatorValueBars = { render };
})(typeof window !== 'undefined' ? window : this);
