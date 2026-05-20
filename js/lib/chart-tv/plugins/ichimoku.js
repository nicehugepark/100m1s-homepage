/* ───── lib/chart-tv/plugins/ichimoku.js — #5 일목균형표 custom series (TradingView v5) ─────
   cycle22 Phase 7b — SPEC DOC-20260520-SPEC-001 v6 §2.2.1 #5 + §3.1.2 색상 verbatim 정합.

   본질 (lead-meta §11.15 외부 spec 사전 검증 PASS):
   - TradingView Lightweight Charts v5 ICustomSeriesPaneView interface 구현
   - WebFetch corroborate (2026-05-21 04:47 KST):
     * https://tradingview.github.io/lightweight-charts/docs/plugins/custom_series
       "renderer / update / hitTest / priceValueBuilder / isWhitespace / defaultOptions / destroy"
     * https://tradingview.github.io/lightweight-charts/docs/api/interfaces/IChartApiBase#addcustomseries
       "addCustomSeries(customPaneView, customOptions?, paneIndex?)" verbatim
   - chart.addCustomSeries(new IchimokuCustomSeries(), opts) 패턴 의무

   산식 (자체 SVG ichimoku.js verbatim 정합 — WebSearch corroborating ≥4건 본질 보존):
   - Tenkan-sen (전환선, 9): (HH_9 + LL_9) / 2
   - Kijun-sen  (기준선, 26): (HH_26 + LL_26) / 2
   - Senkou Span A (선행스팬 1): (Tenkan + Kijun) / 2, +26 forward shift
   - Senkou Span B (선행스팬 2, 52): (HH_52 + LL_52) / 2, +26 forward shift
   - Chikou Span (후행스팬): close, -26 backward shift
   - Cloud (Kumo): Senkou A vs B 영역 fill (한국 증시 관습: A>B 상승구름=빨강 / B>A 하락구름=파랑)

   색상 (SPEC v6 §3.1.2 + 자체 SVG ichimoku.js L14-18 verbatim 정합):
   - 전환선  = #C49930 (am base)         — 햇살 톤
   - 기준선  = #A88639 (am dark)         — 햇살 톤
   - 선행스팬 A = #D4A857 (stroke, dashed) — 햇살 톤
   - 선행스팬 B = #FBE9B5 (stroke, dashed) — 햇살 톤
   - 후행스팬 = #8B95A8 (dm grey, 과거 마커 의미)
   - cloud fill: 상승=rgba(197,57,57,0.12) / 하락=rgba(25,88,199,0.10) (한국 증시 양봉/음봉 정합)

   §16 self-catch (Phase 7b 진입 시):
   - prompt 명시 색상 (#009999/#cc6600/#0066cc/#ff6699/#66cc99) = SPEC v6 §3.1.2 + 자체 SVG verbatim과 mismatch
     → SPEC v6 §3.4 verbatim "Phase 7 dev sub-agent는 본 §3.4 verbatim 적용. 추정 금지." 정합
     → SPEC v6 §3.1.2 + 자체 SVG verbatim 채택 (햇살 톤 본질). prompt 색상 비채택 박제 (보고 시 §16 self-catch 1건 명시).
*/

// 5종 line + 1종 cloud = 5 fill rect (cloud는 polygon fill, lines는 stroke path)
// Canvas 2D 직접 draw 본질 (custom series renderer)

const TENKAN = 9;
const KIJUN = 26;
const SENKOU_B = 52;
const SHIFT = 26;

const DEFAULT_OPTIONS = {
  tenkanColor: '#C49930',
  kijunColor: '#A88639',
  spanAColor: '#D4A857',
  spanBColor: '#FBE9B5',
  chikouColor: '#8B95A8',
  cloudUpColor: 'rgba(197,57,57,0.12)',
  cloudDownColor: 'rgba(25,88,199,0.10)',
  tenkanLineWidth: 1.2,
  kijunLineWidth: 1.2,
  spanLineWidth: 0.8,
  chikouLineWidth: 0.9,
  lastValueVisible: false,
  priceLineVisible: false,
};

function midHL(data, i, period) {
  if (i + 1 < period) return null;
  let hh = -Infinity, ll = Infinity;
  for (let k = i - period + 1; k <= i; k++) {
    const d = data[k];
    if (!d || !(d.high > 0) || !(d.low > 0)) return null;
    if (d.high > hh) hh = d.high;
    if (d.low < ll) ll = d.low;
  }
  return (hh + ll) / 2;
}

function calculateIchimoku(rawData) {
  const N = rawData.length;
  const tenkan = new Array(N).fill(null);
  const kijun = new Array(N).fill(null);
  const senkouA = new Array(N).fill(null);
  const senkouB = new Array(N).fill(null);
  const chikou = new Array(N).fill(null);

  for (let i = 0; i < N; i++) {
    tenkan[i] = midHL(rawData, i, TENKAN);
    kijun[i] = midHL(rawData, i, KIJUN);
    const src = i - SHIFT;
    if (src >= 0 && tenkan[src] != null && kijun[src] != null) {
      senkouA[i] = (tenkan[src] + kijun[src]) / 2;
    }
    if (src >= 0) {
      const v = midHL(rawData, src, SENKOU_B);
      if (v != null) senkouB[i] = v;
    }
    const fwd = i + SHIFT;
    if (fwd < N && rawData[fwd] && rawData[fwd].close > 0) {
      chikou[i] = rawData[fwd].close;
    }
  }
  return { tenkan, kijun, senkouA, senkouB, chikou };
}

// ICustomSeriesPaneRenderer 구현 — canvas draw 본질
class IchimokuRenderer {
  constructor() {
    this._data = null;
    this._options = null;
  }

  update(data, options) {
    this._data = data;
    this._options = options;
  }

  draw(target, priceConverter) {
    if (!this._data || !this._data.bars || this._data.bars.length === 0) return;
    target.useBitmapCoordinateSpace((scope) => {
      this._drawImpl(scope, priceConverter);
    });
  }

  _drawImpl(scope, priceConverter) {
    const ctx = scope.context;
    const bars = this._data.bars;
    const opts = this._options;
    if (!bars || bars.length < TENKAN) return;

    // bars[i].originalData = {tenkan, kijun, senkouA, senkouB, chikou} (custom data passed via setData)
    // bars[i].x = horizontal pixel coordinate (chart provides)
    const N = bars.length;

    // ── (1) Cloud (Kumo) — A vs B 영역 fill, 한국 증시 관습 색상 분기 ──
    // 인접 segment 단위로 polygon 생성. A>B → 상승구름 (빨강), B>A → 하락구름 (파랑)
    let segStart = null;
    let segType = null;
    const segments = [];

    for (let i = 0; i < N; i++) {
      const d = bars[i].originalData;
      if (!d) continue;
      const a = d.senkouA;
      const b = d.senkouB;
      if (a == null || b == null) {
        if (segStart != null) segments.push({ start: segStart, end: i - 1, type: segType });
        segStart = null;
        segType = null;
        continue;
      }
      const cur = (a > b) ? 'up' : (a < b ? 'down' : segType);
      if (segStart == null) { segStart = i; segType = cur || 'up'; continue; }
      if (cur !== segType) {
        segments.push({ start: segStart, end: i - 1, type: segType });
        segStart = i;
        segType = cur;
      }
    }
    if (segStart != null) segments.push({ start: segStart, end: N - 1, type: segType });

    segments.forEach((seg) => {
      ctx.beginPath();
      let firstPt = true;
      for (let k = seg.start; k <= seg.end; k++) {
        const d = bars[k].originalData;
        if (!d || d.senkouA == null) continue;
        const yA = priceConverter(d.senkouA);
        const x = bars[k].x * scope.horizontalPixelRatio;
        if (firstPt) {
          ctx.moveTo(x, yA);
          firstPt = false;
        } else {
          ctx.lineTo(x, yA);
        }
      }
      for (let k = seg.end; k >= seg.start; k--) {
        const d = bars[k].originalData;
        if (!d || d.senkouB == null) continue;
        const yB = priceConverter(d.senkouB);
        const x = bars[k].x * scope.horizontalPixelRatio;
        ctx.lineTo(x, yB);
      }
      ctx.closePath();
      ctx.fillStyle = (seg.type === 'up') ? opts.cloudUpColor : opts.cloudDownColor;
      ctx.fill();
    });

    // ── (2) line series 5종 (Tenkan / Kijun / SenkouA / SenkouB / Chikou) ──
    const drawLine = (key, color, width, dashed) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width * scope.verticalPixelRatio;
      if (dashed) {
        ctx.setLineDash([4 * scope.horizontalPixelRatio, 2 * scope.horizontalPixelRatio]);
      } else {
        ctx.setLineDash([]);
      }
      let started = false;
      for (let i = 0; i < N; i++) {
        const d = bars[i].originalData;
        if (!d) continue;
        const val = d[key];
        if (val == null) {
          started = false;
          continue;
        }
        const y = priceConverter(val);
        const x = bars[i].x * scope.horizontalPixelRatio;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    };

    drawLine('tenkan',  opts.tenkanColor,  opts.tenkanLineWidth,  false);
    drawLine('kijun',   opts.kijunColor,   opts.kijunLineWidth,   false);
    drawLine('senkouA', opts.spanAColor,   opts.spanLineWidth,    true);
    drawLine('senkouB', opts.spanBColor,   opts.spanLineWidth,    true);
    drawLine('chikou',  opts.chikouColor,  opts.chikouLineWidth,  false);

    ctx.setLineDash([]);
  }
}

// ICustomSeriesPaneView interface 구현 본질
export class IchimokuCustomSeries {
  constructor() {
    this._renderer = new IchimokuRenderer();
  }

  priceValueBuilder(plotRow) {
    // priceValueBuilder = autoscale 범위 산출용 (low/high/close 본질)
    // plotRow = ichimoku 산출값 객체 {time, tenkan, kijun, senkouA, senkouB, chikou}
    const values = [];
    if (plotRow.tenkan != null) values.push(plotRow.tenkan);
    if (plotRow.kijun != null) values.push(plotRow.kijun);
    if (plotRow.senkouA != null) values.push(plotRow.senkouA);
    if (plotRow.senkouB != null) values.push(plotRow.senkouB);
    if (plotRow.chikou != null) values.push(plotRow.chikou);
    if (values.length === 0) return [NaN];
    // [low, high, close] 정합 (custom series는 최소 1개, autoscale은 첫/끝/중간 본질)
    return [Math.min(...values), Math.max(...values), plotRow.kijun != null ? plotRow.kijun : values[0]];
  }

  isWhitespace(data) {
    return data.tenkan == null && data.kijun == null && data.senkouA == null
        && data.senkouB == null && data.chikou == null;
  }

  renderer() {
    return this._renderer;
  }

  update(data, options) {
    this._renderer.update(data, options);
  }

  defaultOptions() {
    return DEFAULT_OPTIONS;
  }

  destroy() {
    this._data = null;
    this._renderer = null;
  }
}

/**
 * helper: 캔들 data {time, open, high, low, close} 배열 → ichimoku series data 배열
 * 본질 = chart.addCustomSeries(new IchimokuCustomSeries()) 후 series.setData(buildIchimokuData(candles))
 */
export function buildIchimokuData(candles) {
  if (!Array.isArray(candles) || candles.length < TENKAN) return [];
  const { tenkan, kijun, senkouA, senkouB, chikou } = calculateIchimoku(candles);
  return candles.map((c, i) => ({
    time: c.time,
    tenkan: tenkan[i],
    kijun: kijun[i],
    senkouA: senkouA[i],
    senkouB: senkouB[i],
    chikou: chikou[i],
  }));
}

// window 등록 (ESM consumer + classic script consumer 양 축 호환)
if (typeof window !== 'undefined') {
  window.ChartTVPluginIchimoku = { IchimokuCustomSeries, buildIchimokuData, calculateIchimoku };
}
