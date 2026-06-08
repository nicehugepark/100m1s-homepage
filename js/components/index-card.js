/* ───── components/index-card.js — 야간 미국증시 지수 카드 (Q-20260605-103 Phase 3) ─────
   DSN: DOC-20260430-DSN-001-arch-frontend §3.2 (components 매트릭스) + §3.6.9 (신설).
   IIFE + window 전역 등록 (SW cache 호환, lib/* 동일 패턴).

   renderIndexCard(idx) — 미국 지수 1종(나스닥/S&P 500/다우존스)을 종목카드 동일형 카드 1장으로 렌더.
   - 대표 2026-06-05 20:11 결정(B안) + 20:26 catch 정정: 국내 종목카드 헤더 DOM 1:1 복제.
     섹션 = 타이틀 → 미국발 뉴스 → 지수 카드 세로 나열 (국내장 뉴스요약 → 종목카드 순서 동일).
     카드 헤더 head-left 4-child (renderer.js L1419-1435 verbatim):
       .cal-trade-rank(지수=빈 슬롯) → .cal-trade-candle(당일캔들 miniCandle) → .cal-feature-sparkline → .cal-feature-candles20.
     head-right: .cal-feature-name + .cal-feature-meta(등락률 | 포인트). 하단 = 240일 레인지 바.
   - global miniCandle(당일캔들) + lib/sparkline.js buildSparkline + lib/mini-candle.js buildCandles20 재사용 (중복 구현 0건).
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
  //   지수: '원' 대신 포인트. 중앙 라벨 = trade_date_local 거래일(YYYY-MM-DD, 좌우 끝 날짜와 동일 포맷, Q-20260608-135).
  //   range_240d 부재/불완전 시 '' (카드는 헤더만 렌더).
  function buildRangeBar(r, tradeDate) {
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
      + '<span class="r-now r-now-label"></span>'
      + '<span class="r-high ' + highCls + '">' + esc(highText) + '</span>'
      + '</div>'
      + '<div class="range-row range-dates">'
      + '<span class="r-low">' + esc(r.low_date || '') + '</span>'
      + '<span class="r-now">' + esc(tradeDate || '') + '</span>'
      + '<span class="r-high">' + esc(r.high_date || '') + '</span>'
      + '</div>'
      + '</div>';
  }

  // Q-20260608-140 (A안 페어 카드, DSN-001 §1) — 선물 별개 카드 builder.
  //   삽입형(.idx-futures-row 카드 내 오버레이) 전면 폐기 → 정규장 카드와 동일 골격의 별개 카드 1장.
  //   데이터 제약(§5): 선물엔 candle(OHLC)·range_240d·daily_expanded 부재 → 해당 셀 미렌더(빈 박스 0, graceful).
  //   가용분만 채움: 인트라데이 스파크라인(40봉) + 포인트 + 등락률 + 거래상태 도트 + 갱신시각.
  //   fut = { name, label_note, point, change_pct, spark[] }. ageMin(신선도, renderer 게이트 통과분).
  //   sessionOpen = 섹션 단위 거래중/마감 (true=거래중 / false=마감 / undefined=도트 미렌더).
  //   displayName = 페어 식별용 짧은 제목(예 'NASDAQ 선물'). 입력 부적합 시 '' (호출측 graceful).
  function renderIndexFuturesCard(fut, ageMin, tradeDate, sessionOpen, displayName) {
    if (!fut || typeof fut !== 'object') return '';
    if (typeof fut.point !== 'number' || typeof fut.change_pct !== 'number') return '';
    var fp = fut.change_pct;
    var dir = fp > 0 ? 'up' : (fp < 0 ? 'down' : 'flat');
    var arrow = dir === 'up' ? '▲' : (dir === 'down' ? '▼' : '·');
    // 제목: 짧은 식별명 우선(displayName). 부재 시 fut.name(예 '나스닥100 선물'). label_note(풀 고지문)는 제목 ❌(§1).
    var title = (typeof displayName === 'string' && displayName) ? displayName
      : ((typeof fut.name === 'string' && fut.name) ? fut.name : '선물');

    // 인트라데이 스파크 — 캔들 OHLC 부재 → spark 첫값 기준 방향 추종(§6 색 정책: 선물 스파크 = spark 첫값 기준).
    //   2봉 이상 필요. 라이브 선물 spark = [open, last] 2봉(희소) → 직선이라도 방향 표현.
    var sparkHtml = '';
    if (Array.isArray(fut.spark) && fut.spark.length >= 2 && typeof root.buildSparkline === 'function') {
      sparkHtml = root.buildSparkline(fut.spark, fut.spark[0], dir);
    }

    // 거래상태 도트(§4) — sessionOpen true=거래중(초록)/false=마감(회색). undefined 시 미렌더.
    var statusHtml = '';
    if (sessionOpen === true) {
      statusHtml = '<span class="idx-fut-status open" title="거래중"><span class="idx-fut-dot" aria-hidden="true"></span>거래중</span>';
    } else if (sessionOpen === false) {
      statusHtml = '<span class="idx-fut-status closed" title="거래 마감"><span class="idx-fut-dot" aria-hidden="true"></span>거래 마감</span>';
    }

    // 갱신시각(§4) — "N분 전 기준" (stale 실시간 위장 금지, FLR-AGT-002). ageMin null 시 미렌더.
    var am = (typeof ageMin === 'number') ? ageMin : null;
    var ageText = am == null ? '' : (am <= 0 ? '방금 전 기준' : (am + '분 전 기준'));

    var label = title + ' ' + (dir === 'up' ? '상승' : dir === 'down' ? '하락' : '보합')
      + ' ' + fmtPoint(fut.point) + ' (' + fmtPct(fp) + ')';

    // 정규장 카드 동일 골격(.cal-feature-card.v2 + head-left 4-child) — 단 candle/range/expanded 셀은 데이터 부재로
    //   미렌더(빈 placeholder 박스 0). rank 슬롯·candles20 셀 생략 → 정보 밀도 자연 축소(선물 = 데이터 적음 의도 노출).
    return '<div class="cal-feature-card v2 cal-feature-card--idx cal-feature-card--fut" aria-label="' + esc(label) + '">'
      + '<div class="cal-feature-head v2">'
      + '<div class="cal-feature-head-left">'
      + '<div class="cal-trade-rank"></div>'
      + (sparkHtml ? '<div class="cal-feature-sparkline">' + sparkHtml + '</div>' : '<div class="cal-feature-sparkline cal-spark-empty"></div>')
      + '</div>'
      + '<div class="cal-feature-head-right">'
      + '<div class="cal-feature-namecell">'
      + '<span class="cal-feature-name">' + esc(title) + '</span>'
      + '<span class="idx-fut-badge">선물</span>'
      + (statusHtml ? statusHtml : '')
      + '</div>'
      + '<div class="cal-feature-meta">'
      + '<span class="cal-feature-pct ' + dir + '"><span class="idx-card-arrow" aria-hidden="true">' + arrow + '</span>' + esc(fmtPct(fp)) + '</span>'
      + '<span class="cal-meta-sep">|</span>'
      + '<span class="cal-trade-amount">' + esc(fmtPoint(fut.point)) + ' p</span>'
      + '</div>'
      + (ageText ? '<div class="idx-fut-age">' + esc(ageText) + '</div>' : '')
      + '</div>'
      + '</div>'
      + '</div>';
  }

  // idx 1종 + (선택)futureInfo → 카드 HTML 문자열. 입력 부적합 시 '' (호출측에서 섹션 미렌더 판단).
  function renderIndexCard(idx, futureInfo, tradeDate) {
    if (!idx || typeof idx !== 'object') return '';
    if (typeof idx.name !== 'string' || !idx.name) return '';

    var pct = (typeof idx.change_pct === 'number' && isFinite(idx.change_pct)) ? idx.change_pct : null;
    var dir = pct == null ? 'flat' : (pct > 0 ? 'up' : (pct < 0 ? 'down' : 'flat'));
    var color = dir === 'up' ? UP : (dir === 'down' ? DOWN : FLAT);
    var arrow = dir === 'up' ? '▲' : (dir === 'down' ? '▼' : '·');

    var candle = idx.candle && typeof idx.candle === 'object' ? idx.candle : null;

    // 색 정책 확정 (대표 2026-06-05 21:32 verbatim, 국내·미장 공통): "하루치 캔들은 양봉/음봉 기준이 있다.
    //   스파크라인도 캔들의 확장이다 → 스파크 색 = 캔들 방향(시가 대비). 등락률은 전일보다 올랐으면 양봉색/
    //   내렸으면 음봉색." → candleDir = (close >= open) 시가 대비 = 캔들·스파크 공통 색. 등락률(dir/color/arrow)
    //   = change_pct 전일 대비 = 텍스트 색만(현행 유지). NASDAQ(o<c 양봉 red 캔들·스파크 / change_pct<0 ▼파랑 텍스트) 정합.
    var candleDir = (candle && typeof candle.o === 'number' && typeof candle.c === 'number')
      ? (candle.c >= candle.o ? 'up' : 'down')
      : dir;

    // 당일 캔들 (.cal-trade-candle) — global miniCandle(o,h,l,c,pct). OHLC 존재 시 색 = (close > open) 시가 대비.
    var todayCandleHtml = '';
    if (candle && typeof candle.o === 'number' && typeof candle.h === 'number'
      && typeof candle.l === 'number' && typeof candle.c === 'number'
      && typeof root.miniCandle === 'function') {
      todayCandleHtml = root.miniCandle(candle.o, candle.h, candle.l, candle.c, pct == null ? 0 : pct);
    }

    var sparkHtml = '';
    if (Array.isArray(idx.spark) && idx.spark.length >= 2 && candle && typeof candle.o === 'number'
      && typeof root.buildSparkline === 'function') {
      // 스파크 = 캔들의 확장 → candleDir(시가 대비) 추종 (대표 21:32). base = candle.o (당일 시가 기준선).
      sparkHtml = root.buildSparkline(idx.spark, candle.o, candleDir);
    }
    // 미니 일봉캔들 + 확대 차트 trigger (대표 20:47 — 국내 일봉캔들 클릭 → 확장 차트 인터랙션 1:1).
    //   국내: candles20Html = <div .cal-feature-candles20 data-expand-trigger="chart" data-daily20=... role=button
    //         tabindex=0 aria-expanded=false aria-controls="chart-{code}">. 지수도 동일 emit → 기존 delegated
    //         핸들러(_openChartExpand, [data-expand-trigger="chart"] 위임)가 그대로 발화 (핸들러 0줄 수정).
    //   확대용 series: idx.daily_expanded(백엔드 1y 일봉, range_240d 산출 source) 우선, 부재 시 daily20(20봉)
    //     graceful fallback (국내 Phase 2 prototype 동작 동형). data-stock-code = 합성 code(지수=idxCode) →
    //     slot id "chart-{idxCode}" + aria-controls anchor 정합. _fetchDailybars(idxCode) 는 /data/dailybars 404
    //     → prototype(data-daily20) 유지 (graceful, 거짓 데이터 0).
    var idxCode = 'idx-' + String(idx.name).replace(/[^A-Za-z0-9가-힣]/g, '').slice(0, 20);
    var hasExpanded = Array.isArray(idx.daily_expanded) && idx.daily_expanded.length >= 1;
    var expandSeries = hasExpanded ? idx.daily_expanded : (Array.isArray(idx.daily20) ? idx.daily20 : []);
    // 미니 일봉(20봉) — daily20 우선, 부재/빈배열 시 daily_expanded 마지막 20봉으로 derive.
    //   디자인 워크스루 P1 (대표 20:47): 라이브 daily20=[] → 110px 회색 빈 박스 상시 노출 = "데이터 있는데 빈 박스".
    //   root fix: daily_expanded(1y) 존재 시 그 tail 20봉으로 미니캔들 정상 렌더 (FLR-AGT-002 — 빈 박스 대신 실데이터).
    //   derive 불가(둘 다 0)일 때만 셀 미렌더 + 확대 trigger 비활성.
    var miniSeries = (Array.isArray(idx.daily20) && idx.daily20.length >= 1)
      ? idx.daily20
      : (hasExpanded ? idx.daily_expanded.slice(-20) : []);
    var miniHtml = '';
    if (miniSeries.length >= 1 && typeof root.buildCandles20 === 'function') {
      miniHtml = root.buildCandles20(miniSeries);
    }
    var candles20Cell;
    if (miniHtml && expandSeries.length >= 1) {
      // data-daily20 = 확대 차트 1차 render payload (JSON). attribute 안전 위해 " escape.
      var d20Json = esc(JSON.stringify(expandSeries));
      candles20Cell = '<div class="cal-feature-candles20" data-expand-trigger="chart" data-daily20="' + d20Json + '"'
        + ' role="button" tabindex="0" aria-label="' + esc(idx.name) + ' 일봉, 클릭 시 확대 차트"'
        + ' aria-expanded="false" aria-controls="chart-' + esc(idxCode) + '">' + miniHtml + '</div>';
    } else if (miniHtml) {
      candles20Cell = '<div class="cal-feature-candles20">' + miniHtml + '</div>';
    } else {
      candles20Cell = '<div class="cal-feature-candles20 cal-candles20-empty"></div>';
    }
    // QA P1 (대표 20:50) — range_240d.current 백엔드 미포함 → buildRangeBar L59 '' (레인지 바 전부 미렌더).
    //   fix: current 부재 시 idx.point(현재 지수 포인트 = SSOT) 주입. 원본 무변이 위해 shallow copy.
    //   백엔드 schema 무변경(프론트 단독). low/high 가 있는데 current 만 없는 정상 케이스 해결.
    var r240in = idx.range_240d;
    if (r240in && typeof r240in === 'object' && typeof r240in.current !== 'number' && typeof idx.point === 'number') {
      r240in = Object.assign({}, r240in, { current: idx.point });
    }
    var rangeHtml = buildRangeBar(r240in, tradeDate);
    var newsBodyHtml = buildCardNews(idx.news);

    var label = idx.name + ' ' + (pct == null ? '' : (dir === 'up' ? '상승' : dir === 'down' ? '하락' : '보합'))
      + ' ' + fmtPoint(idx.point) + ' (' + (pct == null ? '등락률 없음' : fmtPct(pct)) + ')';

    // 대표 20:26 catch 정정 — 국내 종목카드 헤더 DOM 1:1 복제 (renderer.js L1419-1435 verbatim 구조).
    //   head-left 4-child 순서 동일: .cal-trade-rank → .cal-trade-candle(당일캔들) → .cal-feature-sparkline
    //   → .cal-feature-candles20(확대 trigger). rank 슬롯 = 지수 순위 부재 → 빈 placeholder(정렬 column 유지).
    //   head-right: .cal-feature-namecell(.cal-feature-name) + .cal-feature-meta(.cal-feature-pct | .cal-trade-amount).
    //   data-stock-code = idxCode (확대 slot id/aria anchor). 국내 미사용: 공유버튼/badges/상세 body (지수 무관).
    // role="img" 제거 (대표 20:47 확대 trigger 추가 → 카드 내 interactive button 존재. img role 은
    //   interactive 자식 비호환). 국내 종목카드도 카드 자체 role 없음(1:1). aria-label 은 card에 두되 group 의미.
    return '<div class="cal-feature-card v2 cal-feature-card--idx" aria-label="' + esc(label) + '"'
      + ' data-stock-code="' + esc(idxCode) + '" data-stock-name="' + esc(idx.name) + '">'
      + '<div class="cal-feature-head v2">'
      + '<div class="cal-feature-head-left">'
      + '<div class="cal-trade-rank"></div>'
      + '<div class="cal-trade-candle">' + todayCandleHtml + '</div>'
      + (sparkHtml ? '<div class="cal-feature-sparkline">' + sparkHtml + '</div>' : '<div class="cal-feature-sparkline cal-spark-empty"></div>')
      + candles20Cell
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
      + newsBodyHtml
      + '</div>';
  }

  // 지수별 주요 기사 — 국내 종목카드 뉴스 영역 (.cal-feature-body > .cal-feature-summary >
  //   .cal-causal 요약 + .cal-feature-links > .cal-feature-link) 템플릿 1:1 (대표 20:31).
  //   데이터: idx.news = {summary, sources:[{name,url}]}. 부재/요약·소스 모두 0 시 '' (블록 전체 생략, placeholder 0).
  function buildCardNews(news) {
    if (!news || typeof news !== 'object') return '';
    var summary = (typeof news.summary === 'string') ? news.summary.trim() : '';
    var sources = Array.isArray(news.sources) ? news.sources : [];
    var linksHtml = sources.map(function (s) {
      if (!s || typeof s !== 'object') return '';
      var url = (typeof s.url === 'string' && /^https?:\/\//i.test(s.url)) ? s.url : '';
      var name = (typeof s.name === 'string') ? s.name : '';
      if (!url || !name) return '';  // 출처명·유효 URL 둘 다 필수 (법무 + placeholder 금지)
      return '<a class="cal-feature-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(name) + '</a>';
    }).filter(Boolean).join('');
    if (!summary && !linksHtml) return '';  // 둘 다 없으면 블록 생략
    var summaryHtml = summary ? '<div class="cal-causal">' + esc(summary) + '</div>' : '';
    var linksBlock = linksHtml ? '<div class="cal-feature-links">' + linksHtml + '</div>' : '';
    return '<div class="cal-feature-body">'
      + '<div class="cal-feature-summary">' + summaryHtml + linksBlock + '</div>'
      + '</div>';
  }

  root.renderIndexCard = renderIndexCard;
  root.renderIndexFuturesCard = renderIndexFuturesCard;  // Q-20260608-140 A안 페어 카드
})(typeof window !== 'undefined' ? window : this);
