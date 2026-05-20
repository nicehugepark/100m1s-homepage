/* ───── lib/chart-tv/plugins/ichimoku.js — #5 일목균형표 (구름대만, TradingView v5) ─────
   cycle22 Phase 7d-1 — REQ DOC-20260521-REQ-001 §2 #5 verbatim 정합.

   본질 (대표 2026-05-21 07:58 KST verbatim "일목균형표도 선행스팬 2개와 구름대만 있으면 된다"):
   - 선행스팬 A + 선행스팬 B + 구름대 (Kumo) fill 3종만 유지
   - Tenkan(전환선 9) / Kijun(기준선 26) / Chikou(후행스팬 -26) 3선 draw 본질 **제거**
   - 산식은 보존 (Senkou A 계산에 Tenkan/Kijun 필요), draw layer만 제거

   v5 ICustomSeriesPaneView interface 본질 정합 (cycle22 Phase 7b 구조 보존).

   §16 self-catch (Phase 7d-1):
   - 본 plugin 본질 정정 = REQ v2 §2 #5 verbatim "선행스팬 A + 선행스팬 B + 구름대 3종만"
   - Tenkan/Kijun/Chikou draw 제거 = REQ v2 §3 5 제거 cascade trigger
*/

const TENKAN = 9;
const KIJUN = 26;
const SENKOU_B = 52;
const SHIFT = 26;

const DEFAULT_OPTIONS = {
  // 선행스팬 stroke (보존)
  spanAColor: '#D4A857',      // 햇살 톤 dashed
  spanBColor: '#FBE9B5',      // 햇살 톤 dashed
  spanLineWidth: 0.8,
  // 구름대 fill (한국 증시 양봉/음봉 정합)
  cloudUpColor: 'rgba(197,57,57,0.12)',
  cloudDownColor: 'rgba(25,88,199,0.10)',
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
  }
  return { senkouA, senkouB };
}

// ICustomSeriesPaneRenderer — Senkou A + B + Cloud fill만 draw (Tenkan/Kijun/Chikou 제거)
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

    const N = bars.length;

    // ── (1) Cloud (Kumo) fill — A vs B 영역, 한국 증시 관습 색상 분기 ──
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

    // ── (2) 선행스팬 A + B stroke 2선 (Tenkan/Kijun/Chikou 제거) ──
    const drawLine = (key, color, width) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width * scope.verticalPixelRatio;
      ctx.setLineDash([4 * scope.horizontalPixelRatio, 2 * scope.horizontalPixelRatio]);
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

    drawLine('senkouA', opts.spanAColor, opts.spanLineWidth);
    drawLine('senkouB', opts.spanBColor, opts.spanLineWidth);

    ctx.setLineDash([]);
  }
}

// ICustomSeriesPaneView interface 구현 본질
export class IchimokuCustomSeries {
  constructor() {
    this._renderer = new IchimokuRenderer();
  }

  priceValueBuilder(plotRow) {
    // priceValueBuilder = autoscale 범위 산출용 (senkouA/B만 본질)
    const values = [];
    if (plotRow.senkouA != null) values.push(plotRow.senkouA);
    if (plotRow.senkouB != null) values.push(plotRow.senkouB);
    if (values.length === 0) return [NaN];
    return [Math.min(...values), Math.max(...values), plotRow.senkouA != null ? plotRow.senkouA : values[0]];
  }

  isWhitespace(data) {
    return data.senkouA == null && data.senkouB == null;
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
 * helper: 캔들 data {time, open, high, low, close} 배열 → ichimoku series data 배열 (senkouA/B만)
 */
export function buildIchimokuData(candles) {
  if (!Array.isArray(candles) || candles.length < TENKAN) return [];
  const { senkouA, senkouB } = calculateIchimoku(candles);
  return candles.map((c, i) => ({
    time: c.time,
    senkouA: senkouA[i],
    senkouB: senkouB[i],
  }));
}

if (typeof window !== 'undefined') {
  window.ChartTVPluginIchimoku = { IchimokuCustomSeries, buildIchimokuData, calculateIchimoku };
}
