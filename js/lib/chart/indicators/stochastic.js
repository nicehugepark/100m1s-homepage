/* ───── lib/chart/indicators/stochastic.js — #11 Stochastic sub-pane (OFF default) ─────
   cycle22 Phase 2.2 — SPEC §2.2 / WebSearch corroborating ≥5건 (StockCharts / strike.money /
   Fidelity / Wikipedia / Corporate Finance Institute).

   본질 공식 (lead-meta §11.15 외부 spec 사전 검증 PASS):
   - Fast Stochastic (표준 default):
     %K = (close - LL_14) / (HH_14 - LL_14) * 100
     %D = SMA(3, %K)
   - 본 사이클 채택 = (14, 3) Fast Stochastic — SPEC §2.2 "Stochastic %K 14 + %D 3" verbatim 정합.
     (영웅문 default 변형 5/3/3 Full Stochastic은 별건 P3, 현 사이클은 표준 14/3 채택)

   20/80 overbought/oversold reference line (StockCharts 표준).

   색상 (SPEC §3.1 모멘텀 = Toss Blue variants):
   - %K = #0064FF
   - %D = #4D8BFF dashed
   - 20/80 reference = #C49930 햇살 톤 dashed
*/
(function (root) {
  'use strict';

  const K_PERIOD = 14;
  const D_PERIOD = 3;

  function calculate(data) {
    const N = data.length;
    const k = new Array(N).fill(null);
    const d = new Array(N).fill(null);
    if (N < K_PERIOD) return { k, d };

    for (let i = K_PERIOD - 1; i < N; i++) {
      let hh = -Infinity, ll = Infinity;
      let valid = true;
      for (let j = i - K_PERIOD + 1; j <= i; j++) {
        const dt = data[j];
        if (!dt || !(dt.h > 0) || !(dt.l > 0) || !(dt.c > 0)) { valid = false; break; }
        if (dt.h > hh) hh = dt.h;
        if (dt.l < ll) ll = dt.l;
      }
      if (!valid) continue;
      const span = hh - ll;
      if (span <= 0) { k[i] = 50; continue; } // 점상 케이스 = 중립 50
      k[i] = ((data[i].c - ll) / span) * 100;
    }
    // %D = SMA(3, %K)
    for (let i = K_PERIOD - 1 + (D_PERIOD - 1); i < N; i++) {
      let sum = 0;
      let cnt = 0;
      for (let j = i - D_PERIOD + 1; j <= i; j++) {
        if (k[j] != null) { sum += k[j]; cnt++; }
      }
      if (cnt === D_PERIOD) d[i] = sum / D_PERIOD;
    }
    return { k, d };
  }

  function render(data, scale, opts = {}) {
    const paneW = opts.width || 1000;
    const paneH = opts.height || 100;
    if (!data || data.length < K_PERIOD + D_PERIOD - 1) {
      return `<g class="chart-indicator-stochastic-insufficient"><text x="${paneW / 2}" y="${paneH / 2}" font-size="10" fill="#8B95A8" text-anchor="middle">Stochastic 데이터 누적 중 (≥ ${K_PERIOD + D_PERIOD - 1}일 필요)</text></g>`;
    }
    const { k, d } = calculate(data);
    const paddingY = 4;
    const innerH = paneH - paddingY * 2;
    const paddingX = scale.paddingX;
    const slot = scale.slot;
    const y = v => paddingY + innerH * (1 - v / 100);

    // 20/80 reference
    const ref20 = `<line x1="${paddingX}" x2="${paddingX + slot * data.length}" y1="${y(20).toFixed(1)}" y2="${y(20).toFixed(1)}" stroke="#C49930" stroke-width="0.5" stroke-dasharray="3 2" opacity="0.5"/>`;
    const ref80 = `<line x1="${paddingX}" x2="${paddingX + slot * data.length}" y1="${y(80).toFixed(1)}" y2="${y(80).toFixed(1)}" stroke="#C49930" stroke-width="0.5" stroke-dasharray="3 2" opacity="0.5"/>`;
    const ref50 = `<line x1="${paddingX}" x2="${paddingX + slot * data.length}" y1="${y(50).toFixed(1)}" y2="${y(50).toFixed(1)}" stroke="#8B95A8" stroke-width="0.3" stroke-dasharray="2 2" opacity="0.4"/>`;
    const t20 = `<text x="${(paddingX + slot * data.length - 4).toFixed(1)}" y="${(y(20) - 2).toFixed(1)}" font-size="8" fill="#C49930" text-anchor="end" opacity="0.7">20</text>`;
    const t80 = `<text x="${(paddingX + slot * data.length - 4).toFixed(1)}" y="${(y(80) - 2).toFixed(1)}" font-size="8" fill="#C49930" text-anchor="end" opacity="0.7">80</text>`;

    // %K + %D
    const ptsK = [];
    const ptsD = [];
    for (let i = 0; i < data.length; i++) {
      const xc = paddingX + slot * (i + 0.5);
      if (k[i] != null) ptsK.push(`${xc.toFixed(1)},${y(k[i]).toFixed(1)}`);
      if (d[i] != null) ptsD.push(`${xc.toFixed(1)},${y(d[i]).toFixed(1)}`);
    }
    const kLine = ptsK.length >= 2
      ? `<polyline points="${ptsK.join(' ')}" fill="none" stroke="#0064FF" stroke-width="1.1"/>` : '';
    const dLine = ptsD.length >= 2
      ? `<polyline points="${ptsD.join(' ')}" fill="none" stroke="#4D8BFF" stroke-width="1.0" stroke-dasharray="3 1"/>` : '';

    return `<g class="chart-indicator-stochastic">${ref20}${ref50}${ref80}${t20}${t80}${dLine}${kLine}</g>`;
  }

  root.ChartIndicatorStochastic = { render, calculate };
})(typeof window !== 'undefined' ? window : this);
