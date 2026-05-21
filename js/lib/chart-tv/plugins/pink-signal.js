/* ───── lib/chart-tv/plugins/pink-signal.js — #2 분홍 강세 vertical line primitive (TradingView v5) ─────
   cycle22 Phase 7d-1 P0-4 — 영웅문 정합 정정 cascade.

   본질 (대표 2026-05-21 10:02 KST verbatim critical 정정):
   - "종목카드의 '강세' 배지는 영웅문의 분홍색 세로 라인을 표시하기 위한 기능이야"
   - 분홍 강세 본질 ≠ marker (createSeriesMarkers aboveBar arrowUp) — 본질 정정 cascade
   - 분홍 본질 = **vertical line primitive** (차트 본문 전체 높이 분홍 #EC4899 세로 라인)
   - 영웅문 광전자 017900 reference 본문: 차트 본문에 분홍 세로 라인 다수 visible (REQ-039 키움 강세 수식 시점)
   - 데이터 source: pinkSignalDates (Array<'YYYY-MM-DD'>, renderer.js data-pinksignal attribute path)

   §11.15 외부 spec 사전 검증 (WebSearch ≥2회 + 공식 docs + repo grep 3종):
   - https://tradingview.github.io/lightweight-charts/docs/plugins/intro
     "ISeriesPrimitive — paneViews() returns IPrimitivePaneView[] for canvas draw"
   - https://tradingview.github.io/lightweight-charts/tutorials/customization/series-primitives
     "BitmapCoordinatesRenderingScope for high-DPR canvas draw"
   - repo grep verbatim: js/lib/chart-tv/plugins/volume-by-decile.js (ISeriesPrimitive paneViews + canvas draw 본질 정합, 동일 패턴)

   §16 self-catch (Phase 7d-1 P0-4):
   - markers.js PINK_SIGNAL_OPTIONS (aboveBar arrowUp #EC4899) 폐기 본질 (본 plugin이 대체)
   - 본 primitive = ISeriesPrimitive paneViews 본질 + canvas 2D vertical line draw 본문
*/

const DEFAULT_OPTIONS = {
  color: '#EC4899',       // 분홍 (REQ-039 강세 배지 본문 정합)
  lineWidth: 1,
  alpha: 0.5,             // 영웅문 alpha 분홍 본문 정합 (gracefully)
};

/**
 * 'YYYY-MM-DD' → BusinessDay {year, month, day} 변환 (markers.js toBusinessDay 본질 정합).
 */
function toBusinessDay(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = String(dateStr).slice(0, 10).split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (!y || !m || !d) return null;
  return { year: y, month: m, day: d };
}

class PinkSignalRenderer {
  constructor(primitive) {
    this._primitive = primitive;
  }

  draw(target) {
    const p = this._primitive;
    if (!p._times || p._times.length === 0) return;
    target.useBitmapCoordinateSpace((scope) => {
      this._drawImpl(scope);
    });
  }

  _drawImpl(scope) {
    const ctx = scope.context;
    const p = this._primitive;
    const opts = p._options;
    const chart = p._chart;
    if (!chart) return;

    const timeScale = chart.timeScale();
    const chartHeight = scope.bitmapSize.height;
    const lineWBitmap = opts.lineWidth * scope.horizontalPixelRatio;

    ctx.globalAlpha = opts.alpha;
    ctx.fillStyle = opts.color;

    p._times.forEach((bd) => {
      // BusinessDay → x좌표 변환 (timeScale.timeToCoordinate 본질)
      const xLogical = timeScale.timeToCoordinate(bd);
      if (xLogical == null) return;
      const x = xLogical * scope.horizontalPixelRatio;
      // vertical line full-height (chart 본문 전체 높이)
      ctx.fillRect(x - lineWBitmap / 2, 0, lineWBitmap, chartHeight);
    });

    ctx.globalAlpha = 1.0;
  }
}

class PinkSignalPaneView {
  constructor(primitive) {
    this._primitive = primitive;
    this._renderer = new PinkSignalRenderer(primitive);
  }

  zOrder() {
    // 캔들 위 (top) 본질이지만 alpha 본문이므로 underneath candles 본질도 OK.
    // 'normal' = 캔들과 동등 레이어 (영웅문 본문 alpha 분홍 본질 정합).
    return 'normal';
  }

  renderer() {
    return this._renderer;
  }

  update() { /* noop — times는 setData 시 재계산 */ }
}

/**
 * ISeriesPrimitive 구현 — 분홍 강세 vertical line.
 */
export class PinkSignalPrimitive {
  /**
   * @param {IChartApi} chart — TradingView chart instance (timeScale 본질)
   * @param {Array<string>} pinkSignalDates — 분홍 강세 일자 (REQ-039 시점)
   * @param {Object} [options]
   */
  constructor(chart, pinkSignalDates, options = {}) {
    this._chart = chart;
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._times = (Array.isArray(pinkSignalDates) ? pinkSignalDates : [])
      .map((d) => toBusinessDay(d))
      .filter(Boolean);
    this._paneViews = [new PinkSignalPaneView(this)];
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }

  // dataset 갱신
  setDates(pinkSignalDates) {
    this._times = (Array.isArray(pinkSignalDates) ? pinkSignalDates : [])
      .map((d) => toBusinessDay(d))
      .filter(Boolean);
    this.updateAllViews();
  }

  // detach 시 cleanup
  detached() {
    this._chart = null;
    this._times = null;
  }
}

if (typeof window !== 'undefined') {
  window.ChartTVPluginPinkSignal = { PinkSignalPrimitive };
}
