/* ───── components/index-card.js — 야간 미국증시 지수 카드 (Q-20260605-103 Phase 3) ─────
   DSN: DOC-20260430-DSN-001-arch-frontend §3.2 (components 매트릭스) + §3.6.9 (신설).
   IIFE + window 전역 등록 (SW cache 호환, lib/* 동일 패턴).

   renderIndexCard(idx) — 미국 지수 1종(나스닥/S&P 500/다우존스)을 종목카드 동일형 카드 1장으로 렌더.
   - 대표 2026-06-05 20:11 결정 (B안): 섹션 = 타이틀 → 미국발 뉴스 → 지수 카드 세로 나열
     (국내장 뉴스요약 → 종목카드 순서 동일). 카드는 종목카드 형태:
       상단 헤더 = 미니 일봉캔들 + 스파크라인 + 지수명 + 등락률 + 현재 포인트(거래대금 자리 대체).
       하단 = 240일 레인지 바 (좌 최저/중앙 현재/우 최고 + 그라데이션 + 현재 마커).
   - lib/sparkline.js buildSparkline + lib/mini-candle.js buildCandles20 재사용 (중복 구현 0건).
   - 레인지 바는 종목카드 .stock-range.v2 클래스/시각 재사용 (기존 renderCalExpandContent 무수정 — 변형 builder, ui-preservation §1).
   - 색: 한국 증시 관습 상승 #C53939 / 하락 #1958C7 / 보합 #94A3B8 (mini-candle.js 정합). role="img" + aria-label.

   idx schema (us-indices/{kstDate}.json indices[] 1개):
     { name, point, change_pct, spark[], candle:{o,h,l,c}, daily20?[],
       range_240d?:{ low, high, current?, low_date, high_date,
                     low_change_pct|low_pct, high_change_pct|high_pct } }
   - spark[]: 당일 분봉 가격 배열 (sparkline). base = candle.o (당일 시가 기준선).
   - daily20[]: 선택 — 미니 일봉 20봉 [{date,o,h,l,c}]. 부재 시 미니 일봉 영역 미렌더.
   - range_240d: 선택 — 부재/불완전 시 레인지 바만 생략, 카드 헤더는 정상 렌더 (FLR-AGT-002).
*/
(function (root) {
  'use strict';

  var UP = '#C53939', DOWN = '#1958C7', FLAT = '#94A3B8';

  function esc(s) {
    return (typeof root.escapeHtml === 'function')
      ? root.escapeHtml(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
  }

  // 포인트 포맷: 소수 2자리 + 천단위 콤마 (지수 관습).
  function fmtPoint(v) {
    if (typeof v !== 'number' || !isFinite(v)) return '—';
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtPct(v) {
    if (typeof v !== 'number' || !isFinite(v)) return '';
    return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
  }

  function fmtPct1(v) {
    if (typeof v !== 'number' || !isFinite(v)) return '';
    return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
  }

  // 240일 레인지 바 — 종목카드 .stock-range.v2 시각 재사용 (renderCalExpandContent L1346-1390 패턴).
  //   지수: '원' 대신 포인트, '현재가' 대신 '현재'. range_240d 부재/불완전 시 '' (카드는 헤더만 렌더).
  function buildRangeBar(r) {
    if (!r || typeof r !== 'object') return '';
    var low = r.low, high = r.high;
    var current = (typeof r.current === 'number') ? r.current : undefined;
    if (typeof low !== 'number' || typeof high !== 'number' || low <= 0 || high <= 0 || high < low) return '';
    if (typeof current !== 'number') return '';  // 현재 위치 마커 필수
    var span = high - low;
    var markerLeft = span > 0 ? Math.max(0, Math.min(100, ((current - low) / span) * 100)) : 50;
    // 양 끝 대비 등락률 — spec(low_change_pct/high_change_pct) ∪ 기존 종목카드(low_pct/high_pct).
    var lowPct = (typeof r.low_change_pct === 'number') ? r.low_change_pct
      : (typeof r.low_pct === 'number') ? r.low_pct : null;
    var highPct = (typeof r.high_change_pct === 'number') ? r.high_change_pct
      : (typeof r.high_pct === 'number') ? r.high_pct : null;
    var isNewLow = low === current, isNewHigh = high === current;
    var lowText = isNewLow ? '신저가' : fmtPct1(lowPct);
    var highText = isNewHigh ? '신고가' : fmtPct1(highPct);
    var lowCls = isNewLow ? 'down' : ((lowPct == null ? 0 : lowPct) >= 0 ? 'up' : 'down');
    var highCls = isNewHigh ? 'up' : ((highPct == null ? 0 : highPct) <= 0 ? 'down' : 'up');
    // 종목카드 .stock-range.v2 클래스 그대로 (대표 20:12 — 폰트·시각 픽셀 동일). 지수 분기 = 텍스트만.
    return '<div class="stock-range v2">'
      + '<div class="range-bar">'
      + '<div class="range-fill" style="--low-pct:0%;--high-pct:' + markerLeft + '%"></div>'
      + '<div class="range-marker" style="left:' + markerLeft + '%"></div>'
      + '</div>'
      + '<div class="range-row range-prices">'
      + '<span class="r-low">' + esc(fmtPoint(low)) + '</span>'
      + '<span class="r-now">' + esc(fmtPoint(current)) + '</span>'
      + '<span class="r-high">' + esc(fmtPoint(high)) + '</span>'
      + '</div>'
      + '<div class="range-row range-pcts">'
      + '<span class="r-low ' + lowCls + '">' + esc(lowText) + '</span>'
      + '<span class="r-now r-now-label">현재</span>'
      + '<span class="r-high ' + highCls + '">' + esc(highText) + '</span>'
      + '</div>'
      + '<div class="range-row range-dates">'
      + '<span class="r-low">' + esc(r.low_date || '') + '</span>'
      + '<span class="r-now"></span>'
      + '<span class="r-high">' + esc(r.high_date || '') + '</span>'
      + '</div>'
      + '</div>';
  }

  // idx 1종 → 카드 HTML 문자열. 입력 부적합 시 '' (호출측에서 섹션 미렌더 판단).
  function renderIndexCard(idx) {
    if (!idx || typeof idx !== 'object') return '';
    if (typeof idx.name !== 'string' || !idx.name) return '';

    var pct = (typeof idx.change_pct === 'number' && isFinite(idx.change_pct)) ? idx.change_pct : null;
    var dir = pct == null ? 'flat' : (pct > 0 ? 'up' : (pct < 0 ? 'down' : 'flat'));
    var color = dir === 'up' ? UP : (dir === 'down' ? DOWN : FLAT);
    var arrow = dir === 'up' ? '▲' : (dir === 'down' ? '▼' : '·');

    var candle = idx.candle && typeof idx.candle === 'object' ? idx.candle : null;
    var sparkHtml = '';
    if (Array.isArray(idx.spark) && idx.spark.length >= 2 && candle && typeof candle.o === 'number'
      && typeof root.buildSparkline === 'function') {
      sparkHtml = root.buildSparkline(idx.spark, candle.o, dir);
    }
    var miniHtml = '';
    if (Array.isArray(idx.daily20) && idx.daily20.length >= 1 && typeof root.buildCandles20 === 'function') {
      miniHtml = root.buildCandles20(idx.daily20);
    }
    var rangeHtml = buildRangeBar(idx.range_240d);

    var label = idx.name + ' ' + (pct == null ? '' : (dir === 'up' ? '상승' : dir === 'down' ? '하락' : '보합'))
      + ' ' + fmtPoint(idx.point) + ' (' + (pct == null ? '등락률 없음' : fmtPct(pct)) + ')';

    // 대표 20:12 — 종목카드 CSS 클래스·폰트 그대로 재사용 (이질감 0). 지수 전용 = .cal-feature-card--idx
    //   modifier 1개만(랭크/공유/뱃지/body 미사용 구조 차이용). 폰트·색·여백·radius는 종목카드 클래스가 결정.
    //   head-left: 미니 일봉캔들(.cal-trade-candle 슬롯) + 스파크라인. head-right: 지수명(.cal-feature-name)
    //   + 메타(.cal-feature-pct 등락률 | .cal-trade-amount 포인트 — 거래대금 골드 슬롯 재사용).
    return '<div class="cal-feature-card v2 cal-feature-card--idx" role="img" aria-label="' + esc(label) + '">'
      + '<div class="cal-feature-head v2">'
      + '<div class="cal-feature-head-left">'
      + (sparkHtml ? '<div class="cal-feature-sparkline">' + sparkHtml + '</div>' : '<div class="cal-feature-sparkline cal-spark-empty"></div>')
      + (miniHtml ? '<div class="cal-feature-candles20">' + miniHtml + '</div>' : '')
      + '</div>'
      + '<div class="cal-feature-head-right">'
      + '<div class="cal-feature-namecell">'
      + '<span class="cal-feature-name">' + esc(idx.name) + '</span>'
      + '</div>'
      + '<div class="cal-feature-meta">'
      + '<span class="cal-feature-pct ' + dir + '"><span class="idx-card-arrow" aria-hidden="true">' + arrow + '</span>' + esc(fmtPct(pct)) + '</span>'
      + '<span class="cal-meta-sep">|</span>'
      + '<span class="cal-trade-amount">' + esc(fmtPoint(idx.point)) + ' p</span>'
      + '</div>'
      + '</div>'
      + '</div>'
      + rangeHtml
      + '</div>';
  }

  root.renderIndexCard = renderIndexCard;
})(typeof window !== 'undefined' ? window : this);
