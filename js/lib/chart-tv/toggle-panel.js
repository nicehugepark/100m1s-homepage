/* ───── lib/chart-tv/toggle-panel.js — 보조지표 토글 UI chip bar (cycle22 Phase 7d-1) ─────
   REQ DOC-20260521-REQ-001 §5 verbatim 정합.

   본질:
   - chart-expanded 상단에 chip bar (가로 스크롤)
   - 9 chip (REQ v2 §2 9 확정 — MA / 일목 / 매물대 / 거래대금 / MACD / RSI / 분홍 / 배당락 / Fibonacci)
   - chip 클릭 시 보조지표 on/off + localStorage 영구화 (indicatorState[ticker] schema)
   - 모바일 대응 (가로 스크롤 wrap)

   schema (REQ v2 §5 verbatim):
   localStorage key 'm100s.chart.tv.indicators.global' value:
   {
     "ma6": true, "ichimoku": true, "volumeByDecile": true,
     "tradingValue": true, "macd": false, "rsi": false,
     "pinkSignal": true, "exDividend": true, "fibonacci": false
   }

   §16 self-catch (Phase 7d-1):
   - chip 9개 = REQ v2 §2 9 확정 정합 (제거 5종 chip 없음)
   - 콜백 패턴 = state 변경 후 chart re-render 호출 (callback 1회 invoke)
*/

// REQ v2 §2 9 확정 — chip 순서는 카테고리 본질 (overlay / pane / marker / drawing)
export const INDICATOR_CHIPS = [
  // overlay (캔들 위)
  { key: 'ma6', label: 'MA', name: 'MA 6선', category: 'overlay' },
  { key: 'ichimoku', label: '일목', name: '일목 (구름)', category: 'overlay' },
  { key: 'volumeByDecile', label: '매물대', name: '매물대 10등분', category: 'overlay' },
  // sub-pane (하단 영역)
  { key: 'tradingValue', label: '거래대금', name: '거래대금', category: 'sub-pane' },
  { key: 'macd', label: 'MACD', name: 'MACD', category: 'sub-pane' },
  { key: 'rsi', label: 'RSI', name: 'RSI', category: 'sub-pane' },
  // marker
  { key: 'pinkSignal', label: '강세', name: '분홍 강세', category: 'marker' },
  { key: 'exDividend', label: '배당락', name: '배당락', category: 'marker' },
  // drawing tool (Phase 7d-2 별건, 본 Phase 7d-1은 OFF default)
  { key: 'fibonacci', label: '피보', name: '피보나치', category: 'drawing' },
];

/**
 * 토글 panel chip bar 신축.
 * @param {HTMLElement} parent — chart-expanded 상단 wrapper
 * @param {Object} state — 현 indicator state ({ma6: true, ...})
 * @param {Function} onChange — state 변경 callback (newState) => void
 * @returns {HTMLElement} — chip bar element (parent에 이미 append됨)
 */
export function buildTogglePanel(parent, state, onChange) {
  if (!parent) return null;

  const bar = document.createElement('div');
  bar.className = 'cal-chart-tv-toggle-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', '보조지표 토글');

  INDICATOR_CHIPS.forEach((chip) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-chart-tv-chip';
    btn.dataset.key = chip.key;
    btn.dataset.category = chip.category;
    const isOn = state[chip.key] === true;
    btn.setAttribute('aria-pressed', String(isOn));
    btn.classList.toggle('is-on', isOn);
    btn.textContent = chip.label;
    btn.title = chip.name + ' ' + (isOn ? '끄기' : '켜기');

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const newOn = !(state[chip.key] === true);
      state[chip.key] = newOn;
      btn.setAttribute('aria-pressed', String(newOn));
      btn.classList.toggle('is-on', newOn);
      btn.title = chip.name + ' ' + (newOn ? '끄기' : '켜기');
      if (typeof onChange === 'function') onChange(state);
    });

    bar.appendChild(btn);
  });

  parent.appendChild(bar);
  return bar;
}

if (typeof window !== 'undefined') {
  window.ChartTVTogglePanel = { buildTogglePanel, INDICATOR_CHIPS };
}
