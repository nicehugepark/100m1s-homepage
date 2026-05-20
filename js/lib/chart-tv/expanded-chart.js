/* ───── lib/chart-tv/expanded-chart.js — Phase 7d-1 TradingView v5 wrapper (보조지표 정정 통합본) ─────
   cycle22 Phase 7d-1 — REQ DOC-20260521-REQ-001 v2 verbatim 정합.

   본질 (대표 정정 cumulative 6회 박제 정합):
   - 9 확정 (캔들 base + MA 6선 + 일목 구름 + 매물대 화면 가변 + 거래대금/MACD/RSI sub-pane + 분홍/배당락 marker)
   - 5 제거 (거래량 sub-pane #10 + Stochastic #11 + OBV #13 + Volume Profile #12 + 일목 Tenkan/Kijun/Chikou)
   - 피보나치 = Phase 7d-2 별건 후행 (본 Phase 7d-1 OFF default 유지, createPriceLine 3선 helper만 보존)

   §11.15 외부 spec 사전 검증 (WebSearch 2건 + 공식 docs 1건 PASS):
   - https://tradingview.github.io/lightweight-charts/tutorials/how_to/panes
     "chart.addSeries(SeriesType, options, paneIndex) — 3rd positional arg is pane index"
   - SPEC v6 §3.4 verbatim `pane: 1` options key 형태는 v5 실제 API와 mismatch (§16 self-catch #1)
   - 본 wrapper는 공식 docs verbatim 3번째 positional 인자 채택

   §16 self-catch (Phase 7d-1):
   1. SPEC v6 §3.4 `pane: 1` options key → 공식 docs `addSeries(Type, opts, paneIdx)` 3번째 positional 인자 정정 (자율 채택, SPEC 갱신 별건 후행)
   2. INDICATOR_META 13종 → INDICATOR_CHIPS 9종 (toggle-panel.js 이관, 제거 5종 chip 없음)
   3. volumeProfile (#12) 제거 — import + state + 호출 layer 모두 삭제
   4. ichimoku.js plugin 본문 정정 채택 (Tenkan/Kijun/Chikou draw 제거, senkouA/B + cloud만)
*/

import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  LineStyle,
  CrosshairMode,
} from 'https://cdn.jsdelivr.net/npm/lightweight-charts@5.0.8/+esm';

// Phase 7d-1 정정 plugin 4종 + 토글 panel (volume-profile.js 제거)
import { attachFibonacci, detachFibonacci } from './plugins/fibonacci.js';
import { IchimokuCustomSeries, buildIchimokuData } from './plugins/ichimoku.js';
import { VolumeByDecilePrimitive } from './plugins/volume-by-decile.js';
import { attachMarkers, detachMarkers } from './plugins/markers.js';
import { buildTogglePanel, INDICATOR_CHIPS } from './toggle-panel.js';

const STORAGE_KEY = 'm100s.chart.tv.indicators.global';

// SPEC §4.1 viewport별 차트 크기
function getViewportSize() {
  const w = window.innerWidth;
  if (w <= 360) return { width: 280, height: 320 };
  if (w <= 768) return { width: 640, height: 360 };
  if (w <= 1024) return { width: 880, height: 400 };
  return { width: 1000, height: 440 };
}

// REQ v2 §6 AC-6 verbatim default 정합 (9 확정 본질)
// ON: 캔들/MA/일목/매물대/거래대금/분홍/배당락 (7종)
// OFF: MACD/RSI/Fibonacci (3종 — 사용자 toggle)
const DEFAULT_INDICATORS = {
  ma6: true,             // #4 MA 6선 (5/20/43/60/120/240)
  ichimoku: true,        // #5 일목 (구름만)
  volumeByDecile: true,  // #1 매물대 화면 가변
  tradingValue: true,    // #7 거래대금 sub-pane
  macd: false,           // #8 MACD sub-pane (사용자 toggle)
  rsi: false,            // #9 RSI sub-pane (사용자 toggle)
  pinkSignal: true,      // #2 분홍 강세 marker
  exDividend: true,      // #6 배당락 marker
  fibonacci: false,      // #3 Fibonacci (Phase 7d-2 별건, OFF default)
};

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
  } catch (e) { /* private mode 등 silent fail */ }
}

// dailybars → TradingView v5 candle schema 변환
function normalizeData(dailyArr) {
  if (!Array.isArray(dailyArr) || dailyArr.length < 1) return [];
  return dailyArr
    .filter((d) => d && typeof d.c === 'number' && d.c > 0 && d.date)
    .map((d) => {
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
        _v: typeof d.v === 'number' ? d.v : 0,
        _tv: typeof d.tv === 'number' ? d.tv : 0,
      };
    })
    .filter(Boolean);
}

// MA 산식 (SMA period)
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

// REQ v2 §2 #4 MA 6선 — 5/20/43/60/120/240 (43=대표 매매 customization, 240=1년 영업일)
const MA_CONFIGS = [
  { period: 5,   color: '#EC4899', title: 'MA 5',   width: 1 },   // 핫핑크
  { period: 20,  color: '#F5A623', title: 'MA 20',  width: 1 },   // 노랑
  { period: 43,  color: '#A88639', title: 'MA 43',  width: 1.2 }, // am dark (대표 매매 강조)
  { period: 60,  color: '#1A6B2D', title: 'MA 60',  width: 1 },   // 초록
  { period: 120, color: '#6B7A99', title: 'MA 120', width: 1 },   // 회색
  { period: 240, color: '#2C3E50', title: 'MA 240', width: 1.2 }, // 진청 (1년 추세 강조)
];

// EMA helper
function computeEMA(data, period) {
  if (!Array.isArray(data) || data.length < period) return [];
  const out = new Array(data.length).fill(null);
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i].close;
  out[period - 1] = sum / period;
  for (let i = period; i < data.length; i++) {
    out[i] = data[i].close * k + out[i - 1] * (1 - k);
  }
  return out;
}

// MACD (12/26/9)
function computeMACD(data) {
  if (data.length < 35) return { line: [], signal: [], hist: [] };
  const ema12 = computeEMA(data, 12);
  const ema26 = computeEMA(data, 26);
  const macdVals = data.map((_, i) => {
    if (ema12[i] == null || ema26[i] == null) return null;
    return ema12[i] - ema26[i];
  });
  const firstIdx = macdVals.findIndex((v) => v != null);
  const signal = new Array(data.length).fill(null);
  if (firstIdx >= 0 && data.length - firstIdx >= 9) {
    const k = 2 / (9 + 1);
    let seed = 0;
    for (let i = firstIdx; i < firstIdx + 9; i++) seed += macdVals[i];
    signal[firstIdx + 8] = seed / 9;
    for (let i = firstIdx + 9; i < data.length; i++) {
      signal[i] = macdVals[i] * k + signal[i - 1] * (1 - k);
    }
  }
  const line = [];
  const sigOut = [];
  const hist = [];
  for (let i = 0; i < data.length; i++) {
    if (macdVals[i] != null) {
      line.push({ time: data[i].time, value: macdVals[i] });
    }
    if (signal[i] != null) {
      sigOut.push({ time: data[i].time, value: signal[i] });
    }
    if (macdVals[i] != null && signal[i] != null) {
      const h = macdVals[i] - signal[i];
      hist.push({
        time: data[i].time,
        value: h,
        color: h >= 0 ? 'rgba(197,57,57,0.6)' : 'rgba(25,88,199,0.6)',
      });
    }
  }
  return { line, signal: sigOut, hist };
}

// RSI (Wilder, period=14)
function computeRSI(data, period = 14) {
  if (data.length < period + 1) return [];
  const out = [];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = data[i].close - data[i - 1].close;
    if (ch > 0) avgGain += ch; else avgLoss -= ch;
  }
  avgGain /= period;
  avgLoss /= period;
  const rs0 = avgLoss === 0 ? 100 : (avgGain / avgLoss);
  out.push({ time: data[period].time, value: 100 - (100 / (1 + rs0)) });

  for (let i = period + 1; i < data.length; i++) {
    const ch = data[i].close - data[i - 1].close;
    const gain = ch > 0 ? ch : 0;
    const loss = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : (avgGain / avgLoss);
    out.push({ time: data[i].time, value: 100 - (100 / (1 + rs)) });
  }
  return out;
}

// 거래대금 histogram (sub-pane) — 캔들 색 동조 (양봉/음봉)
function buildTradingValue(data) {
  return data.map((d) => ({
    time: d.time,
    value: d._tv,
    color: d.close >= d.open ? 'rgba(197,57,57,0.55)' : 'rgba(25,88,199,0.55)',
  }));
}

function buildContainer(slot, ticker) {
  slot.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'cal-chart-tv-wrap';

  // 토글 chip bar 영역 (chart 상단)
  const togglesHost = document.createElement('div');
  togglesHost.className = 'cal-chart-tv-toggles-host';

  const main = document.createElement('div');
  main.className = 'cal-chart-tv-main';
  main.setAttribute('role', 'img');
  main.setAttribute('aria-label', `일봉 확대 차트, ${ticker}`);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'cal-chart-close';
  close.setAttribute('aria-label', '확대 차트 닫기');
  close.textContent = '접기 ▴';

  const attr = document.createElement('div');
  attr.className = 'cal-chart-tv-attr';
  attr.innerHTML = '<a href="https://www.tradingview.com/" target="_blank" rel="noopener" style="color:#6B7A99; font-size:10px; text-decoration:none;">Charts by TradingView</a>';

  wrap.appendChild(togglesHost);
  wrap.appendChild(main);
  wrap.appendChild(close);
  wrap.appendChild(attr);
  slot.appendChild(wrap);

  return { wrap, togglesHost, main, close };
}

/**
 * 차트 render orchestrator (Phase 7d-1).
 * contract: window.ChartTV.render(slot, dailyArr, options)
 */
function renderChartTV(container, dailyArr, options = {}) {
  if (!container) return null;

  const ticker = options.ticker || '';
  const data = normalizeData(dailyArr);
  const { wrap, togglesHost, main, close } = buildContainer(container, ticker);

  if (data.length < 1) {
    main.innerHTML = '<div class="cal-chart-empty" role="img" aria-label="차트 데이터 없음">데이터 누적 중</div>';
    return null;
  }

  const vp = getViewportSize();
  // sub-pane 3종 (거래대금 + MACD + RSI) — height 분배 본질
  const subPaneHeight = Math.round(vp.height * 0.15);
  const totalHeight = vp.height + subPaneHeight * 3;

  let state = options.indicatorState || loadIndicatorState();

  // chart instance
  const chart = createChart(main, {
    width: vp.width,
    height: totalHeight,
    layout: {
      background: { color: 'transparent' },
      textColor: 'rgba(0,0,0,0.6)',
      panes: {
        separatorColor: 'rgba(0,0,0,0.12)',
        separatorHoverColor: 'rgba(0,0,0,0.2)',
        enableResize: true,
      },
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
    },
    rightPriceScale: { borderColor: 'rgba(0,0,0,0.12)' },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
  });

  // 캔들 series (main pane = paneIdx 0)
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

  // ─── 모든 plugin/series instance 보관 (toggle 시 add/remove) ───
  const layers = {
    ma6: [],            // Array<ISeriesApi>
    ichimoku: null,     // ICustomSeriesApi
    volumeByDecile: null, // ISeriesPrimitive
    tradingValue: null, // ISeriesApi (sub-pane 1)
    macd: null,         // { line, signal, hist }
    rsi: null,          // ISeriesApi (sub-pane 3)
    seriesMarkers: null,
    fibLines: [],
  };

  // ── MA 6선 ──
  function addMA6() {
    if (layers.ma6.length > 0) return;
    MA_CONFIGS.forEach((cfg) => {
      const maData = computeMA(data, cfg.period);
      if (maData.length === 0) return;
      const line = chart.addSeries(LineSeries, {
        color: cfg.color,
        lineWidth: cfg.width,
        title: cfg.title,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      line.setData(maData);
      layers.ma6.push(line);
    });
  }
  function removeMA6() {
    layers.ma6.forEach((s) => { try { chart.removeSeries(s); } catch (e) { /* noop */ } });
    layers.ma6 = [];
  }

  // ── 일목 (구름만) ──
  function addIchimoku() {
    if (layers.ichimoku) return;
    try {
      layers.ichimoku = chart.addCustomSeries(new IchimokuCustomSeries(), {});
      layers.ichimoku.setData(buildIchimokuData(data.map((d) => ({
        time: d.time, open: d.open, high: d.high, low: d.low, close: d.close,
      }))));
    } catch (err) {
      layers.ichimoku = null;
    }
  }
  function removeIchimoku() {
    if (!layers.ichimoku) return;
    try { chart.removeSeries(layers.ichimoku); } catch (e) { /* noop */ }
    layers.ichimoku = null;
  }

  // ── 매물대 화면 가변 ──
  function addVolumeByDecile() {
    if (layers.volumeByDecile) return;
    try {
      layers.volumeByDecile = new VolumeByDecilePrimitive(chart, candleSeries, data);
      candleSeries.attachPrimitive(layers.volumeByDecile);
    } catch (err) {
      layers.volumeByDecile = null;
    }
  }
  function removeVolumeByDecile() {
    if (!layers.volumeByDecile) return;
    try {
      candleSeries.detachPrimitive(layers.volumeByDecile);
      layers.volumeByDecile.detached();
    } catch (e) { /* noop */ }
    layers.volumeByDecile = null;
  }

  // ── 거래대금 sub-pane (paneIdx 1) ──
  // v5.0.8 공식 API: chart.addSeries(Type, opts, paneIdx) 3번째 positional 인자
  function addTradingValue() {
    if (layers.tradingValue) return;
    try {
      layers.tradingValue = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      }, 1);
      layers.tradingValue.setData(buildTradingValue(data));
    } catch (err) {
      layers.tradingValue = null;
    }
  }
  function removeTradingValue() {
    if (!layers.tradingValue) return;
    try { chart.removeSeries(layers.tradingValue); } catch (e) { /* noop */ }
    layers.tradingValue = null;
  }

  // ── MACD sub-pane (paneIdx 2) ──
  function addMACD() {
    if (layers.macd) return;
    const m = computeMACD(data);
    if (m.line.length === 0) return;
    try {
      const line = chart.addSeries(LineSeries, {
        color: '#0064FF', lineWidth: 1, title: 'MACD',
        priceLineVisible: false, lastValueVisible: false,
      }, 2);
      const signal = chart.addSeries(LineSeries, {
        color: '#4D8EFF', lineWidth: 1, title: 'Signal',
        priceLineVisible: false, lastValueVisible: false,
      }, 2);
      const hist = chart.addSeries(HistogramSeries, {
        title: 'Hist',
        priceFormat: { type: 'volume' },
      }, 2);
      line.setData(m.line);
      signal.setData(m.signal);
      hist.setData(m.hist);
      layers.macd = { line, signal, hist };
    } catch (err) {
      layers.macd = null;
    }
  }
  function removeMACD() {
    if (!layers.macd) return;
    try {
      chart.removeSeries(layers.macd.line);
      chart.removeSeries(layers.macd.signal);
      chart.removeSeries(layers.macd.hist);
    } catch (e) { /* noop */ }
    layers.macd = null;
  }

  // ── RSI sub-pane (paneIdx 3) ──
  function addRSI() {
    if (layers.rsi) return;
    const rsiData = computeRSI(data, 14);
    if (rsiData.length === 0) return;
    try {
      layers.rsi = chart.addSeries(LineSeries, {
        color: '#0064FF', lineWidth: 1, title: 'RSI 14',
        priceLineVisible: false, lastValueVisible: false,
      }, 3);
      layers.rsi.setData(rsiData);
      layers.rsi.createPriceLine({ price: 30, color: '#94A3B8', lineStyle: LineStyle.Dashed, title: '30' });
      layers.rsi.createPriceLine({ price: 70, color: '#94A3B8', lineStyle: LineStyle.Dashed, title: '70' });
    } catch (err) {
      layers.rsi = null;
    }
  }
  function removeRSI() {
    if (!layers.rsi) return;
    try { chart.removeSeries(layers.rsi); } catch (e) { /* noop */ }
    layers.rsi = null;
  }

  // ── markers (분홍 + 배당락) ──
  function addMarkers() {
    if (layers.seriesMarkers) return;
    layers.seriesMarkers = attachMarkers(candleSeries, {
      pinkSignalDates: (state.pinkSignal !== false) ? (options.pinkSignalDates || []) : [],
      exDividendDates: (state.exDividend !== false) ? (options.exDividendDates || []) : [],
    });
  }
  function removeMarkers() {
    if (!layers.seriesMarkers) return;
    try { detachMarkers(layers.seriesMarkers); } catch (e) { /* noop */ }
    layers.seriesMarkers = null;
  }

  // ── Fibonacci (Phase 7d-2 별건, default OFF) ──
  function addFibonacci() {
    if (layers.fibLines.length > 0) return;
    layers.fibLines = attachFibonacci(candleSeries, data, {});
  }
  function removeFibonacci() {
    if (layers.fibLines.length === 0) return;
    try { detachFibonacci(candleSeries, layers.fibLines); } catch (e) { /* noop */ }
    layers.fibLines = [];
  }

  function applyState(s) {
    if (s.ma6) addMA6(); else removeMA6();
    if (s.ichimoku) addIchimoku(); else removeIchimoku();
    if (s.volumeByDecile) addVolumeByDecile(); else removeVolumeByDecile();
    if (s.tradingValue) addTradingValue(); else removeTradingValue();
    if (s.macd) addMACD(); else removeMACD();
    if (s.rsi) addRSI(); else removeRSI();
    if (s.pinkSignal || s.exDividend) {
      removeMarkers();
      addMarkers();
    } else {
      removeMarkers();
    }
    if (s.fibonacci) addFibonacci(); else removeFibonacci();
  }

  applyState(state);

  // 토글 panel chip bar 신축
  buildTogglePanel(togglesHost, state, (newState) => {
    state = newState;
    saveIndicatorState(state);
    applyState(state);
  });

  // timeScale fit content
  chart.timeScale().fitContent();

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
    try { chart.remove(); } catch (err) { /* noop */ }
  });

  const ro = new ResizeObserver(() => {
    const vp2 = getViewportSize();
    const subH2 = Math.round(vp2.height * 0.15);
    chart.applyOptions({ width: vp2.width, height: vp2.height + subH2 * 3 });
  });
  ro.observe(main);

  return {
    chart,
    candleSeries,
    layers,
    state,
    applyState,
    destroy() {
      try { ro.disconnect(); } catch (e) { /* noop */ }
      try { removeMarkers(); } catch (e) { /* noop */ }
      try { removeFibonacci(); } catch (e) { /* noop */ }
      try { removeVolumeByDecile(); } catch (e) { /* noop */ }
      try { chart.remove(); } catch (e) { /* noop */ }
    },
  };
}

window.ChartTV = {
  render: renderChartTV,
  loadIndicatorState,
  saveIndicatorState,
  INDICATOR_CHIPS,
};

export { renderChartTV, loadIndicatorState, saveIndicatorState, INDICATOR_CHIPS };
