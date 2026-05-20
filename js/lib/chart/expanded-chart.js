/* ───── lib/chart/expanded-chart.js — 일봉캔들 확대 차트 orchestrator (Layer 1 base) ─────
   cycle22 Phase 2 — REQ DOC-20260520-REQ-001 / SPEC DOC-20260520-SPEC-001 §2 / DSN §3.6.6.
   자체 SVG 채택 (라이브러리 의존 0). 13종 보조지표 layer 통합 render.
   IIFE + window 전역 등록 (SW cache 호환, 기존 lib 패턴 정합).

   본질:
   - 3-layer SoT 분리 (Layer 1 base = 본 파일 / Layer 2 indicator = indicators/*.js / Layer 3 interaction = interaction/*.js)
   - 각 indicator 모듈 = 순수 함수 (data, scale, options) → SVG fragment string. 부수효과 X.
   - localStorage key = `m100s.chart.indicators.global` (전역 default + 종목별 override 후행)
   - 4 viewport 모바일 우선: 360/768/1024/1440 — main + sub-pane(≤3) + side(매물대) 분할
*/
(function (root) {
  'use strict';

  const STORAGE_KEY = 'm100s.chart.indicators.global';

  // SPEC §4.3 모바일 default ON 4종 + 데스크탑 default ON 5종
  const DEFAULT_INDICATORS = {
    ma: true, // #4 이동평균선 (5/20)
    volume: true, // #10 거래량
    pinkSignal: true, // #2 분홍 강세 (placeholder, P1-1 별건 cycle)
    exDividend: true, // #6 배당락 marker
    // OFF default (toggle)
    fibonacci: false, // #3
    ichimoku: false, // #5
    valueBars: false, // #7
    macd: false, // #8
    rsi: false, // #9
    stochastic: false, // #11
    obv: false, // #13
    volumeProfile10: false, // #1 매물대 10등분
    volumeProfile: false, // #12 Volume Profile continuous
  };

  // 13종 메타 (toggle UI 표시용 — name + category)
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

  // SPEC §4.1 viewport별 차트 크기
  function getViewportSize() {
    const w = window.innerWidth;
    if (w <= 360) return { main: { w: 280, h: 320 }, sub: { h: 80 }, side: { w: 60 } };
    if (w <= 768) return { main: { w: 640, h: 360 }, sub: { h: 100 }, side: { w: 80 } };
    if (w <= 1024) return { main: { w: 880, h: 400 }, sub: { h: 120 }, side: { w: 100 } };
    return { main: { w: 1000, h: 440 }, sub: { h: 140 }, side: { w: 120 } };
  }

  // localStorage 영구화 (사용자 학습 곡선 보존)
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
      // private mode 등 — silent fail
    }
  }

  // dailybars 데이터 정규화 — daily_20 또는 240일 raw 모두 수용
  // Phase 2 prototype = 기존 daily_20 데이터 사용. Phase 3 dailybars 240영업일 swap 가능 구조.
  function normalizeData(dailyArr) {
    if (!Array.isArray(dailyArr) || dailyArr.length < 1) return [];
    return dailyArr.filter(d => d && typeof d.c === 'number' && d.c > 0)
      .map(d => ({
        date: d.date,
        o: d.o, h: d.h, l: d.l, c: d.c,
        v: typeof d.v === 'number' ? d.v : 0,
        tv: typeof d.tv === 'number' ? d.tv : (d.c * (d.v || 0)), // 거래대금 fallback
      }));
  }

  // Layer 1 base: viewBox + axis + candle body·wick
  // SPEC §2.1: 양봉=--pos, 음봉=--neg, 도지/점상=#94A3B8 (mini-candle.js §3.6.5 정합)
  function buildBaseLayer(data, opts) {
    const { width, height, paddingX = 8, paddingY = 8 } = opts;
    const N = data.length;
    if (N === 0) {
      return `<g class="chart-base-empty"><text x="${width/2}" y="${height/2}" text-anchor="middle" fill="#8B95A8" font-size="12">데이터 없음</text></g>`;
    }
    const innerW = width - paddingX * 2 - (opts.sideWidth || 0);
    const innerH = height - paddingY * 2;
    const slot = innerW / N;
    const bodyW = Math.max(1, slot * 0.65);

    const lows = data.map(d => d.l).filter(v => v > 0);
    const highs = data.map(d => d.h).filter(v => v > 0);
    if (!lows.length || !highs.length) return '';
    const lo = Math.min(...lows);
    const hi = Math.max(...highs);
    const span = hi - lo || 1;
    const y = p => paddingY + innerH * (1 - (p - lo) / span);

    // axis Y (가격) — 우측 4 tick
    const tickY = 4;
    let axisY = '';
    for (let i = 0; i <= tickY; i++) {
      const price = lo + (span * i / tickY);
      const yy = y(price).toFixed(1);
      axisY += `<line x1="${paddingX}" x2="${paddingX + innerW}" y1="${yy}" y2="${yy}" stroke="rgba(0,0,0,0.04)" stroke-width="1"/>`;
      axisY += `<text x="${paddingX + innerW + 4}" y="${yy}" font-size="9" fill="#8B95A8" dominant-baseline="middle">${Math.round(price).toLocaleString()}</text>`;
    }

    // 캔들
    const candles = data.map((d, i) => {
      const xc = paddingX + slot * (i + 0.5);
      const xBody = xc - bodyW / 2;
      const isUp = d.c > d.o;
      const isFlat = d.c === d.o;
      // §3.6.5 / mini-candle.js 정합 — 한국 증시 관습 양봉=빨강 음봉=파랑
      const color = isFlat ? '#94A3B8' : (isUp ? '#C53939' : '#1958C7');
      const yHi = y(d.h), yLo = y(d.l);
      const yOpen = y(d.o), yClose = y(d.c);
      const yBodyTop = Math.min(yOpen, yClose);
      const bodyH = Math.max(0.8, Math.abs(yClose - yOpen));
      const wick = `<line x1="${xc.toFixed(1)}" y1="${yHi.toFixed(1)}" x2="${xc.toFixed(1)}" y2="${yLo.toFixed(1)}" stroke="${color}" stroke-width="1"/>`;
      const body = isFlat
        ? `<line x1="${xBody.toFixed(1)}" y1="${yOpen.toFixed(1)}" x2="${(xBody + bodyW).toFixed(1)}" y2="${yOpen.toFixed(1)}" stroke="${color}" stroke-width="1.2"/>`
        : `<rect x="${xBody.toFixed(1)}" y="${yBodyTop.toFixed(1)}" width="${bodyW.toFixed(1)}" height="${bodyH.toFixed(1)}" fill="${color}"/>`;
      return wick + body;
    }).join('');

    return {
      svg: `<g class="chart-base">${axisY}${candles}</g>`,
      scale: { lo, hi, span, slot, bodyW, paddingX, paddingY, innerW, innerH, y },
    };
  }

  // 차트 render orchestrator
  // Layer 1 base + Layer 2 indicators (각 모듈 호출) + Layer 3 placeholder
  function renderExpandedChart(container, dailyArr, options = {}) {
    if (!container) return;
    const data = normalizeData(dailyArr);
    const state = options.indicatorState || loadIndicatorState();
    const vp = getViewportSize();
    const indW = vp.main.w;
    const indH = vp.main.h;
    const sideW = (state.volumeProfile10 || state.volumeProfile) ? vp.side.w : 0;

    // edge case: 데이터 부족 → placeholder (SPEC §6)
    if (data.length < 1) {
      container.innerHTML = `<div class="cal-chart-empty" role="img" aria-label="차트 데이터 없음">데이터 누적 중</div>`;
      return;
    }

    const base = buildBaseLayer(data, { width: indW, height: indH, sideWidth: sideW });
    if (!base || !base.scale) {
      container.innerHTML = `<div class="cal-chart-empty" role="img" aria-label="차트 데이터 없음">데이터 부족</div>`;
      return;
    }
    const { svg: baseSvg, scale } = base;

    // Layer 2 overlay (main pane 위)
    let overlay = '';
    if (state.ma && root.ChartIndicatorMA) {
      overlay += root.ChartIndicatorMA.render(data, scale, {});
    }
    if (state.ichimoku && root.ChartIndicatorIchimoku) {
      overlay += root.ChartIndicatorIchimoku.render(data, scale, {});
    }
    if (state.fibonacci && root.ChartIndicatorFibonacci) {
      overlay += root.ChartIndicatorFibonacci.render(data, scale, {});
    }

    // Layer 2 side (우측 horizontal)
    let side = '';
    if (state.volumeProfile10 && root.ChartIndicatorVolumeProfile10) {
      side += root.ChartIndicatorVolumeProfile10.render(data, scale, { sideW: vp.side.w, mainW: indW });
    }
    if (state.volumeProfile && root.ChartIndicatorVolumeProfile) {
      side += root.ChartIndicatorVolumeProfile.render(data, scale, { sideW: vp.side.w, mainW: indW });
    }

    // Layer 2 marker (특정 일자)
    let markers = '';
    if (state.pinkSignal && root.ChartIndicatorPinkSignal) {
      markers += root.ChartIndicatorPinkSignal.render(data, scale, {});
    }
    if (state.exDividend && root.ChartIndicatorExDividend) {
      markers += root.ChartIndicatorExDividend.render(data, scale, { exDividendDates: options.exDividendDates || [] });
    }

    // Layer 2 sub-pane (별도 pane, 최대 3개 모바일)
    // 활성 sub-pane 리스트 (default 거래량 ON)
    const subPaneKeys = ['volume', 'valueBars', 'macd', 'rsi', 'stochastic', 'obv'];
    const activeSubPanes = subPaneKeys.filter(k => state[k]);
    const maxSubPanes = (window.innerWidth <= 768) ? 3 : 4; // 모바일 ≤3, 데스크탑 ≤4
    const renderSubPanes = activeSubPanes.slice(0, maxSubPanes);

    let subPanesHtml = '';
    renderSubPanes.forEach((key) => {
      const moduleName = ({
        volume: 'ChartIndicatorVolumeBars',
        valueBars: 'ChartIndicatorValueBars',
        macd: 'ChartIndicatorMACD',
        rsi: 'ChartIndicatorRSI',
        stochastic: 'ChartIndicatorStochastic',
        obv: 'ChartIndicatorOBV',
      })[key];
      const mod = root[moduleName];
      if (!mod || typeof mod.render !== 'function') return;
      const subSvg = mod.render(data, scale, { width: indW, height: vp.sub.h });
      const label = (INDICATOR_META.find(m => m.key === key) || {}).name || key;
      subPanesHtml += `
        <div class="cal-chart-sub-pane" data-indicator="${key}">
          <div class="cal-chart-sub-label">${label}</div>
          <svg viewBox="0 0 ${indW + sideW} ${vp.sub.h}" preserveAspectRatio="none" class="cal-chart-sub-svg" aria-label="${label}">
            ${subSvg}
          </svg>
        </div>`;
    });

    // 종합 DOM 조립
    const mainSvg = `
      <svg viewBox="0 0 ${indW + sideW} ${indH}" preserveAspectRatio="none" class="cal-chart-main-svg" role="img" aria-label="일봉 확대 차트, ${options.ticker || '종목'}">
        ${baseSvg}
        ${overlay}
        ${side}
        ${markers}
      </svg>`;

    // toggle bar (Layer 3 interaction — 별도 모듈에서 wire)
    const toggleBar = INDICATOR_META.map(m => {
      const isOn = !!state[m.key];
      const cls = isOn ? 'cal-chart-toggle on' : 'cal-chart-toggle';
      return `<button type="button" class="${cls}" data-indicator="${m.key}" aria-pressed="${isOn}" aria-label="${m.name} ${isOn ? '끄기' : '켜기'}">${m.label}</button>`;
    }).join('');

    container.innerHTML = `
      <div class="cal-chart-toggle-bar" role="toolbar" aria-label="보조지표 토글">
        ${toggleBar}
      </div>
      <div class="cal-chart-main" role="img" aria-label="일봉 확대 차트">
        ${mainSvg}
      </div>
      <div class="cal-chart-sub-panes">
        ${subPanesHtml}
      </div>
      <button type="button" class="cal-chart-close" aria-label="확대 차트 닫기">접기 ▴</button>`;

    // Layer 3 interaction wire (별도 모듈)
    if (root.ChartInteractionTogglePanel && typeof root.ChartInteractionTogglePanel.wire === 'function') {
      root.ChartInteractionTogglePanel.wire(container, {
        getState: loadIndicatorState,
        setState: saveIndicatorState,
        rerender: (newState) => renderExpandedChart(container, dailyArr, { ...options, indicatorState: newState }),
      });
    }

    // Layer 3 crosshair + tooltip wire (Phase 2.2 본체)
    if (root.ChartInteractionCrosshair && typeof root.ChartInteractionCrosshair.wire === 'function') {
      root.ChartInteractionCrosshair.wire(container, { data, scale, options });
    }
  }

  // 공개 API
  root.ChartExpanded = {
    render: renderExpandedChart,
    loadState: loadIndicatorState,
    saveState: saveIndicatorState,
    DEFAULT_INDICATORS,
    INDICATOR_META,
  };
})(typeof window !== 'undefined' ? window : this);
