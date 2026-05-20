/* ───── lib/chart-tv/plugins/volume-by-decile.js — #1 매물대 10등분 ISeriesPrimitive (TradingView v5) ─────
   cycle22 Phase 7b — SPEC DOC-20260520-SPEC-001 v6 §2.2.1 #1 + §3.1.2 색상 verbatim 정합.

   본질 (lead-meta §11.15 외부 spec 사전 검증 PASS):
   - TradingView Lightweight Charts v5 ISeriesPrimitive interface 구현
   - WebFetch corroborate (2026-05-21 04:47 KST):
     * plugin-examples/volume-profile (verbatim 패턴 reference):
       "class VolumeProfile implements ISeriesPrimitive<Time>
        constructor(chart, series, vpData)
        updateAllViews() { this._paneViews.forEach(pw => pw.update()); }
        paneViews() { return this._paneViews; }
        renderer with CanvasRenderingTarget2D draw method
        series.priceToCoordinate(price) for y-coord conversion"
   - candleSeries.attachPrimitive(new VolumeByDecilePrimitive(chart, series, candles)) 패턴 의무

   산식 (자체 SVG volume-profile-10.js verbatim 정합):
   - 가격 범위 (hi-lo)를 10 bucket으로 분할
   - 각 bucket = 해당 가격 구간에 close가 위치하는 영업일의 거래량 누적
   - bucket별 horizontal rect 우측 side 영역에 가시

   색상 (SPEC v6 §3.1.2 + 자체 SVG L40 verbatim):
   - fill = rgba(196,153,48, 0.3~0.6) — 햇살 톤 alpha (volume 비례)
   - stroke = #C49930 — 햇살 톤 base

   §16 self-catch (Phase 7b 진입 시):
   - prompt 본 plugin은 SPEC v6 §3.4 verbatim 비포함 (Ichimoku/marker/Fibonacci만 §3.4 코드 sample).
     volume-profile-10 색상은 §3.1.2 + 자체 SVG verbatim 채택 정합.
*/

const N_BUCKET = 10;

const DEFAULT_OPTIONS = {
  fillColorBase: 'rgba(196,153,48,', // alpha 0.3~0.6 동적
  strokeColor: '#C49930',
  sideWidthPx: 60,              // 우측 side 영역 폭 (px)
  alphaMin: 0.3,
  alphaMax: 0.6,
  bucketGapPx: 2,               // bucket간 vertical gap
  strokeWidth: 0.3,
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

  // 각 bucket 가격 중심값 + 거래량 ratio
  const result = [];
  for (let i = 0; i < N_BUCKET; i++) {
    if (buckets[i] <= 0) continue;
    const priceMid = lo + (span * (i + 0.5) / N_BUCKET);
    const priceTop = lo + (span * (i + 1) / N_BUCKET);
    const priceBot = lo + (span * i / N_BUCKET);
    const ratio = buckets[i] / maxV;
    result.push({ priceMid, priceTop, priceBot, ratio, volume: buckets[i] });
  }
  return result;
}

class VolumeByDecileRenderer {
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
    const sideX = chartWidthBitmap - sideW;

    p._buckets.forEach((b) => {
      const yMid = series.priceToCoordinate(b.priceMid);
      const yTop = series.priceToCoordinate(b.priceTop);
      const yBot = series.priceToCoordinate(b.priceBot);
      if (yMid == null || yTop == null || yBot == null) return;

      const yTopBitmap = yTop * scope.verticalPixelRatio;
      const yBotBitmap = yBot * scope.verticalPixelRatio;
      const bucketTop = Math.min(yTopBitmap, yBotBitmap) + opts.bucketGapPx * scope.verticalPixelRatio / 2;
      const bucketBot = Math.max(yTopBitmap, yBotBitmap) - opts.bucketGapPx * scope.verticalPixelRatio / 2;
      const bucketH = bucketBot - bucketTop;
      if (bucketH <= 0) return;

      const w = b.ratio * sideW;
      const alpha = opts.alphaMin + b.ratio * (opts.alphaMax - opts.alphaMin);
      ctx.fillStyle = `${opts.fillColorBase}${alpha.toFixed(2)})`;
      ctx.fillRect(sideX, bucketTop, w, bucketH);

      ctx.strokeStyle = opts.strokeColor;
      ctx.lineWidth = opts.strokeWidth * scope.verticalPixelRatio;
      ctx.strokeRect(sideX, bucketTop, w, bucketH);
    });
  }
}

// IPrimitivePaneView 구현 본질 (zOrder + renderer)
class VolumeByDecilePaneView {
  constructor(primitive) {
    this._primitive = primitive;
    this._renderer = new VolumeByDecileRenderer(primitive);
  }

  zOrder() {
    return 'top'; // 매물대는 캔들 위 overlay (우측 side, 캔들과 영역 분리)
  }

  renderer() {
    return this._renderer;
  }

  update() {
    // primitive._buckets는 attach 시점 또는 update 시점에 재계산
  }
}

// ISeriesPrimitive 구현 본질
export class VolumeByDecilePrimitive {
  constructor(chart, series, candles, options = {}) {
    this._chart = chart;
    this._series = series;
    this._candles = candles;
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._buckets = computeBuckets(candles);
    this._paneViews = [new VolumeByDecilePaneView(this)];
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }

  // 데이터 갱신 시 호출 — Phase 7c lazy fetch swap 본질
  setCandles(candles) {
    this._candles = candles;
    this._buckets = computeBuckets(candles);
    this.updateAllViews();
    // chart 재 draw 요청 (TradingView v5 자동 호출 — series 변경 감지 시)
  }

  // detach 시 cleanup
  detached() {
    this._chart = null;
    this._series = null;
    this._candles = null;
    this._buckets = null;
  }
}

if (typeof window !== 'undefined') {
  window.ChartTVPluginVolumeByDecile = { VolumeByDecilePrimitive, computeBuckets };
}
