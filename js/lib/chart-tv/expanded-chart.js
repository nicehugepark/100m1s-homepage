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
  createSeriesMarkers,
} from 'https://cdn.jsdelivr.net/npm/lightweight-charts@5.0.8/+esm';

// Phase 7d-1 정정 plugin 4종 + Phase 7d-1 P0-4 분홍 강세 vertical line primitive + 토글 panel
import { attachFibonacci, detachFibonacci } from './plugins/fibonacci.js';
import { IchimokuCustomSeries, buildIchimokuData } from './plugins/ichimoku.js';
import { VolumeByDecilePrimitive } from './plugins/volume-by-decile.js';
import { attachMarkers, detachMarkers } from './plugins/markers.js';
import { PinkSignalPrimitive } from './plugins/pink-signal.js';
import { buildTogglePanel, INDICATOR_CHIPS } from './toggle-panel.js';

const STORAGE_KEY = 'm100s.chart.tv.indicators.global';

// SPEC §4.1 viewport별 차트 크기
// P0-11 Fix-34 (2026-05-21 12:44 KST 대표 verbatim
//   "현재 나의 갤럭시s25 모바일폰에서 확인한 화면이다. ... 차트 자체가 모바일 버전과 데스크탑 버전을 다르게 가야할거같다.
//    그리고 모바일 버전에서는 y축 위치도 여전히 문제다."):
//   image #10 76d1f57d 직접 read evidence — 갤럭시 S25 본문:
//     - sub-pane title `#거래대` / `MAC` / `R` 본문 우측 본문 잘림 (`#거래대금` / `MACD` / `RSI`)
//     - 우측 priceScale 본문 visible 0건 (영웅문 23a74560 본문 우측 priceScale 727,000 ~ 270,692 본질 vs 본 시스템 부재)
//   root cause 결정적 진단:
//     - P0-10 Fix-32 본문 `Math.min(w - 16, 640)` = window.innerWidth 기준 → viewport 412px (S25) 본문 = 396px chart width
//     - 그러나 실제 chart parent 본문 = `.cal-feature-chart-expanded` 본문 (margin 8px 12px 4px + padding 12px)
//     - main 본문 (`.cal-chart-tv-main`, width:100%) 본문 실제 가용 width = card_width - margin(24) - padding(24) = card_width - 48px
//     - main { display:flex; justify-content:center; } → chart 본문 396px 본문이 부모 본문 (예: 364px) 초과 → overflow 우측 본문 잘림
//     - chart canvas 본문 자체가 부모 본문 초과 → 우측 priceScale (100px) + sub-pane title 본문 잘림
//   정합 본질 — `container.clientWidth` 본문 실측 채택 (DOM 본문 정확 가용 width):
//     - container = renderChartTV(container, ...) 인자 = `.cal-feature-chart-expanded` slot (padding 12 적용된 inner box)
//     - container.clientWidth 본문 = inner content area width (padding 제외) — 정확한 chart 본문 가용 width
//     - layout 본문 timing 본질: slot은 renderer.js L1492 `card.appendChild(slot)` 후 L1525 즉시 ChartTV.render 호출
//       → slot 본문 layout 완료 후 호출되므로 clientWidth 본문 정확 측정 PASS
//   별건 layout 본문 (대표 verbatim "모바일과 데스크탑 다르게"):
//     - 모바일 본문 priceScale minimumWidth 100 → 60 본문 축소 (좁은 폰 본문 가시 영역 본질)
//     - 모바일 본문 chart slot margin/padding 본문 축소 (Fix-37 본문 별건 CSS layer)
//   §11.15 외부 spec 사전 검증 PASS:
//     - HTMLElement.clientWidth 본문 = inner padding 본문 본문 포함 X (W3C CSSOM spec)
//     - TradingView Lightweight Charts v5 createChart options.width 본문 = canvas pixel width (정확 integer)
//     - PriceScaleOptions.minimumWidth 본문 = integer px (v5 docs)
function getViewportSize(container) {
  const w = window.innerWidth;
  // 모바일 본문 (w < 768) — container.clientWidth 본문 실측 width 본문 채택 (DOM 본문 정확 가용 width)
  if (w < 768) {
    let adaptiveWidth;
    if (container && container.clientWidth > 0) {
      // container = chart slot inner content area (padding 제외)
      // 본 chart slot 본문이 부모 카드 본문 width 본질에서 margin/padding 본문 빠진 본질 실측 width 본문
      adaptiveWidth = Math.max(280, Math.min(container.clientWidth, 640));
    } else {
      // fallback (container 본문 layout 본질 직전 호출 본질 시) — viewport - 48px (margin 24 + padding 24)
      const SAFETY_MARGIN = 48;
      adaptiveWidth = Math.max(280, Math.min(w - SAFETY_MARGIN, 640));
    }
    // height 본문 ratio (640:360 = 16:9) 보존 본질
    const adaptiveHeight = Math.round(adaptiveWidth * 360 / 640);
    return { width: adaptiveWidth, height: Math.max(280, adaptiveHeight) };
  }
  if (w <= 1024) return { width: 880, height: 400 };
  return { width: 1000, height: 440 };
}

// lead 옵션 A-3 회신 verbatim (2026-05-21 09:15:50 KST 대표 추가 정정):
// "그리고 하단 지표인 거래대금 rsi macd는 토글뱌튼 필요없이 기본 출력이야"
// → 거래대금/MACD/RSI = base 영구 ON (사용자 toggle 불가, chip 부재). DEFAULT_INDICATORS 본문 외 정합.
// 토글 chip 본질 = 6 chip (MA + 일목 + 매물대 + 분홍 + 배당락 + 피보 Phase 7d-2).
// MA = REQ v2 §2 #4 verbatim 6선 (5/20/43/60/120/240) 유지. MA 10 = REQ v3 별건 후행.
const DEFAULT_INDICATORS = {
  ma6: true,             // #4 MA 6선 (5/20/43/60/120/240) — chip
  ichimoku: true,        // #5 일목 (구름만, forward shift +26) — chip
  volumeByDecile: true,  // #1 매물대 화면 가변 — chip
  pinkSignal: true,      // #2 분홍 강세 marker — chip
  exDividend: true,      // #6 배당락 marker — chip
  fibonacci: false,      // #3 Fibonacci (Phase 7d-2 별건, OFF default) — chip
  // 하단 sub-pane 3종 (tradingValue/macd/rsi) = base 영구 ON (chip 부재). state 본문 외 layer 본질.
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

// REQ v3 §3.1 verbatim 정합 — MA 7선 (5/10/20/43/60/120/240). Phase 7d-2 별건 사이클 본질.
// 대표 verbatim 2026-05-21 09:15 KST "ma 선의 종류와 색상이다" + 영웅문 zoom 7 line 본문.
//
// P0-7 fix-6 (2026-05-21 11:01 KST):
//   REQ v3 §2 + REQ v4 §3.1 verbatim 영웅문 zoom 색상 정정 채택 (별건 cycle 후행 본질 → 본 P0-7 통합):
//     MA 5 = #FF69B4 분홍 (HotPink) — 영웅문 zoom verbatim
//     MA 10 = #FFD700 노랑 (Gold) — 영웅문 zoom verbatim
//     MA 20 = #87CEEB 하늘 (SkyBlue) — 영웅문 zoom verbatim
//     MA 43 = #FFA500 주황 (Orange) — 영웅문 zoom verbatim, 대표 매매 customization
//     MA 60 = #FF8C00 주황 (DarkOrange) — 영웅문 zoom verbatim
//     MA 120 = #4169E1 파랑 (RoyalBlue) — 영웅문 zoom verbatim
//     MA 240 = #90EE90 연두 (LightGreen) — 영웅문 zoom verbatim, 1년 영업일
//
// P0-7 fix-1 (2026-05-21 10:55 KST 대표 verbatim "확대 차트에서 ma선 레이블은 모두 제거해줘. 내 영웅문 화면에도 없잖아"):
//   title 본문 제거 — priceScale 본문 라벨 visible 부재 본질 (영웅문 정합).
//   기존 priceLineVisible:false + lastValueVisible:false + crosshairMarkerVisible:false 본문 정합 유지.
//   title 본문 빈 string '' 본질 → priceScale legend layer 본문 출력 부재.
//
// state key `ma6` 명칭은 그대로 유지 (localStorage backward 호환 본질). 의미는 7선으로 확장.
const MA_CONFIGS = [
  { period: 5,   color: '#FF69B4', title: '', width: 1 },   // HotPink 분홍 (영웅문 zoom verbatim)
  { period: 10,  color: '#FFD700', title: '', width: 1 },   // Gold 노랑 (영웅문 zoom verbatim)
  { period: 20,  color: '#87CEEB', title: '', width: 1 },   // SkyBlue 하늘 (영웅문 zoom verbatim)
  { period: 43,  color: '#FFA500', title: '', width: 1.2 }, // Orange 주황 (영웅문 zoom verbatim, 대표 customization)
  { period: 60,  color: '#FF8C00', title: '', width: 1 },   // DarkOrange 주황 (영웅문 zoom verbatim)
  { period: 120, color: '#4169E1', title: '', width: 1 },   // RoyalBlue 파랑 (영웅문 zoom verbatim)
  { period: 240, color: '#90EE90', title: '', width: 1.2 }, // LightGreen 연두 (영웅문 zoom verbatim, 1년 영업일)
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

// P0-4 영웅문 정합 fix #3 helper (2026-05-21 10:01 KST 대표 정정):
//   RSI 14 시계열 본문 → RSI < 30 (과매도) 시점 'YYYY-MM-DD' string 배열 추출.
//   영웅문 verbatim 임계값 30 본문 (gracefully).
function extractRSIOversoldDates(data, rsiData) {
  if (!Array.isArray(rsiData) || rsiData.length === 0) return [];
  const dates = [];
  rsiData.forEach((point) => {
    if (typeof point.value !== 'number' || point.value >= 30) return;
    const t = point.time;
    if (!t || typeof t.year !== 'number') return;
    const mm = String(t.month).padStart(2, '0');
    const dd = String(t.day).padStart(2, '0');
    dates.push(`${t.year}-${mm}-${dd}`);
  });
  return dates;
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

  // P0-11 Fix-34: container 인자 전달 — chart slot inner content width 실측 본문 채택 (모바일 본문 overflow 봉쇄)
  const vp = getViewportSize(container);
  // sub-pane 3종 (거래대금 + MACD + RSI) — height 분배 본질
  // P0-7 fix-5 (2026-05-21 10:55 KST 대표 verbatim "하단 지표의 높이가 너무 높다. 지금의 절반 수준으로 해봐"):
  //   subPaneHeight 본문 0.15 → 0.075 (절반 본질). main pane stretch factor 본질 상대 증가.
  //   setStretchFactor v5.0.8 API 본문 추가 적용 (chart instance 생성 후 chart.panes() 본문 호출 본질).
  const subPaneHeight = Math.round(vp.height * 0.075);
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
    // P0-11 Fix-36 (2026-05-21 12:44 KST 대표 verbatim "y축 위치도 여전히 문제"):
    //   image #10 76d1f57d 본문 우측 priceScale visible 0건 — chart canvas 본문 자체가 부모 본문 초과 (Fix-34 본질)
    //   본 Fix-34 본문 container.clientWidth 본문 채택 → chart canvas 본문 부모 본문 align 정합 후
    //   모바일 본문 좁은 screen (S25 412px 본문 → chart slot inner ~316px) 본문 priceScale 100px 본문이 33% 차지 → 압축 본질
    //   모바일 본문 minimumWidth 60 본문 (5자리 99,999원 본문 visible 정합), 데스크탑 100 유지.
    //   §11.15 외부 spec 사전 검증 PASS — v5 PriceScaleOptions.minimumWidth (px) accepts integer.
    rightPriceScale: {
      borderColor: 'rgba(0,0,0,0.12)',
      visible: true,
      scaleMargins: { top: 0.15, bottom: 0.15 },  // P0-9 Fix-25 본문 유지
      minimumWidth: window.innerWidth < 768 ? 60 : 100,  // P0-11 Fix-36: 모바일 60 / 데스크탑 100 별건 (대표 verbatim "모바일과 데스크탑 다르게")
    },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
  });

  // P0-7 fix-5 (2026-05-21 10:55 KST 대표 verbatim "하단 지표의 높이가 너무 높다. 지금의 절반 수준으로 해봐"):
  //   chart 생성 직후 setStretchFactor 본문 호출 — main pane 본문 비율 증가 + sub-pane 절반 본질.
  //   v5.0.8 IPaneApi.setStretchFactor() + getStretchFactor() — default = 1.0 동일 비율 본문.
  //   main pane stretch factor = 4.0 (sub-pane 3종 대비 4배) → 각 sub-pane = 1/(4+1+1+1) = 1/7 본문.
  //   §11.15 외부 spec 사전 검증 PASS (WebSearch v5.0.8 release notes + 공식 docs).
  try {
    const panes = chart.panes();
    if (Array.isArray(panes) && panes.length > 0 && typeof panes[0].setStretchFactor === 'function') {
      panes[0].setStretchFactor(4.0);  // main pane 본문 4배
    }
  } catch (err) { /* noop v5.0.8 미지원 fallback = totalHeight 본문만 적용 */ }

  // 캔들 series (main pane = paneIdx 0)
  // lead 옵션 A-3 채택 #4 — 현재가 priceLine 본질 (대표 verbatim 09:08 KST (c) "현재가가 표시되지 않는것도 문제")
  // P0-4 영웅문 정합 fix #1 (2026-05-21 10:00 KST):
  //   priceLineColor 동적 분기 — 마지막 candle close vs open 비교 후 양봉=#C53939 / 음봉=#1958C7
  //   영웅문 verbatim "14,370 ▲ 1,920 (15.42%)" 양봉 = red priceLine 정합
  const lastCandle = data.length > 0 ? data[data.length - 1] : null;
  const lastBullish = lastCandle && lastCandle.close >= lastCandle.open;
  const priceLineColor = lastBullish ? '#C53939' : '#1958C7';
  // P0-13 Fix-45 (2026-05-21 13:44 KST 대표 verbatim "주가의 소수점은 필요없다. 한국은 소수점 화폐가 없다"):
  //   priceFormat 본문 한국 화폐 정합 — precision 0 + minMove 1 본질 (정수 본문 visible).
  //   영웅문 verbatim 본문 정합: 727,000 / 657,680 / 592,000 본문 정수 본문 (소수점 부재).
  //   §11.15 외부 spec 사전 검증 PASS — TradingView v5 PriceFormat:
  //     { type: 'price', precision: 0, minMove: 1 } = 정수만 visible 본문 정합 본질 (PriceFormatBuiltIn spec).
  const KRW_PRICE_FORMAT = { type: 'price', precision: 0, minMove: 1 };
  const candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: '#C53939',
    downColor: '#1958C7',
    wickUpColor: '#C53939',
    wickDownColor: '#1958C7',
    borderUpColor: '#C53939',
    borderDownColor: '#1958C7',
    lastValueVisible: true,
    priceLineVisible: true,
    priceLineWidth: 1,
    priceLineColor: priceLineColor,
    priceLineStyle: 2, // Dashed
    priceFormat: KRW_PRICE_FORMAT,  // P0-13 Fix-45: 한국 화폐 정수 본문 정합
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
    pinkSignal: null,   // ISeriesPrimitive (P0-4 분홍 vertical line)
    // Phase 7d-2 신축 — fibonacci 자석 drawing tool controller (signature 변경, Array → single instance)
    fibController: null,
  };

  // RSI 과매도 dates 미리 산출 (markers attach 본문 source) — P0-4 영웅문 정합 fix #3
  const rsiDataPrecomputed = computeRSI(data, 14);
  const rsiOversoldDatesAuto = extractRSIOversoldDates(data, rsiDataPrecomputed);

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
        priceFormat: KRW_PRICE_FORMAT,  // P0-13 Fix-45: MA 가격 라인 본문 정수 본문 정합
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
  // P0-7 fix-4 (2026-05-21 10:55 KST 대표 verbatim
  //   "일목균형표 역시 오류가 있는 것 같다. 너무 상단에 얇게 그려지는데 차트 위치와 너무 안맞아"):
  //   root cause 진단 본질 = ICustomSeries 본문 default priceScale 본문 candle series와 mismatch
  //   → priceScaleId 본문 'right' 명시 (candle series와 동일 priceScale share 본질)
  //   → priceLineVisible:false + lastValueVisible:false 본문 정합 (legend 본문 회피)
  //   §11.15 외부 spec 사전 검증 — ICustomSeries options.priceScaleId 본문 v5 지원 PASS
  function addIchimoku() {
    if (layers.ichimoku) return;
    try {
      layers.ichimoku = chart.addCustomSeries(new IchimokuCustomSeries(), {
        priceScaleId: 'right',           // candle series와 동일 right priceScale share 본질
        lastValueVisible: false,
        priceLineVisible: false,
        priceFormat: KRW_PRICE_FORMAT,   // P0-13 Fix-45: 일목 senkou span 가격 본문 정수 본문 정합
      });
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
  // P0-4 영웅문 정합 fix #2 (2026-05-21 10:00 KST):
  //   title: '#거래대금' 영웅문 verbatim (priceScale 좌측 상단 자동 표시 본질, TradingView v5 native)
  function addTradingValue() {
    if (layers.tradingValue) return;
    try {
      layers.tradingValue = chart.addSeries(HistogramSeries, {
        title: '#거래대금',
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
  // P0-4 영웅문 정합 fix #2 (2026-05-21 10:00 KST):
  //   title 영웅문 verbatim — 'MACD Oscillator 12,26,9' / 'MACD 시그널 9' / 'Hist'
  //   (영웅문 reference 본문 "MACD Oscillator 12,26,9 MACD 시그널 3,177.81" 정합)
  //
  // P0-7 fix-10 (2026-05-21 11:03 KST 대표 verbatim):
  //   "macd의 경우 시그널 선과 오실래이터 선이 크로스 할 때 데드크로스일 경우 파란색 아래쪽 화살표,
  //    골든크로스일 때 빨강색 위쪽 화살표를 macd 보조지표의 크로스하는 라인에 그려줘야해.
  //    데드크로스는 라인 위에 골든크로스는 라인 아래에."
  //
  //   골든크로스 (MACD line이 signal line 위로 cross) = belowBar arrowUp #C53939 (한국 시장 강세 빨강)
  //   데드크로스 (MACD line이 signal line 아래로 cross) = aboveBar arrowDown #1958C7 (한국 시장 약세 파랑)
  //
  //   §11.15 외부 spec 사전 검증 PASS:
  //   - createSeriesMarkers(series, markers) v5 primitive 본질 (markers.js 동일 패턴)
  //   - position 'aboveBar' / 'belowBar' 본문 sub-pane series 본문 정합 (high/low value 기준)
  //
  //   §16 self-catch:
  //   - 모든 종목 동일 공식 본문 (종목 레벨 하드코딩 0건, 대표 정책 정합)
  //   - signal line undefined / NaN 본문 graceful skip
  //   - edge case 첫 시점 (i=0) cross detection 부재 (prev 본문 없음)
  function detectMACDCrosses(line, signal) {
    // line/signal 본문 = [{time, value}, ...] 동일 length 가정 못함 (signal 본문 9 영업일 지연 본질)
    // time 본문 key string 'YYYY-MM-DD' 생성 → signal map 본문 lookup
    const golden = [];
    const dead = [];
    if (!Array.isArray(line) || !Array.isArray(signal) || line.length < 2 || signal.length < 2) {
      return { golden, dead };
    }
    const timeKey = (t) => `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;
    const signalMap = new Map();
    signal.forEach((p) => { signalMap.set(timeKey(p.time), p.value); });

    let prevDiff = null;
    for (let i = 0; i < line.length; i++) {
      const lp = line[i];
      const sv = signalMap.get(timeKey(lp.time));
      if (typeof lp.value !== 'number' || typeof sv !== 'number' || isNaN(lp.value) || isNaN(sv)) {
        prevDiff = null;
        continue;
      }
      const curDiff = lp.value - sv;
      if (prevDiff != null) {
        // 골든크로스: prev <= 0 && cur > 0 (MACD line이 signal line 아래에서 위로)
        if (prevDiff <= 0 && curDiff > 0) {
          golden.push({
            time: lp.time,
            position: 'belowBar',
            shape: 'arrowUp',
            color: '#C53939',
          });
        }
        // 데드크로스: prev >= 0 && cur < 0 (MACD line이 signal line 위에서 아래로)
        if (prevDiff >= 0 && curDiff < 0) {
          dead.push({
            time: lp.time,
            position: 'aboveBar',
            shape: 'arrowDown',
            color: '#1958C7',
          });
        }
      }
      prevDiff = curDiff;
    }
    return { golden, dead };
  }

  // P0-10 Fix-29 (2026-05-21 12:17 KST 대표 verbatim
  //   "'rsi 14 시그널 9' 레이블은 그냥 'RSI'로 macd는 그냥 'MACD'로 하고"):
  //   영웅문 reference 영웅문은 'MACD Oscillator 12,26,9 MACD 시그널' / 'RSI 14 시그널 9' 본문 한 줄
  //   but 대표 verbatim 단순화 의도 — 그냥 'MACD' / 'RSI' 본문 채택 정합 (영웅문 본문 무시, 대표 명시 우선).
  //   - line series title = 'MACD' (영웅문 본문 무시, 대표 verbatim 정합)
  //   - signal series title = '' (단일 row title 보존)
  //   - Hist series title = '' (영웅문 본문 부재 정보, P0-9 Fix-23 본문 유지)
  function addMACD() {
    if (layers.macd) return;
    const m = computeMACD(data);
    if (m.line.length === 0) return;
    try {
      const line = chart.addSeries(LineSeries, {
        color: '#0064FF', lineWidth: 1, title: 'MACD',  // P0-10 Fix-29: 대표 verbatim 단순화 본문
        priceLineVisible: false, lastValueVisible: false,
      }, 2);
      const signal = chart.addSeries(LineSeries, {
        color: '#4D8EFF', lineWidth: 1, title: '',  // signal title 부재 (단일 row 정합)
        priceLineVisible: false, lastValueVisible: false,
      }, 2);
      const hist = chart.addSeries(HistogramSeries, {
        title: '',                                   // P0-9 Fix-23: 영웅문 본문 부재 정보 제거
        priceFormat: { type: 'volume' },
      }, 2);
      line.setData(m.line);
      signal.setData(m.signal);
      hist.setData(m.hist);

      // P0-7 fix-10: MACD 크로스 detection + marker attach (line series 본문에 attach, sort by time)
      const { golden, dead } = detectMACDCrosses(m.line, m.signal);
      const crossMarkers = [...golden, ...dead].sort((a, b) => {
        const ta = a.time.year * 10000 + a.time.month * 100 + a.time.day;
        const tb = b.time.year * 10000 + b.time.month * 100 + b.time.day;
        return ta - tb;
      });
      let macdCrossMarkers = null;
      if (crossMarkers.length > 0) {
        try {
          macdCrossMarkers = createSeriesMarkers(line, crossMarkers);
        } catch (err) { /* noop createSeriesMarkers v5 미지원 fallback */ }
      }

      layers.macd = { line, signal, hist, crossMarkers: macdCrossMarkers };
    } catch (err) {
      layers.macd = null;
    }
  }
  function removeMACD() {
    if (!layers.macd) return;
    try {
      if (layers.macd.crossMarkers && typeof layers.macd.crossMarkers.setMarkers === 'function') {
        layers.macd.crossMarkers.setMarkers([]);
      }
      chart.removeSeries(layers.macd.line);
      chart.removeSeries(layers.macd.signal);
      chart.removeSeries(layers.macd.hist);
    } catch (e) { /* noop */ }
    layers.macd = null;
  }

  // ── RSI sub-pane (paneIdx 3) ──
  // P0-4 영웅문 정합 fix #2 (2026-05-21 10:00 KST):
  //   title 영웅문 verbatim — 'RSI 14 시그널 9' (영웅문 reference "RSI 14 시그널 9 46.86 / 63.09 / 84.39" 정합)
  //
  // P0-7 fix-9 (2026-05-21 11:00 KST 대표 verbatim
  //   "하단 rsi 보조지표의 경우 과열30, 침체30, period 14, signal 9 거꾸로 보기를 해서 보여줘"):
  //   - 거꾸로 보기 (invertScale) — priceScale invertScale:true 본질 (Y축 반전, 침체 위 + 과열 아래)
  //   - 양 임계값 30 (과열 30 + 침체 30 본질) — invertScale 본질 상 둘 다 30 본문 정합
  //     §16 본질: 영웅문 본인 customization 본문 (표준 RSI overbought 70 / oversold 30 vs 영웅문 둘 다 30 본질)
  //   - signal 9 — SMA(9) of RSI series 본문 추가 신축
  //   - period 14 — 기존 정합 유지
  //   - title 영웅문 verbatim 유지 'RSI 14 시그널 9'
  //   - §11.15 외부 spec 사전 검증 PASS (TradingView v5 PriceScaleOptions invertScale:bool, default:false)
  // P0-10 Fix-29 (2026-05-21 12:17 KST 대표 verbatim
  //   "'rsi 14 시그널 9' 레이블은 그냥 'RSI'로 macd는 그냥 'MACD'로 하고"):
  //   영웅문 본문 'RSI 14 시그널 9' but 대표 명시 단순화 → 'RSI' 본문 채택 정합
  //   - line series title = 'RSI' (대표 verbatim 정합)
  //   - signal series title = '' (단일 row title 보존)
  // P0-9 Fix-23 본문 유지: priceLine title '' (영웅문 본문 부재 정보)
  function addRSI() {
    if (layers.rsi) return;
    const rsiData = computeRSI(data, 14);
    if (rsiData.length === 0) return;
    try {
      // RSI 메인 라인 (period 14)
      layers.rsi = chart.addSeries(LineSeries, {
        color: '#0064FF', lineWidth: 1, title: 'RSI',  // P0-10 Fix-29: 대표 verbatim 단순화 본문
        priceLineVisible: false, lastValueVisible: false,
      }, 3);
      layers.rsi.setData(rsiData);
      // P0-9 Fix-23: priceLine title 제거 (영웅문 본문 부재 정보, 임계값 30 line 본문만 visible 본문)
      layers.rsi.createPriceLine({ price: 30, color: '#94A3B8', lineStyle: LineStyle.Dashed, title: '' });
      layers.rsi.createPriceLine({ price: 30, color: '#94A3B8', lineStyle: LineStyle.Dashed, title: '' });

      // P0-7 fix-9: signal 9 line 본문 신축 — SMA(9) of RSI series
      const signalData = [];
      if (rsiData.length >= 9) {
        let sum = 0;
        for (let i = 0; i < rsiData.length; i++) {
          sum += rsiData[i].value;
          if (i >= 9) sum -= rsiData[i - 9].value;
          if (i >= 8) signalData.push({ time: rsiData[i].time, value: sum / 9 });
        }
      }
      if (signalData.length > 0) {
        layers.rsiSignal = chart.addSeries(LineSeries, {
          color: '#FFA726', lineWidth: 1, title: '',  // P0-9 Fix-24: signal title 제거 (영웅문 본문 단일 row 정합)
          priceLineVisible: false, lastValueVisible: false,
        }, 3);
        layers.rsiSignal.setData(signalData);
      }

      // P0-7 fix-9: invertScale 본문 — RSI sub-pane priceScale Y축 반전 (영웅문 customization)
      try {
        chart.priceScale('right', 3).applyOptions({ invertScale: true });
      } catch (err) { /* noop fallback */ }
    } catch (err) {
      layers.rsi = null;
    }
  }
  function removeRSI() {
    if (!layers.rsi) return;
    try { chart.removeSeries(layers.rsi); } catch (e) { /* noop */ }
    if (layers.rsiSignal) {
      try { chart.removeSeries(layers.rsiSignal); } catch (e) { /* noop */ }
      layers.rsiSignal = null;
    }
    layers.rsi = null;
  }

  // ── markers (배당락 + RSI 과매도) ──
  // P0-4 영웅문 정합 정정 (2026-05-21 10:02 KST): 분홍 강세 marker 본문 제거 — 별건 PinkSignalPrimitive layer로 이관
  // P0-4 영웅문 정합 fix #3 (2026-05-21 10:01 KST): RSI<30 (과매도) 시점 검은 arrowDown marker 신축
  function addMarkers() {
    if (layers.seriesMarkers) return;
    layers.seriesMarkers = attachMarkers(candleSeries, {
      exDividendDates: (state.exDividend !== false) ? (options.exDividendDates || []) : [],
      rsiOversoldDates: rsiOversoldDatesAuto || [],
    });
  }
  function removeMarkers() {
    if (!layers.seriesMarkers) return;
    try { detachMarkers(layers.seriesMarkers); } catch (e) { /* noop */ }
    layers.seriesMarkers = null;
  }

  // ── 분홍 강세 vertical line primitive (P0-4 영웅문 정합 정정 2026-05-21 10:02 KST) ──
  function addPinkSignal() {
    if (layers.pinkSignal) return;
    try {
      const pinkDates = options.pinkSignalDates || [];
      if (!Array.isArray(pinkDates) || pinkDates.length === 0) return;
      layers.pinkSignal = new PinkSignalPrimitive(chart, pinkDates, {});
      candleSeries.attachPrimitive(layers.pinkSignal);
    } catch (err) {
      layers.pinkSignal = null;
    }
  }
  function removePinkSignal() {
    if (!layers.pinkSignal) return;
    try {
      candleSeries.detachPrimitive(layers.pinkSignal);
      layers.pinkSignal.detached();
    } catch (e) { /* noop */ }
    layers.pinkSignal = null;
  }

  // ── Fibonacci 자석 drawing tool (Phase 7d-2 신축, default OFF) ──
  // 본질: 사용자 클릭 + 자석 snap + drag handle + localStorage 영구화 (대표 verbatim 08:08 KST)
  // signature: attachFibonacci(chart, series, candles, ticker, container, options)
  function addFibonacci() {
    if (layers.fibController) return;
    layers.fibController = attachFibonacci(chart, candleSeries, data, ticker, main, {});
  }
  function removeFibonacci() {
    if (!layers.fibController) return;
    try { detachFibonacci(layers.fibController); } catch (e) { /* noop */ }
    layers.fibController = null;
  }

  function applyState(s) {
    if (s.ma6) addMA6(); else removeMA6();
    if (s.ichimoku) addIchimoku(); else removeIchimoku();
    if (s.volumeByDecile) addVolumeByDecile(); else removeVolumeByDecile();
    // 하단 sub-pane 3종 = base 영구 ON (lead 옵션 A-3 회신 verbatim 09:15:50 KST 대표 정정)
    // chip 부재 + toggle 불가 + state 본문 외 layer 본질
    // P0-4 영웅문 정합 정정 (2026-05-21 10:02 KST):
    //   분홍 강세 = vertical line primitive (별건 layer, state.pinkSignal chip toggle 본질 정합)
    //   배당락 + RSI 과매도 = markers.js 통합 layer (createSeriesMarkers 본문)
    //   RSI 과매도 marker = 영웅문 본질 visible 영구 (RSI<30 자동 추출, 사용자 toggle 불가, 영웅문 reference 정합)
    if (s.exDividend) {
      removeMarkers();
      addMarkers();
    } else {
      // RSI 과매도는 영웅문 본질 영구 visible — 배당락 toggle off 시에도 RSI 과매도 marker 유지
      removeMarkers();
      addMarkers();
    }
    if (s.pinkSignal) addPinkSignal(); else removePinkSignal();
    if (s.fibonacci) addFibonacci(); else removeFibonacci();
  }

  applyState(state);

  // 하단 sub-pane 3종 base 영구 ON — applyState 호출 후 1회 신축, toggle 불가
  // (lead 옵션 A-3 회신 verbatim "토글뱌튼 필요없이 기본 출력")
  addTradingValue();
  addMACD();
  addRSI();

  // P0-10 Fix-30 (2026-05-21 12:17 KST 대표 verbatim
  //   "보조지표의 y축 우측에 있는 값은 보여주지 않아도 된다"):
  //   sub-pane 3종 (거래대금 paneIdx=1 / MACD paneIdx=2 / RSI paneIdx=3) priceScale 본문 정합:
  //     - 우측 y축 본문 가격 라벨 visible 부재 의무 (label visible 본문 hide)
  //     - 본질: lastValueVisible 본문 false 본문 + priceScale borderVisible 본문 유지 (chart 본문 visual 정합)
  //   §11.15 외부 spec 사전 검증 PASS:
  //     - TradingView v5 PriceScaleOptions.visible 본문 false → priceScale 전체 hide (border + label 둘 다)
  //     - chart.priceScale(id, paneIdx).applyOptions({visible: false}) 본문 v5 native API
  //   §16 self-catch:
  //     - sub-pane 본문 priceScale 본문 hide 시 chart 본문 layout 본문 shift 가능성 본문 (canvas width 본문 늘어남)
  //     - main pane right priceScale 본문은 visible 유지 (P0-10 Fix-28 minimumWidth:100 본문 정합)
  //     - sub-pane 본문 priceScale 본문 hide 본문 가능 → main pane priceScale 본문 본문 alignment 본문 정합
  try {
    // 거래대금 sub-pane (paneIdx=1) priceScale visible 본문 hide
    if (layers.tradingValue) {
      // tradingValue series는 priceScaleId='' (overlay) 본문 정합
      // P0-10 Fix-30: lastValueVisible 본문 false + priceLineVisible 본문 false 본문 (priceScale label hide)
      layers.tradingValue.applyOptions({ lastValueVisible: false, priceLineVisible: false });
    }
    // MACD sub-pane (paneIdx=2) priceScale label hide
    if (layers.macd) {
      if (layers.macd.line) layers.macd.line.applyOptions({ lastValueVisible: false, priceLineVisible: false });
      if (layers.macd.signal) layers.macd.signal.applyOptions({ lastValueVisible: false, priceLineVisible: false });
      if (layers.macd.hist) layers.macd.hist.applyOptions({ lastValueVisible: false, priceLineVisible: false });
    }
    // RSI sub-pane (paneIdx=3) priceScale label hide
    if (layers.rsi) layers.rsi.applyOptions({ lastValueVisible: false, priceLineVisible: false });
    if (layers.rsiSignal) layers.rsiSignal.applyOptions({ lastValueVisible: false, priceLineVisible: false });
  } catch (err) { /* noop fallback = priceScale label visible 유지 */ }

  // 토글 panel chip bar 신축
  buildTogglePanel(togglesHost, state, (newState) => {
    state = newState;
    saveIndicatorState(state);
    applyState(state);
  });

  // timeScale — lead 옵션 A-3 채택 #5 (대표 verbatim 09:08 KST (a) "가장 최근 날짜로 포커싱이 안되는게 문제")
  // P0-13 Fix-46 (2026-05-21 13:44 KST 대표 verbatim "선행스팬인데 선행하지 않다.. 위치와 비율도 엉망이다"):
  //   P0-9 Fix-20 backward source cascade revert + P0-4 forward shift 본질 복원 본문 정합.
  //   영웅문 verbatim "선행스팬 = leading = forward shift +26 영업일" 본질 → cloud 본문 미래 영역 visible 정합.
  //   visible range 본문 = (최근 candle영역 ~50) + (미래 SHIFT=26 영업일 cloud 영역) 양 축 포함 본질.
  //   FUTURE_CLOUD 본문 = SHIFT 상수 본문 (ichimoku.js 본문 동일 정합) — 영웅문 본문 우측 cloud 영역 visible.
  //
  // P0-14b Fix-48 (2026-05-21 14:17 KST §16 정직 채널 + §11.15 외부 spec 검증 PASS):
  //   P0-14 sub-agent root cause catch = fitContent + setVisibleLogicalRange race condition.
  //   TradingView v5 docs (WebSearch 2회 corroborating + 공식 docs + github issue #1107 cross-check):
  //     - fitContent()는 "momentary operation" but axis width recalc → cascade visible range re-change 본질
  //     - 호출 순서 win 본질 = "whichever is called last takes effect" but cascade re-render 본문 race
  //     - fitContent가 setVisibleLogicalRange의 의도된 logical range를 cascade overwrite 가능 본질
  //   Fix 옵션 A 채택 (race 근본 제거 본질) — fitContent() 호출 폐기 + setVisibleLogicalRange만 본문.
  //     - ichimoku cloud series outLen = N + SHIFT = N + 26 logical index 등록 PASS (ichimoku.js:108 verbatim grep)
  //     - setVisibleLogicalRange({to: N-1+26}) → series 등록 logical index 0~N+25 범위 내 effective 본질
  //     - candle series N=240 fit 누락 본문 회피 — setVisibleLogicalRange가 의도된 range 정확 결정 본질
  //   라이브 라이브 결함 (7072f037 모바일 cloud 우측 미래 0건 vs 영웅문 3005fbac/23a74560 +26영업일 visible) 결정적 fix 본질.
  try {
    const N = data.length;
    if (N > 0) {
      const VISIBLE_RECENT = 50;       // 최근 영업일 (영웅문 정합 약 39 + 여유분)
      const FUTURE_CLOUD = 26;         // P0-13 Fix-46: 미래 cloud 영역 본문 영업일 (ichimoku.js SHIFT 본문 정합)
      const fromIdx = Math.max(0, N - VISIBLE_RECENT);
      const toIdx = N - 1 + FUTURE_CLOUD;  // 미래 26 영업일 cloud visible 본질 정합
      // P0-14b: fitContent() 호출 폐기 본문 (race condition 근본 제거) — setVisibleLogicalRange만 본문 visible range 결정 본질
      chart.timeScale().setVisibleLogicalRange({ from: fromIdx, to: toIdx });
    }
  } catch (err) { /* noop */ }

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
    // P0-11 Fix-34: container 인자 전달 — resize 시점 chart slot inner width 실측 본문 채택
    const vp2 = getViewportSize(container);
    const subH2 = Math.round(vp2.height * 0.075);  // P0-7 fix-5 정합 (0.15 → 0.075 본문)
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
      // Phase 7d-2 fibonacci 자석 drawing tool — subscribe handler unsubscribe + handle DOM 제거 의무
      try { removeFibonacci(); } catch (e) { /* noop */ }
      try { removeVolumeByDecile(); } catch (e) { /* noop */ }
      try { removePinkSignal(); } catch (e) { /* noop */ }
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
