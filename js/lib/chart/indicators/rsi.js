/* ───── lib/chart/indicators/rsi.js — #9 RSI sub-pane (OFF default) ─────
   cycle22 Phase 2.2 — SPEC §2.2 / WebSearch corroborating ≥4건 (StockCharts / TC2000 /
   Supra Docs / Macroption / blog.quantinsti / OANDA / algotradinglib).

   본질 공식 (lead-meta §11.15 외부 spec 사전 검증 PASS):
   1. chg[t] = close[t] - close[t-1]
   2. gain[t] = max(chg, 0), loss[t] = max(-chg, 0)
   3. First AvgGain/AvgLoss (i = period) = mean of first `period` gains/losses
   4. Wilder smoothing (i > period):
      AvgGain[t] = (AvgGain[t-1] * (period-1) + gain[t]) / period
      AvgLoss[t] = (AvgLoss[t-1] * (period-1) + loss[t]) / period
   5. RS = AvgGain / AvgLoss (AvgLoss == 0 → RSI = 100)
   6. RSI = 100 - 100 / (1 + RS)

   색상 (SPEC §3.1 모멘텀 sub-pane = Toss Blue variants):
   - RSI line = #0064FF
   - 30/70 reference line = #C49930 dashed (햇살 톤)
*/
(function (root) {
  'use strict';

  const PERIOD = 14;

  function calculate(data) {
    const N = data.length;
    const rsi = new Array(N).fill(null);
    if (N < PERIOD + 1) return rsi;

    // chg series
    const gains = new Array(N).fill(0);
    const losses = new Array(N).fill(0);
    for (let i = 1; i < N; i++) {
      const chg = data[i].c - data[i - 1].c;
      gains[i] = Math.max(0, chg);
      losses[i] = Math.max(0, -chg);
    }
    // first SMA (index PERIOD using gains[1..PERIOD])
    let sumG = 0, sumL = 0;
    for (let i = 1; i <= PERIOD; i++) {
      sumG += gains[i];
      sumL += losses[i];
    }
    let avgG = sumG / PERIOD;
    let avgL = sumL / PERIOD;
    rsi[PERIOD] = avgL === 0 ? 100 : (100 - 100 / (1 + avgG / avgL));
    // Wilder smoothing for subsequent
    for (let i = PERIOD + 1; i < N; i++) {
      avgG = (avgG * (PERIOD - 1) + gains[i]) / PERIOD;
      avgL = (avgL * (PERIOD - 1) + losses[i]) / PERIOD;
      rsi[i] = avgL === 0 ? 100 : (100 - 100 / (1 + avgG / avgL));
    }
    return rsi;
  }

  function render(data, scale, opts = {}) {
    const paneW = opts.width || 1000;
    const paneH = opts.height || 100;
    if (!data || data.length < PERIOD + 1) {
      return `<g class="chart-indicator-rsi-insufficient"><text x="${paneW / 2}" y="${paneH / 2}" font-size="10" fill="#8B95A8" text-anchor="middle">RSI 데이터 누적 중 (≥ ${PERIOD + 1}일 필요)</text></g>`;
    }
    const rsi = calculate(data);
    const paddingY = 4;
    const innerH = paneH - paddingY * 2;
    const paddingX = scale.paddingX;
    const slot = scale.slot;
    // RSI scale 0~100 고정
    const y = v => paddingY + innerH * (1 - v / 100);

    // 30/70 reference + 50 midline
    const ref30 = `<line x1="${paddingX}" x2="${paddingX + slot * data.length}" y1="${y(30).toFixed(1)}" y2="${y(30).toFixed(1)}" stroke="#C49930" stroke-width="0.5" stroke-dasharray="3 2" opacity="0.5"/>`;
    const ref70 = `<line x1="${paddingX}" x2="${paddingX + slot * data.length}" y1="${y(70).toFixed(1)}" y2="${y(70).toFixed(1)}" stroke="#C49930" stroke-width="0.5" stroke-dasharray="3 2" opacity="0.5"/>`;
    const ref50 = `<line x1="${paddingX}" x2="${paddingX + slot * data.length}" y1="${y(50).toFixed(1)}" y2="${y(50).toFixed(1)}" stroke="#8B95A8" stroke-width="0.3" stroke-dasharray="2 2" opacity="0.4"/>`;
    const t30 = `<text x="${(paddingX + slot * data.length - 4).toFixed(1)}" y="${(y(30) - 2).toFixed(1)}" font-size="8" fill="#C49930" text-anchor="end" opacity="0.7">30</text>`;
    const t70 = `<text x="${(paddingX + slot * data.length - 4).toFixed(1)}" y="${(y(70) - 2).toFixed(1)}" font-size="8" fill="#C49930" text-anchor="end" opacity="0.7">70</text>`;

    // RSI line
    const pts = [];
    for (let i = 0; i < data.length; i++) {
      if (rsi[i] == null) continue;
      const xc = paddingX + slot * (i + 0.5);
      pts.push(`${xc.toFixed(1)},${y(rsi[i]).toFixed(1)}`);
    }
    const rsiLine = pts.length >= 2
      ? `<polyline points="${pts.join(' ')}" fill="none" stroke="#0064FF" stroke-width="1.1"/>` : '';

    return `<g class="chart-indicator-rsi">${ref30}${ref50}${ref70}${t30}${t70}${rsiLine}</g>`;
  }

  root.ChartIndicatorRSI = { render, calculate };
})(typeof window !== 'undefined' ? window : this);
