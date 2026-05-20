/* ───── lib/chart/indicators/ex-dividend.js — #6 배당락 marker (default ON) ─────
   cycle22 Phase 2 — SPEC §2.2 + §3.1 배당락 = --neu (#6B7A99 회색, 이벤트 중립).

   본질: 배당락일에 차트 위 작은 ⓓ marker (둥근 사각형 + 텍스트).
   입력 = opts.exDividendDates (string[] YYYY-MM-DD). 데이터 부재 시 빈 render.
   본 단발 = render 구조만 (date 입력은 후행 backend dailybars 또는 별건 데이터 채널).
*/
(function (root) {
  'use strict';

  function render(data, scale, opts = {}) {
    if (!data || !data.length) return '';
    const dates = Array.isArray(opts.exDividendDates) ? opts.exDividendDates : [];
    if (!dates.length) return '';
    const { paddingX, paddingY, slot } = scale;
    const markers = data.map((d, i) => {
      if (!dates.includes(d.date)) return '';
      const xc = paddingX + slot * (i + 0.5);
      const yMark = paddingY + 12;
      return `<g class="chart-ex-dividend-marker"><circle cx="${xc.toFixed(1)}" cy="${yMark}" r="6" fill="#6B7A99"/><text x="${xc.toFixed(1)}" y="${yMark + 0.5}" font-size="8" fill="#fff" text-anchor="middle" dominant-baseline="middle" font-weight="700">D</text><title>배당락 ${d.date}</title></g>`;
    }).join('');
    return `<g class="chart-indicator-ex-dividend">${markers}</g>`;
  }

  root.ChartIndicatorExDividend = { render };
})(typeof window !== 'undefined' ? window : this);
