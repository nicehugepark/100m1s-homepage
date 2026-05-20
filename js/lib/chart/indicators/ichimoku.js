/* ───── lib/chart/indicators/ichimoku.js — #5 일목균형표 overlay (OFF default) ─────
   cycle22 Phase 2 stub — SPEC §2.2 / DSN §3.6.6.
   전환선=9 / 기준선=26 / 선행스팬1·2 (구름대 fill) / 후행스팬=26 후행.
   Phase 2.2 후행 sub-agent가 정식 공식 구현 (WebSearch evidence + 9/26/52 표준).

   본 stub = render 호출 시 minimal placeholder text (toggle 동작 검증용).
   Phase 2.2 통합 시 본 함수 본체만 교체.
*/
(function (root) {
  'use strict';

  function render(data, scale, opts = {}) {
    if (!data || !data.length) return '';
    const { paddingX, paddingY, innerW } = scale;
    return `<g class="chart-indicator-ichimoku-stub"><text x="${paddingX + innerW / 2}" y="${paddingY + 12}" font-size="9" fill="#C49930" text-anchor="middle" opacity="0.5">일목균형표 (Phase 2.2 후행 구현)</text></g>`;
  }

  root.ChartIndicatorIchimoku = { render };
})(typeof window !== 'undefined' ? window : this);
