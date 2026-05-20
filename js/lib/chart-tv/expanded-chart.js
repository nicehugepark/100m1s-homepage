/* ───── lib/chart-tv/expanded-chart.js — Phase 7c TradingView Lightweight Charts v5 wrapper (통합본) ─────
   cycle22 Phase 7a/7b/7c — REQ DOC-20260520-REQ-001 / SPEC DOC-20260520-SPEC-001 v6 §2 §3.4 §13 §15 §15.6 / DSN §3.6.6.

   본질:
   - TradingView Lightweight Charts v5.0.8 채택 (SPEC v3~v6 본질, Apache 2.0, ~35KB gzip)
   - 자체 SVG 16 모듈 (js/lib/chart/) = Phase 7c 본 단계 git rm 완료. ChartExpanded global 더 이상 미존재.
   - Phase 7a 범위 (commit 153c4330): 캔들 + MA 4선 (5/20/60/120) + grid + crosshair + timeScale + ChartTV.render() entry.
   - Phase 7b 범위 (commit 1a60f203): custom plugin 3종 (Ichimoku custom series + 매물대 10등분 primitive + Volume Profile continuous primitive) + Fibonacci horizontal createPriceLine 3종 helper.
   - Phase 7c 범위 (본 commit): marker primitive 통합 (createSeriesMarkers — 분홍 강세 #2 + 배당락 #6) + plugins 4종 통합 호출 (Ichimoku/매물대/Volume Profile/Fibonacci) + renderer.js _openChartExpand 교체 + sw.js STATIC_ASSETS list 정합 + 자체 SVG 16 모듈 git rm.

   ESM 모듈 본질:
   - news.html에서 `<script type="module">` import 의무 (defer classic script와 별개)
   - 본 wrapper는 ESM `export` + window 등록 dual 패턴 — 신규 contract (`window.ChartTV.render(slot, data, opts)`)
   - 자체 SVG ChartExpanded = git rm (renderer.js는 ChartTV.render 직접 호출)

   SPEC §3.4 v4 verbatim 채택 본질:
   - 캔들: addCandlestickSeries({upColor:'#C53939', downColor:'#1958C7', wickUp/Down, borderUp/Down})
   - MA 5/20/60/120: addLineSeries({color}) — §3.4 v4 default 4색 (#EC4899/#F5A623/#1A6B2D/#6B7A99) but
     §3.5 v4 추가 권고 (MA 5 = #F5A623 노랑 / MA 20 = #8B95A8 회색 + 옵션 의뢰)는 lead 결정 보류 → v4 default 채택.
   - grid: alpha 0.08 dotted (영웅문 시각 본질 정합 §3.1.3 mismatch D 봉쇄)
   - crosshair: Normal mode (라이브러리 default 모바일 친화)
   - timeScale + rightPriceScale: border alpha 0.12

   data schema 본질:
   - 입력 = renderer.js _openChartExpand normalized rows {date, o, h, l, c, v, tv}
     (Phase 2/2.2 prototype 20일 또는 Phase 3 dailybars 240일 lazy fetch swap)
   - TradingView expects: candle = {time, open, high, low, close} / histogram = {time, value, color?}
     {date: 'YYYY-MM-DD'} → time = epoch sec (TradingView v5 timestamp 본질) 또는 BusinessDay {year, month, day}
     본 wrapper는 BusinessDay 객체 사용 (영업일 본질 정합, timezone 무관)

   §16 self-catch (Phase 7a 진입 시):
   1. prompt "index.html" → 실제 chart 진입점은 news.html (index.html grep 0건 confirm) — news.html만 touch
   2. SRI hash vs jsdelivr `+esm` mutual exclusive → SRI 0건 + @5.0.8 pinned version 채택 (jsdelivr 공식 권고 verbatim "Do NOT use SRI with dynamically generated files")
   3. createSeriesMarkers는 Phase 7c 보류 (marker primitive 통합 layer)
   4. sw.js STATIC_ASSETS 0 touch (Phase 7c 통합)
*/

// v5 unified series API — addSeries(SeriesType, options) 패턴 의무 (v4 deprecated)
// Source: https://tradingview.github.io/lightweight-charts/docs/migrations/from-v4-to-v5 WebFetch 2026-05-21 04:30 KST verbatim
// §11.15 외부 spec 사전 검증 PASS — Phase 7a §16 self-catch 직후 자율 정정 (SPEC §3.4 v4 코드 v4 API 잔존 본질)
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  LineStyle,
  CrosshairMode,
} from 'https://cdn.jsdelivr.net/npm/lightweight-charts@5.0.8/+esm';

// Phase 7b plugins 4종 + Phase 7c markers 통합 import (모두 ESM module — wrapper 1회 import로 plugins 통합 로드)
import { attachFibonacci, detachFibonacci } from './plugins/fibonacci.js';
import { IchimokuCustomSeries } from './plugins/ichimoku.js';
import { VolumeByDecilePrimitive } from './plugins/volume-by-decile.js';
import { VolumeProfilePrimitive } from './plugins/volume-profile.js';
import { attachMarkers, updateMarkers, detachMarkers } from './plugins/markers.js';

const STORAGE_KEY = 'm100s.chart.tv.indicators.global';

// SPEC §4.1 viewport별 차트 크기 (자체 SVG ChartExpanded 정합)
function getViewportSize() {
  const w = window.innerWidth;
  if (w <= 360) return { width: 280, height: 320 };
  if (w <= 768) return { width: 640, height: 360 };
  if (w <= 1024) return { width: 880, height: 400 };
  return { width: 1000, height: 440 };
}

// SPEC §4.3 모바일 default ON 4종 + 데스크탑 default ON 5종 (자체 SVG 정합)
const DEFAULT_INDICATORS = {
  ma: true,         // #4 이동평균선 (5/20/60/120 — Phase 7a 채택)
  volume: true,     // #10 거래량 sub-pane — Phase 7a 보류 (Phase 7b custom plugin layer)
  pinkSignal: true, // #2 — Phase 7c marker primitive
  exDividend: true, // #6 — Phase 7c marker primitive
  fibonacci: false, // #3 — Phase 7b createPriceLine
  ichimoku: false,  // #5 — Phase 7b custom series
  valueBars: false, // #7 — Phase 7b sub-pane
  macd: false,      // #8 — Phase 7b sub-pane
  rsi: false,       // #9 — Phase 7b sub-pane
  stochastic: false,// #11 — Phase 7b sub-pane
  obv: false,       // #13 — Phase 7b sub-pane
  volumeProfile10: false, // #1 — Phase 7b custom primitive
  volumeProfile: false,   // #12 — Phase 7b custom primitive
};

// 13종 메타 (toggle UI 표시용 — Phase 7a wrapper)
const INDICATOR_META = [
  { key: 'ma', label: 'MA', name: '이동평균선', category: 'overlay' },
  { key: 'ichimoku', label: '일목', name: '일목균형표', category: 'overlay' },
  { key: 'fibonacci', label: '피보', name: '피보나치', category: 'overlay' },
  { key: 'volumeProfile10', label: '매물대', name: '매물대 10등분', category: 'side' },
  { key: 'volumeProfile', label: 'VP', name: 'Volume Profile', category: 'side' },
  { key: 'pinkSignal', label: '강세', name: '분홍 강세 신호', category: 'marker' },
  { key: 'exDividend', label: '배당락', name: '배당락', category: 'marker' },
  { key: 'volume', label: '거래량', name: '거래량 막대', category: 'sub-pane' },
  { key: 'valueBars', label: '거래대금', name: '거래대금', category: 'sub-pane' },
  { key: 'macd', label: 'MACD', name: 'MACD', category: 'sub-pane' },
  { key: 'rsi', label: 'RSI', name: 'RSI', category: 'sub-pane' },
  { key: 'stochastic', label: 'Stoch', name: 'Stochastic', category: 'sub-pane' },
  { key: 'obv', label: 'OBV', name: 'OBV', category: 'sub-pane' },
];

function loadIndicatorState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_INDICATORS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_INDICATORS, ...parsed };
  } catch (e) {
    return { ...DEFAULT_INDICATORS };
  }
}

function saveIndicatorState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // private mode 등 silent fail
  }
}

// dailybars 데이터 정규화 — renderer.js _openChartExpand 입력 schema {date, o, h, l, c, v, tv}
// → TradingView v5 candle schema {time, open, high, low, close}
// time = BusinessDay 객체 {year, month, day} — 영업일 본질 정합 (timezone 무관, 한국 KRX 정합)
function normalizeData(dailyArr) {
  if (!Array.isArray(dailyArr) || dailyArr.length < 1) return [];
  return dailyArr
    .filter((d) => d && typeof d.c === 'number' && d.c > 0 && d.date)
    .map((d) => {
      // 'YYYY-MM-DD' → BusinessDay
      const parts = String(d.date).slice(0, 10).split('-');
      if (parts.length !== 3) return null;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      if (!y || !m || !day) return null;
      return {
        time: { year: y, month: m, day: day },
        open: d.o,
        high: d.h,
        low: d.l,
        close: d.c,
        // 거래량 본질 보존 (Phase 7b sub-pane histogram series 입력 source)
        _v: typeof d.v === 'number' ? d.v : 0,
        _tv: typeof d.tv === 'number' ? d.tv : 0,
      };
    })
    .filter(Boolean);
}

// MA 산출 (period = 5/20/60/120 — SPEC §3.4 v4)
// 출력 = [{time, value}] line series 입력 정합
function computeMA(data, period) {
  if (!Array.isArray(data) || data.length < period) return [];
  const out = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;
    if (i >= period) sum -= data[i - period].close;
    if (i >= period - 1) {
      out.push({ time: data[i].time, value: sum / period });
    }
  }
  return out;
}

// SPEC §3.4 v4 MA 4색 default (§3.5 v4 추가 권고는 lead 결정 보류 → v4 default 채택)
// MA 5 = #EC4899 핫핑크 (분홍 강세 신호 #2와 색 동일 위험 §3.5 v4 권고 잔존 but Phase 7c marker primitive 도입 시점에 재 audit)
const MA_COLORS = {
  ma5:   { color: '#EC4899', title: 'MA 5' },
  ma20:  { color: '#F5A623', title: 'MA 20' },
  ma60:  { color: '#1A6B2D', title: 'MA 60' },
  ma120: { color: '#6B7A99', title: 'MA 120' },
};

// chart container 본질 — slot 내부에 chart root + close button + toggle bar wrapper
// (Phase 7a는 최소 wrapper만 — Phase 7b/7c custom plugin + marker 통합 시 toggle bar 13종 chip + attribution layer 신축)
function buildContainer(slot, ticker) {
  slot.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'cal-chart-tv-wrap';

  const main = document.createElement('div');
  main.className = 'cal-chart-tv-main';
  main.setAttribute('role', 'img');
  main.setAttribute('aria-label', `일봉 확대 차트, ${ticker}`);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'cal-chart-close';
  close.setAttribute('aria-label', '확대 차트 닫기');
  close.textContent = '접기 ▴';

  // attribution (Apache 2.0 의무 §13.8)
  const attr = document.createElement('div');
  attr.className = 'cal-chart-tv-attr';
  attr.innerHTML = '<a href="https://www.tradingview.com/" target="_blank" rel="noopener" style="color:#6B7A99; font-size:10px; text-decoration:none;">Charts by TradingView</a>';

  wrap.appendChild(main);
  wrap.appendChild(close);
  wrap.appendChild(attr);
  slot.appendChild(wrap);

  return { wrap, main, close };
}

// 차트 render orchestrator (Phase 7a — 캔들 + MA 4선만)
// contract: window.ChartTV.render(slot, dailyArr, options) — 자체 SVG ChartExpanded 정합
function renderChartTV(container, dailyArr, options = {}) {
  if (!container) return null;

  const ticker = options.ticker || '';
  const data = normalizeData(dailyArr);
  const { wrap, main, close } = buildContainer(container, ticker);

  // edge case: 데이터 부족
  if (data.length < 1) {
    main.innerHTML = '<div class="cal-chart-empty" role="img" aria-label="차트 데이터 없음">데이터 누적 중</div>';
    return null;
  }

  const vp = getViewportSize();

  // TradingView v5 chart 초기화 (SPEC §3.4 v4 verbatim)
  const chart = createChart(main, {
    width: vp.width,
    height: vp.height,
    layout: {
      background: { color: 'transparent' },
      textColor: 'rgba(0,0,0,0.6)',
    },
    grid: {
      vertLines: { color: 'rgba(0,0,0,0.08)', style: LineStyle.Dotted },
      horzLines: { color: 'rgba(0,0,0,0.08)', style: LineStyle.Dotted },
    },
    crosshair: { mode: CrosshairMode.Normal },
    timeScale: {
      borderColor: 'rgba(0,0,0,0.12)',
      timeVisible: false,
      secondsVisible: false,
      // 영업일 본질 정합 — BusinessDay 입력 시 빈 캘린더 날짜 (주말/공휴일) 자동 건너뜀
    },
    rightPriceScale: {
      borderColor: 'rgba(0,0,0,0.12)',
    },
    // 모바일 touch 정합 default (v5 native)
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
  });

  // 캔들 series (SPEC §3.4 v4 코드 본문은 v4 API verbatim — v5 unified addSeries 패턴으로 정정 cascade)
  // 한국 시장 관습 양봉 빨강 / 음봉 파랑 (cycle22 현 본질 정합 §3.1.2)
  const candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: '#C53939',
    downColor: '#1958C7',
    wickUpColor: '#C53939',
    wickDownColor: '#1958C7',
    borderUpColor: '#C53939',
    borderDownColor: '#1958C7',
  });
  candleSeries.setData(data.map((d) => ({
    time: d.time, open: d.open, high: d.high, low: d.low, close: d.close,
  })));

  // MA 4선 (SPEC §3.4 v4 default 4색)
  const state = options.indicatorState || loadIndicatorState();
  const maSeries = {};
  if (state.ma !== false) {
    const periods = [5, 20, 60, 120];
    const keys = ['ma5', 'ma20', 'ma60', 'ma120'];
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      const k = keys[i];
      const meta = MA_COLORS[k];
      const maData = computeMA(data, p);
      if (maData.length === 0) continue;
      const line = chart.addSeries(LineSeries, {
        color: meta.color,
        lineWidth: 1,
        title: meta.title,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      line.setData(maData);
      maSeries[k] = line;
    }
  }

  // ─── Phase 7c — marker primitive + plugins 4종 통합 호출 (toggle state 정합) ───────

  // #2 분홍 강세 신호 + #6 배당락 marker primitive (SPEC v6 §3.4 + §15 + §2.2.1 verbatim)
  // input: options.pinkSignalDates / options.exDividendDates (Array<'YYYY-MM-DD'>)
  // default state: pinkSignal=true / exDividend=true (SPEC §4.3 모바일 default ON)
  let seriesMarkers = null;
  if (state.pinkSignal !== false || state.exDividend !== false) {
    seriesMarkers = attachMarkers(candleSeries, {
      pinkSignalDates: (state.pinkSignal !== false) ? (options.pinkSignalDates || []) : [],
      exDividendDates: (state.exDividend !== false) ? (options.exDividendDates || []) : [],
    });
  }

  // #3 Fibonacci 38.2/50/61.8% horizontal price line (SPEC v6 §3.4 verbatim)
  let fibLines = [];
  if (state.fibonacci === true) {
    fibLines = attachFibonacci(candleSeries, data, {});
  }

  // #5 일목균형표 custom series (SPEC v6 §2.2.1 #5 + §3.1.2 색상 verbatim)
  let ichimokuSeries = null;
  if (state.ichimoku === true) {
    try {
      ichimokuSeries = chart.addCustomSeries(new IchimokuCustomSeries(), {});
      ichimokuSeries.setData(data.map((d) => ({
        time: d.time, open: d.open, high: d.high, low: d.low, close: d.close,
      })));
    } catch (err) {
      // custom series API 미지원 또는 plugin 본문 incompatibility — silent fail
      ichimokuSeries = null;
    }
  }

  // #1 매물대 10등분 ISeriesPrimitive (SPEC v6 §2.2.1 #1)
  let volumeByDecile = null;
  if (state.volumeProfile10 === true) {
    try {
      volumeByDecile = new VolumeByDecilePrimitive(chart, candleSeries, data);
      candleSeries.attachPrimitive(volumeByDecile);
    } catch (err) {
      volumeByDecile = null;
    }
  }

  // #12 Volume Profile continuous ISeriesPrimitive (SPEC v6 §2.2.1 #12)
  let volumeProfileCont = null;
  if (state.volumeProfile === true) {
    try {
      volumeProfileCont = new VolumeProfilePrimitive(chart, candleSeries, data);
      candleSeries.attachPrimitive(volumeProfileCont);
    } catch (err) {
      volumeProfileCont = null;
    }
  }

  // timeScale fit content (전체 영업일 시각 가시 — plugins attach 후 호출 본질)
  chart.timeScale().fitContent();

  // close button — slot 내부 닫기 (renderer.js _openChartExpand close 분기는 트리거 재클릭으로 처리, 본 close는 보조)
  close.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const card = container.closest('.cal-feature-card');
    if (card) {
      card.classList.remove('chart-expanded');
      card.setAttribute('aria-expanded', 'false');
      const trigger = card.querySelector('[data-expand-trigger="chart"]');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }
    // chart instance 정리 (메모리 누수 회피)
    try { chart.remove(); } catch (err) { /* noop */ }
  });

  // viewport resize 정합 (모바일 회전 등)
  const ro = new ResizeObserver(() => {
    const vp2 = getViewportSize();
    chart.applyOptions({ width: vp2.width, height: vp2.height });
  });
  ro.observe(main);

  return {
    chart,
    candleSeries,
    maSeries,
    seriesMarkers,
    fibLines,
    ichimokuSeries,
    volumeByDecile,
    volumeProfileCont,
    destroy() {
      try { ro.disconnect(); } catch (e) { /* noop */ }
      try { if (seriesMarkers) detachMarkers(seriesMarkers); } catch (e) { /* noop */ }
      try { if (fibLines && fibLines.length) detachFibonacci(candleSeries, fibLines); } catch (e) { /* noop */ }
      try { chart.remove(); } catch (e) { /* noop */ }
    },
  };
}

// ESM export + window 등록 dual 패턴 (renderer.js classic script 정합 + 후속 ESM consumer 정합)
window.ChartTV = {
  render: renderChartTV,
  loadIndicatorState,
  saveIndicatorState,
  INDICATOR_META,
};

export { renderChartTV, loadIndicatorState, saveIndicatorState, INDICATOR_META };
