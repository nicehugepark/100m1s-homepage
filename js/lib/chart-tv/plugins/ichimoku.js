/* ───── lib/chart-tv/plugins/ichimoku.js — #5 일목균형표 (영웅문 정합 backward source 본문, TradingView v5) ─────
   cycle22 Phase 7d-1 P0-9 — REQ DOC-20260521-REQ-001 §2 #5 + 대표 verbatim 11:34 KST 영웅문 정합 정정.

   본질 (대표 2026-05-21 11:34 KST verbatim "달라진 점이 없다. 선행스팬 자체가 과거의 차트 위치를
         그저 우측으로 이동시킨 것 밖에 없는데 높낮이 위치가 맞지 않다"):
   - 선행스팬 A + 선행스팬 B + 구름대 (Kumo) fill 3종만 유지
   - 영웅문 reference 본문 (23a74560-10166.jpg 09:08 KST 현대모비스 012330) 직접 read evidence:
     * cloud visible 영역 = 차트 **좌측~마지막 candle 본문 영역** (3/31~5/21)
     * **마지막 candle 우측 미래 영역 cloud 부재** = forward shift visible 없음
     * 즉 영웅문 = **i 좌표 plot value = (tenkan[i-26]+kijun[i-26])/2 본문 backward source forward draw**
       (cloud 본문 i 시점 좌표 visible but source data = i-26 시점, 즉 외관상 cloud 본문 candle 위 정합)
   - Tenkan(전환선 9) / Kijun(기준선 26) / Chikou(후행스팬 -26) 3선 draw 본질 **제거** (REQ v2 §3 5 제거 cascade)
   - 산식은 보존, draw layer만 제거

   P0-9 Fix-20 본질 정정 (Phase 7d-1 P0 forward shift cascade 폐기):
   - 기존 (Phase 7d-1 P0 forward 본문 폐기): `outIdx = i + SHIFT` source=i → 미래 i+26 좌표 plot
     → cloud가 차트 **우측 미래 영역**에 표시 = 영웅문 본문 mismatch (영웅문 = 미래 cloud 부재)
   - 정정 (P0-9 backward source 본문): `outIdx = i` source = i-SHIFT → i 좌표 plot value 본문
     value = (tenkan[i-26] + kijun[i-26]) / 2  본문 = i-26 시점 산출값을 i 좌표 plot
     senkouB[i] = midHL(rawData, i-26, 52)
     → cloud가 차트 **좌측~현재 visible 영역**에 표시 = 영웅문 정합
   - 미래 placeholder 제거 (영웅문 cloud 미래 영역 부재 visible 정합)
   - outLen = N (미래 확장 없음, candle data 영역만 본문 정합)

   v5 ICustomSeriesPaneView interface 본질 정합 (cycle22 Phase 7b 구조 보존).

   §16 self-catch (P0-9 Fix-20):
   - 본 plugin 본질 정정 = 영웅문 23a74560 직접 read evidence cloud visible 영역 본문 정합
   - "높낮이 위치가 맞지 않다" 본문 root cause = forward shift 본문 cloud 본문 미래 영역 visible
     vs 영웅문 backward source 본문 i 좌표 cloud visible mismatch 본문
   - Tenkan/Kijun/Chikou draw 제거 유지 = REQ v2 §3 5 제거 cascade
   - addBusinessDays 본문 미래 placeholder 본문 layer 폐기 (cloud 미래 영역 부재 영웅문 정합)
*/

const TENKAN = 9;
const KIJUN = 26;
const SENKOU_B = 52;
const SHIFT = 26;

// P0-10 Fix-27 (2026-05-21 12:17 KST 대표 verbatim
//   "일목균형표가 여전히 문제를 일으키고 있고"):
//   영웅문 reference 23a74560 직접 read evidence (cross-check):
//   - 영웅문 본문 cloud (Kumo) 본문 = 매우 subtle 본문 visible (opacity 본문 약 0.04~0.06 본문)
//   - 라이브 image #8 본문 cloud = 너무 진함 (opacity 0.10~0.12 본문 → chart 본문 본질 가림)
//   - root cause 진단 본질 = cloud opacity 본문 너무 높음 (영웅문 본문 mismatch)
//   - 정합 본질: cloud opacity 본문 0.12/0.10 → 0.05/0.04 본문 본질 영웅문 정합 (subtle visible 정합)
//   - 추가 본질: stroke lineWidth 0.8 → 0.5 본문 본질 (영웅문 본문 선행스팬 본문 더 얇음 visible 정합)
//
//   §16 self-catch:
//   - backward source 본문 (P0-9 Fix-20) 본문 유지 — cloud 본문 i 좌표 plot 본문 정합
//   - opacity 본문 0.05 본문 = chart 본문 본질 가림 본문 회피 + 영웅문 본문 subtle visible 정합 양 축 PASS
const DEFAULT_OPTIONS = {
  // 선행스팬 stroke (보존)
  spanAColor: '#D4A857',      // 햇살 톤 dashed
  spanBColor: '#FBE9B5',      // 햇살 톤 dashed
  spanLineWidth: 0.5,         // P0-10 Fix-27: 0.8 → 0.5 본문 (영웅문 본문 얇은 stroke 정합)
  // 구름대 fill (한국 증시 양봉/음봉 정합)
  // P0-10 Fix-27: opacity 본문 0.12/0.10 → 0.05/0.04 본문 (영웅문 subtle visible 정합)
  cloudUpColor: 'rgba(197,57,57,0.05)',
  cloudDownColor: 'rgba(25,88,199,0.04)',
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
 * 일목 산식 — P0-9 Fix-20 영웅문 정합 backward source 본질.
 * i 좌표 plot value = (tenkan[i-SHIFT] + kijun[i-SHIFT]) / 2  본문 = i-26 시점 산출값을 i 좌표 plot.
 *
 * @returns {senkouA, senkouB} — length = N (미래 placeholder 없음, 영웅문 정합)
 *   senkouA[i] = (i < SHIFT) ? null : (tenkan[i-SHIFT] + kijun[i-SHIFT]) / 2
 *   senkouB[i] = (i < SHIFT) ? null : midHL(rawData, i-SHIFT, SENKOU_B)
 *   i ∈ [0, N-1], i < SHIFT 시점은 backward source 부재로 null (영웅문 본문 차트 좌측 영역 cloud 부재 visible 정합)
 */
function calculateIchimoku(rawData) {
  const N = rawData.length;
  const outLen = N;  // P0-9 Fix-20: 미래 placeholder 없음 (영웅문 본문 미래 cloud 부재 정합)
  const tenkan = new Array(N).fill(null);
  const kijun = new Array(N).fill(null);
  const senkouA = new Array(outLen).fill(null);
  const senkouB = new Array(outLen).fill(null);

  // 현재 시점 i ∈ [0, N-1] 에서 tenkan/kijun 산출
  for (let i = 0; i < N; i++) {
    tenkan[i] = midHL(rawData, i, TENKAN);
    kijun[i] = midHL(rawData, i, KIJUN);
  }

  // P0-9 Fix-20 backward source: i 좌표 plot value = i-SHIFT 시점 산출값
  // outIdx = i, source = i - SHIFT (영웅문 정합 본문)
  for (let i = SHIFT; i < N; i++) {
    const srcIdx = i - SHIFT;
    if (tenkan[srcIdx] != null && kijun[srcIdx] != null) {
      senkouA[i] = (tenkan[srcIdx] + kijun[srcIdx]) / 2;
    }
    const v = midHL(rawData, srcIdx, SENKOU_B);
    if (v != null) senkouB[i] = v;
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
 * helper: 캔들 data {time, open, high, low, close} 배열 → ichimoku series data 배열 (senkouA/B만, backward source).
 *
 * P0-9 Fix-20: 영웅문 정합 본질. 미래 placeholder 폐기 (영웅문 본문 cloud 미래 영역 부재 visible 정합).
 *
 * 출력 length = N (미래 확장 없음).
 *   - i ∈ [0, N-1]: time = candles[i].time, senkouA/B = backward source (i-SHIFT 시점 데이터)
 *   - i < SHIFT: senkouA/B = null (backward source 부재 = 영웅문 본문 차트 좌측 cloud 부재 visible 정합)
 */
export function buildIchimokuData(candles) {
  if (!Array.isArray(candles) || candles.length < TENKAN) return [];
  const N = candles.length;
  const { senkouA, senkouB } = calculateIchimoku(candles);
  const out = new Array(N);

  for (let i = 0; i < N; i++) {
    out[i] = {
      time: candles[i].time,
      senkouA: senkouA[i],
      senkouB: senkouB[i],
    };
  }
  return out;
}

if (typeof window !== 'undefined') {
  window.ChartTVPluginIchimoku = { IchimokuCustomSeries, buildIchimokuData, calculateIchimoku };
}
