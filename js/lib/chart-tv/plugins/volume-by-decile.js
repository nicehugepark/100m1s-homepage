/* ───── lib/chart-tv/plugins/volume-by-decile.js — #1 매물대 10등분 화면 가변 (TradingView v5) ─────
   cycle22 Phase 7d-1 — REQ DOC-20260521-REQ-001 §2 #1 verbatim 정합.

   본질 (대표 2026-05-21 08:16 KST verbatim "매물대도 필요한데 현재 화면에 보여지는 캔들에 한해서 가변적이어야 한다"):
   - 매물대 10등분 = **차트 visible range 기준 동적 재계산** (줌/스크롤 시 갱신)
   - 240영업일 고정 → 화면 가변 본질 정정
   - chart.timeScale().subscribeVisibleLogicalRangeChange(handler) v5 API 채택

   §11.15 외부 spec 사전 검증 (WebSearch 2건 + 공식 docs 1건):
   - https://tradingview.github.io/lightweight-charts/docs/api/interfaces/ITimeScaleApi
     "subscribeVisibleLogicalRangeChange(handler) — handler receives newVisibleLogicalRange (LogicalRange | null)"
   - LogicalRange = { from: number, to: number } — bar index float (예: from=10.5 = 10번째 bar 중간부터)
   - known issue #1851: v5 panes 사용 시 main pane timeScale은 정상 (cycle22 단일 main pane 본질, sub-pane series는 별)

   v5 ISeriesPrimitive interface 본질 정합.

   §16 self-catch (Phase 7d-1):
   - 본 plugin 본질 정정 = REQ v2 §2 #1 verbatim "현재 화면 보이는 캔들 범위 기준 동적 10등분"
   - subscribeVisibleLogicalRangeChange handler에서 visible candles 추출 + buckets 재계산 + updateAllViews() 호출
*/

const N_BUCKET = 10;

const DEFAULT_OPTIONS = {
  fillColorBase: 'rgba(196,153,48,', // alpha 0.3~0.6 동적
  strokeColor: '#C49930',
  sideWidthPx: 60,              // 우측 side 영역 폭 (px)
  alphaMin: 0.3,
  alphaMax: 0.6,
  bucketGapPx: 2,
  strokeWidth: 0.3,
};

/**
 * candles 배열 → 10 bucket 산출 (close 기준 가격 분포 + 거래량 누적).
 * 입력 candles는 visible range 추출 후 본 함수 호출 본질.
 */
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

    // P0-7 fix-3 (2026-05-21 11:01 KST 대표 verbatim "매물대도 차트 좌측벽에서부터 출발해야한다"):
    //   sideX = 0 (차트 좌측벽 즉시 시작 본질, scope.bitmapSize 본문 = chart 본문 영역만 본문, priceScale 본문 제외)
    //   sideX 본문 0부터 sideW 본문까지 width 본문 (좌측 → 우측 본문 확장 본질, 영웅문 정합)
    //   v5 useBitmapCoordinateSpace scope.bitmapSize.width = chart 영역 본문 (priceScale 제외) → 0이 좌측벽 본문
    const sideW = opts.sideWidthPx * scope.horizontalPixelRatio;
    const sideX = 0;

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

class VolumeByDecilePaneView {
  constructor(primitive) {
    this._primitive = primitive;
    this._renderer = new VolumeByDecileRenderer(primitive);
  }

  zOrder() {
    return 'top';
  }

  renderer() {
    return this._renderer;
  }

  update() {
    // buckets는 primitive setVisibleRange 시점에 재계산
  }
}

// ISeriesPrimitive 구현 본질 + 화면 가변 subscribe layer
export class VolumeByDecilePrimitive {
  /**
   * @param {IChartApi} chart — TradingView chart instance (subscribeVisibleLogicalRangeChange 의무)
   * @param {ISeriesApi} series — candle series (priceToCoordinate 의무)
   * @param {Array} candles — 전체 candle 배열 (visible range 추출 source)
   * @param {Object} [options]
   */
  constructor(chart, series, candles, options = {}) {
    this._chart = chart;
    this._series = series;
    this._allCandles = candles;
    this._options = { ...DEFAULT_OPTIONS, ...options };
    // 초기 buckets = 전체 candles 본질 (visible range 미설정 시 default = 항상 visible 보장)
    this._buckets = computeBuckets(candles);
    this._paneViews = [new VolumeByDecilePaneView(this)];

    // 화면 가변 subscribe — visibleLogicalRange 변화 시 재계산
    this._rangeHandler = (newRange) => {
      this._onVisibleRangeChange(newRange);
    };

    try {
      this._chart.timeScale().subscribeVisibleLogicalRangeChange(this._rangeHandler);
      // 초기 1회 호출 — fitContent 직후 visibleLogicalRange가 이미 있을 수 있음
      const initialRange = this._chart.timeScale().getVisibleLogicalRange();
      if (initialRange) this._onVisibleRangeChange(initialRange);

      // 매물대 visible 결함 root cause fix (Phase 7d-1 P0):
      // expanded-chart.js setVisibleLogicalRange 호출이 primitive attach 직후 발생 시
      // subscribe handler 1회 호출 보장 안됨. setTimeout 0 + 강제 재호출 본질.
      // (대표 verbatim 09:08 KST (e) "매물대도 보이지 않는게 문제")
      setTimeout(() => {
        try {
          const lateRange = this._chart && this._chart.timeScale().getVisibleLogicalRange();
          if (lateRange) this._onVisibleRangeChange(lateRange);
        } catch (e) { /* noop */ }
      }, 0);
    } catch (err) {
      // subscribe 미지원 시 fallback = 전체 candles 본질 유지 (정적 매물대)
      this._rangeHandler = null;
    }
  }

  /**
   * visibleLogicalRange handler — visible candles 추출 + buckets 재계산
   * @param {{from: number, to: number} | null} range
   */
  _onVisibleRangeChange(range) {
    if (!range || !this._allCandles) return;
    const from = Math.max(0, Math.floor(range.from));
    const to = Math.min(this._allCandles.length - 1, Math.ceil(range.to));
    if (to < from) return;
    const visible = this._allCandles.slice(from, to + 1);
    if (visible.length < 2) return;
    this._buckets = computeBuckets(visible);
    this.updateAllViews();
    // chart 재 draw trigger (v5는 series 변경 자동 감지, primitive 변경은 명시 trigger 필요할 수 있음)
    try {
      if (this._series && typeof this._series.applyOptions === 'function') {
        // no-op options apply = redraw trigger (v5 v5.0.8 hack)
        this._series.applyOptions({});
      }
    } catch (e) { /* noop */ }
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }

  // 데이터 갱신 시 호출 — lazy fetch swap 본질
  setCandles(candles) {
    this._allCandles = candles;
    this._buckets = computeBuckets(candles);
    this.updateAllViews();
  }

  // detach 시 cleanup — subscribe 해제 의무 (메모리 누수 회피)
  detached() {
    try {
      if (this._chart && this._rangeHandler) {
        this._chart.timeScale().unsubscribeVisibleLogicalRangeChange(this._rangeHandler);
      }
    } catch (e) { /* noop */ }
    this._chart = null;
    this._series = null;
    this._allCandles = null;
    this._buckets = null;
    this._rangeHandler = null;
  }
}

if (typeof window !== 'undefined') {
  window.ChartTVPluginVolumeByDecile = { VolumeByDecilePrimitive, computeBuckets };
}
