/* ───── lib/chart/indicators/volume-profile-10.js — #1 매물대 10등분 side overlay (OFF default) ─────
   cycle22 Phase 2 — SPEC §2.2 + 대표 발화 18:43 verbatim "매물대 10등분".
   가격 범위 (hi-lo)를 10 bucket으로 분할 후 각 bucket 거래량 누적 = horizontal rect.
   햇살 톤 alpha rgba(196,153,48,0.3~0.6). 우측 side 영역에 표시.
*/
(function (root) {
  'use strict';

  function render(data, scale, opts = {}) {
    if (!data || data.length < 2) return '';
    const { paddingX, paddingY, innerW, innerH, y } = scale;
    const sideW = opts.sideW || 60;
    const mainW = opts.mainW || (paddingX + innerW + 50);
    const sideX = mainW - sideW; // 우측 정렬

    const closes = data.map(d => d.c);
    const lo = Math.min(...closes);
    const hi = Math.max(...closes);
    const span = hi - lo;
    if (span <= 0) return '';

    const N_BUCKET = 10;
    const buckets = new Array(N_BUCKET).fill(0);
    data.forEach(d => {
      if (!(d.v > 0)) return;
      const idx = Math.min(N_BUCKET - 1, Math.floor((d.c - lo) / span * N_BUCKET));
      buckets[idx] += d.v;
    });
    const maxBucketV = Math.max(...buckets);
    if (maxBucketV <= 0) return '';

    const bucketH = innerH / N_BUCKET;
    let rects = '';
    buckets.forEach((vol, i) => {
      if (vol <= 0) return;
      const bucketPriceMid = lo + (span * (i + 0.5) / N_BUCKET);
      const yMid = y(bucketPriceMid);
      const w = (vol / maxBucketV) * sideW;
      const alpha = 0.3 + (vol / maxBucketV) * 0.3; // 0.3 ~ 0.6
      rects += `<rect x="${sideX}" y="${(yMid - bucketH / 2 + 1).toFixed(1)}" width="${w.toFixed(1)}" height="${(bucketH - 2).toFixed(1)}" fill="rgba(196,153,48,${alpha.toFixed(2)})" stroke="#C49930" stroke-width="0.3"><title>매물대 ${Math.round(lo + span * i / N_BUCKET).toLocaleString()} ~ ${Math.round(lo + span * (i + 1) / N_BUCKET).toLocaleString()}</title></rect>`;
    });
    return `<g class="chart-indicator-volume-profile-10">${rects}</g>`;
  }

  root.ChartIndicatorVolumeProfile10 = { render };
})(typeof window !== 'undefined' ? window : this);
