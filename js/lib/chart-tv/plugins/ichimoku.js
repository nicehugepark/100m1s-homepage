/* ───── lib/chart-tv/plugins/ichimoku.js — #5 일목균형표 (구름대만 forward shift +26, TradingView v5) ─────
   cycle22 Phase 7d-1 P0 — REQ DOC-20260521-REQ-001 §2 #5 + lead 옵션 A-3 회신 verbatim 정합.

   본질 (대표 2026-05-21 09:08 KST verbatim "일목균형표가 선행스팬인데 후행으로 그려지는것도 문제"):
   - 선행스팬 A + 선행스팬 B + 구름대 (Kumo) fill 3종만 유지
   - **Senkou = "Leading" = forward shift +26 영업일 본질** (TradingView v5 표준, 영웅문 정합)
   - Tenkan(전환선 9) / Kijun(기준선 26) / Chikou(후행스팬 -26) 3선 draw 본질 **제거**
   - 산식은 보존, draw layer만 제거

   forward shift cascade (Phase 7d-1 P0 정정):
   - 기존 (Phase 7d-1 backward 본문): `src = i - SHIFT` → 현재 시점 i의 senkouA/B 값을 i-26 데이터로 계산
     → cloud가 차트 좌측 (과거 영역) 에 표시 = 후행 본문, 영웅문/표준 mismatch
   - 정정 (Phase 7d-1 P0 forward 본문): 현재 i 시점 데이터로 계산된 senkouA/B를 i + SHIFT 시점 좌표에 plot
     → cloud가 차트 우측 (미래 영역) 에 표시 = forward 본문, 영웅문/표준 정합
   - 미래 SHIFT(26) 영업일 placeholder 추가 (whitespace data, candle 없는 미래 좌표)
   - 한국 영업일 정확한 계산은 Phase 7d-2 후행, 본 Phase 7d-1 P0는 calendar day 근사 (주말 skip)

   v5 ICustomSeriesPaneView interface 본질 정합 (cycle22 Phase 7b 구조 보존).

   §16 self-catch (Phase 7d-1 P0):
   - 본 plugin 본질 정정 = 대표 09:08 KST verbatim "후행 → 선행" + forward shift +26 본문
   - Tenkan/Kijun/Chikou draw 제거 유지 = REQ v2 §3 5 제거 cascade
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

/**
 * 일목 산식 — forward shift +26 본질 (Phase 7d-1 P0 정정).
 * 현재 i 시점 데이터로 계산된 senkouA/B 값을 i + SHIFT 좌표 (미래) 에 plot.
 *
 * @returns {senkouA, senkouB} — length = N + SHIFT (미래 placeholder 포함)
 *   senkouA[k] = (k < SHIFT) ? null : (tenkan[k-SHIFT] + kijun[k-SHIFT]) / 2
 *   senkouB[k] = (k < SHIFT) ? null : midHL(rawData, k-SHIFT, SENKOU_B)
 *   k ∈ [0, N+SHIFT-1], k < SHIFT 시점은 fwd shift source 부재로 null
 */
function calculateIchimoku(rawData) {
  const N = rawData.length;
  const outLen = N + SHIFT;  // 미래 SHIFT만큼 확장
  const tenkan = new Array(N).fill(null);
  const kijun = new Array(N).fill(null);
  const senkouA = new Array(outLen).fill(null);
  const senkouB = new Array(outLen).fill(null);

  // 현재 시점 i ∈ [0, N-1] 에서 tenkan/kijun 산출
  for (let i = 0; i < N; i++) {
    tenkan[i] = midHL(rawData, i, TENKAN);
    kijun[i] = midHL(rawData, i, KIJUN);
  }

  // forward shift +SHIFT: i 시점 senkouA/B 값을 i + SHIFT 좌표에 plot
  // outIdx = i + SHIFT, source = i
  for (let i = 0; i < N; i++) {
    const outIdx = i + SHIFT;
    if (outIdx >= outLen) break;
    if (tenkan[i] != null && kijun[i] != null) {
      senkouA[outIdx] = (tenkan[i] + kijun[i]) / 2;
    }
    const v = midHL(rawData, i, SENKOU_B);
    if (v != null) senkouB[outIdx] = v;
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
 * BusinessDay {year, month, day} 좌표를 day 만큼 forward shift.
 * 한국 주말 (Sat/Sun) skip. 공휴일 정확한 calc는 Phase 7d-2 후행, 본 Phase 7d-1 P0는 주말만 skip.
 *
 * @param {{year, month, day}} bd — start BusinessDay 좌표
 * @param {number} days — forward shift 영업일 수
 * @returns {{year, month, day}} — shifted BusinessDay
 */
function addBusinessDays(bd, days) {
  let d = new Date(Date.UTC(bd.year, bd.month - 1, bd.day));
  let added = 0;
  while (added < days) {
    d = new Date(d.getTime() + 86400000); // +1 day
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) added += 1; // skip Sun/Sat
  }
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * helper: 캔들 data {time, open, high, low, close} 배열 → ichimoku series data 배열 (senkouA/B만, forward shift +SHIFT).
 *
 * 출력 length = N + SHIFT (미래 26 영업일 placeholder 포함).
 *   - i ∈ [0, N-1]: time = candles[i].time, senkouA/B = forward shift source (i-SHIFT 시점 데이터)
 *   - i ∈ [N, N+SHIFT-1]: time = forward shift 미래 좌표, senkouA/B = (i-SHIFT) 시점 데이터
 */
export function buildIchimokuData(candles) {
  if (!Array.isArray(candles) || candles.length < TENKAN) return [];
  const N = candles.length;
  const { senkouA, senkouB } = calculateIchimoku(candles);
  const outLen = N + SHIFT;
  const out = new Array(outLen);

  // 본 시점 N 개 (candle time 본문 정합)
  for (let i = 0; i < N; i++) {
    out[i] = {
      time: candles[i].time,
      senkouA: senkouA[i],
      senkouB: senkouB[i],
    };
  }

  // 미래 SHIFT 개 (영업일 forward shift 좌표 추가)
  const lastTime = candles[N - 1].time;
  for (let k = 0; k < SHIFT; k++) {
    const futureTime = addBusinessDays(lastTime, k + 1);
    out[N + k] = {
      time: futureTime,
      senkouA: senkouA[N + k],
      senkouB: senkouB[N + k],
    };
  }
  return out;
}

if (typeof window !== 'undefined') {
  window.ChartTVPluginIchimoku = { IchimokuCustomSeries, buildIchimokuData, calculateIchimoku };
}
