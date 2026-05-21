/* ───── lib/chart-tv/toggle-panel.js — 보조지표 토글 UI chip bar (cycle22 P0-16) ─────
   REQ DOC-20260521-REQ-001 §5 + 대표 verbatim 2026-05-21 14:57 KST 정합.

   본질 (cycle22 P0-16 verbatim "일목균형표는 도저히 안되겠다 제거해줘"):
   - **5 chip** (일목 chip 제거 본질 cascade)
   - 대표 verbatim 09:15:50 KST: "그리고 하단 지표인 거래대금 rsi macd는 토글뱌튼 필요없이 기본 출력이야"
   - → tradingValue/macd/rsi chip 제거 (base 영구 ON, expanded-chart.js addTradingValue/addMACD/addRSI 1회 호출)
   - 5 chip = MA + 매물대 + 분홍 + 배당락 + 피보 (P0-16 Fix-50/Fix-51 본질)

   schema (P0-16 정정):
   localStorage key 'm100s.chart.tv.indicators.global' value:
   {
     "ma6": true, "volumeByDecile": true,
     "pinkSignal": true, "exDividend": true, "fibonacci": true
   }
   tradingValue/macd/rsi는 state 본문 외 layer (base 영구 ON).

   §16 self-catch (P0-16):
   - chip 5개 = 일목 chip 제거 cascade (대표 verbatim destructive ack 정합)
   - fibonacci default true = drawing tool 본문 default ON + auto-anchor 본문 정합 (대표 verbatim "이어서 계속")
   - localStorage 본문 기존 `ichimoku` key 본문 잔존 가능 but state read 시 DEFAULT_INDICATORS spread 본문 silent ignore PASS
*/

// P0-16 본질 — 5 chip (일목 chip 제거 cascade)
// chip 순서 = 카테고리 본질 (overlay / marker / drawing)
export const INDICATOR_CHIPS = [
  // overlay (캔들 위)
  { key: 'ma6', label: 'MA', name: 'MA 7선', category: 'overlay' },
  { key: 'volumeByDecile', label: '매물대', name: '매물대 10등분', category: 'overlay' },
  // marker
  { key: 'pinkSignal', label: '강세', name: '분홍 강세', category: 'marker' },
  { key: 'exDividend', label: '배당락', name: '배당락', category: 'marker' },
  // drawing tool (P0-16 Fix-51: default ON + auto-anchor 본문)
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
