/* ───── lib/chart/indicators/ichimoku.js — #5 일목균형표 overlay (OFF default) ─────
   cycle22 Phase 2.2 — SPEC §2.2 / DSN §3.6.6 / WebSearch corroborating ≥4건
   (Wikipedia / NAGA / MetricGate / heygotrade / Forex Factory).

   본질 공식 (lead-meta §11.15 외부 spec 사전 검증 PASS):
   - Tenkan-sen (전환선, 9): (HH_9 + LL_9) / 2
   - Kijun-sen  (기준선, 26): (HH_26 + LL_26) / 2
   - Senkou Span A (선행스팬1): (Tenkan + Kijun) / 2, +26 forward shift
   - Senkou Span B (선행스팬2, 52): (HH_52 + LL_52) / 2, +26 forward shift
   - Chikou Span (후행스팬): close, -26 backward shift
   - Cloud (Kumo): Senkou A vs B 사이 영역 fill (A>B → 상승구름 pos-bg / B>A → 하락구름 neg-bg)

   색상 (SPEC §3.1 햇살 톤 variants):
   - 전환선 = #C49930 (am base)
   - 기준선 = #A88639 (am dark)
   - 선행스팬 A·B = stroke #D4A857 / #FBE9B5
   - 후행스팬 = #8B95A8 (dm grey, 과거 마커 의미)
   - cloud fill: 상승=rgba(26,107,45,0.15) 하락=rgba(184,48,46,0.12)

   특정 종목 hardcoding 0건 (전 종목 일반 공식, rules/data-continuity L46 정합).
*/
(function (root) {
  'use strict';

  const TENKAN = 9;
  const KIJUN = 26;
  const SENKOU_B = 52;
  const SHIFT = 26;

  /** HH/LL midpoint for window ending at index i (inclusive). null if insufficient. */
  function midHL(data, i, period) {
    if (i + 1 < period) return null;
    let hh = -Infinity, ll = Infinity;
    for (let k = i - period + 1; k <= i; k++) {
      const d = data[k];
      if (!d || !(d.h > 0) || !(d.l > 0)) return null;
      if (d.h > hh) hh = d.h;
      if (d.l < ll) ll = d.l;
    }
    return (hh + ll) / 2;
  }

  function calculate(data) {
    const N = data.length;
    const tenkan = new Array(N).fill(null);
    const kijun = new Array(N).fill(null);
    // senkou A/B는 +26 forward shift이므로 plot index = source index + SHIFT.
    // 본 사이클 = 가시 영역 (data 범위 내)만 표시. 미래 26 영역 (data 범위 외)는 plot 생략 (240영업일 chart에 미래 빈 공간 추가 회피 — UX 부담).
    const senkouA = new Array(N).fill(null);
    const senkouB = new Array(N).fill(null);
    const chikou = new Array(N).fill(null);

    for (let i = 0; i < N; i++) {
      tenkan[i] = midHL(data, i, TENKAN);
      kijun[i] = midHL(data, i, KIJUN);
      // senkou A/B는 source 위치 (i - SHIFT). plot index i.
      const srcA = i - SHIFT;
      if (srcA >= 0 && tenkan[srcA] != null && kijun[srcA] != null) {
        senkouA[i] = (tenkan[srcA] + kijun[srcA]) / 2;
      }
      const srcB = i - SHIFT;
      if (srcB >= 0) {
        const v = midHL(data, srcB, SENKOU_B);
        if (v != null) senkouB[i] = v;
      }
      // chikou = close shifted -26 (i.e., plot at index i, value = close[i + 26]).
      const fwdIdx = i + SHIFT;
      if (fwdIdx < N && data[fwdIdx] && data[fwdIdx].c > 0) {
        chikou[i] = data[fwdIdx].c;
      }
    }
    return { tenkan, kijun, senkouA, senkouB, chikou };
  }

  function buildPolyline(arr, scale, color, width = 1.0, dash = '') {
    const { paddingX, slot, y } = scale;
    const pts = [];
    arr.forEach((val, i) => {
      if (val == null) return;
      const xc = paddingX + slot * (i + 0.5);
      pts.push(`${xc.toFixed(1)},${y(val).toFixed(1)}`);
    });
    if (pts.length < 2) return '';
    const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="${width}"${dashAttr}/>`;
  }

  function buildCloud(senkouA, senkouB, scale) {
    const { paddingX, slot, y } = scale;
    const N = senkouA.length;
    // 구간별 (A>B 상승구름, B>A 하락구름) path 분리 fill.
    // 인접 segment 단위로 polygon 생성.
    let svg = '';
    let segStart = null;
    let segType = null; // 'up' | 'down'

    const flush = (end) => {
      if (segStart == null || segType == null) return;
      const aPts = [];
      const bPts = [];
      for (let k = segStart; k <= end; k++) {
        if (senkouA[k] == null || senkouB[k] == null) continue;
        const xc = paddingX + slot * (k + 0.5);
        aPts.push(`${xc.toFixed(1)},${y(senkouA[k]).toFixed(1)}`);
        bPts.push(`${xc.toFixed(1)},${y(senkouB[k]).toFixed(1)}`);
      }
      if (aPts.length < 2) { segStart = null; segType = null; return; }
      // polygon = A forward + B reverse
      const polyPts = aPts.concat(bPts.reverse()).join(' ');
      const fill = (segType === 'up')
        ? 'rgba(197,57,57,0.12)'  // 한국 증시 관습: 상승=빨강 cloud (양봉 정합)
        : 'rgba(25,88,199,0.10)'; // 하락=파랑 cloud (음봉 정합)
      svg += `<polygon points="${polyPts}" fill="${fill}" stroke="none"/>`;
      segStart = null;
      segType = null;
    };

    for (let i = 0; i < N; i++) {
      const a = senkouA[i];
      const b = senkouB[i];
      if (a == null || b == null) { flush(i - 1); continue; }
      const cur = (a > b) ? 'up' : (a < b ? 'down' : segType);
      if (segStart == null) { segStart = i; segType = cur || 'up'; continue; }
      if (cur !== segType) {
        flush(i - 1);
        segStart = i;
        segType = cur;
      }
    }
    flush(N - 1);
    return svg;
  }

  function render(data, scale, opts = {}) {
    if (!data || data.length < TENKAN) return '';
    const { tenkan, kijun, senkouA, senkouB, chikou } = calculate(data);
    let svg = '<g class="chart-indicator-ichimoku">';
    // Cloud 먼저 (배경)
    svg += buildCloud(senkouA, senkouB, scale);
    // line
    svg += buildPolyline(tenkan, scale, '#C49930', 1.2);  // 전환선
    svg += buildPolyline(kijun, scale, '#A88639', 1.2);   // 기준선
    svg += buildPolyline(senkouA, scale, '#D4A857', 0.8, '4 2'); // 선행스팬 1
    svg += buildPolyline(senkouB, scale, '#FBE9B5', 0.8, '4 2'); // 선행스팬 2
    svg += buildPolyline(chikou, scale, '#8B95A8', 0.9);  // 후행스팬
    svg += '</g>';
    return svg;
  }

  root.ChartIndicatorIchimoku = { render, calculate };
})(typeof window !== 'undefined' ? window : this);
