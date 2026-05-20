/* ───── lib/chart/indicators/ma.js — #4 이동평균선 overlay (default ON) ─────
   cycle22 Phase 2 — SPEC §2.2 + DSN §3.6.6 / WebSearch SMA 표준 공식 verbatim.

   본질: SMA = sum(close[last N]) / N. N data point 누적되면 line 시작 (이전은 null skip).
   햇살 톤 명도 단계 (5=#C49930 / 20=#E8C063 / 60=#FBE9B5 / 120=#FFF6E5).
   모바일 default = 5/20만 표시. 데스크탑 = 5/20/60/120 4종.
*/
(function (root) {
  'use strict';

  const COLORS = {
    5: '#C49930',
    20: '#E8C063',
    60: '#D4A857', // 명도 보정 — FBE9B5는 너무 흐림 → 가시 ↑
    120: '#A88639', // 명도 보정
  };

  function calculateSMA(data, period) {
    const result = new Array(data.length).fill(null);
    if (data.length < period) return result;
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i].c;
    }
    result[period - 1] = sum / period;
    for (let i = period; i < data.length; i++) {
      sum = sum - data[i - period].c + data[i].c;
      result[i] = sum / period;
    }
    return result;
  }

  function buildPolyline(data, smaArr, scale, color, label) {
    const { paddingX, slot, y } = scale;
    const pts = [];
    smaArr.forEach((val, i) => {
      if (val == null) return;
      const xc = paddingX + slot * (i + 0.5);
      pts.push(`${xc.toFixed(1)},${y(val).toFixed(1)}`);
    });
    if (pts.length < 2) return '';
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.2" data-ma="${label}" />`;
  }

  function render(data, scale, opts = {}) {
    if (!data || !data.length) return '';
    const isMobile = window.innerWidth <= 768;
    const periods = isMobile ? [5, 20] : [5, 20, 60, 120];
    let svg = '<g class="chart-indicator-ma">';
    periods.forEach(p => {
      const sma = calculateSMA(data, p);
      svg += buildPolyline(data, sma, scale, COLORS[p], `MA${p}`);
    });
    svg += '</g>';
    return svg;
  }

  root.ChartIndicatorMA = { render, calculateSMA };
})(typeof window !== 'undefined' ? window : this);
