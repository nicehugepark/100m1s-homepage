/* ───── lib/chart/interaction/crosshair.js — Layer 3 crosshair + tooltip ─────
   cycle22 Phase 2.2 — SPEC §2.1 Layer 3 / §5.3 트랜지션 (crosshair instant).

   본질:
   - mousemove + touchmove 시 X 위치 기준 최근 candle 매칭 → vertical guide line + tooltip.
   - tooltip = 일자 + OHLC + 거래량 (옵션 + 보조지표 값은 후행 P3).
   - touch: 44pt 타겟 정합 (SPEC §5.4 a11y).
   - cleanup: 빈 영역 mouseleave + container click 외부 시 hide.

   호출부: ChartInteractionCrosshair.wire(container, { data, scale, options })
   - container = .cal-feature-chart-expanded 슬롯 (mousemove 위임)
   - data = normalized data array
   - scale = { paddingX, slot, y, innerH, paddingY }
*/
(function (root) {
  'use strict';

  function nearestIndex(xPx, scale, dataLen) {
    const { paddingX, slot } = scale;
    if (slot <= 0) return -1;
    const idx = Math.floor((xPx - paddingX) / slot);
    if (idx < 0) return 0;
    if (idx >= dataLen) return dataLen - 1;
    return idx;
  }

  function formatPrice(v) {
    if (v == null || isNaN(v)) return '-';
    return Math.round(v).toLocaleString();
  }

  function formatVolume(v) {
    if (v == null || isNaN(v) || v === 0) return '-';
    if (v >= 1e8) return (v / 1e8).toFixed(1) + '억';
    if (v >= 1e4) return (v / 1e4).toFixed(0) + '만';
    return v.toLocaleString();
  }

  function buildTooltip(d) {
    if (!d) return '';
    const chgColor = d.c > d.o ? '#C53939' : (d.c < d.o ? '#1958C7' : '#94A3B8');
    const chgPct = d.o > 0 ? ((d.c - d.o) / d.o * 100).toFixed(2) : '0.00';
    return `
      <div class="cal-chart-tooltip-date">${d.date || '-'}</div>
      <div class="cal-chart-tooltip-row"><span>시</span><strong>${formatPrice(d.o)}</strong></div>
      <div class="cal-chart-tooltip-row"><span>고</span><strong>${formatPrice(d.h)}</strong></div>
      <div class="cal-chart-tooltip-row"><span>저</span><strong>${formatPrice(d.l)}</strong></div>
      <div class="cal-chart-tooltip-row"><span>종</span><strong style="color:${chgColor}">${formatPrice(d.c)} (${d.c >= d.o ? '+' : ''}${chgPct}%)</strong></div>
      <div class="cal-chart-tooltip-row"><span>거래량</span><strong>${formatVolume(d.v)}</strong></div>`;
  }

  function wire(container, opts = {}) {
    if (!container || !opts.data || !opts.scale) return;
    const { data, scale } = opts;

    const mainSvg = container.querySelector('.cal-chart-main-svg');
    if (!mainSvg) return;

    // tooltip + guide line DOM 생성 (없으면)
    let tooltip = container.querySelector('.cal-chart-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'cal-chart-tooltip';
      tooltip.setAttribute('aria-hidden', 'true');
      tooltip.style.position = 'absolute';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.display = 'none';
      container.style.position = container.style.position || 'relative';
      container.appendChild(tooltip);
    }

    // guide line은 SVG 내부 별도 group (rerender 시 cleanup 의무)
    let guideG = mainSvg.querySelector('.cal-chart-guide');
    if (!guideG) {
      guideG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      guideG.setAttribute('class', 'cal-chart-guide');
      mainSvg.appendChild(guideG);
    }

    function showAt(clientX, clientY) {
      const rect = mainSvg.getBoundingClientRect();
      if (rect.width <= 0) return;
      // SVG viewBox vs DOM pixel 비율 보정
      const vbW = parseFloat(mainSvg.getAttribute('viewBox')?.split(' ')[2]) || rect.width;
      const xPx = (clientX - rect.left) * (vbW / rect.width);
      const idx = nearestIndex(xPx, scale, data.length);
      if (idx < 0) return;
      const d = data[idx];
      if (!d) return;
      const xc = scale.paddingX + scale.slot * (idx + 0.5);

      // guide line update
      guideG.innerHTML = `<line x1="${xc.toFixed(1)}" x2="${xc.toFixed(1)}" y1="${scale.paddingY}" y2="${(scale.paddingY + scale.innerH).toFixed(1)}" stroke="#8B95A8" stroke-width="0.6" stroke-dasharray="3 2" opacity="0.7"/>`;

      // tooltip 위치 (오른쪽 placement, container 우측 초과 시 좌측 flip)
      tooltip.innerHTML = buildTooltip(d);
      tooltip.style.display = 'block';
      // 측정 후 위치 결정
      const contRect = container.getBoundingClientRect();
      const tooltipW = tooltip.offsetWidth || 120;
      const tooltipH = tooltip.offsetHeight || 90;
      const xRelative = clientX - contRect.left;
      const yRelative = clientY - contRect.top;
      let placeX = xRelative + 12;
      let placeY = yRelative - tooltipH / 2;
      if (placeX + tooltipW > contRect.width - 8) placeX = xRelative - tooltipW - 12;
      if (placeY < 8) placeY = 8;
      if (placeY + tooltipH > contRect.height - 8) placeY = contRect.height - tooltipH - 8;
      tooltip.style.left = placeX + 'px';
      tooltip.style.top = placeY + 'px';
    }

    function hide() {
      tooltip.style.display = 'none';
      guideG.innerHTML = '';
    }

    function onMove(e) {
      const t = e.touches ? e.touches[0] : e;
      if (!t) return;
      showAt(t.clientX, t.clientY);
    }

    // mouse + touch wire (한 번만)
    if (!mainSvg._crosshairBound) {
      mainSvg.addEventListener('mousemove', onMove);
      mainSvg.addEventListener('mouseleave', hide);
      mainSvg.addEventListener('touchstart', onMove, { passive: true });
      mainSvg.addEventListener('touchmove', onMove, { passive: true });
      mainSvg.addEventListener('touchend', hide);
      mainSvg._crosshairBound = true;
    }
  }

  function unwire(container) {
    if (!container) return;
    const tooltip = container.querySelector('.cal-chart-tooltip');
    if (tooltip) tooltip.remove();
    const mainSvg = container.querySelector('.cal-chart-main-svg');
    if (mainSvg) {
      const guideG = mainSvg.querySelector('.cal-chart-guide');
      if (guideG) guideG.remove();
    }
  }

  root.ChartInteractionCrosshair = { wire, unwire };
})(typeof window !== 'undefined' ? window : this);
