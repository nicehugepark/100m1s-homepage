/* ───── lib/chart-tv/toggle-panel.js — 보조지표 토글 UI chip bar (cycle22 Phase 7d-1 P0) ─────
   REQ DOC-20260521-REQ-001 §5 + lead 옵션 A-3 회신 verbatim 정합 (2026-05-21 09:15:50 KST).

   본질 (lead 옵션 A-3 회신 verbatim):
   - 6 chip (REQ v2 §5 9 chip 본질 정정 polished)
   - 대표 verbatim 2026-05-21 09:15:50 KST: "그리고 하단 지표인 거래대금 rsi macd는 토글뱌튼 필요없이 기본 출력이야"
   - → tradingValue/macd/rsi chip 제거 (base 영구 ON, expanded-chart.js addTradingValue/addMACD/addRSI 1회 호출)
   - 6 chip = MA + 일목 + 매물대 + 분홍 + 배당락 + 피보 (Phase 7d-2 fibonacci OFF default)

   schema (lead 옵션 A-3 정정):
   localStorage key 'm100s.chart.tv.indicators.global' value:
   {
     "ma6": true, "ichimoku": true, "volumeByDecile": true,
     "pinkSignal": true, "exDividend": true, "fibonacci": false
   }
   tradingValue/macd/rsi는 state 본문 외 layer (base 영구 ON).

   §16 self-catch (Phase 7d-1 P0):
   - chip 6개 = lead 옵션 A-3 회신 verbatim 정합 (sub-pane 3 chip 제거)
   - 콜백 패턴 = state 변경 후 chart re-render 호출 (callback 1회 invoke)
*/

// lead 옵션 A-3 회신 verbatim — 6 chip (sub-pane 3종 chip 제거, base 영구 ON 본질)
// chip 순서 = 카테고리 본질 (overlay / marker / drawing)
export const INDICATOR_CHIPS = [
  // overlay (캔들 위)
  { key: 'ma6', label: 'MA', name: 'MA 6선', category: 'overlay' },
  { key: 'ichimoku', label: '일목', name: '일목 (구름)', category: 'overlay' },
  { key: 'volumeByDecile', label: '매물대', name: '매물대 10등분', category: 'overlay' },
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
