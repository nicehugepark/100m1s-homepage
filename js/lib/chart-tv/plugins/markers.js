/* ───── lib/chart-tv/plugins/markers.js — #2 분홍 강세 + #6 배당락 marker primitive (TradingView v5) ─────
   cycle22 Phase 7c — SPEC DOC-20260520-SPEC-001 v6 §2.2.1 #2/#6 + §3.4 + §15 verbatim 정합.

   본질 (lead-meta §11.15 외부 spec 사전 검증 PASS):
   - TradingView Lightweight Charts v5에서 `series.setMarkers()` **deprecated**.
   - v5 정합 = `createSeriesMarkers(series, [...])` separate primitive 패턴 의무.
   - WebFetch corroborate (SPEC §15 + §3.4 verbatim):
     * https://tradingview.github.io/lightweight-charts/docs/migrations/from-v4-to-v5
       "Markers moved to separate primitive for optimized bundle size"
       "You must now import createSeriesMarkers separately"
     * https://tradingview.github.io/lightweight-charts/tutorials/how_to/series-markers
       v5 정합 패턴: createSeriesMarkers(series, [...markers]) + seriesMarkers.setMarkers([...]) 후속 갱신
   - bundle size 최적화 본질 — v3까지 core method였으나 v5에서 separate primitive로 분리

   marker 4종 본질 (SPEC v6 §2.2.1 + §3.4 verbatim):
   - #2 분홍 강세 신호: position='aboveBar', shape='arrowUp', color='#EC4899' (sev-hot 정합), text='강세'
     * 입력 source = options.pinkSignalDates (Array<string 'YYYY-MM-DD'>) — 후속 trigger 본질
       (Phase 7c 본 단계 = data schema stub 만 — 실 산식 + dataset 적재는 별건 cycle 본질)
   - #6 배당락 marker: position='belowBar', shape='circle', color='#6B7A99' (--neu 회색 정합), text='배당락'
     * 입력 source = options.exDividendDates (Array<string 'YYYY-MM-DD'>) — 자체 SVG ex-dividend.js 입력 schema 정합

   SPEC v6 §3.4 verbatim 채택 본질:
   - import { createSeriesMarkers } from 'lightweight-charts'
   - const seriesMarkers = createSeriesMarkers(candleSeries, [
       { time: '2026-05-15', position: 'aboveBar', shape: 'arrowUp', color: '#EC4899', text: '강세 #2' },
       { time: '2026-04-30', position: 'belowBar', shape: 'circle',  color: '#6B7A99', text: '배당락' },
     ]);
   - 후속 갱신: seriesMarkers.setMarkers([...])
   - 조회: seriesMarkers.markers()

   §16 self-catch (Phase 7c 진입 시):
   - prompt 본 plugin은 SPEC v6 §3.4 verbatim 채택 (분홍 강세 + 배당락 2종).
   - dataset 본질 (분홍 강세 산식 + 배당락 일자 source) = renderer.js _openChartExpand 입력 layer.
     본 Phase 7c는 marker primitive 통합 layer만 구현. 산식/dataset 본질은 후속 별건 cycle.
   - BusinessDay vs UNIX timestamp 본질: TradingView v5 marker time = candle series time 본질과 동일 type 의무.
     candle series가 BusinessDay 객체 {year, month, day} 사용 (expanded-chart.js normalizeData L129 정합) →
     marker time도 BusinessDay 객체로 변환 의무 (string 'YYYY-MM-DD' 직접 불가).
*/

import { createSeriesMarkers } from 'https://cdn.jsdelivr.net/npm/lightweight-charts@5.0.8/+esm';

// SPEC v6 §3.4 verbatim 색상 + shape 정합
const PINK_SIGNAL_OPTIONS = {
  position: 'aboveBar',
  shape: 'arrowUp',
  color: '#EC4899',
  text: '강세',
};

const EX_DIVIDEND_OPTIONS = {
  position: 'belowBar',
  shape: 'circle',
  color: '#6B7A99',
  text: '배당락',
};

/**
 * 'YYYY-MM-DD' string → BusinessDay {year, month, day} 변환.
 * candle series time schema (expanded-chart.js L129 normalizeData verbatim) 정합.
 *
 * @param {string} dateStr
 * @returns {{year, month, day}|null}
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

/**
 * 분홍 강세 + 배당락 marker 통합 attach.
 *
 * 본질: v5 marker primitive 단일 호출 (분리된 series.setMarkers() 2회 deprecated 패턴 회피).
 * 본 wrapper는 marker 배열 build + createSeriesMarkers 1회 호출.
 *
 * @param {ISeriesApi} candleSeries — 캔들 series (markers attach 대상)
 * @param {Object} [options]
 * @param {Array<string>} [options.pinkSignalDates] — 분홍 강세 일자 (Array<'YYYY-MM-DD'>)
 * @param {Array<string>} [options.exDividendDates] — 배당락 일자 (Array<'YYYY-MM-DD'>)
 * @returns {ISeriesMarkers|null} — createSeriesMarkers return (제거 시 destroy() 또는 setMarkers([]) 호출)
 */
export function attachMarkers(candleSeries, options = {}) {
  if (!candleSeries) return null;

  const pinkDates = Array.isArray(options.pinkSignalDates) ? options.pinkSignalDates : [];
  const exdDates = Array.isArray(options.exDividendDates) ? options.exDividendDates : [];

  const markers = [];

  // #2 분홍 강세 신호 (SPEC v6 §3.4 verbatim — aboveBar arrowUp #EC4899)
  pinkDates.forEach((dateStr) => {
    const time = toBusinessDay(dateStr);
    if (!time) return;
    markers.push({
      time,
      ...PINK_SIGNAL_OPTIONS,
    });
  });

  // #6 배당락 marker (SPEC v6 §3.4 verbatim — belowBar circle #6B7A99)
  exdDates.forEach((dateStr) => {
    const time = toBusinessDay(dateStr);
    if (!time) return;
    markers.push({
      time,
      ...EX_DIVIDEND_OPTIONS,
    });
  });

  if (markers.length === 0) return null;

  // markers time 기준 정렬 (TradingView v5 marker primitive 요구 본질 — ascending time order)
  markers.sort((a, b) => {
    const ta = a.time.year * 10000 + a.time.month * 100 + a.time.day;
    const tb = b.time.year * 10000 + b.time.month * 100 + b.time.day;
    return ta - tb;
  });

  // v5 unified marker primitive 단일 호출 (SPEC §15 + §3.4 verbatim)
  try {
    return createSeriesMarkers(candleSeries, markers);
  } catch (err) {
    // silent fail — marker primitive 미지원 또는 series detach 등 edge case
    return null;
  }
}

/**
 * 기존 attach한 markers 갱신 (재계산 필요 시 setMarkers([...]) 후속 호출).
 *
 * @param {ISeriesMarkers} seriesMarkers — attachMarkers return
 * @param {Object} options — pinkSignalDates / exDividendDates (attachMarkers와 동일 schema)
 */
export function updateMarkers(seriesMarkers, options = {}) {
  if (!seriesMarkers || typeof seriesMarkers.setMarkers !== 'function') return;

  const pinkDates = Array.isArray(options.pinkSignalDates) ? options.pinkSignalDates : [];
  const exdDates = Array.isArray(options.exDividendDates) ? options.exDividendDates : [];

  const markers = [];
  pinkDates.forEach((dateStr) => {
    const time = toBusinessDay(dateStr);
    if (!time) return;
    markers.push({ time, ...PINK_SIGNAL_OPTIONS });
  });
  exdDates.forEach((dateStr) => {
    const time = toBusinessDay(dateStr);
    if (!time) return;
    markers.push({ time, ...EX_DIVIDEND_OPTIONS });
  });
  markers.sort((a, b) => {
    const ta = a.time.year * 10000 + a.time.month * 100 + a.time.day;
    const tb = b.time.year * 10000 + b.time.month * 100 + b.time.day;
    return ta - tb;
  });

  try {
    seriesMarkers.setMarkers(markers);
  } catch (err) {
    // noop
  }
}

/**
 * markers detach (chart remove 시 정리 본질).
 *
 * @param {ISeriesMarkers} seriesMarkers — attachMarkers return
 */
export function detachMarkers(seriesMarkers) {
  if (!seriesMarkers) return;
  try {
    // v5 marker primitive detach 패턴 — setMarkers([]) 빈 배열로 reset (destroy() 메서드 없음)
    if (typeof seriesMarkers.setMarkers === 'function') {
      seriesMarkers.setMarkers([]);
    }
  } catch (err) {
    // noop
  }
}

if (typeof window !== 'undefined') {
  window.ChartTVPluginMarkers = { attachMarkers, updateMarkers, detachMarkers };
}
