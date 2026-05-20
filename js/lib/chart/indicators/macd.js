/* ───── lib/chart/indicators/macd.js — #8 MACD sub-pane (OFF default) ─────
   cycle22 Phase 2.2 — SPEC §2.2 / WebSearch corroborating ≥4건 (Wikipedia / StockCharts /
   altfins / OANDA / forextester).

   본질 공식 (lead-meta §11.15 외부 spec 사전 검증 PASS):
   - MACD line = EMA(12, close) - EMA(26, close)
   - signal line = EMA(9, MACD line)
   - histogram = MACD line - signal line

   EMA(N, x) = α·x[t] + (1-α)·EMA[t-1],  α = 2/(N+1)
   초기값 = SMA(N) (표준 관례).

   색상 (SPEC §3.1 모멘텀 = Toss Blue #0064FF variants):
   - MACD line = #0064FF (base)
   - signal    = #4D8BFF (lighter)
   - histogram = pos(#C53939 한국 양봉) / neg(#1958C7 한국 음봉)
*/
(function (root) {
  'use strict';

  const FAST = 12;
  const SLOW = 26;
  const SIGNAL = 9;

  /** EMA(N, x) — 표준 EMA. SMA 초기값 + α = 2/(N+1) smoothing. */
  function ema(values, period) {
    const N = values.length;
    const out = new Array(N).fill(null);
    if (N < period) return out;
    const alpha = 2 / (period + 1);
    // 초기값 = SMA(첫 period)
    let sum = 0;
    let validCount = 0;
    for (let i = 0; i < period; i++) {
      if (values[i] == null || isNaN(values[i])) return out; // null 함유 시 abort
      sum += values[i];
      validCount++;
    }
    if (validCount < period) return out;
    out[period - 1] = sum / period;
    for (let i = period; i < N; i++) {
      if (values[i] == null) { out[i] = out[i - 1]; continue; }
      out[i] = alpha * values[i] + (1 - alpha) * out[i - 1];
    }
    return out;
  }

  function calculate(data) {
    const closes = data.map(d => d.c);
    const fastEma = ema(closes, FAST);
    const slowEma = ema(closes, SLOW);
    const N = data.length;
    const macd = new Array(N).fill(null);
    for (let i = 0; i < N; i++) {
      if (fastEma[i] != null && slowEma[i] != null) {
        macd[i] = fastEma[i] - slowEma[i];
      }
    }
    // signal = EMA(9, macd) — null prefix 스킵
    const firstValid = macd.findIndex(v => v != null);
    let signal = new Array(N).fill(null);
    if (firstValid >= 0) {
      const slice = macd.slice(firstValid).map(v => v == null ? 0 : v);
      const sigSlice = ema(slice, SIGNAL);
      sigSlice.forEach((v, k) => {
        if (v != null) signal[firstValid + k] = v;
      });
    }
    const histogram = new Array(N).fill(null);
    for (let i = 0; i < N; i++) {
      if (macd[i] != null && signal[i] != null) {
        histogram[i] = macd[i] - signal[i];
      }
    }
    return { macd, signal, histogram };
  }

  function render(data, scale, opts = {}) {
    if (!data || data.length < SLOW + SIGNAL) {
      // 데이터 부족 placeholder
      const paneW = opts.width || 1000;
      const paneH = opts.height || 100;
      return `<g class="chart-indicator-macd-insufficient"><text x="${paneW / 2}" y="${paneH / 2}" font-size="10" fill="#8B95A8" text-anchor="middle">MACD 데이터 누적 중 (≥ ${SLOW + SIGNAL}일 필요)</text></g>`;
    }
    const { macd, signal, histogram } = calculate(data);
    const paneW = opts.width || 1000;
    const paneH = opts.height || 100;
    const paddingY = 4;
    const innerH = paneH - paddingY * 2;
    const paddingX = scale.paddingX;
    const slot = scale.slot;

    // 자체 sub-pane scale (MACD/histogram min~max range).
    const allVals = [];
    macd.forEach(v => v != null && allVals.push(v));
    signal.forEach(v => v != null && allVals.push(v));
    histogram.forEach(v => v != null && allVals.push(v));
    if (!allVals.length) return '';
    const lo = Math.min(...allVals);
    const hi = Math.max(...allVals);
    const span = (hi - lo) || 1;
    const y = v => paddingY + innerH * (1 - (v - lo) / span);
    const yZero = y(0);

    // histogram bar (zero line 기준 양/음)
    const bodyW = Math.max(1, slot * 0.55);
    let bars = '';
    histogram.forEach((v, i) => {
      if (v == null) return;
      const xc = paddingX + slot * (i + 0.5);
      const xBar = xc - bodyW / 2;
      const yVal = y(v);
      const yTop = Math.min(yVal, yZero);
      const h = Math.max(0.5, Math.abs(yVal - yZero));
      const color = v >= 0 ? '#C53939' : '#1958C7';
      bars += `<rect x="${xBar.toFixed(1)}" y="${yTop.toFixed(1)}" width="${bodyW.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}" fill-opacity="0.45"/>`;
    });

    // MACD line + signal line polylines
    const ptsMACD = [];
    const ptsSig = [];
    for (let i = 0; i < data.length; i++) {
      if (macd[i] != null) {
        const xc = paddingX + slot * (i + 0.5);
        ptsMACD.push(`${xc.toFixed(1)},${y(macd[i]).toFixed(1)}`);
      }
      if (signal[i] != null) {
        const xc = paddingX + slot * (i + 0.5);
        ptsSig.push(`${xc.toFixed(1)},${y(signal[i]).toFixed(1)}`);
      }
    }
    const macdLine = ptsMACD.length >= 2
      ? `<polyline points="${ptsMACD.join(' ')}" fill="none" stroke="#0064FF" stroke-width="1.1"/>` : '';
    const sigLine = ptsSig.length >= 2
      ? `<polyline points="${ptsSig.join(' ')}" fill="none" stroke="#4D8BFF" stroke-width="1.0" stroke-dasharray="3 1"/>` : '';
    // zero line
    const zeroLine = `<line x1="${paddingX}" x2="${paddingX + (slot * data.length)}" y1="${yZero.toFixed(1)}" y2="${yZero.toFixed(1)}" stroke="#8B95A8" stroke-width="0.4" stroke-dasharray="2 2" opacity="0.5"/>`;

    return `<g class="chart-indicator-macd">${zeroLine}${bars}${sigLine}${macdLine}</g>`;
  }

  root.ChartIndicatorMACD = { render, calculate, ema };
})(typeof window !== 'undefined' ? window : this);
