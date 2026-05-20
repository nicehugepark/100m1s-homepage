/* ───── lib/chart/indicators/volume-bars.js — #10 거래량 막대 sub-pane (default ON) ─────
   cycle22 Phase 2 — SPEC §2.2 + §3.1 시장강도 sub-pane = --dm grey scale.

   본질: 일별 거래량 raw value rect bar. 양봉 일자 = --pos / 음봉 일자 = --neg 색상 (저강도 alpha).
   별도 sub-pane scale (max volume = pane height fit).
*/
(function (root) {
  'use strict';

  function render(data, scale, opts = {}) {
    if (!data || !data.length) return '';
    const { paddingX, slot } = scale;
    const paneH = opts.height || 100;
    const paneW = opts.width || 1000;
    const paddingY = 4;
    const innerH = paneH - paddingY * 2;
    const volumes = data.map(d => d.v).filter(v => v > 0);
    if (!volumes.length) return '<g class="chart-indicator-volume-empty"></g>';
    const maxV = Math.max(...volumes);
    const bodyW = Math.max(1, slot * 0.65);

    const bars = data.map((d, i) => {
      if (!(d.v > 0)) return '';
      const xc = paddingX + slot * (i + 0.5);
      const xBar = xc - bodyW / 2;
      const h = (d.v / maxV) * innerH;
      const yBar = paddingY + innerH - h;
      const isUp = d.c > d.o;
      const isFlat = d.c === d.o;
      const color = isFlat ? '#94A3B8' : (isUp ? '#C53939' : '#1958C7');
      return `<rect x="${xBar.toFixed(1)}" y="${yBar.toFixed(1)}" width="${bodyW.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}" fill-opacity="0.55"/>`;
    }).join('');

    return `<g class="chart-indicator-volume">${bars}</g>`;
  }

  root.ChartIndicatorVolumeBars = { render };
})(typeof window !== 'undefined' ? window : this);
