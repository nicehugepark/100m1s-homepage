/* ───── lib/chart-tv/plugins/volume-profile.js — #12 Volume Profile continuous ISeriesPrimitive (TradingView v5) ─────
   cycle22 Phase 7b — SPEC DOC-20260520-SPEC-001 v6 §2.2.1 #12 + §3.1.2 색상 verbatim 정합.

   본질 (lead-meta §11.15 외부 spec 사전 검증 PASS):
   - TradingView Lightweight Charts v5 ISeriesPrimitive interface 구현
   - 매물대 10등분 (#1, volume-by-decile.js) = coarse-grain 10 bucket
   - Volume Profile continuous (본 모듈) = fine-grain 30 bucket + POC (Point Of Control) 강조
   - REQ §7.4 대표 결정 A "둘 다 유지" (#1과 별건) verbatim 정합
   - WebFetch corroborate (plugin-examples/volume-profile verbatim 패턴, 2026-05-21 04:47 KST PASS):
     "class VolumeProfile implements ISeriesPrimitive<Time>
      paneViews() { return this._paneViews; }
      updateAllViews() {...}
      VolumeProfileRenderer.draw with CanvasRenderingTarget2D"

   산식 (자체 SVG volume-profile.js verbatim 정합):
   - 가격 범위를 30 bucket continuous 분할
   - bucket별 거래량 누적
   - POC = max(buckets) bucket → 색 강조 + stroke

   색상 (SPEC v6 §3.1.2 + 자체 SVG L43-44 verbatim):
   - 일반 bucket fill = rgba(196,153,48, 0.2~0.6) — 햇살 톤 alpha
   - POC fill = #C49930 (solid) + stroke #A8821D 0.5px
*/

const N_BUCKET = 30;

const DEFAULT_OPTIONS = {
  fillColorBase: 'rgba(196,153,48,',
  pocFillColor: '#C49930',
  pocStrokeColor: '#A8821D',
  pocStrokeWidth: 0.5,
  sideWidthPx: 60,
  sideOffsetPx: 1,           // 매물대 10등분 (volume-by-decile)과 시각 분리 1px offset
  alphaMin: 0.2,
  alphaMax: 0.6,
};

function computeBuckets(candles) {
  if (!Array.isArray(candles) || candles.length < 2) return null;
  const closes = candles.map((c) => c.close).filter((v) => typeof v === 'number' && v > 0);
  if (closes.length < 2) return null;
  const lo = Math.min(...closes);
  const hi = Math.max(...closes);
  const span = hi - lo;
  if (span <= 0) return null;

  const buckets = new Array(N_BUCKET).fill(0);
  candles.forEach((c) => {
    if (!c || !(c._v > 0) || typeof c.close !== 'number') return;
    const idx = Math.min(N_BUCKET - 1, Math.floor((c.close - lo) / span * N_BUCKET));
    buckets[idx] += c._v;
  });
  const maxV = Math.max(...buckets);
  if (maxV <= 0) return null;
  const pocIdx = buckets.indexOf(maxV);

  const result = [];
  for (let i = 0; i < N_BUCKET; i++) {
    if (buckets[i] <= 0) continue;
    const priceMid = lo + (span * (i + 0.5) / N_BUCKET);
    const priceTop = lo + (span * (i + 1) / N_BUCKET);
    const priceBot = lo + (span * i / N_BUCKET);
    const ratio = buckets[i] / maxV;
    result.push({
      priceMid, priceTop, priceBot, ratio,
      volume: buckets[i],
      isPOC: (i === pocIdx),
    });
  }
  return result;
}

class VolumeProfileRenderer {
  constructor(primitive) {
    this._primitive = primitive;
  }

  draw(target) {
    const p = this._primitive;
    if (!p._buckets || p._buckets.length === 0) return;
    target.useBitmapCoordinateSpace((scope) => {
      this._drawImpl(scope);
    });
  }

  _drawImpl(scope) {
    const ctx = scope.context;
    const p = this._primitive;
    const opts = p._options;
    const series = p._series;
    if (!series) return;

    const sideW = opts.sideWidthPx * scope.horizontalPixelRatio;
    const chartWidthBitmap = scope.bitmapSize.width;
    const sideX = chartWidthBitmap - sideW + opts.sideOffsetPx * scope.horizontalPixelRatio;

    p._buckets.forEach((b) => {
      const yTop = series.priceToCoordinate(b.priceTop);
      const yBot = series.priceToCoordinate(b.priceBot);
      if (yTop == null || yBot == null) return;

      const yTopBitmap = yTop * scope.verticalPixelRatio;
      const yBotBitmap = yBot * scope.verticalPixelRatio;
      const bucketTop = Math.min(yTopBitmap, yBotBitmap);
      const bucketBot = Math.max(yTopBitmap, yBotBitmap);
      const bucketH = bucketBot - bucketTop;
      if (bucketH <= 0) return;

      const w = b.ratio * sideW;

      if (b.isPOC) {
        ctx.fillStyle = opts.pocFillColor;
        ctx.fillRect(sideX, bucketTop, w, bucketH);
        ctx.strokeStyle = opts.pocStrokeColor;
        ctx.lineWidth = opts.pocStrokeWidth * scope.verticalPixelRatio;
        ctx.strokeRect(sideX, bucketTop, w, bucketH);
      } else {
        const alpha = opts.alphaMin + b.ratio * (opts.alphaMax - opts.alphaMin);
        ctx.fillStyle = `${opts.fillColorBase}${alpha.toFixed(2)})`;
        ctx.fillRect(sideX, bucketTop, w, bucketH);
      }
    });
  }
}

class VolumeProfilePaneView {
  constructor(primitive) {
    this._primitive = primitive;
    this._renderer = new VolumeProfileRenderer(primitive);
  }

  zOrder() {
    return 'top';
  }

  renderer() {
    return this._renderer;
  }

  update() {
    // bucket 재계산은 primitive.setCandles() 시점
  }
}

export class VolumeProfilePrimitive {
  constructor(chart, series, candles, options = {}) {
    this._chart = chart;
    this._series = series;
    this._candles = candles;
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._buckets = computeBuckets(candles);
    this._paneViews = [new VolumeProfilePaneView(this)];
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }

  setCandles(candles) {
    this._candles = candles;
    this._buckets = computeBuckets(candles);
    this.updateAllViews();
  }

  detached() {
    this._chart = null;
    this._series = null;
    this._candles = null;
    this._buckets = null;
  }
}

if (typeof window !== 'undefined') {
  window.ChartTVPluginVolumeProfile = { VolumeProfilePrimitive, computeBuckets };
}
