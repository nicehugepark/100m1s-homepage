/* ───── lib/chart/indicators/fibonacci.js — #3 피보나치 retracement overlay (OFF default) ─────
   cycle22 Phase 2 stub — SPEC §2.2 / DSN §3.6.6.
   38.2% / 50% / 61.8% horizontal line (recent swing high - low 기준).
   Phase 2.2 후행 sub-agent가 swing point detection + level rendering 구현.

   본 stub = 단순 high/low 기준 3 line (회귀 검증용 minimal impl).
*/
(function (root) {
  'use strict';

  const LEVELS = [0.382, 0.5, 0.618];

  function render(data, scale, opts = {}) {
    if (!data || data.length < 2) return '';
    const { paddingX, innerW, y } = scale;
    const closes = data.map(d => d.c);
    const hi = Math.max(...closes);
    const lo = Math.min(...closes);
    const span = hi - lo;
    if (span <= 0) return '';
    let lines = '';
    LEVELS.forEach(lv => {
      const price = hi - span * lv;
      const yy = y(price).toFixed(1);
      lines += `<line x1="${paddingX}" x2="${paddingX + innerW}" y1="${yy}" y2="${yy}" stroke="#C49930" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.6"/>`;
      lines += `<text x="${paddingX + innerW - 4}" y="${(parseFloat(yy) - 2).toFixed(1)}" font-size="8" fill="#C49930" text-anchor="end" opacity="0.7">${(lv * 100).toFixed(1)}%</text>`;
    });
    return `<g class="chart-indicator-fibonacci">${lines}</g>`;
  }

  root.ChartIndicatorFibonacci = { render };
})(typeof window !== 'undefined' ? window : this);
