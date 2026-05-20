/* ───── lib/chart/indicators/obv.js — #13 OBV sub-pane (OFF default) ─────
   cycle22 Phase 2.2 — SPEC §2.2 / WebSearch corroborating ≥5건 (Fidelity / Wikipedia /
   TC2000 / strike.money / WealthCharts / CorporateFinanceInstitute / WallStreetOasis).

   본질 공식 (lead-meta §11.15 외부 spec 사전 검증 PASS):
   - OBV[0] = 0 (관례적 시작점)
   - close[t] > close[t-1] → OBV[t] = OBV[t-1] + volume[t]
   - close[t] < close[t-1] → OBV[t] = OBV[t-1] - volume[t]
   - close[t] == close[t-1] → OBV[t] = OBV[t-1] (변경 없음)

   본 line 누적 거래량 폴리라인 — sub-pane 자체 scale.

   색상 (SPEC §3.1 시장강도 = --dm grey #8B95A8 variants):
   - OBV line = #6B7A99 (darker variant, 가독성 ↑)
*/
(function (root) {
  'use strict';

  function calculate(data) {
    const N = data.length;
    const obv = new Array(N).fill(0);
    if (N < 2) return obv;
    for (let i = 1; i < N; i++) {
      const prev = data[i - 1];
      const cur = data[i];
      const v = cur && cur.v > 0 ? cur.v : 0;
      if (!cur || !prev || cur.c == null || prev.c == null) {
        obv[i] = obv[i - 1];
        continue;
      }
      if (cur.c > prev.c) obv[i] = obv[i - 1] + v;
      else if (cur.c < prev.c) obv[i] = obv[i - 1] - v;
      else obv[i] = obv[i - 1];
    }
    return obv;
  }

  function render(data, scale, opts = {}) {
    const paneW = opts.width || 1000;
    const paneH = opts.height || 100;
    if (!data || data.length < 2) {
      return `<g class="chart-indicator-obv-insufficient"><text x="${paneW / 2}" y="${paneH / 2}" font-size="10" fill="#8B95A8" text-anchor="middle">OBV 데이터 누적 중 (≥ 2일 필요)</text></g>`;
    }
    const obv = calculate(data);
    const paddingY = 4;
    const innerH = paneH - paddingY * 2;
    const paddingX = scale.paddingX;
    const slot = scale.slot;
    const lo = Math.min(...obv);
    const hi = Math.max(...obv);
    const span = (hi - lo) || 1;
    const y = v => paddingY + innerH * (1 - (v - lo) / span);
    const yZero = lo <= 0 && hi >= 0 ? y(0) : null;

    // zero line (lo/hi가 0을 포함할 때만)
    let zeroLine = '';
    if (yZero != null) {
      zeroLine = `<line x1="${paddingX}" x2="${paddingX + slot * data.length}" y1="${yZero.toFixed(1)}" y2="${yZero.toFixed(1)}" stroke="#8B95A8" stroke-width="0.3" stroke-dasharray="2 2" opacity="0.4"/>`;
    }

    // OBV line
    const pts = [];
    for (let i = 0; i < data.length; i++) {
      const xc = paddingX + slot * (i + 0.5);
      pts.push(`${xc.toFixed(1)},${y(obv[i]).toFixed(1)}`);
    }
    const obvLine = pts.length >= 2
      ? `<polyline points="${pts.join(' ')}" fill="none" stroke="#6B7A99" stroke-width="1.1"/>` : '';

    return `<g class="chart-indicator-obv">${zeroLine}${obvLine}</g>`;
  }

  root.ChartIndicatorOBV = { render, calculate };
})(typeof window !== 'undefined' ? window : this);
