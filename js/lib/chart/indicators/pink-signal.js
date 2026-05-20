/* ───── lib/chart/indicators/pink-signal.js — #2 분홍 강세 신호 marker (default ON) ─────
   cycle22 Phase 2 — SPEC §2.2 + §3.1 분홍 강세 (#EC4899 핫 핑크, sev-hot 정합).

   본질: 100m1s 자체 신호. REQ §7 P1-1 = 정의 부재 — 별건 cycle 후행 spec.
   본 단발 = placeholder 본질 (signalDates input 기반 marker rendering).
   Phase 2.2 후행 sub-agent가 P1-1 결정 후 시그널 계산 로직 채울 예정.

   특정 종목 하드코딩 0건 (대표 발화 18:57 + data-continuity L46 정합).
   본 모듈 입력 = data + opts.signalDates (string[] YYYY-MM-DD) 또는 자동 placeholder rule.
*/
(function (root) {
  'use strict';

  // placeholder rule (P1-1 결정 전 default) — 거래량 상위 5% + 양봉 = 잠정 강세 signal.
  // P1-1 결정 후 별건 cycle에서 본 함수 교체 의무.
  function detectPlaceholderSignals(data) {
    if (!data || data.length < 5) return [];
    const volumes = data.map(d => d.v).filter(v => v > 0);
    if (!volumes.length) return [];
    const sorted = [...volumes].sort((a, b) => b - a);
    const p95 = sorted[Math.floor(sorted.length * 0.05)] || sorted[0];
    const signals = [];
    data.forEach(d => {
      if (d.v >= p95 && d.c > d.o && d.date) signals.push(d.date);
    });
    return signals;
  }

  function render(data, scale, opts = {}) {
    if (!data || !data.length) return '';
    const signalDates = (opts.signalDates && opts.signalDates.length) ? opts.signalDates : detectPlaceholderSignals(data);
    if (!signalDates.length) return '';
    const { paddingX, paddingY, slot, y } = scale;
    const markers = data.map((d, i) => {
      if (!signalDates.includes(d.date)) return '';
      const xc = paddingX + slot * (i + 0.5);
      const yMark = y(d.h) - 8; // wick 위 8px
      // 작은 다이아몬드 marker (touch target ≥ 6×6 SVG → CSS hit area는 별건)
      return `<polygon points="${xc.toFixed(1)},${(yMark - 4).toFixed(1)} ${(xc + 4).toFixed(1)},${yMark.toFixed(1)} ${xc.toFixed(1)},${(yMark + 4).toFixed(1)} ${(xc - 4).toFixed(1)},${yMark.toFixed(1)}" fill="#EC4899" stroke="#fff" stroke-width="0.5"><title>분홍 강세 신호 ${d.date}</title></polygon>`;
    }).join('');
    return `<g class="chart-indicator-pink-signal">${markers}</g>`;
  }

  root.ChartIndicatorPinkSignal = { render, detectPlaceholderSignals };
})(typeof window !== 'undefined' ? window : this);
