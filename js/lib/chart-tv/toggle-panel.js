/* ───── lib/chart-tv/toggle-panel.js — 보조지표 토글 UI chip bar (cycle23 chart-tv-3changes) ─────
   REQ DOC-20260521-REQ-001 §5 + 대표 verbatim 2026-05-21 14:57 KST + 2026-05-22 17:21 KST 정합.

   본질 (cycle22 P0-16 verbatim "일목균형표는 도저히 안되겠다 제거해줘"):
   - **5 chip** (일목 chip 제거 본질 cascade)
   - 대표 verbatim 09:15:50 KST: "그리고 하단 지표인 거래대금 rsi macd는 토글뱌튼 필요없이 기본 출력이야"
   - → tradingValue/macd/rsi chip 제거 (base 영구 ON, expanded-chart.js addTradingValue/addMACD/addRSI 1회 호출)
   - 5 chip = MA + 매물대 + 분홍 + 배당락 + 피보 (P0-16 Fix-50/Fix-51 본질)

   cycle23 chart-tv-3changes Spot 2 (2026-05-22 17:22 KST 대표 verbatim
     "배당락 토글이 있는데 아직 한번도 검증되진 않았지만 기본기능으로 판단하고 항상 표시해주는걸로
      한 다음 토글 버튼은 제거해줘"):
   - **4 chip** (배당락 chip 제거 cascade)
   - exDividend = DEFAULT_INDICATORS 본문 true 유지 (영구 ON, 기본 기능 본질)
   - expanded-chart.js 본문 state.exDividend !== false 본문 본질 → toggle 부재 시 default true 본문 정합
   - chip 4개 = MA + 매물대 + 분홍 + 피보 (배당락 chip 제거 cascade)

   schema (cycle23 정정):
   localStorage key 'm100s.chart.tv.indicators.global' value:
   {
     "ma6": true, "volumeByDecile": true,
     "pinkSignal": true, "exDividend": true, "fibonacci": true
   }
   tradingValue/macd/rsi/exDividend는 state 본문 외 chip layer (base 영구 ON).

   §16 self-catch (cycle23):
   - chip 4개 = 배당락 chip 제거 cascade (대표 verbatim destructive ack 정합)
   - exDividend default true 영구 ON (DEFAULT_INDICATORS 본문 보존 + localStorage backward 호환 본질)
   - expanded-chart.js line 933 본문 `state.exDividend !== false` 본질 → toggle 부재 + default true 본문 정합
   - localStorage 본문 기존 exDividend false 본문 user 잔존 가능 but cycle23 본질 영구 ON 본문 → backward override 부재 정합
     (대표 verbatim "기본기능으로 판단하고 항상 표시" = 기존 localStorage state 본문 무시 + 강제 ON 본질)
*/

// cycle23 chart-tv-3changes Spot 2 본질 — 4 chip (배당락 chip 제거 cascade)
// chip 순서 = 카테고리 본질 (overlay / marker / drawing)
export const INDICATOR_CHIPS = [
  // overlay (캔들 위)
  { key: 'ma6', label: 'MA', name: 'MA 7선', category: 'overlay' },
  { key: 'volumeByDecile', label: '매물대', name: '매물대 10등분', category: 'overlay' },
  // marker
  { key: 'pinkSignal', label: '강세', name: '분홍 강세', category: 'marker' },
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
