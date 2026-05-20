/* ───── lib/chart/indicators/volume-profile.js — #12 Volume Profile continuous side (OFF default) ─────
   cycle22 Phase 2 — SPEC §2.2 + REQ §7.4 대표 결정 A "둘 다 유지" (#1과 별건).
   가격 범위를 30 bucket continuous로 분할, POC (가장 큰 bucket) 강조.
   Phase 2.2 후행 sub-agent가 VAH/VAL Value Area 70% 정식 채울 예정.

   본 단발 = 30 bucket continuous render + POC 강조 1줄.
*/
(function (root) {
  'use strict';

  function render(data, scale, opts = {}) {
    if (!data || data.length < 2) return '';
    const { paddingX, paddingY, innerW, innerH, y } = scale;
    const sideW = opts.sideW || 60;
    const mainW = opts.mainW || (paddingX + innerW + 50);
    const sideX = mainW - sideW;

    const closes = data.map(d => d.c);
    const lo = Math.min(...closes);
    const hi = Math.max(...closes);
    const span = hi - lo;
    if (span <= 0) return '';

    const N = 30;
    const buckets = new Array(N).fill(0);
    data.forEach(d => {
      if (!(d.v > 0)) return;
      const idx = Math.min(N - 1, Math.floor((d.c - lo) / span * N));
      buckets[idx] += d.v;
    });
    const maxV = Math.max(...buckets);
    if (maxV <= 0) return '';
    const pocIdx = buckets.indexOf(maxV);

    const bucketH = innerH / N;
    let rects = '';
    buckets.forEach((vol, i) => {
      if (vol <= 0) return;
      const bucketPriceMid = lo + (span * (i + 0.5) / N);
      const yMid = y(bucketPriceMid);
      const w = (vol / maxV) * sideW;
      const isPOC = (i === pocIdx);
      const fill = isPOC ? '#C49930' : `rgba(196,153,48,${(0.2 + (vol / maxV) * 0.4).toFixed(2)})`;
      rects += `<rect x="${(sideX + 1).toFixed(1)}" y="${(yMid - bucketH / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${bucketH.toFixed(1)}" fill="${fill}" stroke="${isPOC ? '#A8821D' : 'none'}" stroke-width="${isPOC ? 0.5 : 0}"/>`;
    });
    return `<g class="chart-indicator-volume-profile">${rects}</g>`;
  }

  root.ChartIndicatorVolumeProfile = { render };
})(typeof window !== 'undefined' ? window : this);
