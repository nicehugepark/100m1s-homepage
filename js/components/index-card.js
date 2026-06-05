/* ───── components/index-card.js — 야간 미국증시 지수 카드 (Q-20260605-103 Phase 3) ─────
   DSN: DOC-20260430-DSN-001-arch-frontend §3.2 (components 매트릭스) + §3.6.9 (신설).
   IIFE + window 전역 등록 (SW cache 호환, lib/* 동일 패턴).

   renderIndexCard(idx) — 미국 지수 1종(나스닥/S&P 500/다우존스)을 카드 1장으로 렌더.
   - lib/sparkline.js buildSparkline + lib/mini-candle.js buildCandles20 재사용 (중복 구현 0건).
   - 종목 전용 요소(가격범위 바·매매버튼·뱃지·전략 row·prev_pick) 전부 제외 (보조 위계).
   - 색: 한국 증시 관습 상승 #C53939 / 하락 #1958C7 / 보합 #94A3B8 (mini-candle.js 정합).
   - ▲/▼ 병기(색맹 대응) + role="img" + aria-label.

   idx schema (us-indices/{kstDate}.json indices[] 1개):
     { name, point, change_pct, spark[], candle:{o,h,l,c}, daily20?[] }
   - spark[]: 당일 분봉 가격 배열 (sparkline). base = candle.o (당일 시가 기준선).
   - candle: 당일 1봉 OHLC (당일 캔들).
   - daily20[]: 선택 — 미니 일봉 20봉 [{date,o,h,l,c}]. 부재 시 미니 일봉 영역 미렌더.
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

  // 포인트 포맷: 소수 2자리 + 천단위 콤마 (지수 관습). format.js fmtNum은 정수 위주 → 자체 처리.
  function fmtPoint(v) {
    if (typeof v !== 'number' || !isFinite(v)) return '—';
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtPct(v) {
    if (typeof v !== 'number' || !isFinite(v)) return '';
    return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
  }

  // idx 1종 → 카드 HTML 문자열. 입력 부적합 시 '' (호출측에서 섹션 미렌더 판단).
  function renderIndexCard(idx) {
    if (!idx || typeof idx !== 'object') return '';
    if (typeof idx.name !== 'string' || !idx.name) return '';

    var pct = (typeof idx.change_pct === 'number' && isFinite(idx.change_pct)) ? idx.change_pct : null;
    var dir = pct == null ? 'flat' : (pct > 0 ? 'up' : (pct < 0 ? 'down' : 'flat'));
    var color = dir === 'up' ? UP : (dir === 'down' ? DOWN : FLAT);
    var arrow = dir === 'up' ? '▲' : (dir === 'down' ? '▼' : '·');

    // 스파크라인 — base = 당일 시가(candle.o), dir 일치 (sparkline.js 색 분기는 up/down/그외).
    var sparkHtml = '';
    var candle = idx.candle && typeof idx.candle === 'object' ? idx.candle : null;
    if (Array.isArray(idx.spark) && idx.spark.length >= 2 && candle && typeof candle.o === 'number'
      && typeof root.buildSparkline === 'function') {
      sparkHtml = root.buildSparkline(idx.spark, candle.o, dir);
    }

    // 미니 일봉(20봉) — 선택. daily20 부재 시 영역 자체 미렌더 (빈 박스 금지).
    var miniHtml = '';
    if (Array.isArray(idx.daily20) && idx.daily20.length >= 1 && typeof root.buildCandles20 === 'function') {
      miniHtml = root.buildCandles20(idx.daily20);
    }

    var label = idx.name + ' ' + (pct == null ? '' : (dir === 'up' ? '상승' : dir === 'down' ? '하락' : '보합'))
      + ' ' + fmtPoint(idx.point) + ' (' + (pct == null ? '등락률 없음' : fmtPct(pct)) + ')';

    // 레이아웃 (대표 2026-06-05 20:01 요청): 카드명 상단 → 2열 grid. 당일캔들 제거.
    //   좌상 스파크라인 / 좌하 등락률(▲▼) | 우상 미니 일봉캔들 / 우하 포인트.
    return '<div class="idx-card" role="img" aria-label="' + esc(label) + '">'
      + '<div class="idx-card-name">' + esc(idx.name) + '</div>'
      + '<div class="idx-card-grid">'
      + '<div class="idx-card-cell idx-card-spark">' + sparkHtml + '</div>'
      + '<div class="idx-card-cell idx-card-mini">' + miniHtml + '</div>'
      + '<div class="idx-card-cell idx-card-pct ' + dir + '" style="color:' + color + ';">'
      + '<span class="idx-card-arrow" aria-hidden="true">' + arrow + '</span>'
      + esc(fmtPct(pct)) + '</div>'
      + '<div class="idx-card-cell idx-card-point">' + esc(fmtPoint(idx.point)) + '</div>'
      + '</div>'
      + '</div>';
  }

  root.renderIndexCard = renderIndexCard;
})(typeof window !== 'undefined' ? window : this);
