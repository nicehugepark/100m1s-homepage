/* ───── lib/chart-tv/plugins/fibonacci.js — #3 Fibonacci retracement helper (TradingView v5 native) ─────
   cycle22 Phase 7b — SPEC DOC-20260520-SPEC-001 v6 §2.2.1 #3 + §3.4 verbatim 정합.

   본질 (lead-meta §11.15 외부 spec 사전 검증 PASS):
   - TradingView Lightweight Charts v5 native `series.createPriceLine()` API 직접 사용 (custom plugin 불요)
   - SPEC v6 §3.4 코드 verbatim 정합:
     candleSeries.createPriceLine({ price, color: '#F5A623', lineStyle: LineStyle.Dotted, title: 'Fib XX.X%' })
   - 본 모듈 = helper 함수만 export (price 계산 + createPriceLine 3종 호출 wrapper)

   산식 (자체 SVG fibonacci.js verbatim 정합, SPEC v6 §3.4 verbatim):
   - hi = 가시 영역 최고가, lo = 가시 영역 최저가, span = hi - lo
   - Fib 38.2% = hi - span * 0.382 = high*0.618 + low*0.382
   - Fib 50%   = hi - span * 0.5   = (high + low) / 2
   - Fib 61.8% = hi - span * 0.618 = high*0.382 + low*0.618

   색상 (SPEC v6 §3.4 verbatim):
   - color = '#F5A623' (노랑 — MA 20과 동일 톤이지만 lineStyle Dotted로 시각 분리)
   - lineStyle = LineStyle.Dotted
   - lineWidth = default (1)
   - title = 'Fib 38.2%' / 'Fib 50%' / 'Fib 61.8%'

   §16 self-catch (Phase 7b 진입 시):
   - prompt verbatim "52w high / 52w low / 직전 swing low" = SPEC v6 §3.4 verbatim "38.2/50/61.8% retracement"와 mismatch
     → SPEC v6 §3.4 verbatim "Phase 7 dev sub-agent는 본 §3.4 verbatim 적용. 추정 금지." 정합
     → SPEC v6 §3.4 verbatim 채택 (Fib 38.2/50/61.8%). prompt 본질 비채택 박제 (보고 시 §16 self-catch 2건 명시).
*/

import { LineStyle } from 'https://cdn.jsdelivr.net/npm/lightweight-charts@5.0.8/+esm';

const DEFAULT_OPTIONS = {
  color: '#F5A623',
  lineStyle: LineStyle.Dotted,
  lineWidth: 1,
  axisLabelVisible: true,
};

const LEVELS = [
  { ratio: 0.382, title: 'Fib 38.2%' },
  { ratio: 0.5,   title: 'Fib 50%' },
  { ratio: 0.618, title: 'Fib 61.8%' },
];

/**
 * Fibonacci retracement 3 price line을 caller series에 attach.
 *
 * 본질: TradingView v5 native createPriceLine() API 사용 (custom plugin 불요).
 *
 * @param {ISeriesApi} candleSeries — 캔들 series (또는 line series — createPriceLine 지원 series 본질)
 * @param {Array<{open, high, low, close}>} candles — normalized candle 배열
 * @param {Object} [options] — override (color/lineStyle/lineWidth/axisLabelVisible)
 * @returns {Array<IPriceLine>} — createPriceLine return 3개 (제거 시 series.removePriceLine(line) 호출)
 */
export function attachFibonacci(candleSeries, candles, options = {}) {
  if (!candleSeries || !Array.isArray(candles) || candles.length < 2) return [];

  const opts = { ...DEFAULT_OPTIONS, ...options };

  const highs = candles.map((c) => c.high).filter((v) => typeof v === 'number' && v > 0);
  const lows = candles.map((c) => c.low).filter((v) => typeof v === 'number' && v > 0);
  if (highs.length < 2 || lows.length < 2) return [];

  const hi = Math.max(...highs);
  const lo = Math.min(...lows);
  const span = hi - lo;
  if (span <= 0) return [];

  const priceLines = [];
  LEVELS.forEach((lv) => {
    const price = hi - span * lv.ratio;
    const line = candleSeries.createPriceLine({
      price,
      color: opts.color,
      lineStyle: opts.lineStyle,
      lineWidth: opts.lineWidth,
      axisLabelVisible: opts.axisLabelVisible,
      title: lv.title,
    });
    priceLines.push(line);
  });
  return priceLines;
}

/**
 * 기존 attach한 Fibonacci price line 제거.
 * @param {ISeriesApi} candleSeries
 * @param {Array<IPriceLine>} priceLines — attachFibonacci return
 */
export function detachFibonacci(candleSeries, priceLines) {
  if (!candleSeries || !Array.isArray(priceLines)) return;
  priceLines.forEach((line) => {
    try {
      candleSeries.removePriceLine(line);
    } catch (e) {
      // noop — series 이미 detach 또는 chart remove
    }
  });
}

if (typeof window !== 'undefined') {
  window.ChartTVPluginFibonacci = { attachFibonacci, detachFibonacci };
}
