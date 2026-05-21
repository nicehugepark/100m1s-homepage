/* ───── lib/chart-tv/plugins/ichimoku.js — #5 일목균형표 (영웅문 정합 forward shift +26 본질, TradingView v5) ─────
   cycle22 P0-13 — REQ DOC-20260521-REQ-001 §2 #5 + 대표 verbatim 13:44 KST 본질 정정.

   본질 (대표 2026-05-21 13:44 KST verbatim "일목균형표는 여전히 엉망진창이다. 선행스팬인데 선행하지 않다.. 위치와 비율도 엉망이다"):
   - 선행스팬 = leading span = **forward shift +26 영업일 본질** (영웅문 verbatim "선행스팬1 9 26 / 선행스팬2 52 26")
   - 영웅문 reference 본문 (23a74560-10166.jpg 직접 read evidence 현대모비스 012330):
     * cloud (Kumo) 본문 = 차트 **우측 미래 영역** 본문 명확 visible (5/21 ~ 6말+ 영업일 26 forward)
     * 즉 senkouA/B 산식 = 현재 시점 i 산출값 → time 좌표 i+SHIFT (미래 26 영업일) plot 본문
   - cycle22 P0-9 Fix-20 본문 backward source 본질 (`srcIdx = i - SHIFT, outIdx = i`) = **lead 환각 cascade revert 본질**
     (영웅문 verbatim "선행스팬 = leading" 본질 무시한 backward source 사고)
   - Tenkan(전환선 9) / Kijun(기준선 26) / Chikou(후행스팬 -26) 3선 draw 제거 유지 (REQ v2 §3 5 제거 cascade)

   P0-13 Fix-46 본질 정정 (P0-9 Fix-20 backward cascade revert):
   - 기존 (P0-9 Fix-20 backward 본문 폐기): outIdx = i, source = i - SHIFT → cloud i 좌표 plot value = i-26 산출
     → cloud가 차트 candle 영역 본문 plot = 영웅문 본문 미래 cloud 영역 mismatch (영웅문 = cloud 우측 미래 visible)
   - 정정 (P0-13 Fix-46 forward shift 본문 본질 복원, P0-4 Fix-8 본문 본질 정합):
     * senkouA[i] = (tenkan[i] + kijun[i]) / 2 본문 (현재 시점 산출값)
     * senkouB[i] = midHL(rawData, i, SENKOU_B) 본문 (현재 시점 산출값)
     * **time 좌표 본문 = future i+SHIFT 영업일 (BusinessDay forward shift +26)** 본질
     * outLen = N + SHIFT (미래 26 영업일 placeholder 본문 신축)
     * addBusinessDays helper 본문 복원 (한국 주말 skip 본질 정합)
   - 영웅문 정합: cloud 본문 = 차트 우측 미래 영역 visible (5/21 candle 이후 +26 영업일 future plot)

   v5 ICustomSeriesPaneView interface 본질 정합 (cycle22 Phase 7b 구조 보존).

   §16 self-catch (P0-13 Fix-46):
   - P0-9 Fix-20 backward source 본문 = lead 환각 cascade 본문 (영웅문 "선행스팬 = leading" verbatim 무시 본질)
   - "위치와 비율도 엉망" 본문 root cause = backward source 본문 cloud 본문 candle 영역 동일 plot
     vs 영웅문 forward shift +26 미래 영역 visible mismatch 본문
   - P0-12 Fix-40 opacity 0.20/0.18 visible 정정 본문 PASS (본 P0-13 본문 유지)
   - addBusinessDays 본문 복원 = 미래 placeholder time 좌표 산출 (한국 영업일 본문 주말 skip 정합)
   - §11.15 외부 spec 사전 검증 (Ichimoku Kinko Hyo Senkou Span A/B leading shift):
     * 일본 발원 본질 (Hosoda 1968) — Senkou A/B = leading (forward shift +26) 본질 표준
     * 영웅문 한국 verbatim 본문 정합 동일 (선행 = 미래 plot)
     * TradingView Lightweight Charts v5 BusinessDay time 좌표 본문 = forward 미래 placeholder 허용
*/

const TENKAN = 9;
const KIJUN = 26;
const SENKOU_B = 52;
const SHIFT = 26;

// P0-12 Fix-40 본문 opacity (영웅문 visible 정합) — 본 P0-13 본문 유지
const DEFAULT_OPTIONS = {
  // 선행스팬 stroke (보존)
  spanAColor: '#D4A857',      // 햇살 톤 dashed
  spanBColor: '#FBE9B5',      // 햇살 톤 dashed
  spanLineWidth: 0.5,         // P0-10 Fix-27 유지: 영웅문 본문 얇은 stroke 정합
  // 구름대 fill (한국 증시 양봉/음봉 정합) — P0-12 Fix-40 본문 0.20/0.18 visible 본문 유지
  cloudUpColor: 'rgba(197,57,57,0.20)',
  cloudDownColor: 'rgba(25,88,199,0.18)',
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
 * P0-13 Fix-46 — 한국 영업일 forward shift helper (주말 skip 본질).
 *
 * 한국 거래소 본문 = 월~금 영업일 (공휴일 추가 skip 본질 but raw data 본문 거래일 본질만 보유,
 * 미래 26 영업일 placeholder time 좌표 산출 본질 = 주말 skip만 본문 정합).
 *
 * BusinessDay {year, month, day} 본문 input → +days 미래 영업일 BusinessDay 본문 output.
 *
 * §11.15 외부 spec 사전 검증 PASS:
 *   - JavaScript Date object 본문 setDate +N → 자동 month/year roll-over 본문 정합
 *   - getDay() 본문 0=일 / 6=토 본문 skip 본질
 *   - 영웅문 한국 시장 본문 = 월~금만 plot (공휴일 본문 별건 layer)
 */
export function addBusinessDays(time, days) {
  const date = new Date(Date.UTC(time.year, time.month - 1, time.day));
  let added = 0;
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1);
    const dow = date.getUTCDay();
    if (dow !== 0 && dow !== 6) added += 1;  // 주말 skip
  }
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/**
 * 일목 산식 — P0-13 Fix-46 영웅문 정합 forward shift +26 본질 (P0-9 Fix-20 backward cascade revert).
 *
 * 현재 시점 i ∈ [0, N-1] 산출값을 time 좌표 i+SHIFT (미래 26 영업일) plot 본문.
 *
 * @returns {senkouA, senkouB} — length = N + SHIFT (미래 26 영업일 placeholder 본문 신축)
 *   - i ∈ [0, N-1]: senkouA[i+SHIFT] = (tenkan[i] + kijun[i]) / 2, senkouB[i+SHIFT] = midHL(rawData, i, 52)
 *   - i ∈ [0, SHIFT-1]: senkouA[i] = senkouB[i] = null (영웅문 본문 차트 좌측 cloud 부재 visible 정합)
 *   - i ∈ [N, N+SHIFT-1]: 미래 영역 본문 = 현재 시점 i-SHIFT 산출값 (= i ∈ [N-SHIFT, N-1] 산출) forward shift plot
 */
function calculateIchimoku(rawData) {
  const N = rawData.length;
  const outLen = N + SHIFT;  // P0-13 Fix-46: 미래 SHIFT 영업일 placeholder 신축 (영웅문 forward 정합)
  const tenkan = new Array(N).fill(null);
  const kijun = new Array(N).fill(null);
  const senkouA = new Array(outLen).fill(null);
  const senkouB = new Array(outLen).fill(null);

  // 현재 시점 i ∈ [0, N-1] 에서 tenkan/kijun 산출
  for (let i = 0; i < N; i++) {
    tenkan[i] = midHL(rawData, i, TENKAN);
    kijun[i] = midHL(rawData, i, KIJUN);
  }

  // P0-13 Fix-46 forward shift: outIdx = i + SHIFT, source = i (현재 시점 산출값)
  // 영웅문 verbatim "선행스팬 = leading = forward shift +26" 본질 정합
  for (let i = 0; i < N; i++) {
    const outIdx = i + SHIFT;
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
 * helper: 캔들 data {time, open, high, low, close} 배열 → ichimoku series data 배열 (senkouA/B만, forward shift +26).
 *
 * P0-13 Fix-46: 영웅문 정합 forward shift +26 본질 (P0-9 Fix-20 backward cascade revert).
 *
 * 출력 length = N + SHIFT (미래 SHIFT 영업일 placeholder 본문 신축).
 *   - i ∈ [0, N-1]: time = candles[i].time, senkouA/B = (i ∈ [0, SHIFT-1]) null / (i ≥ SHIFT) i-SHIFT 시점 산출
 *   - i ∈ [N, N+SHIFT-1]: time = addBusinessDays(candles[N-1].time, i-N+1), senkouA/B = (i-SHIFT) 시점 산출 (현재 시점 N-SHIFT~N-1)
 *
 * §16 self-catch (P0-13 Fix-46):
 *   - 미래 placeholder 영역 time 좌표 산출 = addBusinessDays helper 본문 (한국 영업일 주말 skip)
 *   - candle data 본문 부재 미래 영역 = senkouA/B만 plot (영웅문 본문 cloud only visible 정합)
 *   - 미래 영역 candle 본문 부재 = isWhitespace 본문 OHLC undefined 정합 (TradingView v5 whitespace 본질)
 */
export function buildIchimokuData(candles) {
  if (!Array.isArray(candles) || candles.length < TENKAN) return [];
  const N = candles.length;
  const { senkouA, senkouB } = calculateIchimoku(candles);
  const outLen = N + SHIFT;
  const out = new Array(outLen);

  // 현재 candle 영역 (i ∈ [0, N-1])
  for (let i = 0; i < N; i++) {
    out[i] = {
      time: candles[i].time,
      senkouA: senkouA[i],
      senkouB: senkouB[i],
    };
  }

  // 미래 placeholder 영역 (i ∈ [N, N+SHIFT-1]) — time 좌표 forward shift 본문 산출
  const lastTime = candles[N - 1].time;
  for (let k = 1; k <= SHIFT; k++) {
    const futureTime = addBusinessDays(lastTime, k);
    out[N + k - 1] = {
      time: futureTime,
      senkouA: senkouA[N + k - 1],
      senkouB: senkouB[N + k - 1],
    };
  }
  return out;
}

if (typeof window !== 'undefined') {
  window.ChartTVPluginIchimoku = { IchimokuCustomSeries, buildIchimokuData, calculateIchimoku, addBusinessDays };
}
