/* ───── renderer.js — 카드/차트/테마 렌더링 + 초기화 ───── */

// REQ-033 — 마지막 업데이트 시각 포맷 (SPEC-001 §I.4).
// build_daily.py의 generated_at은 naive ISO ("2026-04-27T22:59:43.768243") — timezone 미명시.
// new Date() 파싱 시 브라우저 timezone 의존성 회피하기 위해 substring 직접 추출 (KST 가정 명시).
// 형식 불일치 시 빈 문자열 반환 (FLR-AGT-002 정합 — 거짓 표시 차단).
function _formatGeneratedAt(generatedAt) {
  if (!generatedAt || typeof generatedAt !== 'string') return '';
  const m = generatedAt.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/);
  if (!m) return '';
  return `${m[1]}:${m[2]} KST`;
}

// 신선도 라벨 (2026-05-27 대표 직접 발화) — 차단(blackout) 없이 stale 여부만 산출.
// 대표 verbatim: "폴링 오류 화면(장중 데이터 갱신 중)이 존재하는 것 자체가 잘못."
//   기존 `_computeMarketHardGuard`(종목 카드/차트 차단)를 제거하고, 항상 마지막 데이터를 렌더하되
//   헤더에 정직한 신선도 라벨(점 • + "HH:MM 기준" + is-stale)만 표시한다 (FLR-20260527-TEC-001 정합).
// stale 조건: KST 장중 09:00~15:30 + 오늘 view + (now - last_snapshot_at) > 30분.
//   그 외(장 시작 전/장 마감 후/휴장/과거 viewDate/30분 이내) = stale:false.
// 반환: { stale: boolean }  (차단 정보 없음 — 단순 신선도 플래그)
function _computeFreshnessLabel(generatedAt, lastSnapshotAt, viewDate, nowMs) {
  // KST = UTC+9. nowMs(UTC) 에 9시간 가산 후 UTC 메서드로 읽으면 브라우저 timezone과 무관하게 KST 시각 확보.
  const kstMs = nowMs + 9 * 60 * 60 * 1000;
  const kstNow = new Date(kstMs);
  const yyyy = kstNow.getUTCFullYear();
  const mm = String(kstNow.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kstNow.getUTCDate()).padStart(2, '0');
  const todayKst = `${yyyy}-${mm}-${dd}`;
  const hourKst = kstNow.getUTCHours();
  const minKst = kstNow.getUTCMinutes();
  const totalMin = hourKst * 60 + minKst;
  const isToday = (viewDate === todayKst);
  const isMarketOpen = (totalMin >= 9 * 60 && totalMin < 15 * 60 + 30);
  // 장중 + 오늘 view 일 때만 신선도 판정 (그 외는 stale 개념 무의미 → false)
  if (!isToday || !isMarketOpen) {
    return { stale: false };
  }
  // (now - last_snapshot_at) > 30분 → stale
  if (lastSnapshotAt && typeof lastSnapshotAt === 'string') {
    const parsed = Date.parse(lastSnapshotAt);
    if (!isNaN(parsed)) {
      const minutesAgo = Math.floor((nowMs - parsed) / 60000);
      if (minutesAgo > 30) return { stale: true };
    }
  }
  return { stale: false };
}

// buildSparkline → js/lib/sparkline.js (REQ-001 §3 Phase 1 분리)
// buildCandles20 → js/lib/mini-candle.js (REQ-001 §3 Phase 1 분리)

function deriveDate(post) {
  if (post.post_date) return post.post_date;
  if (post.fetched_at) return post.fetched_at.slice(0, 10);
  return '날짜 미상';
}

// Q-20260606-111 — 카드 마감 종가 SSOT = dailybars close (daily_20[-1].c). interp.close_price snapshot 은
//   장중 cur_prc 가 섞여 마감 종가와 괴리(001440 close_price=74000=고가 사고). 일봉캔들(Q-20260515-CANDLE-
//   SOURCE-UNIFY) 과 동일 source 로 통일. daily_20 부재 시 close_price → range_240d.current fallback (graceful).
function _dailybarsClose(interp) {
  if (!interp) return null;
  const d20 = interp.daily_20;
  if (Array.isArray(d20) && d20.length > 0 && typeof d20[d20.length - 1].c === 'number') {
    return d20[d20.length - 1].c;
  }
  if (typeof interp.close_price === 'number') return interp.close_price;
  if (interp.range_240d && typeof interp.range_240d.current === 'number') return interp.range_240d.current;
  return null;
}

// PM320-D6 P1 (손님 판정 — 용어 풀이 0) — 주식 초보(손님) 대상 용어 1줄 풀이.
//   라벨 옆 (?) 버튼을 탭하면 팝오버로 풀이 표시 (모바일 터치 동작 = 전역 위임 핸들러 _wireTermTips).
//   거짓 금지(FLR-AGT-002) — 사실 기반 간결 정의만. 추정·과장 0.
const _PM320_GLOSSARY = {
  'trade-amount': { t: '거래대금', d: '하루 동안 그 종목이 사고팔린 금액의 합계. 클수록 사람들의 관심·돈이 많이 몰렸다는 뜻입니다.' },
  candle: { t: '양봉 / 음봉', d: '하루 캔들 색. 시작가보다 끝값이 오르면 빨강(양봉), 내리면 파랑(음봉)입니다.' },
  watering: { t: '물타기', d: '산 종목이 떨어졌을 때 더 사서 평균 매입가를 낮추는 것. PM320은 진입가에서 약 -6.4%일 때를 기준점으로 봅니다.' },
  'take-profit': { t: '익절', d: '이익을 본 상태에서 파는 것. PM320은 진입가에서 약 +3.2%를 목표로 잡습니다.' },
  pending: { t: '보류', d: '그날의 조건을 만족하는 종목이 없어 추천을 내지 않는 것. 무리한 추천 대신 쉬어가는 날입니다.' },
};
// (?) 마커 — term 키에 해당하는 풀이가 있을 때만 생성. aria-label 로 스크린리더 정합.
function _termTip(term) {
  const g = _PM320_GLOSSARY[term];
  if (!g) return '';
  return `<button type="button" class="cal-term-tip" data-term="${escapeHtml(term)}" aria-label="${escapeHtml(g.t)} 용어 설명" aria-expanded="false">?</button>`;
}
// 전역 (?) 탭 팝오버 — 1회만 등록. 탭 시 해당 버튼 아래 풀이 팝오버 토글, 바깥 탭 시 닫힘.
function _wireTermTips() {
  if (window._termTipsInit) return;
  window._termTipsInit = true;
  const _close = () => {
    const open = document.querySelector('.cal-term-pop');
    if (open) open.remove();
    document.querySelectorAll('.cal-term-tip[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  };
  document.addEventListener('click', (e) => {
    const tip = e.target.closest('.cal-term-tip');
    if (!tip) { _close(); return; }
    e.preventDefault();
    e.stopPropagation();
    const wasOpen = tip.getAttribute('aria-expanded') === 'true';
    _close();
    if (wasOpen) return; // 토글: 열려 있던 것 탭 시 닫기만
    const g = _PM320_GLOSSARY[tip.dataset.term];
    if (!g) return;
    const pop = document.createElement('div');
    pop.className = 'cal-term-pop';
    pop.setAttribute('role', 'tooltip');
    pop.innerHTML = `<span class="cal-term-pop-title">${escapeHtml(g.t)}</span>${escapeHtml(g.d)}`;
    tip.setAttribute('aria-expanded', 'true');
    // position:fixed 오버레이 — body 직속으로 붙여 어떤 부모 레이아웃에도 0 영향(시프트 0).
    //   버튼 rect 기준으로 좌표 계산, 뷰포트 경계(8px 여백) 넘으면 좌/우 자동 보정(클리핑 방지).
    document.body.appendChild(pop);
    const MARGIN = 8;
    const btn = tip.getBoundingClientRect();
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    // 가로: 버튼 좌측 정렬 기본, 우측 클리핑 시 좌측으로 당김(최소 MARGIN 확보).
    let left = btn.left;
    if (left + pw > window.innerWidth - MARGIN) left = window.innerWidth - MARGIN - pw;
    if (left < MARGIN) left = MARGIN;
    // 세로: 버튼 아래 기본, 아래 공간 부족하면 버튼 위로 플립.
    let top = btn.bottom + 6;
    if (top + ph > window.innerHeight - MARGIN && btn.top - 6 - ph >= MARGIN) top = btn.top - 6 - ph;
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
  });
  // 바깥 스크롤 시 닫힘 — fixed 팝오버가 앵커와 분리돼 떠다니는 잔상 방지.
  window.addEventListener('scroll', _close, { passive: true });
}

function renderNewsCard(card) {
  const j = card.judgment || '중립';
  // 강도 — % 숫자 대신 카테고리. 구버전 호환: confidence가 있으면 임계값으로 변환
  let strength = card.strength;
  if (!strength && card.confidence != null) {
    if (card.confidence >= 0.75) strength = '강';
    else if (card.confidence >= 0.5) strength = '중';
    else strength = '약';
  }
  const strengthHtml = strength ? `<span class="judgment-strength">·${strength}</span>` : '';
  return `
    <div class="news-card">
      <div class="news-judgment ${j}">${j}${strengthHtml}</div>
      <div class="news-content">
        <div class="news-summary">${escapeHtml(card.summary || '(요약 없음)')}</div>
        ${card.reasoning ? `<div class="news-reasoning">${escapeHtml(card.reasoning)}</div>` : ''}
      </div>
    </div>
  `;
}

// DSN-001 §16.1.4 (v7.2): rules_version 배너 — localStorage에 최종 확인 버전 저장, 불일치 시 1회 안내.
// data.rules_version이 없으면 배너 자체 미생성 (graceful degradation).
function _buildRulesVersionBanner(rulesVersion) {
  if (!rulesVersion || typeof rulesVersion !== 'string') return '';
  const LS_KEY = 'lastSeenRulesVersion';
  let lastSeen = '';
  try { lastSeen = localStorage.getItem(LS_KEY) || ''; } catch (e) { return ''; }
  if (lastSeen === rulesVersion) return ''; // 최신 확인 완료
  // 배너 1회 표시. 사용자 X 클릭 시 해당 버전을 최신으로 저장.
  const safeVer = String(rulesVersion).replace(/[^0-9a-zA-Z]/g, '').slice(0, 16);
  return `<div class="cal-rules-version-banner" role="status" aria-live="polite" data-version="${safeVer}">
    <span class="cal-rules-version-icon" aria-hidden="true">ℹ️</span>
    <span class="cal-rules-version-msg">규정 데이터가 갱신되었습니다. 최신 기준으로 보시려면 새로고침을 권장합니다.</span>
    <button type="button" class="cal-rules-version-close" aria-label="배너 닫기" data-rules-ver="${safeVer}">&times;</button>
  </div>`;
}
// 배너 X 클릭 핸들러 — event delegation (document-level)
if (typeof document !== 'undefined' && !window.__rulesVerBannerBound) {
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest('.cal-rules-version-close');
    if (!btn) return;
    const v = btn.getAttribute('data-rules-ver') || '';
    try { localStorage.setItem('lastSeenRulesVersion', v); } catch (err) {}
    const banner = btn.closest('.cal-rules-version-banner');
    if (banner) banner.remove();
  });
  window.__rulesVerBannerBound = true;
}

/* ───── DSN-20260425-DSN-004 v9.1 §J.1 — KOREA_HOLIDAYS 글로벌 주입 ─────
   utils.js getNextTradingDay()의 안전망 데이터 소스. build_daily.py 산출 next_trading_day_for_predicted 신뢰가 원칙.
   estimated 등급 시 console.warn (FLR-20260423-FLR-002 verified 절차).
*/
if (typeof window !== 'undefined' && !window.__koreaHolidaysLoading && !window.KOREA_HOLIDAYS) {
  window.__koreaHolidaysLoading = true;
  fetch('/data/holidays.json')
    .then(r => r.ok ? r.json() : null)
    .then(j => { if (j) window.KOREA_HOLIDAYS = j; })
    .catch(() => {})
    .finally(() => { window.__koreaHolidaysLoading = false; });
}

// Q-20260605-103 Phase 4 → Q-20260608-140 (A안 페어 카드) → Q-20260608-145 (선물 상시 표시) — 미 선물 게이트. DSN-001 §2/§4.
//   변경 이력: (1) 하드 시간대 게이트(09:00~15:30 한국장중) 폐기 → 신선도(as_of_kst ≤30분)만 판정.
//     (2) Q-145: 30분 신선도 게이트 폐기 → 선물 데이터 있고 *유효 거래일 범위*면 항상 표시(토글·카드 상시 노출).
//   사유(Q-145): us-intraday cron 이 국내장(08:50~15:30 KST) 에만 갱신 → 15:30 후 30분이면 선물 토글이 사라져
//     "선물 장 끝났냐"(대표) 오해. 그러나 CME 선물은 ~23h 거래(거의 항상 open) → 데이터 stale ≠ 시장 마감.
//     stale 는 숨기지 않고 "N분 전 기준" + (30분↑) "지연" 배지로 *정직하게 명시*(FLR-AGT-002 거짓 충실성: 숨김도
//     허위실시간도 금지). 거래중/마감 위계는 데이터 session_open 도트로 별도 노출(신선도와 직교).
//   가드(유지): (a) ageMin < 0(미래시각=데이터 오류) → 미표시. (b) ageMin > STALE_MAX_MIN(주말 휴장 ~49h 초과 =
//     "수일 전 좀비 데이터") → 미표시. 정당한 거래일 간극(평일 마감~다음 갱신, 주말)은 모두 graceful 표시.
//   반환에 isStale(30분 초과) 추가 → index-card 가 "지연" 배지 분기.
//   as_of_kst 형식: ISO(tz offset 有, 라이브 "...+09:00") 또는 "YYYY-MM-DD HH:MM:SS"(tz 無, KST 로컬) graceful.
function _matchFuturesToIndices(us) {
  const fu = us && us.futures;
  if (!fu || !Array.isArray(fu.futures) || fu.futures.length === 0) return null;
  // as_of_kst 신선도 — tz offset 有(라이브) 시 Date 가 절대시각으로 정확 파싱 → Date.now() 와 직접 비교.
  //   tz 無("YYYY-MM-DD HH:MM:SS") 시 KST 로컬 벽시계로 해석되므로 kstNow 벽시계와 비교(환경 무관).
  const s = String(fu.as_of_kst).trim();
  const hasTz = /[zZ]$|[+\-]\d{2}:?\d{2}$/.test(s);
  let ageMin;
  if (hasTz) {
    const parsed = new Date(s);
    if (isNaN(parsed.getTime())) return null;  // 파싱 실패 → 미표시 (stale 가장 금지)
    ageMin = Math.round((Date.now() - parsed.getTime()) / 60000);
  } else {
    const isoish = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s) ? s.replace(' ', 'T') : s;
    const parsed = new Date(isoish);
    if (isNaN(parsed.getTime())) return null;
    const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    ageMin = Math.round((kstNow.getTime() - parsed.getTime()) / 60000);
  }
  // Q-20260608-145 — 30분 게이트 폐기. 미래시각(오류) + "수일 전 좀비" 만 차단, 거래일 간극은 graceful 표시.
  //   STALE_MAX_MIN: CME 선물 최장 정당 휴장 = 주말(토 06:00 KST ~ 월 08:00 KST 경) ~49h. 여유 포함 49h=2940분.
  //   초과 = 데이터 파이프라인 수일 정지(좀비) → 허위 노출 방지 위해 미표시.
  const STALE_MAX_MIN = 49 * 60;
  if (ageMin < 0 || ageMin > STALE_MAX_MIN) return null;
  const isStale = ageMin > 30;  // 30분 초과 → index-card "지연" 배지 (cron 갱신 주기 ~10분 기준 비정상)
  const byName = new Map();
  fu.futures.forEach(f => { if (f && f.name) byName.set(String(f.name).toLowerCase(), f); });
  // session_open — 섹션 단위 거래중/마감 (data-loader 통과). boolean 아니면 undefined(도트 미렌더).
  const sessionOpen = (typeof fu.session_open === 'boolean') ? fu.session_open : undefined;
  return { byName, list: fu.futures, ageMin, sessionOpen, isStale };
}

// 클라이언트 ET 벽시계 미 정규장 개장 판정 (평일 09:30~16:00 ET). 서버 regular_open 부재 시 fallback.
//   ZoneInfo 대신 toLocaleString('en-US',{timeZone:'America/New_York'}) → EDT/EST 자동(DST 분기 불요,
//   collect_us_indices.is_us_regular_open 백엔드 판정 동형). 주말 휴장. best-effort(공휴일 미반영 —
//   휴장일 true 여도 그 외 시간 선물 기본이라 영향 경미).
function _isUsRegularOpenClient() {
  const etNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const dow = etNow.getDay();  // 0=일 6=토
  if (dow === 0 || dow === 6) return false;
  const mins = etNow.getHours() * 60 + etNow.getMinutes();
  return mins >= 9 * 60 + 30 && mins < 16 * 60;  // [09:30, 16:00)
}

// Q-20260609 (대표 verbatim 2026-06-09 05:48) — 토글 자동 기본값 단순화. 시계 시간표(23:30~08:00 등) 폐기.
//   "미 정규장 시간대만 정규장 토글, 그 외 시간엔 선물 토글을 기본." regular_open 단일 기준.
//   반환 'regular'(정규장) | 'futures'(선물). "둘 다" 자동 기본 ❌(사용자 능동 선택만).
//   규칙: (1) 선물 데이터(matched) 부재 → 'regular'(빈 화면 방지 graceful, 기존 L183 유지) /
//     (2) 미 정규장 개장 중(regularOpen) → 'regular' / (3) 그 외 모든 시간 → 'futures'.
//   regularOpen 판정 = 서버 us.regular_open(P0 부착, boolean) 우선 → 미부착 시 클라이언트 ET fallback.
function _futAutoDefault(matched, regularOpen) {
  if (!matched) return 'regular';  // 선물 데이터 없으면 정규장만 (graceful, 빈 화면 방지)
  const isRegularOpen = (typeof regularOpen === 'boolean') ? regularOpen : _isUsRegularOpenClient();
  return isRegularOpen ? 'regular' : 'futures';  // 정규장 개장 중=정규장, 그 외=선물 기본
}

// Q-20260608-140 (A안, DSN-001 §1 #4 + §7 비판 4) — 지수↔선물 명시 매핑 테이블 (부분일치 폐기).
//   부분일치(`NASDAQ` lower vs `나스닥100 선물`)는 라이브에서 NASDAQ·DOW 미매칭 사고 원인 → 결정적 매핑.
//   key = 지수 카드 제목(us-indices indices[].name), value = { futName: 선물 데이터 name, display: 페어 카드 제목 }.
//   futName 은 us-indices futures[].name 과 정확 일치(소문자 비교). display 는 짧은 식별명(label_note 풀 고지문 ❌).
const _IDX_FUT_MAP = {
  'nasdaq': { futName: '나스닥100 선물', display: 'NASDAQ 선물' },
  's&p500': { futName: 'S&P500 선물', display: 'S&P500 선물' },
  'dow': { futName: '다우 선물', display: 'DOW 선물' }
};

// 지수(ix) → 대응 선물 entry. 명시 매핑 테이블 기준 정확 해소. 미매칭 시 null (허위 매핑 금지).
//   반환 { fut, ageMin, display, isStale } — display = 페어 카드 제목, isStale = 30분 초과(Q-145 지연 배지).
function _resolveFutureFor(ix, matched) {
  if (!matched || !ix) return null;
  const nm = String(ix.name || '').trim().toLowerCase();
  const m = _IDX_FUT_MAP[nm];
  if (!m) return null;  // 매핑 테이블에 없는 지수 → 선물 카드 미생성
  const fut = matched.byName.get(String(m.futName).toLowerCase());
  if (!fut) return null;  // 선물 데이터에 해당 name 부재 → 미렌더
  return { fut, ageMin: matched.ageMin, display: m.display, isStale: matched.isStale };
}

// Q-20260605-103 Phase 3 → Q-20260608-140 (A안 페어 카드) — 야간 미국증시 요약 섹션 빌더.
//   DSN-001 §1~§4. 입력 us = data.nightlyUs (data-loader.loadNightlyUsSummary 검증 산출).
//   null/부재/지수 0건 시 '' 반환 → 섹션 전체 미렌더 (FLR-AGT-002 거짓 충실성 차단, 빈 카드/mock 금지).
//   구조 (A안): 정규장 카드 + 선물 카드 = 별개 페어. 섹션 단위 토글 [정규장|선물|둘 다] + 시간대 자동 기본값.
//     삽입형(.idx-futures-row 카드 내 오버레이) 전면 폐기 (라이브 깨짐·NASDAQ/DOW 미노출 원인).
//   토글 = data-fut-view attribute(regular|futures|both) + CSS 가시성 제어(JS는 attribute만 토글, 재렌더 0).
//     기본 진입 = _futAutoDefault(시간대 자동). 사용자 클릭 시 localStorage('pm320-us-fut-view') override.
function _buildNightlyUsHtml(us, viewDate) {
  if (!us || typeof us !== 'object') return '';
  if (!Array.isArray(us.indices) || us.indices.length === 0) return '';
  if (typeof renderIndexCard !== 'function') return '';

  // Q-20260610 (대표 catch 6/10, 2회차) — 지난 날짜 카드 판정. session_open 은 수집 시점 스냅샷이라
  //   지난 날짜(viewDate < KST 오늘) 카드에서 frozen true 로 "장중"(현재형) 라벨이 오독된다(FLR-AGT-002).
  //   여기서 viewDate vs KST 오늘을 비교해 isPastDate 를 산출, 카드 컴포넌트로 전달 → 현재형 라벨 강등.
  //   viewDate 부재(구 호출) 시 false(현행 유지). KST=UTC+9 (브라우저 timezone 무관 산출, L23 동형).
  var isPastDate = false;
  if (typeof viewDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(viewDate)) {
    var _kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    var _todayKst = _kst.getUTCFullYear() + '-'
      + String(_kst.getUTCMonth() + 1).padStart(2, '0') + '-'
      + String(_kst.getUTCDate()).padStart(2, '0');
    isPastDate = viewDate < _todayKst;
  }

  // 선물 신선도 매칭 (≤30분). 부재/stale 시 null → 선물 카드·토글 미렌더 (정규장 카드만, 현행 동일).
  const _futMatched = _matchFuturesToIndices(us);
  const _hasFutures = !!_futMatched;

  // 지수별 페어 그룹 — 정규장 카드(renderIndexCard) + (가용 시)선물 카드(renderIndexFuturesCard) 묶음.
  //   futureInfo 인자 제거(삽입형 폐기) → renderIndexCard 2번째 인자 null.
  const groupsHtml = us.indices.map(ix => {
    const regularCard = renderIndexCard(ix, null, us.trade_date_local, { isPastDate });
    if (!regularCard) return '';
    let futCard = '';
    if (_hasFutures && typeof renderIndexFuturesCard === 'function') {
      const resolved = _resolveFutureFor(ix, _futMatched);  // { fut, ageMin, display } | null
      if (resolved) {
        // Q-20260608-143 — 선물 카드 = 선물 전용 *실시간* 뉴스(resolved.fut.news, us-intraday 가 한국
        //   장중=미 야간 선물 거래시간대 RSS 로 생성). 정규장 지수(ix.news, 전일 미장 마감)와 시제 분리.
        //   선물 실시간 뉴스 부재 시 undefined → 선물 카드 뉴스 블록 미렌더(정규장 마감 뉴스 fallback 금지,
        //   시제 혼동 재발 차단, FLR-AGT-002). Q-141 의 ix.news 공유는 폐기.
        const futNews = (resolved.fut && typeof resolved.fut.news === 'object') ? resolved.fut.news : undefined;
        futCard = renderIndexFuturesCard(
          resolved.fut, resolved.ageMin, us.trade_date_local, _futMatched.sessionOpen, resolved.display, futNews,
          resolved.isStale,  // Q-145 — 30분 초과 시 "지연" 배지 (selectorless graceful, 카드 숨김 ❌)
          isPastDate  // Q-20260610 (2회차) — 지난 날짜 카드 시 라이브 "거래중" 도트·실시간 라벨 강등
        );
      }
    }
    // .idx-pair-group — 정규장(.idx-card-regular) + 선물(.idx-card-futures) 래핑. 토글 CSS가 가시성 제어.
    return `<div class="idx-pair-group">`
      + `<div class="idx-card-regular">${regularCard}</div>`
      + (futCard ? `<div class="idx-card-futures">${futCard}</div>` : '')
      + `</div>`;
  }).filter(Boolean).join('');
  if (!groupsHtml) return '';

  // 토글 세그먼트(§2) → Q-20260608-141 (§2) — "둘 다" 제거. 2-state [정규장|선물]만. 터치 ≥44px(CSS).
  //   초기 active = 자동 기본값(_futAutoDefault). data-fut-view 동기화는 inline init script(_wireUsFutToggle).
  // Q-20260609 — 서버 regular_open(P0 부착) 전달. 미부착(구 데이터) 시 _futAutoDefault 가 클라 ET fallback.
  const autoView = _hasFutures ? _futAutoDefault(_futMatched, us && us.regular_open) : 'regular';
  let toggleHtml = '';
  if (_hasFutures) {
    toggleHtml = `<div class="idx-fut-toggle" role="tablist" aria-label="미장 표시 전환">`
      + `<button type="button" class="idx-fut-toggle-btn" data-fut-set="regular" role="tab">정규장</button>`
      + `<button type="button" class="idx-fut-toggle-btn" data-fut-set="futures" role="tab">선물</button>`
      + `</div>`;
  }

  // 선물 고지(§4) — 섹션 1회 공통 각주 (카드마다 반복 ❌, 깨짐 원인 제거). 선물 가용 시에만.
  const disclaimerHtml = _hasFutures
    ? `<div class="idx-fut-disclaimer">선물은 현물 지수와 별개 기초자산입니다. 갱신 주기 약 10분.</div>`
    : '';

  // 미국발 뉴스 요약 — 국내 "오늘의 뉴스요약" 칩 클래스 1:1 (대표 21:09 catch).
  //   국내 실제 칩 = .cal-macro-strip > .cal-macro-chip. 본 클래스 그대로 재사용(스타일 복제 금지). a 래핑 + 출처 약어.
  let newsHtml = '';
  if (Array.isArray(us.news_chips) && us.news_chips.length > 0) {
    const chips = us.news_chips.map(c => {
      const safeUrl = (typeof c.url === 'string' && /^https?:\/\//i.test(c.url)) ? c.url : '';
      if (!safeUrl) return '';  // 유효 URL 없으면 칩 미렌더 (법무: 딥링크 필수)
      const summary = escapeHtml(sanitize(c.summary || ''));
      const source = escapeHtml(sanitize(c.source || ''));
      return `<a class="cal-macro-chip nightly-us-newschip" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">`
        + `${summary}<span class="nightly-us-news-source">${source}</span></a>`;
    }).filter(Boolean).join('');
    if (chips) {
      newsHtml = `<div class="cal-section-title">미국발 뉴스 요약</div>`
        + `<div class="cal-macro-strip">${chips}</div>`;
    }
  }

  // PM320 정보 위계 개편 (대표 2026-06-10 A안 승인 "야간 미국증시는 권장대로 해") — 야간 미국증시도 기본 접힘.
  //   #cal-content 내부에서 이 섹션(높이 ~1176px)이 오늘의 뉴스/픽 위에 렌더돼 픽을 4스크롤 아래로 밀어내던
  //   문제(실측 픽 y=2134→접기 시 ~900) 해소. 동일 토글 패턴 + 미니요약 "▸ 나스닥 ±N%"(첫 지수 기준).
  //   localStorage 'pm320SectionExpand' 공유(키 'nightly-us'). aria/Enter/Space 위임은 _wireSectionCollapse.
  let _nuSummary = '야간 미국증시';
  try {
    const _lead = us.indices.find(ix => /nasdaq|나스닥/i.test(ix && ix.name || '')) || us.indices[0];
    if (_lead && typeof _lead.change_pct === 'number') {
      const _sign = _lead.change_pct > 0 ? '+' : (_lead.change_pct < 0 ? '−' : '');
      const _nm = escapeHtml(_lead.name || '나스닥');
      _nuSummary = _nm + ' ' + _sign + Math.abs(_lead.change_pct).toFixed(2) + '%';
    }
  } catch (_) { /* graceful */ }
  const _nuHeaderHtml =
    '<div class="nightly-us-head pm320-section-header" role="button" tabindex="0"'
    + ' data-collapse-section="nightly-us" aria-expanded="false" aria-controls="sec-body-nightly-us"'
    + ' aria-label="야간 미국증시 요약 섹션 펼치기/접기">'
    + '<div class="pm320-section-headline"><div class="nightly-us-title">야간 미국증시</div></div>'
    + '<span class="pm320-section-summary" data-collapse-summary="1">' + _nuSummary + '</span>'
    + '<span class="pm320-section-chevron" aria-hidden="true">▾</span>'
    + '</div>';
  // data-fut-view = 초기 가시성(CSS). data-fut-auto = 자동 기본값(localStorage 없을 때 fallback, init script 사용).
  return `<section class="nightly-us-summary pm320-collapsible" id="nightly-us" aria-label="야간 미국증시 요약" data-fut-view="${autoView}" data-fut-auto="${autoView}" data-has-fut="${_hasFutures ? '1' : '0'}">`
    + _nuHeaderHtml
    + `<div class="section-collapse-body" id="sec-body-nightly-us">`
    + newsHtml
    + toggleHtml
    + `<div class="nightly-us-cards">${groupsHtml}</div>`
    + disclaimerHtml
    + `</div>`
    + `</section>`;
}

// Q-20260608-140 (A안, DSN-001 §2) — 미장 토글 wiring. 섹션 렌더 후 1회 호출(_renderCalendar 말미).
//   localStorage('pm320-us-fut-view') 우선 → 없으면 data-fut-auto(시간대 자동). 클릭 시 attribute + localStorage 갱신.
//   재렌더 0 (data-fut-view attribute만 변경, CSS 가 가시성 제어). 멱등(중복 호출 안전 — dataset flag 가드).
function _wireUsFutToggle() {
  const sec = document.querySelector('.nightly-us-summary[data-has-fut="1"]');
  if (!sec || sec.dataset.futWired === '1') return;
  sec.dataset.futWired = '1';
  let view = sec.getAttribute('data-fut-auto') || 'regular';
  try {
    const saved = localStorage.getItem('pm320-us-fut-view');
    // Q-20260608-141 (§2) — "both" 폐기. 과거 'both' override 저장분은 무시(자동 기본값으로 fallback) + 정리.
    if (saved === 'regular' || saved === 'futures') view = saved;
    else if (saved === 'both') { try { localStorage.removeItem('pm320-us-fut-view'); } catch (e2) { /* 무시 */ } }
  } catch (e) { /* localStorage 차단 환경 → 자동값 유지 */ }
  const apply = (v) => {
    sec.setAttribute('data-fut-view', v);
    sec.querySelectorAll('.idx-fut-toggle-btn').forEach(b => {
      const on = b.getAttribute('data-fut-set') === v;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  };
  apply(view);
  sec.querySelectorAll('.idx-fut-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.getAttribute('data-fut-set');
      if (v !== 'regular' && v !== 'futures') return;  // Q-20260608-141 (§2) — "both" 제거
      apply(v);
      try { localStorage.setItem('pm320-us-fut-view', v); } catch (e) { /* 무시 */ }
    });
  });
}

// design-news-time-state-v1 — PRE_MARKET 빈 상태 (Option A).
// 거래일 09:00 미만 시 카드 list 미렌더 + 시계 아이콘 + 카운트다운 + 보조 토글 (전일 데이터 보기).
// stale 라벨 자연 봉쇄 (catch 2): PRE_MARKET 진입 시 데이터 자체가 안 보이므로 라벨 노출 0.
// 사용자 명시 토글 시에만 카드 list 렌더 + data-stale="true" attribute 부착.
// PM320-D6 R18 (비신자 평가자 P1) — 장전(PRE_MARKET) 랜딩에 "어제의 픽 결과" 칩(접지 않고 노출).
//   종전: 장 시작 전엔 카운트다운만 → "빈 페이지" 인식 이탈. 전일 픽 결과를 한 줄 칩으로 즉시 노출해
//   "이 서비스가 뭘 하는지"를 첫 화면에서 보여준다(전일 데이터 보기 토글은 그대로 — 칩은 핵심 1픽만).
//   - 데이터: 전일(prevDate) loadCalDayData 결과의 interpretedByName 중 pm320_pick.is_pick===true 1건.
//   - 청산 완료(taken_profit/expired_*) 시 결과 + 장중 MDD 병기. running(진행중)이면 "보유 중 D+n".
//   - 픽 부재/미신뢰 시 빈 문자열(미렌더, 추정 0 — FLR-AGT-002). 하드코딩 0.

// R25 P0-1 (2026-06-11) — D-카운터 분모 동적화 helpers. 종전 "/+3" 하드코딩 + dOffset<=3 조건은
//   물타기 픽(만기 연장, 예: 6/4 픽 expiry 6/12 = D+6)과 같은 카드의 만기 필드와 자기모순 +
//   D+4~ 진입 시 카운터 소실. 분모 = pick_date→expiry_date 영업일 차(데이터 SSOT, "D+6" 등
//   전략 파라미터 하드코딩 0). 주중(월~금) 카운트 — pick/expiry 자체가 영업일이라 안전, 중간
//   평일 공휴일 구간은 ±1 보수 오차 가능(분모/분자 동일 산식이라 상호 정합). 무효 입력 시 null
//   → 호출부가 카운터 자체를 생략(거짓 표시 차단, FLR-AGT-002).
function _pm320BizDayDiff(fromISO, toISO) {
  if (typeof fromISO !== 'string' || typeof toISO !== 'string') return null;
  const f = fromISO.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const t = toISO.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!f || !t) return null;
  const from = Date.UTC(+f[1], +f[2] - 1, +f[3]);
  const to = Date.UTC(+t[1], +t[2] - 1, +t[3]);
  if (to < from) return null;
  let count = 0;
  for (let ms = from + 86400000; ms <= to; ms += 86400000) {
    const dow = new Date(ms).getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    if (count > 60) return null; // 비정상 구간(데이터 오염) 방어 — 카운터 생략
  }
  return count;
}
function _pm320DTotal(pk) {
  if (!pk) return null;
  return _pm320BizDayDiff(pk.pick_date, pk.expiry_date);
}
// KST 오늘 (YYYY-MM-DD) — 브라우저 timezone 무관 (_computeFreshnessLabel 동일 기법, UTC+9 가산)
function _pm320TodayKstISO() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
}

function _buildPrevPickChipHtml(prevInterpByName, prevDate) {
  try {
    if (!prevInterpByName || typeof prevInterpByName.values !== 'function') return '';
    let pk = null, name = '', code = '';
    for (const interp of prevInterpByName.values()) {
      const p = interp && interp.pm320_pick;
      if (p && p.is_pick === true) { pk = p; name = interp.name || interp.stock_name || ''; code = interp.code || interp.ticker || ''; break; }
    }
    if (!pk || !pk.current_state) return '';
    const state = pk.current_state;
    const _signed = (p) => (p == null || !Number.isFinite(p)) ? '—' : `${p >= 0 ? '+' : ''}${p.toFixed(2)}%`;
    const _dd = (p) => (p == null || !Number.isFinite(p)) ? '' : `${p.toFixed(2)}%`;
    // 자체 KRW 포매터(이 함수는 module-level — renderCalExpandContent 의 _fmtKRW closure 밖이라 재정의).
    const _krw = (n) => (n == null || !Number.isFinite(n)) ? '—' : (n.toLocaleString('ko-KR') + '원');
    let markText, mod, finalPct;
    if (state === 'running') {
      // R25 P0-1/P0-2 (2026-06-11) — (1) 분모 동적: 만기 필드 기반(_pm320DTotal), "/+3" 하드코딩 폐기.
      //   (2) D+N 동결 차단: 스냅샷 d_offset 대신 pick_date→오늘(KST) 실제 영업일 차로 라이브 계산
      //   (만기 상한 클램프). 트래커 데이터 갱신이 정지돼도 "진입 당일 (D+0)" 거짓 라벨이 안 나온다.
      //   잠정 손익(current_pnl_pct)은 스냅샷(prevDate) 기준 값 그대로 → "집계 기준 MM/DD" caption 으로
      //   정직 명시(데이터 파이프라인 touch 0, 표기 정직성만 회복 — FLR-AGT-002).
      const dTotal = _pm320DTotal(pk);
      const todayKst = _pm320TodayKstISO();
      const dLiveRaw = _pm320BizDayDiff(pk.pick_date, todayKst);
      const dLive = (dLiveRaw != null)
        ? (dTotal != null ? Math.min(dLiveRaw, dTotal) : dLiveRaw)
        : pk.d_offset;
      const d = (dLive != null && dLive >= 0 && dTotal != null) ? ` (D+${dLive}/+${dTotal})` : '';
      // PM320-D6 R23 P0-2 (수익률 모순 정합) — 픽 손익(current_pnl_pct)은 *진입가 대비* 잠정치다.
      //   진입 당일은 "진입 당일·성과 집계 전", D+1~ 는 "보유 중"으로 의미 분리(R23). 판정 기준을
      //   스냅샷 d_offset → 라이브 dLive 로 교체(R25 P0-2: 어제 픽이 오늘도 "진입 당일"로 남는 거짓 차단).
      const isEntryDay = (dLive === 0);
      // R27 P0-2 (조니 2심, 2026-06-11) — "집계 기준 {파일 날짜}" echo 폐기. per-day 파일은 후행
      //   갱신되므로 파일 날짜 ≠ 실제 집계일일 수 있다. 스냅샷 날짜는 데이터 필드(pk.snapshot_date,
      //   backend 별건 신설 예정)가 있을 때만 출력, 부재 시 무날짜 라벨 "잠정 집계" —
      //   모르는 날짜를 출력하지 않는다 (FLR-AGT-002 거짓 충실성 / 본 mark 와 양끝 동시 fix,
      //   FLR-20260428-TEC-001 한쪽 코드·양끝 누락 동형 예방).
      const _chipSnapDate = (typeof pk.snapshot_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(pk.snapshot_date))
        ? pk.snapshot_date : null;
      const staleCaption = (!isEntryDay && typeof prevDate === 'string' && prevDate < todayKst)
        ? (_chipSnapDate ? ` · 집계 기준 ${_chipSnapDate.slice(5).replace('-', '/')}` : ' · 잠정 집계')
        : '';
      markText = isEntryDay
        ? `⏳ 진입 당일 · 성과 집계 전${d}`
        : `⏳ 보유 중 ${_signed(pk.current_pnl_pct)}${d}${staleCaption}`;
      mod = 'running';
    } else {
      const r = pk.result || {};
      finalPct = r.final_pnl_pct != null ? _signed(r.final_pnl_pct) : _signed(pk.current_pnl_pct);
      if (state === 'taken_profit') { markText = `✅ 익절 ${finalPct}`; mod = 'profit'; }
      else if (state === 'expired_gain') { markText = `✅ 만기청산 (이익) ${finalPct}`; mod = 'profit'; }
      else if (state === 'expired_loss') { markText = `⚠️ 만기청산 (손실) ${finalPct}`; mod = 'loss'; }
      else return '';
    }
    // 장중 MDD 칩 (청산 완료 + 음수일 때만, per-card 결과 mark 와 동일 SoT).
    const mddV = (pk.result && pk.result.mdd_peak_pct);
    const mddChip = (state !== 'running' && mddV != null && Number.isFinite(mddV) && mddV < 0)
      ? `<span class="pm320-rec-mark-mdd">· 장중 ${_dd(mddV)}</span>` : '';

    // PM320-D6 R22 (오전 동선, "추천 보러 왔는데 추천이 숨어 있다") — 종전 1줄 pill 은 결과만 노출(진입가·목표
    //   부재 → "+0.00% 무신호" 평가). 진입가/익절목표/만기를 grid 로 병기해 "어제의 픽 결과 카드"로 승격
    //   (per-card SSOT 동일 키: entry_price / take_profit_target_price / expiry_date). 데이터 부재 칸은 '—'
    //   graceful(추정 0, FLR-AGT-002). 진입가 = pk.entry_price(매매 row 진입가와 동일 SoT, authClose 보정은
    //   당일 종가 의존이라 장전 시점엔 entry_price 가 SSOT). 카드 직하에 "오늘의 픽 15:25 공개" 예고 라인.
    const buyV = _krw(pk.entry_price);
    const tpV = _krw(pk.take_profit_target_price);
    const expiryV = pk.expiry_date || '—';
    const gridHtml = `<div class="cal-pre-prev-pick-grid">`
      + `<div class="cal-pre-prev-pick-cell"><span class="cal-pre-prev-pick-k">진입가</span><span class="cal-pre-prev-pick-v">${escapeHtml(buyV)}</span></div>`
      + `<div class="cal-pre-prev-pick-cell"><span class="cal-pre-prev-pick-k">익절목표</span><span class="cal-pre-prev-pick-v cal-pre-prev-pick-v--up">${escapeHtml(tpV)}</span></div>`
      + `<div class="cal-pre-prev-pick-cell"><span class="cal-pre-prev-pick-k">만기</span><span class="cal-pre-prev-pick-v">${escapeHtml(expiryV)}</span></div>`
      + `</div>`;
    // data-prev-pick-code: R21 P1 — sticky 픽바 클릭 시 전일 패널 자동 펼침 후 이 종목 풀 카드로 이동.
    return `<div class="cal-pre-prev-pick cal-pre-prev-pick--${mod} cal-pre-prev-pick--card"${code ? ` data-prev-pick-code="${escapeHtml(code)}"` : ''} role="group" aria-label="어제의 픽 ${escapeHtml(name)} ${escapeHtml(markText)}, 진입가 ${escapeHtml(buyV)}, 익절목표 ${escapeHtml(tpV)}, 만기 ${escapeHtml(expiryV)}">`
      + `<div class="cal-pre-prev-pick-head">`
      +   `<span class="cal-pre-prev-pick-eyebrow">어제의 픽</span>`
      +   (name ? `<span class="cal-pre-prev-pick-name">${escapeHtml(name)}</span>` : '')
      +   `<span class="cal-pre-prev-pick-mark">${escapeHtml(markText)}${mddChip}</span>`
      + `</div>`
      + gridHtml
      + `<div class="cal-pre-prev-pick-foretell">오늘의 픽은 <strong>15:25</strong>에 공개됩니다</div>`
      + `</div>`;
  } catch (_) { return ''; }
}

// r5 (2026-06-11, 대표 도메인 정정 — "지난 추천으로 최대 보유 종목 개수가 늘어날 수 있다,
//   하나만 존재하는 게 아니야") — 현재 *보유 중(running)* 픽을 복수로 도출.
//   데이터 = history JSON 의 running 상태에서 도출(발명 0, FLR-AGT-002). 정직 조건:
//     해당 일자 픽 스냅샷 current_state === 'running' AND expiry_date >= 오늘.
//   (per-day 스냅샷은 그 날 기준 상태라, 이후 청산됐을 수 있음 → expiry_date 만료 전만 신뢰.
//    summary.json 의 running 카운트와 교차검증해 불일치 시 호출부가 카운트만 노출.)
//   bound = 최근 8영업일 fan-out (만기 D+3 모델상 보유 가능 구간 충분 커버). 병렬 로드(캐시 활용).
//   반환: [{ code, name, date, pk }] newest-first (dedup by code). 데이터 부재/오류 시 [].
async function _collectRunningPicks(fromDate, maxDays) {
  try {
    if (!fromDate || typeof loadCalDayData !== 'function') return [];
    const _now = new Date();
    const _todayKst = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
    // 최근 영업일 목록 — getPrevTradingDate 가용 시 사용, 아니면 달력 day−1 (휴장은 history 404 graceful).
    const dates = [];
    let cur = fromDate;
    const cap = Math.max(1, maxDays || 8);
    for (let i = 0; i < cap && cur; i++) {
      dates.push(cur);
      cur = (typeof getPrevTradingDate === 'function')
        ? getPrevTradingDate(cur)
        : (() => { const d = new Date(cur + 'T00:00:00'); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    }
    const datas = await Promise.all(dates.map(d => loadCalDayData(d).then(x => ({ d, x })).catch(() => ({ d, x: null }))));
    const out = [];
    const seen = new Set();
    for (const { d, x } of datas) {
      const m = x && x.interpretedByName;
      if (!m || typeof m.values !== 'function') continue;
      for (const interp of m.values()) {
        const pk = interp && interp.pm320_pick;
        if (!pk || pk.is_pick !== true || pk.current_state !== 'running') continue;
        if (!pk.expiry_date || pk.expiry_date < _todayKst) continue; // 만기 지난 픽 배제(정직)
        const code = interp.code || interp.ticker || '';
        if (code && seen.has(code)) continue;
        if (code) seen.add(code);
        out.push({ code, name: interp.name || interp.stock_name || '', date: d, pk });
      }
    }
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest-first
    return out;
  } catch (_) { return []; }
}

// r5 (2026-06-11) — "외 N종 보유 중" 리스트 HTML. headlineCode = 이미 칩으로 노출된 최신 픽(중복 제외).
//   running 픽이 headline 외 ≥1종이면 "외 N종 보유 중" + 각 종목 1줄(종목명 · 진입가 · 만기).
//   running 이 headline 1종뿐이면 빈 문자열(미렌더). summary.running 교차검증으로 신뢰 판정.
function _buildRunningHoldingsHtml(runningPicks, headlineCode, summaryRunning) {
  try {
    if (!Array.isArray(runningPicks) || runningPicks.length === 0) return '';
    const _krw = (n) => (n == null || !Number.isFinite(n)) ? '—' : (n.toLocaleString('ko-KR') + '원');
    // 교차검증(FLR-AGT-002): 각 픽은 자기 일자 스냅샷의 running + 만기 미경과로 개별 검증됨(정직).
    //   summary.running 은 매일 1회 빌드 스냅샷이라 당일 신규 픽보다 뒤처질 수 있음(stale-newer).
    //   → fan-out 카운트 ≥ summary 면 per-pick 신뢰(fan-out 이 더 최신·개별 검증). fan-out < summary
    //     면 우리가 일부 보유 픽을 놓친 것(summary 가 더 많이 앎) → per-pick 리스트 대신 count 만 표시
    //     (놓친 픽을 누락한 채 "전부"인 척 차단). summary 부재 시 = per-pick 신뢰(개별 검증으로 충분).
    const trustList = (typeof summaryRunning !== 'number') || (runningPicks.length >= summaryRunning);
    const others = runningPicks.filter(p => p.code !== headlineCode);
    if (others.length === 0) return '';
    // wave1 fix ③ (2026-06-11, R24 P2) — 히어로 "하루 단 한 종목" vs "외 N종 보유 중" 표면 충돌 해소.
    //   취지 설명 1줄: 추천은 하루 1픽, 각 픽은 만기까지 보유 → 기간이 겹치면 보유가 누적된다.
    //   만기 일수는 전략 파라미터(가변)라 숫자 미표기(D+N 하드코딩 금지, 과장 0).
    const noteHtml = `<div class="cal-pre-prev-pick-holdings-note">추천은 하루 1종목 — 각 픽을 만기까지 보유해 기간이 겹치면 여러 종목을 함께 보유합니다</div>`;
    if (!trustList) {
      return `<div class="cal-pre-prev-pick-holdings cal-pre-prev-pick-holdings--countonly">`
        + `<span class="cal-pre-prev-pick-holdings-label">외 ${others.length}종 보유 중</span>`
        + noteHtml
        + `</div>`;
    }
    const rows = others.map(p =>
      `<div class="cal-pre-prev-pick-holding-row"${p.code ? ` data-prev-pick-code="${escapeHtml(p.code)}"` : ''}>`
      + `<span class="cal-pre-prev-pick-holding-name">${escapeHtml(p.name || '—')}</span>`
      + `<span class="cal-pre-prev-pick-holding-meta">진입가 ${escapeHtml(_krw(p.pk.entry_price))} · 만기 ${escapeHtml(p.pk.expiry_date || '—')}</span>`
      + `</div>`).join('');
    return `<div class="cal-pre-prev-pick-holdings" role="group" aria-label="외 ${others.length}종 보유 중">`
      + `<div class="cal-pre-prev-pick-holdings-label">외 ${others.length}종 보유 중</div>`
      + rows
      + noteHtml
      + `</div>`;
  } catch (_) { return ''; }
}

function _formatCountdownToOpen(now) {
  const _now = now || new Date();
  const target = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate(), 9, 0, 0, 0);
  let diff = Math.max(0, target.getTime() - _now.getTime());
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// PM320-D6 P0 — 오늘의 추천 공개(15:20)까지 남은 시간. 손님 판정(시점 혼란) 기반.
//   장중(09:00~15:20)에 오늘 view + 픽 미생성 시 "전일 종가 기준" 안내 배너에 표시.
//   15:20 도달 시 "00:00:00" 반환 (호출부가 타이머 종료 + 안내 문구 전환).
function _formatCountdownToPick(now) {
  const _now = now || new Date();
  const target = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate(), 15, 20, 0, 0);
  const diff = Math.max(0, target.getTime() - _now.getTime());
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

let _preMarketTimer = null;
let _preMarketVisHandler = null;

function _stopPreMarketTimer() {
  if (_preMarketTimer) { clearInterval(_preMarketTimer); _preMarketTimer = null; }
  if (_preMarketVisHandler) {
    document.removeEventListener('visibilitychange', _preMarketVisHandler);
    _preMarketVisHandler = null;
  }
}

// PM320-D6 P0 — 장중 "오늘 추천 15:20 공개" 배너의 카운트다운 타이머.
//   renderCalExpandContent 가 매 렌더 시 _wirePickCountdown() 호출 → 배너 DOM 존재 시 1초 tick.
//   배너 미존재(픽 생성됨 / 장 마감 후 / 과거 view) 시 자동 정리. 무한 setInterval 누수 방지.
let _pickCountdownTimer = null;
function _stopPickCountdown() {
  if (_pickCountdownTimer) { clearInterval(_pickCountdownTimer); _pickCountdownTimer = null; }
}
function _wirePickCountdown() {
  _stopPickCountdown();
  // R28 P1⑤ — 카운트다운 슬롯 2원화(본문 pending 배너 + 헤더 직하 portal 칩). 단일 querySelector
  //   → querySelectorAll 전수 tick (한쪽 코드 양끝 누락 동형 예방, FLR-20260428-TEC-001).
  if (!document.querySelector('.cal-pm320-pending-countdown[data-pick-cd="1"]')) return; // 미존재 → 타이머 불요
  const tick = () => {
    const els = Array.from(document.querySelectorAll('.cal-pm320-pending-countdown[data-pick-cd="1"]'))
      .filter(el => document.body.contains(el));
    if (els.length === 0) { _stopPickCountdown(); return; }
    const now = new Date();
    // 15:20 도달 → 카운트다운 문구를 "곧 갱신됩니다"로 전환 후 타이머 종료.
    //   (15:20~15:30 사이 다음 자동 폴링/리렌더 전까지의 공백 안내. 픽 생성되면 리렌더로 배너 자연 소거.)
    if (now.getHours() * 60 + now.getMinutes() >= 15 * 60 + 20) {
      els.forEach(el => {
        const banner = el.closest('.cal-pm320-pending');
        if (banner) {
          const cdWrap = banner.querySelector('.cal-pm320-pending-cd-wrap');
          if (cdWrap) cdWrap.innerHTML = '<span class="cal-pm320-pending-soon">곧 갱신됩니다</span>';
          return;
        }
        const chip = el.closest('.cal-pm320-portal-cd');
        if (chip) chip.innerHTML = '<span class="cal-pm320-pending-soon">곧 갱신됩니다</span>';
      });
      _stopPickCountdown();
      return;
    }
    const _txt = _formatCountdownToPick(now);
    els.forEach(el => { el.textContent = _txt; });
  };
  tick();
  _pickCountdownTimer = setInterval(tick, 1000);
}

// PRE_MARKET (장 시작 전, 09:00 이전 + 오늘 view) 빈 상태 — 당일 표출 데이터가 아직 없는 정상 상태.
// 2026-05-27 대표 발화로 장중 stale 차단(staleInfo) 경로 제거 → PRE_MARKET 단일 모드만 남김.
function renderPreMarketEmpty(container, date, prevDate, prevData, nightlyUs) {
  _stopPreMarketTimer();
  const prevLabel = prevDate ? formatKoDate(prevDate) : '';
  const inner = container || document.getElementById('cal-content');
  if (!inner) return;
  const titleText = '장 시작 전';
  const subText = '09:00에 신규 데이터가 표출됩니다';
  const metaText = '장 시작 전';
  const liveText = _formatCountdownToOpen();
  // P0 (Q-20260609) — 국내 PRE_MARKET 빈 상태여도 미국증시 섹션은 독립 렌더.
  //   국내 종목(stock-{date}.json)이 아직 없는 새벽/장전에도 미 정규장/선물은 살아있음
  //   (한국 02:30~05:00 = 미 정규장 장중). 기존: 본 함수가 국내 빈상태만 그리고 early-return
  //   → renderCalExpandContent L1833 미장 합류부 도달 못 함 → 미장 통째 누락(design DOM probe usSection:false).
  //   fix: _buildNightlyUsHtml(국내와 동일 SSOT 함수)을 빈상태 안내 아래 삽입. nightlyUs 부재/null
  //   시 빈 문자열 반환(graceful 생략 — 빈 카드 금지, FLR-AGT-002). 국내 빈상태 안내는 그대로 유지.
  const _usHtml = (typeof _buildNightlyUsHtml === 'function') ? _buildNightlyUsHtml(nightlyUs, date) : '';
  // PM320-D6 R22 (오전 동선, "추천 보러 왔는데 추천이 숨어 있다") — 종전 "어제의 픽" 슬롯은
  //   .cal-pre-market-empty 안(미장 섹션 _usHtml 아래)이라 본문 한참 아래로 밀려(top≈1246) 첫 화면에서
  //   안 보임. 슬롯을 cal-content-head 직하·미장 섹션 위로 끌어올려 "토글 없이 기본 상단 노출"(P0).
  //   카드 자체는 async 주입(아래 prevPickSlot wiring)이라 여기선 빈 컨테이너만 선배치(레이아웃 점프 0).
  inner.innerHTML = `
    <div class="cal-content-head" role="button" tabindex="0" aria-label="달력으로 이동" data-scroll-to-cal="1">
      <div class="cal-content-date">${formatKoDate(date)}</div>
      <div class="cal-content-meta">${metaText}</div>
    </div>
    ${prevDate ? `<div class="cal-pre-prev-pick-top" data-pre-prev-pick-top hidden><div class="cal-pre-prev-pick-slot" data-pre-prev-pick hidden></div></div>` : ''}
    ${_usHtml}
    <div class="cal-pre-market-empty" role="status" aria-live="polite">
      <svg class="cal-pre-market-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <polyline points="12 7 12 12 15 14"></polyline>
      </svg>
      <div class="cal-pre-market-title">${escapeHtml(titleText)}</div>
      <div class="cal-pre-market-sub">${escapeHtml(subText)}</div>
      <div class="cal-pre-market-countdown" data-cd="1">${escapeHtml(liveText)}</div>
      ${prevDate ? `<button type="button" class="cal-pre-market-toggle" data-pre-toggle="1" aria-expanded="false">전일(${prevLabel}) 데이터 보기 ▾</button>` : ''}
      <div class="cal-pre-market-prev" data-pre-prev hidden></div>
    </div>
  `;
  // P0 (Q-20260609) — PRE_MARKET path 에 주입한 미장 섹션의 선물 토글 wiring.
  //   정상 path 는 renderCalExpandContent 말미(L1911)에서 _wireUsFutToggle() 호출하나, PRE_MARKET 은
  //   early-return 으로 그곳에 도달 못 함 → 어제 P0(15dc4b465)가 미장 HTML 은 주입했지만 토글 바인딩 누락
  //   → 선물 토글 이벤트 0 + data-fut-view=auto('regular') 고정 → CSS 가 선물 카드 숨김 → "선물 버튼
  //   사라짐"(대표 catch, Q-145 선물 상시 표시 위반). fix: 미장 HTML 주입 시 토글 wiring 동반 호출(멱등).
  if (_usHtml && typeof _wireUsFutToggle === 'function') _wireUsFutToggle();
  // PM320 (대표 2026-06-10 A안) — PRE_MARKET path 미장 섹션 접힘 상태 + localStorage 복원.
  if (_usHtml && typeof _applySectionCollapse === 'function') {
    const _nuRoot = document.getElementById('nightly-us');
    if (_nuRoot) _applySectionCollapse(_nuRoot, 'nightly-us');
  }
  // 카운트다운 1초 단위 + Page Visibility API
  {
    const cdEl = inner.querySelector('[data-cd]');
    const tick = () => {
      if (!cdEl || !document.body.contains(cdEl)) { _stopPreMarketTimer(); return; }
      cdEl.textContent = _formatCountdownToOpen();
      // 09:00 도달 시 자동 OPEN 전환 (한 번만)
      const nowH = new Date();
      if (nowH.getHours() >= 9 && getMarketState() !== 'PRE_MARKET') {
        _stopPreMarketTimer();
        // _refreshDataAsync 동등 — calendar.js의 onCalCellClick으로 재렌더
        try { onCalCellClick(date, false); } catch (_) {}
      }
    };
    _preMarketTimer = setInterval(tick, 1000);
    _preMarketVisHandler = () => {
      if (document.hidden) {
        if (_preMarketTimer) { clearInterval(_preMarketTimer); _preMarketTimer = null; }
      } else if (!_preMarketTimer) {
        tick();
        _preMarketTimer = setInterval(tick, 1000);
      }
    };
    document.addEventListener('visibilitychange', _preMarketVisHandler);
  }

  // 보조 토글 — 전일 데이터 표출 (data-stale="true")
  const toggleBtn = inner.querySelector('[data-pre-toggle]');
  const prevBox = inner.querySelector('[data-pre-prev]');
  if (toggleBtn && prevBox && prevDate) {
    toggleBtn.addEventListener('click', async () => {
      // PM320 여정 fix r3 (2026-06-11, R20 P0 — "전일 보기" 토글 시 scrollY 0 점프 차단).
      //   원인: 펼침 시 renderCalExpandContent 가 #cal-content innerHTML 을 동기 리셋 → 브라우저가
      //   스크롤 위치를 잃고 top 으로 점프. 토글 직전 scrollY 를 저장해 리렌더 후 강제 복원(이동 0).
      //   누른 토글 버튼이 화면에 남으면 사용자는 펼쳐진 섹션을 버튼 바로 아래에서 자연스럽게 이어 본다.
      const savedY = window.pageYOffset;
      const _restoreToggleScroll = () => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            if (window.pageYOffset !== savedY) window.scrollTo({ top: savedY, behavior: 'auto' });
          }));
        } else if (window.pageYOffset !== savedY) {
          window.scrollTo({ top: savedY, behavior: 'auto' });
        }
      };
      const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      if (expanded) {
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.textContent = `전일(${prevLabel}) 데이터 보기 ▾`;
        prevBox.hidden = true;
        prevBox.innerHTML = '';
        _restoreToggleScroll();
        // R21 P0 — 접힘 후 픽바 재동기(안전망). 펼침 중 prevBox 카드를 잘못 mirror 했더라도 1차 픽으로 복원.
        if (typeof window._syncPickBar === 'function') window._syncPickBar();
      } else {
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.textContent = `전일(${prevLabel}) 데이터 접기 ▴`;
        prevBox.hidden = false;
        prevBox.setAttribute('data-stale', 'true');
        const data = prevData || (typeof loadCalDayData === 'function' ? await loadCalDayData(prevDate) : null);
        if (data) {
          // 🔴 R18 P0 fix (FLR-20260605-TEC-001 동형 stale 변종) — 종전: 임시 div 에 렌더 후
          //   prevBox.innerHTML = tmp.innerHTML 로 transplant 했으나, renderCalExpandContent 가
          //   inner.innerHTML 동기 set 직후 async 섹션(theme-tree/stocks 등)을 비동기 채움 →
          //   transplant 시점에 stocks/news 미반영 + 이벤트 핸들러·차트 canvas 소실 → 테마트리 조각만
          //   남는 빈 패널(평가자 적발). fix: temp 폐기. prevBox 에 직접 cal-content id 를 부여해
          //   renderCalExpandContent 가 in-document 인 prevBox 에 직접 그리고 wiring 하게 한다(transplant 0).
          //   원본 #cal-content 는 렌더 중 임시 rename → 복원(hardcoded getElementById 충돌 회피).
          const origInner = document.getElementById('cal-content');
          const origId = origInner ? origInner.id : null;
          const prevBoxOrigId = prevBox.id || '';
          if (origInner && origInner !== prevBox) origInner.id = '_cal-content-saved';
          prevBox.id = 'cal-content';
          try {
            // PRE_MARKET 재진입 회피 — 전일은 항상 hasAny path 또는 closed/empty path
            renderCalExpandContent(prevDate, data);
          } catch (e) { prevBox.textContent = '전일 데이터 로드 실패'; }
          // id 원복 (prevBox 는 본래 id 없으면 제거, 있으면 복원).
          if (prevBoxOrigId) prevBox.id = prevBoxOrigId; else prevBox.removeAttribute('id');
          if (origInner && origId && origInner !== prevBox) origInner.id = origId;
        } else {
          prevBox.textContent = '전일 데이터 없음';
        }
        // 펼침 리렌더(prevBox 표시·async 섹션 채움)가 스크롤을 흔든 경우 토글 직전 위치로 복원.
        _restoreToggleScroll();
      }
    });
  }

  // R18 (비신자 평가자 P1) — 어제의 픽 결과 칩을 접지 않고 기본 노출(빈 페이지 이탈 차단).
  //   전일 데이터를 비동기 1회 로드(초기 카운트다운 렌더 차단 X) → 픽 1건 칩 주입.
  //   픽 부재/미신뢰 시 slot 은 hidden 유지(추정 0, FLR-AGT-002). 토글(전일 데이터 보기)은 별개 유지.
  // R23 (오전 동선 P0) — 어제픽 카드 주입 대상을 헤더 직하 portal(#pm320-prepick-portal)로 라우팅.
  //   R22 의 cal-content 내부 top 슬롯([data-pre-prev-pick])은 cal-content 컨테이너가 본문 마지막이라
  //   여전히 fold 밖(R23 적발). portal 은 page-header 직하·모든 섹션 위라 첫 화면(fold)에 카드가 보인다.
  //   portal 이 있으면 거기 주입 + cal-content 내부 슬롯은 hidden 유지(중복 0). 과거 빌드(portal 부재)면
  //   기존 cal-content 슬롯으로 graceful fallback(무회귀).
  const portal = document.getElementById('pm320-prepick-portal');
  const prevPickSlot = inner.querySelector('[data-pre-prev-pick]');
  // portal 은 매 PRE_MARKET 렌더 시 초기화(다른 날짜/장중 전환 잔존 카드 제거 — 추정 노출 0).
  if (portal) { portal.innerHTML = ''; portal.hidden = true; }
  if ((portal || prevPickSlot) && prevDate) {
    (async () => {
      try {
        const pd = prevData || (typeof loadCalDayData === 'function' ? await loadCalDayData(prevDate) : null);
        if (!pd || !pd.interpretedByName) return;
        let chipHtml = _buildPrevPickChipHtml(pd.interpretedByName, prevDate);
        if (!chipHtml) return;
        // r5 (2026-06-11, 대표 도메인 정정) — 현재 보유 중(running) 픽 복수 도출 → "외 N종 보유 중" 병기.
        //   headline = prevDate 픽(이미 칩). 그 외 running 픽이 있으면 칩 하단에 보유 리스트 append.
        //   데이터 부재/단일 보유 시 빈 문자열(무회귀). race 로 chip 이 비면 enrich 생략.
        try {
          let _headlineCode = '';
          for (const itp of pd.interpretedByName.values()) {
            const p = itp && itp.pm320_pick;
            if (p && p.is_pick === true) { _headlineCode = itp.code || itp.ticker || ''; break; }
          }
          const _running = await _collectRunningPicks(prevDate, 8);
          const _summaryRunning = (pd.pm320Summary && typeof pd.pm320Summary.running === 'number')
            ? pd.pm320Summary.running : undefined;
          const _holdingsHtml = _buildRunningHoldingsHtml(_running, _headlineCode, _summaryRunning);
          if (_holdingsHtml) chipHtml = chipHtml + _holdingsHtml;
        } catch (_) { /* graceful — 보유 리스트 생략 */ }
        // 렌더 도중 다른 시점으로 전환됐으면(여전히 PRE_MARKET inner 가 문서에 있나) 무시 (race graceful).
        if (!document.body.contains(inner)) return;
        if (portal && document.body.contains(portal)) {
          // 주 경로 — 헤더 직하 portal 에 주입(fold 노출). cal-content 내부 슬롯은 비활성(중복 0).
          portal.innerHTML = chipHtml;
          portal.hidden = false;
          if (prevPickSlot && document.body.contains(prevPickSlot)) {
            prevPickSlot.innerHTML = '';
            prevPickSlot.hidden = true;
            const topWrap = inner.querySelector('[data-pre-prev-pick-top]');
            if (topWrap) topWrap.hidden = true;
          }
        } else if (prevPickSlot && document.body.contains(prevPickSlot)) {
          // 폴백 — portal 부재(과거 빌드)면 R22 의 cal-content 내부 top 슬롯에 주입(무회귀).
          prevPickSlot.innerHTML = chipHtml;
          prevPickSlot.hidden = false;
          const topWrap = inner.querySelector('[data-pre-prev-pick-top]');
          if (topWrap) topWrap.hidden = false;
        }
        // PM320 여정 fix r2 (2026-06-11) — 칩은 async 주입이라 최초 _syncPickBar() 시점엔 부재였다.
        //   주입 직후 재동기화 → 장전 sticky 픽 바가 "어제의 픽" 칩을 mirror 노출 (FAIL #2).
        if (typeof window._syncPickBar === 'function') window._syncPickBar();
      } catch (_) { /* graceful — 칩 생략 */ }
    })();
  }
}

// 🔴 P0-2 (FLR-20260605-TEC-001) — 공유 링크 존재 보장 manifest (모듈 스코프, 1회 정의).
//   `data/page-manifest.json` = 배포된 종목페이지 목록 { pages: { "{date}": ["{code}", …] } }.
//   빌드/sync(scripts/build-page-manifest.js, kiwoom_cron push add-set 시점)가 라이브 디렉토리
//   `pm320/{date}/{code}.html` 실파일을 스캔해 생성 → manifest = 실제 배포 상태 SSOT (Q-119 stock 제거).
//   공유 URL 생성 시 대상 페이지가 manifest 에 있으면 OG landing 경로, 없으면 news.html 폴백
//   → 404 URL 절대 생성 금지. manifest 부재/parse 실패 시 = 보수적 폴백(PRE_MARKET 휴리스틱
//   으로 degrade — 과거 카드 OG 무회귀 + 오늘·장전 404 회피).
//   prefetch: 핸들러 등록 시 비동기 1회 로드 → window._pageManifest (Promise 캐시).
function _loadPageManifest() {
  if (window._pageManifestPromise) return window._pageManifestPromise;
  const _v = (typeof window.SW_VERSION !== 'undefined' && window.SW_VERSION)
    ? window.SW_VERSION
    : new Date().toISOString().slice(0, 10).replace(/-/g, '');
  window._pageManifestPromise = fetch(`/data/page-manifest.json?v=${_v}`)
    .then(r => (r && r.ok ? r.json() : null))
    .then(j => {
      // schema validation — pages 가 object 여야 신뢰. 아니면 null(보수적 폴백).
      if (j && typeof j === 'object' && j.pages && typeof j.pages === 'object') {
        window._pageManifest = j;
        return j;
      }
      window._pageManifest = null;
      return null;
    })
    .catch(() => { window._pageManifest = null; return null; });
  return window._pageManifestPromise;
}
window._loadPageManifest = _loadPageManifest;

// 대상 종목페이지가 라이브에 존재하는지 manifest 로 판정 (순수 함수, 테스트용 window 노출).
//   return true  = manifest 가 존재 명시 → OG 경로 사용 가능
//   return false = manifest 가 부재 명시 → 폴백(news.html)
//   return null  = manifest 자체 없음/미신뢰 → 판정 불가(호출부가 PRE_MARKET 가드로 degrade)
function _manifestHasPage(date, code, manifest) {
  const m = manifest || window._pageManifest;
  if (!m || !m.pages || typeof m.pages !== 'object') return null;
  const list = m.pages[date];
  if (!Array.isArray(list)) {
    // 해당 날짜 키 자체가 없음 = 그 날짜 페이지 0건 배포 = 부재 확정.
    return false;
  }
  return list.indexOf(code) !== -1;
}
window._manifestHasPage = _manifestHasPage;

// 🔴 P0-2 공유 URL 단일 출처(SSOT) 순수 함수 — 핸들러·셀프테스트 공용(drift 봉쇄).
//   입력: origin, code, dateStr, cacheToken, manifest, nowMs, getMarketStateFn
//   manifest 가 페이지 존재/부재를 명시하면 PRE_MARKET 휴리스틱보다 정밀(라이브 실파일 기준).
//   manifest 미신뢰(null) 시에만 기존 PRE_MARKET 휴리스틱으로 degrade (보수적 폴백·무회귀).
//   404 URL 절대 생성 안 함 — 미배포 확정 시 항상 정적 news.html(200) 폴백.
function _computeShareUrl(origin, code, dateStr, cacheToken, manifest, nowMs, getMarketStateFn) {
  const _nowKst = new Date((typeof nowMs === 'number' ? nowMs : Date.now()) + 9 * 3600 * 1000);
  const _todayKst = `${_nowKst.getUTCFullYear()}-${String(_nowKst.getUTCMonth() + 1).padStart(2, '0')}-${String(_nowKst.getUTCDate()).padStart(2, '0')}`;
  const _ogPageMayMissingHeuristic = dateStr === _todayKst
    && (typeof getMarketStateFn === 'function' ? getMarketStateFn(dateStr) === 'PRE_MARKET' : false);
  const _verdict = (code && dateStr) ? _manifestHasPage(dateStr, code, manifest) : null;
  let _ogPageMayMissing;
  if (_verdict === true) {
    _ogPageMayMissing = false;           // 배포 확정 → OG 경로 (휴리스틱 무시, OG 미리보기 유지)
  } else if (_verdict === false) {
    _ogPageMayMissing = true;            // 미배포 확정 → 폴백 (404 봉쇄)
  } else {
    _ogPageMayMissing = _ogPageMayMissingHeuristic; // manifest 미신뢰 → 보수적 degrade
  }
  const _useOgLanding = code && dateStr && !_ogPageMayMissing;
  // Q-20260605-104 (21:31) — fallback URL news.html → pm320.html.
  // Q-20260606-119 — OG landing 경로에서 stock 세그먼트 제거 (/pm320/stock/{date}/{code} → /pm320/{date}/{code},
  //   "pm320 자체가 주식"). 신규 공유 URL = 새 경로 직접 발급. 구경로 stub 불요(대표 "이미 공유된 링크 신경쓰지마").
  return _useOgLanding
    ? `${origin}/pm320/${dateStr}/${code}.html?v=${cacheToken}`
    : code
      ? `${origin}/pm320.html?stock=${code}${dateStr ? `&date=${dateStr}` : ''}&v=${cacheToken}`
      : (dateStr
        ? `${origin}/pm320.html?date=${dateStr}&v=${cacheToken}`
        : `${origin}/pm320.html?v=${cacheToken}`);
}
window._computeShareUrl = _computeShareUrl;

// PM320 여정 fix (2026-06-11, FLR-20260605-AGT-002 첫 화면 가치) — sticky 미니 픽 바 동기화.
//   현재 선택일 픽(.cal-pm320-today-rec)을 헤더 아래 1줄 바에 mirror. SSOT=DOM(추정 0).
//   픽 카드가 뷰포트 상단 밖으로 나갈 때만 노출(IntersectionObserver). 탭 = data-rec-jump 재사용.
let _pickBarObserver = null;
function _pm320StickyJumpOffset() {
  const isMobile = window.innerWidth <= 880;
  const nav = document.querySelector('header');
  let offset = nav ? nav.getBoundingClientRect().height : (isMobile ? 68 : 72);
  const bar = document.getElementById('pm320-pickbar');
  if (bar && !bar.hidden && (bar.classList.contains('pm320-pickbar--visible') || document.body.classList.contains('pm320-pickbar-on'))) {
    offset += bar.getBoundingClientRect().height || (isMobile ? 64 : 52);
  }
  const head = document.querySelector('#cal-content .cal-content-head');
  if (head) {
    const pos = window.getComputedStyle(head).position;
    if (pos === 'sticky' || pos === '-webkit-sticky') offset += head.getBoundingClientRect().height || 0;
  }
  return Math.ceil(offset + 12);
}

function _syncPickBar() {
  const bar = document.getElementById('pm320-pickbar');
  if (!bar) return; // 과거 빌드(바 미존재) graceful no-op
  // R23 P0 — 매 재동기 진입 시 픽바-on 상태 리셋(픽 부재 early-return·소스 교체 시 sticky 충돌
  //   클래스 잔존 방지). 바가 다시 visible 되면 IntersectionObserver 토글이 재설정한다.
  document.body.classList.remove('pm320-pickbar-on');
  // PM320 여정 fix r4 (2026-06-11, R21 P0 — "전일 데이터 보기" 토글 시 픽바 라벨 변조·고착).
  //   원인: 토글 펼침이 prevBox([data-pre-prev]) 안에 전일 픽 요약 카드(.cal-pm320-today-rec,
  //   라벨 "이날의 추천"/"잠정")를 주입한다. 또 토글은 펼침 도중 prevBox 를 임시로 id="cal-content"
  //   로 rename 해 전일을 in-document 렌더한다(원본 #cal-content 는 #_cal-content-saved 로 임시 rename).
  //   → 종전 코드는 getElementById('cal-content') 후 .cal-pm320-today-rec 를 "하위 전체"에서 찾아
  //   (a) 펼침 도중엔 prevBox(=임시 cal-content)의 전일 카드를, (b) 펼침 후엔 #cal-content 하위
  //   prevBox 안의 전일 카드를 mirror → 픽바가 "이날의 추천" 으로 변조 + 접어도 재동기 호출 없어 고착.
  //   fix: mirror 소스를 "1차(오늘/보는 날짜) 콘텐츠"로만 한정 — (1) 원본 콘텐츠는 #cal-content 이되
  //   토글 렌더 중이면 #_cal-content-saved 가 원본이다(우선). (2) 그 안에서도 [data-pre-prev] 토글
  //   박스 하위 카드는 제외(전일 카드 배제). 픽바는 토글 펼침/접힘과 무관하게 1차 픽만 반영한다.
  const primary = document.getElementById('_cal-content-saved') || document.getElementById('cal-content');
  // [data-pre-prev] (전일 토글 박스) 하위에 들어간 카드는 제외하고 1차 콘텐츠의 카드만 선택.
  const _pickPrimary = (sel) => {
    if (!primary) return null;
    const all = primary.querySelectorAll(sel);
    for (const el of all) { if (!el.closest('[data-pre-prev]')) return el; }
    return null;
  };

  // 직전 observer 정리 (매 렌더 재바인딩 — 카드 노드 교체됨)
  if (_pickBarObserver) { _pickBarObserver.disconnect(); _pickBarObserver = null; }

  // mirror 소스 우선순위 — SSOT=DOM (추정 0, FLR-AGT-002):
  //   (1) 오늘/보는 날짜의 픽 요약 카드(.cal-pm320-today-rec). 탭 시 풀 카드(#stock-{code})로 점프.
  //   (2) PM320 여정 fix r2 (2026-06-11, R19 비신자 평가자 P1 — "장전 첫 진입에 sticky 바 부재"):
  //       장전(PRE_MARKET)엔 요약 카드/풀 카드 자체가 미렌더라 (1) 부재 → "어제의 픽" 결과 칩
  //       (.cal-pre-prev-pick, R18 신설)을 fallback mirror. 풀 카드가 없으므로 탭 = 칩 자체로 scroll.
  //   둘 다 부재(픽 없음/보류) → 바 숨김 (가짜 픽 노출 금지).
  //   ※ 두 소스 모두 [data-pre-prev] 토글 박스 하위 카드는 배제(_pickPrimary) — R21 변조·고착 차단.
  const rec = _pickPrimary('.cal-pm320-today-rec');
  // R23 — 어제픽 카드가 헤더 직하 portal(#pm320-prepick-portal)로 이동했으므로 거기 먼저 탐색.
  //   portal 미존재/빈 경우 R22 의 cal-content 내부 슬롯으로 fallback(과거 빌드·폴백 경로 무회귀).
  let prevChip = null;
  if (!rec) {
    const portalEl = document.getElementById('pm320-prepick-portal');
    prevChip = (portalEl && !portalEl.hidden ? portalEl.querySelector('.cal-pre-prev-pick') : null)
      || _pickPrimary('.cal-pre-prev-pick');
  }
  // R26 P1 (2026-06-11, 무픽 날 픽바 침묵 해소) — (3) 보류 확정일(.cal-pm320-no-pick 렌더됨)은
  //   픽바를 숨기는 대신 "추천 없음 (기준 미달)"을 mirror (가짜 픽 0 — 무픽 사실 자체를 정직 노출).
  //   탭 시 본문 no-pick 라인으로 scroll. 픽/전일 칩 존재 시 종전 경로 그대로 (무회귀).
  const noPickEl = (!rec && !prevChip) ? _pickPrimary('.cal-pm320-no-pick') : null;
  // R27 P0-3 (조니 2심) — (4) 결측 날짜(.cal-pm320-no-data 렌더됨)도 동일 mirror.
  //   픽바까지 침묵하면 eyebrow 기본값("오늘의 픽") DOM 잔재만 남는 거짓 상태 (R26 no-pick 동형).
  const noDataEl = (!rec && !prevChip && !noPickEl) ? _pickPrimary('.cal-pm320-no-data') : null;

  let src, nameText, eyebrowText, resultEl, jumpCode, prevPickCode = null;
  if (rec) {
    const nameEl = rec.querySelector('.cal-pm320-today-rec-name');
    const jumpBtn = rec.querySelector('[data-rec-jump]');
    const code = jumpBtn ? jumpBtn.getAttribute('data-rec-jump') : null;
    if (!nameEl || !code) { bar.hidden = true; bar.classList.remove('pm320-pickbar--visible'); return; }
    src = rec;
    nameText = nameEl.textContent.trim();
    const headLabelEl = rec.querySelector('.cal-pm320-today-rec-headlabel');
    eyebrowText = (headLabelEl && headLabelEl.textContent.trim()) || '오늘의 픽';
    resultEl = rec.querySelector('.cal-pm320-today-rec-result'); // 진행중/청산 결과 mark
    jumpCode = code;            // 풀 카드로 점프 (data-rec-jump)
  } else if (prevChip) {
    const nameEl = prevChip.querySelector('.cal-pre-prev-pick-name');
    const markEl = prevChip.querySelector('.cal-pre-prev-pick-mark');
    if (!nameEl) { bar.hidden = true; bar.classList.remove('pm320-pickbar--visible'); return; }
    src = prevChip;
    nameText = nameEl.textContent.trim();
    const eyebrowEl2 = prevChip.querySelector('.cal-pre-prev-pick-eyebrow');
    eyebrowText = (eyebrowEl2 && eyebrowEl2.textContent.trim()) || '어제의 픽';
    resultEl = markEl;          // 칩의 결과 텍스트 mirror
    // r5 (2026-06-11, 대표 도메인 정정) — running 보유가 복수면 픽바 종목명에 "외 N종" 카운트 병기.
    //   카운트 = 같은 portal 내 보유 리스트(.cal-pre-prev-pick-holdings-label) verbatim mirror(추정 0).
    try {
      const _portalEl = document.getElementById('pm320-prepick-portal');
      const _holdLabel = _portalEl && _portalEl.querySelector('.cal-pre-prev-pick-holdings-label');
      const _m = _holdLabel && _holdLabel.textContent.match(/외\s*(\d+)\s*종/);
      if (_m) nameText = `${nameText} · 외 ${_m[1]}종`;
    } catch (_) { /* graceful */ }
    jumpCode = null;            // 장전엔 풀 카드 미렌더 → 클릭 시 전일 패널 자동 펼침(아래 P1 참조)
    // R21 P1 (클릭 보상) — 장전 픽바 클릭이 같은 칩으로만 scroll 하면 정보 증분 0.
    //   칩이 종목 code 를 들고 있으면(data-prev-pick-code) 클릭 시 "전일 데이터 보기" 토글을
    //   자동 펼쳐 전일 풀 카드(#stock-{code})를 렌더·점프시킨다(증분 = 매매 row·차트·근거).
    prevPickCode = prevChip.getAttribute('data-prev-pick-code') || null;
  } else if (noPickEl) {
    // R26 P1 — 보류 확정일 mirror. 이름 자리에 "추천 없음 (기준 미달)" (b 태그 본문 verbatim).
    src = noPickEl;
    const _bEl = noPickEl.querySelector('b');
    nameText = (_bEl && _bEl.textContent.trim()) || '추천 없음 (기준 미달)';
    eyebrowText = 'PM320';
    resultEl = null;
    jumpCode = null; // 풀 카드 없음 → 탭 시 no-pick 라인 자체로 scroll (data-pickbar-scroll 폴백)
  } else if (noDataEl) {
    // R27 P0-3 — 결측 날짜 mirror (b 태그 본문 verbatim — "이 날짜의 데이터가 없습니다").
    src = noDataEl;
    const _bNd = noDataEl.querySelector('b');
    nameText = (_bNd && _bNd.textContent.trim()) || '이 날짜의 데이터가 없습니다';
    eyebrowText = 'PM320';
    resultEl = null;
    jumpCode = null; // 풀 카드 없음 → 탭 시 no-data 라인 자체로 scroll (data-pickbar-scroll 폴백)
  } else {
    bar.hidden = true;
    bar.classList.remove('pm320-pickbar--visible');
    return;
  }

  const eyebrowEl = bar.querySelector('[data-pickbar-eyebrow]');
  if (eyebrowEl) eyebrowEl.textContent = eyebrowText;
  const nameOut = bar.querySelector('[data-pickbar-name]');
  if (nameOut) nameOut.textContent = nameText;

  // 상태 칩: 결과 mark 텍스트/색상 mod mirror. (.cal-pm320-today-rec-result--up/dn 또는
  //   장전 칩 .cal-pre-prev-pick--profit/--loss 양쪽 색상 신호를 동일 status mod 로 매핑.)
  const statusOut = bar.querySelector('[data-pickbar-status]');
  if (statusOut) {
    statusOut.classList.remove('pm320-pickbar-status--up', 'pm320-pickbar-status--dn');
    if (resultEl) {
      // wave1 fix ① (2026-06-11, R24 P1) — 종전 .slice(0, 24) 하드 절단이 최장 상태
      //   ("⏳ 진입 당일 · 성과 집계 전 (D+0/+N)" = 26자)에서 "(D+0/+" 토큰 중간 클립 유발.
      //   절단 폐기 — verbatim mirror(추정 0). 폭 방어는 CSS(.pm320-pickbar-status flex:0 0 auto
      //   + name 측 ellipsis shrink)가 담당. D-카운터 숫자는 데이터 verbatim(하드코딩 0).
      //   child 노드 단위 join(' ') — 칩 span(.pm320-rec-mark-date/.pm320-rec-mark-mdd)은 시각
      //   간격이 margin이라 textContent 직결 시 공백 유실("+3.20%(2026-06-09)") 방지.
      statusOut.textContent = Array.from(resultEl.childNodes)
        .map((n) => (n.textContent || '').trim()).filter(Boolean)
        .join(' ').replace(/\s+/g, ' ');
      const isUp = resultEl.classList.contains('cal-pm320-today-rec-result--up') || (src.classList && src.classList.contains('cal-pre-prev-pick--profit'));
      const isDn = resultEl.classList.contains('cal-pm320-today-rec-result--dn') || (src.classList && src.classList.contains('cal-pre-prev-pick--loss'));
      if (isUp) statusOut.classList.add('pm320-pickbar-status--up');
      else if (isDn) statusOut.classList.add('pm320-pickbar-status--dn');
      statusOut.hidden = false;
    } else {
      statusOut.textContent = '';
      statusOut.hidden = true;
    }
  }

  // 탭 동작 — 셋 중 하나만 set:
  //   (a) data-rec-jump      = 오늘/보는 날짜 풀 카드(#stock-{code})로 scroll
  //   (b) data-pickbar-prev-jump = 장전 + 전일 픽 code 있음 → 전일 토글 자동 펼침 + 전일 풀 카드 점프 (R21 P1)
  //   (c) data-pickbar-scroll = 장전 + code 부재(폴백) → 어제의 픽 칩 자체로 scroll
  bar.removeAttribute('data-rec-jump');
  bar.removeAttribute('data-pickbar-prev-jump');
  bar.removeAttribute('data-pickbar-scroll');
  if (jumpCode) { bar.setAttribute('data-rec-jump', jumpCode); }
  else if (prevPickCode) { bar.setAttribute('data-pickbar-prev-jump', prevPickCode); }
  else { bar.setAttribute('data-pickbar-scroll', '1'); }
  bar.hidden = false;

  // 가시성 토글 — mirror 소스가 화면에 보이면 바 숨김(중복 회피), 위로 사라지면 바 노출.
  //   IntersectionObserver 미지원(구형) 시 항상 노출(graceful degrade).
  // R23 P0 (대표 catch, 과거 날짜 sticky 충돌) — sticky 픽바(top:76, z:99)와 sticky 날짜 헤더
  //   (.cal-content-head, top:var(--nav-h)≈77, z:50)가 거의 같은 top 이라, 픽바가 보일 때 날짜
  //   헤더 요약줄("오늘의 종목 N개·…·KST 기준")이 픽바 뒤로 겹쳐 절단됨(실측 overlap 40px).
  //   fix: 픽바 visible 시 body 에 .pm320-pickbar-on 클래스 + --pickbar-h(실측 높이) 노출 → CSS 가
  //   날짜 헤더 sticky top 을 calc(var(--nav-h)+var(--pickbar-h)) 로 내려 픽바 아래 stack(겹침 0).
  //   픽바 숨김(소스 가시) 시 클래스 제거 → 날짜 헤더는 nav 바로 아래 원위치(무회귀).
  // R23 P0 — body 클래스만 토글(높이는 CSS 고정값 사용). 픽바 visible 높이는 CSS max-height 52px 한도
  //   내 결정적(패딩 10~11px*2 + 1줄 콘텐츠)이라, sticky offset 을 CSS 에서 픽바 max-height(52px)로 고정
  //   하면 transition 중 실측 race 없이 항상 겹침 0(약간의 여유는 무해). JS 실측 의존 제거.
  const _setPickBarOn = (on) => {
    if (on) {
      bar.classList.add('pm320-pickbar--visible');
      document.body.classList.add('pm320-pickbar-on');
    } else {
      bar.classList.remove('pm320-pickbar--visible');
      document.body.classList.remove('pm320-pickbar-on');
    }
  };
  if (typeof IntersectionObserver === 'function') {
    _pickBarObserver = new IntersectionObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      _setPickBarOn(!e.isIntersecting);
    }, { rootMargin: '-80px 0px 0px 0px', threshold: 0 });
    _pickBarObserver.observe(src);
  } else {
    _setPickBarOn(true);
  }

  // 클릭 핸들러 — 1회만 등록. 세 모드:
  //   (1) data-rec-jump → 해당 풀 카드(#stock-{code})로 scroll (rec-jump 와 동일 로직, dup-id scope 회피).
  //   (2) data-pickbar-prev-jump → R21 P1: 장전. "전일 데이터 보기" 토글 자동 펼침 후 전일 풀 카드로 점프.
  //   (3) data-pickbar-scroll → 장전 "어제의 픽" 칩(.cal-pre-prev-pick)으로 scroll (code 부재 폴백).
  bar.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const navOffset = _pm320StickyJumpOffset();
      const cc2 = document.getElementById('cal-content');

      // 목적지로 부드럽게 이동 (v312 원칙 — 목적지 카드가 viewport 에 보이는 최소 이동).
      const _scrollTo = (target) => {
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const top = window.pageYOffset + rect.top - navOffset;
        window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
      };
      const _expandCard = (target) => {
        if (!target || target.classList.contains('expanded')) return;
        const detailToggle = target.querySelector('.cal-detail-toggle');
        if (!detailToggle) return;
        target.classList.add('expanded');
        const txt = detailToggle.querySelector('.cal-toggle-text');
        if (txt) txt.textContent = '접기';
        detailToggle.setAttribute('aria-label', '접기');
      };

      const c = bar.getAttribute('data-rec-jump');
      const prevC = bar.getAttribute('data-pickbar-prev-jump');
      if (c) {
        // 바가 mirror 하는 픽은 항상 #cal-content 안의 카드 → 그 안에서 우선 탐색(dup-id 회피), 부재 시 document fallback.
        const target = (cc2 && cc2.querySelector('#stock-' + c)) || document.getElementById('stock-' + c);
        _expandCard(target);
        _scrollTo(target);
      } else if (prevC) {
        // R21 P1 — 장전: "전일 데이터 보기" 토글을 자동 펼침 → 전일 풀 카드(#stock-{prevC})로 점프.
        //   토글이 이미 펼쳐졌으면 그대로 카드만 점프. 토글 펼침은 async 렌더라 펼침 완료를 기다려
        //   카드 등장 시 scroll (간단 폴링, 최대 ~1.2s). 카드 끝내 부재 시 칩으로 폴백 scroll.
        const prevBox = cc2 ? cc2.querySelector('[data-pre-prev]') : null;
        const toggleBtn = cc2 ? cc2.querySelector('[data-pre-toggle]') : null;
        const _find = () => (prevBox && prevBox.querySelector('#stock-' + prevC)) || null;
        const existing = _find();
        if (existing) { _scrollTo(existing); return; }
        if (toggleBtn && toggleBtn.getAttribute('aria-expanded') !== 'true') {
          toggleBtn.click(); // 펼침 트리거 (handler 가 전일 데이터 렌더)
        }
        let tries = 0;
        const poll = () => {
          const t = _find();
          if (t) { _scrollTo(t); return; }
          if (++tries < 40) { setTimeout(poll, 30); return; }
          // 폴백 — 끝내 카드 부재 시 어제의 픽 칩으로 scroll (최소 동선 보장).
          _scrollTo(cc2 ? cc2.querySelector('.cal-pre-prev-pick') : null);
        };
        setTimeout(poll, 30);
      } else if (bar.getAttribute('data-pickbar-scroll')) {
        // R26 P1 — 전일 칩 부재(무픽 보류일)면 no-pick 라인으로 폴백 scroll.
        // R27 P0-3 — 결측 날짜는 no-data 라인으로 폴백 scroll (체인 말단).
        _scrollTo(cc2 ? (cc2.querySelector('.cal-pre-prev-pick') || cc2.querySelector('.cal-pm320-no-pick') || cc2.querySelector('.cal-pm320-no-data')) : null);
      }
  };
}
window._syncPickBar = _syncPickBar;

// R27 P1⑥ (조니 2심, 2026-06-11) — 뉴스요약(매크로 칩) 의미 동일 사실 중복 표시단 dedup.
//   예: "소비자물가 4.2% 상승" + "CPI 4.2% 기록" = 같은 사실 2회 노출 → 첫 칩만 유지.
//   판정 보수적: 동의어 정규화(canonical topic) 후 (a) 같은 topic 이 1개 이상 겹치고
//   (b) % 수치 집합이 동일할 때만 중복으로 간주(과잉 병합 차단). 데이터(원본 JSON) 수정 0.
function _dedupSimilarMacro(events) {
  if (!Array.isArray(events) || events.length < 2) return events || [];
  const SYN = [
    [/소비자\s*물가(?:\s*지수)?|\bCPI\b/gi, 'CPI'],
    [/생산자\s*물가(?:\s*지수)?|\bPPI\b/gi, 'PPI'],
    [/국내\s*총생산|\bGDP\b/gi, 'GDP'],
    [/연방공개시장위원회|\bFOMC\b/gi, 'FOMC'],
    [/기준\s*금리/g, '기준금리'],
  ];
  const keyOf = (t) => {
    let s = String(t || '');
    for (const [re, c] of SYN) s = s.replace(re, c);
    const nums = [...new Set((s.match(/\d+(?:\.\d+)?\s*%/g) || []).map((x) => x.replace(/\s/g, '')))].sort();
    const topics = [...new Set(SYN.map(([, c]) => c).filter((c) => s.includes(c)))].sort();
    if (nums.length === 0 || topics.length === 0) return null; // 비교 축 부족 → dedup 비대상
    return `${topics.join(',')}|${nums.join(',')}`;
  };
  const seen = new Set();
  return events.filter((m) => {
    const k = keyOf(m && m.summary);
    if (k && seen.has(k)) return false;
    if (k) seen.add(k);
    return true;
  });
}

// R27 P1⑦ (조니 2심, 2026-06-11) — 카드 본문 "분석가 화법" 표시단 sanitize.
//   LLM 생성 본문에 섞이는 자료 메타 언급("제공된 유일 자료는…", "해당 기사는…홍보뿐이다" 등)은
//   손님에게 무의미한 내부 화법 → 해당 문장만 표시단에서 제거 (원본 데이터 수정 0,
//   생성 프롬프트 차단은 backend 별건 — 14:00 게이트 후). 패턴 보수적(자료 메타 언급만).
function _sanitizeAnalystVoice(text) {
  const s = String(text || '');
  if (!s) return s;
  const META = /(제공된\s*[^.!?]{0,12}(자료|정보|기사)|해당\s*기사|주어진\s*(자료|정보|뉴스)|입수된\s*자료|분석\s*대상\s*(자료|기사))/;
  if (!META.test(s)) return s;
  // 문장 단위 분리 (종결부호 뒤 경계 마커 삽입 — lookbehind 미사용, 구형 Safari 호환)
  const kept = s.replace(/([.!?])\s+/g, '$1\n').split('\n').filter((p) => p.trim() && !META.test(p));
  return kept.join(' ').trim();
}

function renderCalExpandContent(date, data) {
  // design-news-time-state-v1 (catch 1) — 시점 분기 PRE_MARKET 빈 상태.
  // 본 함수 진입점에서 getMarketState로 분기. 거래일 09:00 미만 시 카드 list 미렌더.
  // 09:00 이후 OPEN/POST_MARKET 또는 비거래일 HOLIDAY는 기존 로직 유지.
  // 대표 발화 (2026-05-27): "폴링 오류 화면(장중 데이터 갱신 중)이 존재하는 것 자체가 잘못."
  //   장중 stale 데이터 차단(blackout) 제거 — stale/지연 무관 항상 마지막 데이터를 렌더하고,
  //   신선도는 헤더 freshness 라벨(점 + "HH:MM 기준")로만 정직하게 표시한다 (FLR-20260527-TEC-001 정합).
  //   PRE_MARKET (09:00 이전 + 오늘 view) 만 빈 상태 유지 — 표출할 당일 데이터가 아직 없는 정상 상태.
  try {
    const state = (typeof getMarketState === 'function') ? getMarketState(date) : null;
    const _now = new Date();
    const _todayIso = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
    if (state === 'PRE_MARKET' && date === _todayIso) {
      // 전일 거래일 = date 하루씩 뒤로 가며 첫 비휴장일
      let prev = null;
      const dt = new Date(date + 'T00:00:00');
      for (let i = 0; i < 10; i++) {
        dt.setDate(dt.getDate() - 1);
        const iso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
        if (typeof isMarketClosed === 'function' && !isMarketClosed(iso)) { prev = iso; break; }
      }
      const inner = document.getElementById('cal-content');
      // P0 (Q-20260609) — data.nightlyUs 전달: 국내 빈상태에서도 미국증시 섹션 독립 렌더.
      renderPreMarketEmpty(inner, date, prev, null, data && data.nightlyUs);
      return;
    } else {
      // 다른 시점 진입 시 PRE_MARKET 타이머 정리
      _stopPreMarketTimer();
    }
  } catch (_) { /* getMarketState 미정의 시 graceful */ }

  const inner = document.getElementById('cal-content');
  // Q-20260514-058 Fix F-A Plan B (대표 결정 04:08 KST) — chain 순서 역전.
  // 종래: daily_top (하루 누적 max_trade_amount, snapshot stale data 포함) → latest_stocks (최신 snapshot, SSOT)
  // 본질: kiwoom.daily_top는 first_seen=00:22 1회 잡힌 stale 종목까지 포함 (예: 010170 대한광통신 2026-05-13 #1 +4.11%/2.1조 = 키움 HTS 미정합).
  // 키움 HTS 조건검색 SSOT = latest_stocks (snapshot_count 최종 21:33 기준 25종). 키움 HTS와 정합.
  // daily_top는 폴백 유지 (latest_stocks 누락 시).
  const _baseStocks = data.kiwoom ? (data.kiwoom.latest_stocks || data.kiwoom.daily_top || []) : [];
  // REQ-082 Phase 2 §본질 fix (FLR-20260429-FLR-001 §본질) — REQ-080 §1 union 정책을 frontend에서도 적용.
  // build_daily.py union(line 2351-2410)이 interpreted JSON `stocks`에 상한가 종목을 추가하지만,
  // 종래 renderer는 raw kiwoom.daily_top만 사용 → union 결과 무시 → 4/29 6건 카드 미렌더 (qa-2 FAIL 6건).
  // design-lead 옵션 C: 정렬 SSOT(daily_top) 보존 + 상한가 union 종목만 list 끝에 append.
  // data.stocks는 data-loader가 interpretedByName Map만 노출하므로 Map iterate로 적응.
  const _interpByName = data.interpretedByName || new Map();
  const _baseTickers = new Set(_baseStocks.map(s => s.ticker || s.code).filter(Boolean));
  const _limitUpAdded = [];
  for (const [_name, _interp] of _interpByName) {
    const _ticker = _interp.code || '';
    if (!_ticker || _baseTickers.has(_ticker)) continue;
    const _hasLimitUp = (_interp.status_badges || []).some(b => b.label === '상한가');
    if (!_hasLimitUp) continue;
    // kiwoom dict 호환 형태로 합성 (build_daily.py:2378 _added_lu와 동일 시그니처)
    _limitUpAdded.push({
      ticker: _ticker,
      name: _name,
      last_price: _interp.close_price ?? null,
      max_trade_amount: _interp.trade_amount ?? null,
      trade_amount: _interp.trade_amount ?? null,
      max_change_pct: _interp.change_pct ?? null,
      change_pct: _interp.change_pct ?? null,
      _source_union: 'limit_up',
    });
  }
  const kiwoomStocks = _limitUpAdded.length > 0 ? [..._baseStocks, ..._limitUpAdded] : _baseStocks;
  const hasInterpretedStocks = data.interpretedByName && data.interpretedByName.size > 0;
  const hasAny = kiwoomStocks.length > 0 || hasInterpretedStocks;

  if (!hasAny) {
    const closed = isMarketClosed(date);
    let emptyMsg;
    if (closed) {
      const nextDate = getNextTradingDate(date);
      const nextLabel = nextDate ? formatKoDate(nextDate) : '';
      emptyMsg = `
        <div style="text-align:center;padding:32px 0;">
          <div style="font-size:15px;font-weight:700;color:var(--tx2);margin-bottom:6px;">오늘은 장이 쉽니다</div>
          <div style="font-size:12px;color:var(--dm);">${nextLabel ? '다음 거래일 ' + escapeHtml(nextLabel) : ''}</div>
        </div>`;
    } else {
      // DSN-frontend §3.6.2.2 (2026-05-28 대표 직접 발화) — 오늘 view + 09:00+ 데이터 없음 시간대별 정직 고지.
      // 대표 verbatim: "9시부터 종목검색 결과가 있을 때까지 어제걸 보여주는게 과연 맞는걸까? 무슨 이점이 있지?"
      //                "없으면 없다고 알려주는게 더 신뢰도나 활용면에서 좋자않나?"
      // 기존: yesterday data fallback (data-loader.js) → "수집된 데이터가 없습니다" 1줄.
      // 신규: data-loader.js fallback 차단 + 시간대별 sub-message로 사용자 즉시 인지.
      //   - 09:00~11:00 KST: 장 시작 직후 수집 진행 중 (정상 상황)
      //   - 11:00 KST 이후: 파이프라인 이상 또는 새로고침 권장
      //   - 그 외 (과거 날짜 등): 기존 메시지 유지
      const now = new Date();
      const todayIso = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const isToday = (date === todayIso);
      const hour = now.getHours();
      let titleText = '수집된 데이터가 없습니다';
      let subText = '';
      if (isToday && hour >= 9 && hour < 11) {
        titleText = '장 시작 직후 데이터 수집 중';
        subText = '잠시 후 자동 갱신됩니다';
      } else if (isToday && hour >= 11 && hour < 16) {
        titleText = '데이터 수집이 지연되고 있습니다';
        subText = '새로고침하거나 잠시 후 다시 확인해 주세요';
      }
      emptyMsg = `<div class="cal-empty">
            <div class="cal-empty-circle"></div>
            <div>${escapeHtml(titleText)}</div>
            ${subText ? `<div class="cal-empty-sub">${escapeHtml(subText)}</div>` : ''}
          </div>`;
    }
    // 휴장일이라도 매크로 이벤트가 있으면 표시
    // R27 P1⑥ — 의미 동일 사실 중복 칩 표시단 dedup (본 렌더 path 양끝 동시, FLR-20260428-TEC-001 동형 예방).
    const closedMacro = _dedupSimilarMacro((data.macroEvents || []).filter(m => m.summary && m.summary.length >= 10)).slice(0, 5);
    const closedMacroHtml = closedMacro.length > 0
      ? `<div class="cal-macro-strip">${closedMacro.map(m => `<span class="cal-macro-chip" title="${escapeHtml(sanitize(m.title || ''))}">${escapeHtml(sanitize(m.summary))}</span>`).join('')}</div>`
      : '';
    const _emptyVerBanner = _buildRulesVersionBanner(data && data.rules_version);
    // P0 (Q-20260609 2회차) — 국내 빈상태(휴장 / "데이터 없음" / "장 시작 직후 수집 중" / "수집 지연")
    //   에서도 미국증시 섹션은 국내 종목 상태와 완전 독립으로 렌더한다. 어제 P0(15dc4b465)는 PRE_MARKET
    //   path 만 미장을 삽입 → 09:00 직후 국내 OPEN 이지만 당일 stock-*.json 미생성 시 본 !hasAny early-return
    //   path 로 falls-through → 미장 통째 누락 재발(대표 catch 09:05 "이 순간에도 미장은 계속 보여야지").
    //   미 동부 20:05 ET = 정규장 마감 + 선물 거래 중이므로 미장은 항상 표출돼야 함.
    //   fix: PRE_MARKET path(L388/L412)와 동형 — _buildNightlyUsHtml(국내와 동일 SSOT 함수) 삽입 +
    //   _wireUsFutToggle() 동반(어제 wiring 누락 회귀 교훈 FLR-20260609-TEC-001). nightlyUs 부재/null 시
    //   빈 문자열 graceful 생략(빈 카드 금지, FLR-AGT-002). 본 path 는 closed/past/today-empty 모두 커버.
    const _emptyUsHtml = (typeof _buildNightlyUsHtml === 'function') ? _buildNightlyUsHtml(data && data.nightlyUs, date) : '';
    inner.innerHTML = `
      ${_emptyVerBanner}
      <div class="cal-content-head" role="button" tabindex="0" aria-label="달력으로 이동" data-scroll-to-cal="1">
        <div class="cal-content-date">${formatKoDate(date)}</div>
        <div class="cal-content-meta">${closed ? '휴장' : '데이터 없음'}</div>
      </div>
      ${_emptyUsHtml}
      ${closedMacroHtml}
      ${emptyMsg}
    `;
    // 미장 섹션 주입 시 선물 토글 wiring 동반(멱등). 본 path 는 early-return 이라 L1926 말미 호출에 도달 못 함.
    if (_emptyUsHtml && typeof _wireUsFutToggle === 'function') _wireUsFutToggle();
    // PM320 (대표 2026-06-10 A안) — empty-state path 미장 섹션 접힘 상태 복원.
    if (_emptyUsHtml && typeof _applySectionCollapse === 'function') {
      const _nuRoot = document.getElementById('nightly-us');
      if (_nuRoot) _applySectionCollapse(_nuRoot, 'nightly-us');
    }
    return;
  }

  // 키움 name → {ticker, change_pct} 맵 (특징주 join용)
  const kiwoomByName = new Map();
  for (const s of kiwoomStocks) {
    if (s && s.name) kiwoomByName.set(s.name, s);
  }

  // interpretedByName을 특징주/종목 구성에서 사용하기 위해 먼저 참조
  const interpByName = data.interpretedByName || new Map();

  // 특징주 결정: 거래대금 TOP 또는 stock-*.json 기반
  let featureSource = 'primary';
  let featureItems = []; // { name, pct, themes, ticker, reason }
  if (kiwoomStocks.length > 0) {
    featureSource = 'fallback';
    featureItems = kiwoomStocks.slice(0, 6).map(s => {
      const interp = interpByName.get(s.name);
      // cycle20 P1 — limit-up/down status_badges 우선 (featureItems primary)
      const _featLimit = (interp && Array.isArray(interp.status_badges))
        ? interp.status_badges.find(b => Array.isArray(b.effect_badges)
            && b.effect_badges.some(e => e.effect === 'limit-up' || e.effect === 'limit-down')
            && b.flu_rt != null
            && Math.abs(b.flu_rt) <= 35) // anomaly guard (±35% 초과 = ka10017 source 결함, P3 audit)
        : null;
      const pct = _featLimit ? _featLimit.flu_rt : (interp?.change_pct ?? s.change_pct ?? s.max_change_pct ?? null);
      const themes = (interp?.themes || themesData?.stocks?.[s.ticker]?.themes || []).slice(0, 3);
      return { name: s.name, pct, themes, links: [], ticker: s.ticker, reason: '', interp };
    });
  } else if (interpByName.size > 0) {
    // kiwoom JSON 없음, 카페 없음 → stock-*.json 기반 특징주
    featureSource = 'fallback';
    featureItems = [];
    for (const [name, interp] of interpByName) {
      if (featureItems.length >= 6) break;
      const themes = (interp.themes || []).slice(0, 3).map(t => typeof t === 'string' ? { name: t } : t);
      // cycle20 P1 — limit-up/down status_badges 우선 (featureItems no-kiwoom)
      const _featLimit2 = Array.isArray(interp.status_badges)
        ? interp.status_badges.find(b => Array.isArray(b.effect_badges)
            && b.effect_badges.some(e => e.effect === 'limit-up' || e.effect === 'limit-down')
            && b.flu_rt != null
            && Math.abs(b.flu_rt) <= 35) // anomaly guard (±35% 초과 = ka10017 source 결함, P3 audit)
        : null;
      const _featPct2 = _featLimit2 ? _featLimit2.flu_rt : (interp.change_pct ?? null);
      featureItems.push({ name, pct: _featPct2, themes, links: [], code: interp.code || '', ticker: interp.code || '', reason: '', interp });
    }
  }

  // cycle20 P1 (2026-05-20) — 상한가/하한가 카드 등락률 status_badges 우선 사용 (frontend 빠른 fix)
  // 본질: build_daily.py SoT 결함으로 limit-up 종목의 interp.change_pct가 부정합 (예: 광전자 -1.46% vs 실제 +29.96%).
  //   intraday.base 잘못된 기준 → change_pct 잘못 계산. backend SoT 통일은 별건 P2 후행.
  // frontend가 정합 책임: status_badges[].effect_badges[].effect === 'limit-up'/'limit-down' 있고
  //   status_badges[].flu_rt + cur_prc 정의 시 → 카드 pct/price를 그것으로 override.
  // mismatch 4/9 종목 catch (광전자/마키나락스/성문전자/케이엠제약, 2026-05-20 13:43 KST lead 진단).
  // DSN-arch-frontend §3.6.4 spec 신설.
  const _extractLimitEffect = (interp) => {
    if (!interp || !Array.isArray(interp.status_badges)) return null;
    for (const b of interp.status_badges) {
      if (!Array.isArray(b.effect_badges)) continue;
      const isLimit = b.effect_badges.some(e => e.effect === 'limit-up' || e.effect === 'limit-down');
      if (isLimit && b.flu_rt != null && b.cur_prc != null) {
        // range guard: 한국 증시 상한가/하한가 ±30% 제도적 fact. ±35% 초과 = ka10017 source anomaly (예: 마키나락스 +300%).
        // anomaly 시 status_badges override 무효 → 기존 change_pct fallback 사용. P3 backend audit 별건 trigger.
        if (Math.abs(b.flu_rt) > 35) {
          // eslint-disable-next-line no-console
          console.warn(`[limit-up-mismatch] anomaly flu_rt=${b.flu_rt} for ${interp.code}/${interp.name} — skip override (P3 backend audit)`);
          return null;
        }
        return { flu_rt: b.flu_rt, cur_prc: b.cur_prc };
      }
    }
    return null;
  };
  // cycle20 P1 (2026-05-20) — 카드 좌측 빨간 테두리(.cal-feature-card--lu) 결정용 헬퍼.
  // 본질 fix: 기존 _source_union==='limit_up' 단일 조건 → kiwoom.latest_stocks 內 상한가 종목(녹십자엠에스 등)은 union 미경유 → 테두리 누락.
  // 대표 catch (2026-05-20 15:08 KST): "녹십엠에스는 상한가인데도 카드 좌측 빨간 테두리 없음 (광전자는 있음)".
  // 일관성: status_badges[].effect_badges[].effect === 'limit-up' 검출 시 source 무관 테두리 부여.
  // anomaly guard 동일 적용 (±35% 초과 = ka10017 source 결함이지만 marker는 유지 — 시각 일관성 우선).
  const _hasLimitUpEffect = (interp) => {
    if (!interp || !Array.isArray(interp.status_badges)) return false;
    for (const b of interp.status_badges) {
      if (!Array.isArray(b.effect_badges)) continue;
      if (b.effect_badges.some(e => e.effect === 'limit-up')) return true;
    }
    return false;
  };

  // DOC-20260603-DSN-001 §1+§3+§4 — PM320 추천/결과 row HTML build helper.
  // 본문 영어 enum (running / taken_profit / expired_gain / expired_loss) → 한국어 매핑.
  // 카톡 6차 본문 verbatim 정합 (매수 / 물타기 / 익절 / 만기청산 4 row).
  // non-PICK = 매매 muted 차등 (FLR-AGT-002 거짓 충실성 차단, 대표 verbatim 2026-06-03).
  // 입력: pm320_pick 객체 (data-loader.js 합성 패스스루) + viewDate (카드 일자).
  // 출력: HTML string (배지 / row), 부재 시 빈 string.
  const _fmtKRW = (n) => {
    if (n == null || !Number.isFinite(n)) return '—';
    return n.toLocaleString('ko-KR') + '원';
  };
  const _fmtPctSigned = (p) => {
    if (p == null || !Number.isFinite(p)) return '—';
    const s = p >= 0 ? '+' : '';
    return `${s}${p.toFixed(2)}%`;
  };
  // 낙폭(drawdown) 전용 포매터: 낙폭은 음수/0만 의미 있음 → '+' 부호 제거(고장 오인 차단).
  //   0 = 해당 기준선 아래로 안 빠짐(정상). 음수 = 그 기준 대비 최대 평가손실.
  const _fmtDrawdown = (p) => {
    if (p == null || !Number.isFinite(p)) return '—';
    return `${p.toFixed(2)}%`;
  };
  // PM320-D6 R18 (트레이더 평가자 P1) — 접힌(공유 URL 단일카드 포함) 결과 mark 에 장중 최대낙폭 병기.
  //   종전: 결과 mark 는 "✅ 익절 +3.2%" 만 노출 → 펼쳐야 MDD 가 보여, 공유 링크로 단일 카드만 본
  //   손님이 익절 결과만 보고 "보유 중 -21% 까지 빠졌던 현실"을 인지 못 함(승률 착시와 동형).
  //   fix: 청산 mark 뒤에 " · 장중 -X.X%" 칩을 같은 줄에 병기(공유 링크·접힘 상태에서도 1초 catch).
  //   기준 = result.mdd_peak_pct(보유 고점→저점, 표준 MDD). 음수일 때만 표시(0·부재·running 미표시,
  //   거짓 충실성 차단 FLR-AGT-002). 펼침 본문 MDD row 와 동일 SoT(추가 추정 0).
  //   plain text 반환(소비부가 escapeHtml 후 별 span 으로 색 분리). 음수일 때만 값, 그 외 ''.
  const _mddPeakChipText = (pk) => {
    const v = pk && pk.result && pk.result.mdd_peak_pct;
    if (v == null || !Number.isFinite(v) || v >= 0) return '';
    return `· 장중 ${_fmtDrawdown(v)}`;
  };
  // 한국어 매핑 (DSN-001 §1 영어 enum → §3.5 한국어 label)
  // running = 잠정 / taken_profit = 익절 / expired_gain = 만기청산 (이익) / expired_loss = 만기청산 (손실)
  const _pm320StateLabel = (state) => {
    switch (state) {
      case 'running': return '잠정';
      case 'taken_profit': return '익절';
      case 'expired_gain': return '만기청산 (이익)';
      case 'expired_loss': return '만기청산 (손실)';
      default: return '';
    }
  };
  // 결과 mark inline (default 접힘 상태에서도 1초 catch — DSN-001 §3.2 / §4.1 본질)
  const _pm320ResultMark = (pk) => {
    if (!pk || !pk.current_state) return '';
    const state = pk.current_state;
    const pnl = pk.current_pnl_pct;
    const dOffset = pk.d_offset;
    if (state === 'running') {
      // 진행 중 통합 — 전부 "⏳ 잠정 {pnl} (D+offset/+N)" 단일 형태 (FLR-AGT-002 §4.4)
      // 대표 지시 2026-06-05: D+0(당일 진입)도 "🕐 진입 D+0" 별도 문구 폐지, 잠정 형태로 통일
      // R25 P0-1 (2026-06-11) — 분모 "/+3" 하드코딩 + dOffset<=3 조건 폐기 → 만기 SSOT 동적
      //   (_pm320DTotal = pick_date→expiry_date 영업일 차). 물타기 픽 만기 연장(D+6 등) 시
      //   같은 카드 만기 필드와 자기모순 + D+4~ 카운터 소실 버그 봉쇄. per-day 스냅샷 카드라
      //   분자(d_offset)는 그 날 기준 스냅샷 값 유지(역사 카드 의미 정합).
      const pnlText = _fmtPctSigned(pnl);
      const dTotal = _pm320DTotal(pk);
      const dText = (dOffset != null && dOffset >= 0 && dTotal != null && dOffset <= dTotal) ? ` (D+${dOffset}/+${dTotal})` : '';
      // R26 P0-2① (2026-06-11, stale 정직화 전수 — 한쪽 코드 양끝 누락 예방 FLR-20260428-TEC-001 동형) —
      //   과거 날짜 페이지의 running mark 는 그 날짜 스냅샷 값(잠정 pnl·D+N)이라 "현재 성적"이 아니다
      //   (예: 6/4 페이지 주성 "D+3 · -20.86%" 가 오늘인 양 읽힘). 보는 날짜(date) < 오늘(KST)일 때만 caption.
      // R27 P0-2 (조니 2심, 2026-06-11) — "집계 기준 {조회 날짜}" echo 폐기. per-day 파일은 후행
      //   갱신되므로 조회 날짜 ≠ 실제 집계일 (6/4 파일에 D+3 스냅샷 = 내부 모순 재현). 스냅샷 날짜는
      //   데이터 필드(pk.snapshot_date, backend 별건 신설 예정)가 있을 때만 출력, 부재 시 무날짜 라벨
      //   "잠정 집계" — 모르는 날짜를 출력하지 않는다 (FLR-AGT-002 거짓 충실성).
      const _snapDate = (pk && typeof pk.snapshot_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(pk.snapshot_date))
        ? pk.snapshot_date : null;
      const _isPastView = (typeof date === 'string' && date < _pm320TodayKstISO());
      // R28 P2 (조니 2심, 2026-06-11) — "잠정 +0.00% … (잠정 집계)" 동어 1회로. 라벨 "잠정"이
      //   이미 잠정성을 명시하므로 무날짜 폴백 칩 "(잠정 집계)" 폐기 — snapshot_date 실재 시에만
      //   "(집계 기준 M/D)" 출력 (모르는 날짜 미출력 원칙 R27 P0-2 유지, FLR-AGT-002).
      const _staleChip = (_isPastView && _snapDate)
        ? `(집계 기준 ${_snapDate.slice(5).replace('-', '/')})`
        : '';
      return {
        html: `⏳ 잠정 ${pnlText}${dText}`,
        mod: 'running',
        dateChip: _staleChip,
        aria: `진행 ${dOffset}일차, 잠정 수익률 ${pnlText}${_isPastView && _snapDate ? `, 집계 기준 ${_snapDate}` : ''}`,
      };
    }
    // 22:11 (대표 verbatim "물타기 된 종목은 이익이든 손실이든 물타기 정보도 추가") —
    // watered=true 시 라벨 끝에 " (물타기)" or " (이익+물타기)" / " (손실+물타기)" suffix 추가.
    const watered = !!(pk.result && pk.result.watered);
    if (state === 'taken_profit') {
      const pnlText = pk.result && pk.result.final_pnl_pct != null
        ? _fmtPctSigned(pk.result.final_pnl_pct)
        : _fmtPctSigned(pnl);
      const resultDate = pk.result && pk.result.result_date ? ` (${pk.result.result_date})` : '';
      const label = watered ? '익절 (물타기)' : '익절';
      const ariaSuffix = watered ? ', 물타기 진입' : '';
      // wave1 fix ② (2026-06-11, R24 P2) — 청산일 "(YYYY-MM-DD)"를 html 평문에서 분리해
      //   dateChip 으로 반환 (mddChip 패턴 동형). pill wrap(v317/r6) 시 날짜가 하이픈에서
      //   줄쪼개지지 않게 호출부가 nowrap span(.pm320-rec-mark-date)으로 감싼다. aria 는 종전 유지.
      return {
        html: `✅ ${label} ${pnlText}`,
        mod: 'profit',
        dateChip: pk.result && pk.result.result_date ? `(${pk.result.result_date})` : '',
        mddChip: _mddPeakChipText(pk),
        aria: `${label.replace(' (물타기)', '')} 도달${ariaSuffix}, 수익률 ${pnlText}${resultDate}`,
      };
    }
    if (state === 'expired_gain') {
      const pnlText = pk.result && pk.result.final_pnl_pct != null
        ? _fmtPctSigned(pk.result.final_pnl_pct)
        : _fmtPctSigned(pnl);
      const label = watered ? '만기청산 (이익+물타기)' : '만기청산 (이익)';
      const ariaSuffix = watered ? ', 물타기 진입' : '';
      return {
        html: `✅ ${label} ${pnlText}`,
        mod: 'profit',
        mddChip: _mddPeakChipText(pk),
        aria: `만기 도달, 평단 상회${ariaSuffix}, ${pnlText}`,
      };
    }
    if (state === 'expired_loss') {
      const pnlText = pk.result && pk.result.final_pnl_pct != null
        ? _fmtPctSigned(pk.result.final_pnl_pct)
        : _fmtPctSigned(pnl);
      const label = watered ? '만기청산 (손실+물타기)' : '만기청산 (손실)';
      const ariaSuffix = watered ? ', 물타기 진입' : '';
      return {
        html: `⚠️ ${label} ${pnlText}`,
        mod: 'loss',
        mddChip: _mddPeakChipText(pk),
        aria: `만기 도달${ariaSuffix}, 손실 ${pnlText}`,
      };
    }
    return '';
  };
  // 펼침 본문 4 row (DSN-001 §3.4 카톡 6차 verbatim 정합)
  const _pm320DetailRows = (pk, authClose) => {
    if (!pk) return '';
    const buyDate = pk.pick_date || '';
    // Q-20260606-111 종가 SSOT 통일 (대표 02:11 + lead 02:15) — 매매 진입가(버튼)를 카드 종가(authClose =
    //   daily_20[-1].c = 마감 dailybars close)로 통일. pk.entry_price(pick 시점 stale 가능) 가 authClose 와
    //   다르면 authClose 우선 + 물타기·익절·물타기후익절 전부 authClose 기반 재계산 (build_card_history 동일 식:
    //   watering=round(P0*0.936) / tp=round(P0*1.032) / tpAfterWatering=round((P0+2*P0*0.936)/3*1.032)).
    //   authClose 미존재(과거 카드 daily_20 부재 등) 시 저장값 fallback (graceful, 추정 0).
    const WATERING_RATIO = 0.936, TAKE_PROFIT_RATIO = 1.032;
    const _p0 = (typeof authClose === 'number' && authClose > 0) ? authClose : pk.entry_price;
    const _useRecompute = (typeof authClose === 'number' && authClose > 0 && authClose !== pk.entry_price);
    const _watering = _useRecompute ? Math.round(_p0 * WATERING_RATIO) : pk.watering_target_price;
    const _tp = _useRecompute ? Math.round(_p0 * TAKE_PROFIT_RATIO) : pk.take_profit_target_price;
    const _tpAfter = _useRecompute
      ? Math.round(((_p0 + 2 * _p0 * WATERING_RATIO) / 3) * TAKE_PROFIT_RATIO)
      : pk.take_profit_after_watering_price;
    const entryPrice = _fmtKRW(_p0);
    // 표기 "약 X원" → "X원 부근" (대표 02:10, 카톡 f107de3 표기 통일). 22:29 ratio % 표기 유지.
    const wateringPrice = _watering != null ? `${_fmtKRW(_watering)} 부근 (-6.4%)` : '—';
    const wateringWeight = pk.watering_weight || '첫 매수의 2배';
    const tpPrice = _tp != null ? `${_fmtKRW(_tp)} 부근 (+3.2%)` : '—';
    const tpAfterPrice = _tpAfter != null
      ? `${_fmtKRW(_tpAfter)} 부근 (+3.2%)`
      : '—';
    const expiryDate = pk.expiry_date || '';
    // 결과 strip (state != running 시만)
    let resultStrip = '';
    // MDD row (대표 지시 2026-06-08 정정 — "최대 낙폭"이 죄다 +0.00% 로 고장처럼 읽힘).
    //   원인: 헤드라인이 mdd_pct(진입가 대비)였는데, 강세장 픽은 진입 후 바로 올라 익절 →
    //         진입가 아래로 안 빠져 mdd_pct=0(정상). 실제 변동은 mdd_peak_pct(보유 고점 대비)에 있음.
    //   ⇒ 헤드라인 "최대 낙폭" = result.mdd_peak_pct (표준 MDD 정의, 고점→저점, 항상 의미있는 값).
    //   ⇒ 보조 = result.mdd_pct (진입 후 최대 평가손실). 0이면 "진입가 아래로 안 빠짐" 명시(고장 오인 차단).
    //   낙폭은 음수/0만 의미 → _fmtDrawdown 으로 '+' 부호 제거.
    //   완결 픽(state != running && result 존재 && mdd_peak_pct finite)에만 표시. running·보류·null은 미표시(graceful).
    let mddRow = '';
    if (pk.current_state && pk.current_state !== 'running' && pk.result
        && pk.result.mdd_peak_pct != null && Number.isFinite(pk.result.mdd_peak_pct)) {
      const peakText = _fmtDrawdown(pk.result.mdd_peak_pct);
      const hasEntry = pk.result.mdd_pct != null && Number.isFinite(pk.result.mdd_pct);
      // mdd_pct===0 시: 값은 "0%", 안내문구("진입가 아래로 안 빠짐")는 괄호 없이 다음 줄로 분리(대표 지시 2026-06-08).
      const zeroEntry = hasEntry && pk.result.mdd_pct === 0;
      const entrySub = hasEntry
        ? (zeroEntry ? '0%' : _fmtDrawdown(pk.result.mdd_pct))
        : '';
      mddRow = `
      <div class="pm320-rec-detail-row pm320-rec-detail-row--mdd">
        <span class="pm320-rec-label">📉 최대 낙폭</span>
        <span class="pm320-rec-value pm320-rec-value--mdd">${escapeHtml(peakText)}</span>
      </div>${hasEntry ? `
      <div class="pm320-rec-detail-row pm320-rec-detail-sub">
        <span class="pm320-rec-label"></span>
        <span class="pm320-rec-value pm320-rec-value--sub">└ 진입 후 최대 평가손실: ${escapeHtml(entrySub)}</span>
      </div>${zeroEntry ? `
      <div class="pm320-rec-detail-row pm320-rec-detail-sub">
        <span class="pm320-rec-label"></span>
        <span class="pm320-rec-value pm320-rec-value--sub pm320-rec-value--sub-cont">진입가 아래로 안 빠짐</span>
      </div>` : ''}` : ''}`;
    }
    if (pk.current_state && pk.current_state !== 'running' && pk.result) {
      const state = pk.current_state;
      const finalPrice = pk.result.final_price != null ? _fmtKRW(pk.result.final_price) : '';
      const finalPct = pk.result.final_pnl_pct != null ? _fmtPctSigned(pk.result.final_pnl_pct) : '';
      const resDate = pk.result.result_date || '';
      // 22:11 — 물타기 정보 suffix (watered=true 시).
      const watered = !!pk.result.watered;
      let mark, mod;
      if (state === 'taken_profit') {
        mark = watered ? `✅ 익절 (물타기) ${finalPct}` : `✅ 익절 ${finalPct}`;
        mod = 'profit';
      } else if (state === 'expired_gain') {
        mark = watered ? `✅ 만기청산 (이익+물타기) ${finalPct}` : `✅ 만기청산 (이익) ${finalPct}`;
        mod = 'profit';
      } else if (state === 'expired_loss') {
        mark = watered ? `⚠️ 만기청산 (손실+물타기) ${finalPct}` : `⚠️ 만기청산 (손실) ${finalPct}`;
        mod = 'loss';
      } else {
        mark = `${_pm320StateLabel(state)} ${finalPct}`;
        mod = '';
      }
      const cls = mod ? `pm320-rec-result-strip pm320-rec-result-strip--${mod}` : 'pm320-rec-result-strip';
      // R18 (트레이더 평가자 P1) — 결과 strip 하단 체결현실 면책 1줄. 공유 URL 단일 카드로
      //   "익절 +3.2%" 만 본 손님이 균일 청산을 사기성으로 오해/혹은 체결현실로 과신하는 것 차단.
      const _fillNote = `<div class="pm320-rec-result-fill-note">장중 목표가 터치 기준 가상 산출 — 슬리피지·시가 갭·부분체결 미반영. 실제 체결가는 다를 수 있습니다.</div>`;
      resultStrip = `<div class="${cls}" aria-label="${escapeHtml(`${_pm320StateLabel(state)}, 수익률 ${finalPct}${resDate ? ', ' + resDate : ''}`)}">${escapeHtml(mark)}${resDate ? ` · ${escapeHtml(resDate)} 종가 ${escapeHtml(finalPrice)}` : ''}</div>${_fillNote}`;
    }
    return `
      <div class="pm320-rec-detail-row pm320-rec-detail-row--buy">
        <span class="pm320-rec-label">💰 매수</span>
        <span class="pm320-rec-value">${escapeHtml(buyDate)} 종가 ${escapeHtml(entryPrice)}</span>
      </div>
      <div class="pm320-rec-detail-row pm320-rec-detail-row--watering">
        <span class="pm320-rec-label">📉 물타기${_termTip('watering')}</span>
        <span class="pm320-rec-value">${escapeHtml(wateringPrice)}</span>
      </div>
      <div class="pm320-rec-detail-row pm320-rec-detail-sub">
        <span class="pm320-rec-label"></span>
        <span class="pm320-rec-value pm320-rec-value--sub">└ 비중: ${escapeHtml(wateringWeight)}</span>
      </div>
      <div class="pm320-rec-detail-row pm320-rec-detail-row--profit">
        <span class="pm320-rec-label">📈 익절${_termTip('take-profit')}</span>
        <span class="pm320-rec-value">${escapeHtml(tpPrice)}</span>
      </div>
      <div class="pm320-rec-detail-row pm320-rec-detail-sub">
        <span class="pm320-rec-label"></span>
        <span class="pm320-rec-value pm320-rec-value--sub">└ 물타기 후 익절가: ${escapeHtml(tpAfterPrice)} <span class="pm320-rec-value--note">(체결 평단 하락분 반영)</span></span>
      </div>
      <div class="pm320-rec-detail-row pm320-rec-detail-row--expiry">
        <span class="pm320-rec-label">⏰ 만기청산</span>
        <span class="pm320-rec-value">${escapeHtml(expiryDate)} 종가</span>
      </div>${mddRow}
      ${resultStrip}`;
  };
  // PICK 배지 (DSN-001 §2 — 헤더 .cal-feature-badges 좌측 첫 자리)
  // r5 (2026-06-11, 대표 P1 시점 분기) — 과거 날짜 보기 시 "오늘" → "이날의" (divider·요약카드 headLabel 정합).
  const _buildPm320PickBadge = (pk, isPast) => {
    if (!pk || !pk.is_pick) return '';
    const _lbl = isPast ? '이날의 PM320 추천' : '오늘 PM320 추천';
    const _aria = isPast ? '이 날 15:20에 PM320이 추천한 종목' : '오늘 15:20에 PM320이 추천한 종목';
    return `<span class="cal-pm320-pick-badge" aria-label="${_aria}" title="15:20 카톡 6차 추천"><svg class="cal-pm320-pick-icon" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg><span class="cal-pm320-pick-label">${_lbl}</span></span>`;
  };
  // 추천/결과 row (DSN-001 §3 — .cal-feature-summary 마지막 줄)
  const _buildPm320RecRow = (pk, code, authClose) => {
    if (!pk) return '';
    const isPick = !!pk.is_pick;
    const variantClass = isPick ? '' : ' pm320-rec-row--virtual';
    // PM320-D6 P0 (손님 판정 — 추천/가상 혼동) — 비-픽(가상) 행은 화면 텍스트로 추천 아님을 명시.
    //   종전: 라벨 "매매" 픽과 동일 + "가상"은 aria-label에만 → 초보 손님이 6종목 전부 "추천"으로 오인.
    //   fix = (a) 라벨 "가상매매"(픽=그냥 "매매") (b) 행 위 1줄 "※ 추천 아님 — 동일 규칙 적용 시 가상 계산".
    const labelText = isPick ? '매매' : '가상매매';
    const labelAria = isPick
      ? 'PM320 추천 매매 상세'
      : 'PM320 카톡 6차 규칙으로 만약 진입했다면 — 가상 매매 (추천 아님)';
    // 비-픽 행 상단 안내 (추천 아님 — 동일 규칙 가상 시뮬레이션). 픽은 빈 문자열(무회귀).
    const virtualNoteHtml = isPick
      ? ''
      : `<div class="pm320-rec-virtual-note" role="note">※ 추천 아님 — 동일 규칙 적용 시 <b>가상 계산</b></div>`;
    const mark = _pm320ResultMark(pk);
    const markHtml = mark
      ? `<span class="pm320-rec-result-mark pm320-rec-result-mark--${mark.mod}" aria-label="${escapeHtml(mark.aria)}">${escapeHtml(mark.html)}${mark.dateChip ? `<span class="pm320-rec-mark-date">${escapeHtml(mark.dateChip)}</span>` : ''}${mark.mddChip ? `<span class="pm320-rec-mark-mdd">${escapeHtml(mark.mddChip)}</span>` : ''}</span>`
      : '<span class="pm320-rec-result-mark pm320-rec-result-mark--running"></span>';
    const detailId = `pm320-rec-detail-${escapeHtml(code || '')}`;
    const detailRows = _pm320DetailRows(pk, authClose);
    // §3.1 정정 (2026-06-03 design-lead 옵션 B 권고, 대표 critical catch 20:41 "통일성 미려함도 없고") —
    // chevron 폐기 + 텍스트 토글 "매매" ↔ "접기" (cal-detail-toggle 완전 정합).
    // 22:11 정정 (대표 verbatim "매매 보기 대신 매매 라고 이름 바꿔") — " 보기" suffix 폐기.
    // mark inline 우측 (라벨 우측 gap 6px), justify-content center, font-weight 700 (위계 강조).
    return `<div class="pm320-rec-row${variantClass}" data-rec-state="${escapeHtml(pk.current_state || 'running')}" data-d-offset="${pk.d_offset != null ? pk.d_offset : ''}" data-collapse-label="${escapeHtml(labelText)}">
      ${virtualNoteHtml}
      <button class="pm320-rec-toggle" type="button" aria-expanded="false" aria-controls="${detailId}" aria-label="${escapeHtml(labelAria)}">
        <span class="pm320-rec-toggle-label">
          <svg class="pm320-rec-icon" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18M7 16l4-4 4 4 5-5"/></svg>
          <span class="pm320-rec-toggle-text">${escapeHtml(labelText)}</span>
        </span>
        ${markHtml}
      </button>
      <div class="pm320-rec-detail" id="${detailId}" hidden>${detailRows}</div>
    </div>`;
  };

  // PM320-D6 (2026-06-10 대표 verbatim "추천 카드가 별도로 만들어지는 줄 알았는데 없네") —
  //   카운트다운 배너(15:20 전) 가 사라진 자리(=픽 확정 시)에 들어가는 "오늘의 추천" 전용 요약 카드.
  //   per-card PICK 배지/매매 row(DSN-001 §2·§3)와 별개로, 슬롯 상단에 한눈 요약을 띄운다.
  //   - 데이터: 오늘(또는 보는 날짜) 픽 종목 1개의 pm320_pick 객체만 사용. 하드코딩 0 (FLR-AGT-002).
  //   - 픽 부재(보류/미생성) 시 빈 문자열 → 미렌더 (기존 카운트다운/보류 분기 무회귀).
  //   - 과거 날짜 시 헤더 "이날의 추천" + (청산 완료면) 결과 mark. 진행중이면 "잠정".
  //   진입가 SSOT = 매매 row와 동일(authClose 우선, _buildPm320RecRow 와 같은 식, 추정 0).
  const _buildPm320TodayRecCard = (pk, code, name, authClose, isPast) => {
    if (!pk || !pk.is_pick) return '';
    const WATERING_RATIO = 0.936, TAKE_PROFIT_RATIO = 1.032;
    const _p0 = (typeof authClose === 'number' && authClose > 0) ? authClose : pk.entry_price;
    const _recompute = (typeof authClose === 'number' && authClose > 0 && authClose !== pk.entry_price);
    const _watering = _recompute ? Math.round(_p0 * WATERING_RATIO) : pk.watering_target_price;
    const _tp = _recompute ? Math.round(_p0 * TAKE_PROFIT_RATIO) : pk.take_profit_target_price;
    // 대표 20:51 지적 — 익절가는 물타기 체결 시 평단 하락으로 바뀌므로 단일 단정 금지.
    //   풀 카드(_buildPm320CardHtml)의 "물타기 시: X원"과 동일 SSOT·동일 식으로 요약 카드 익절 칸에 병기.
    //   recompute: round((P0 + 2·P0·0.936)/3 · 1.032) / 저장값: pk.take_profit_after_watering_price.
    const _tpAfter = _recompute
      ? Math.round(((_p0 + 2 * _p0 * WATERING_RATIO) / 3) * TAKE_PROFIT_RATIO)
      : pk.take_profit_after_watering_price;
    const buyV = _fmtKRW(_p0);
    const tpV = _tp != null ? _fmtKRW(_tp) : '—';
    const tpAfterV = _tpAfter != null ? _fmtKRW(_tpAfter) : null;
    const waterV = _watering != null ? _fmtKRW(_watering) : '—';
    const expiryV = pk.expiry_date || '—';
    const mark = _pm320ResultMark(pk);
    // mark.html 은 픽 진행중이면 "⏳ 잠정 +0.00% (D+0/+3)", 청산 완료면 결과(익절/만기). 부재 시 생략.
    const resultMod = mark ? mark.mod : 'running';
    const resultHtml = mark
      ? `<div class="cal-pm320-today-rec-result cal-pm320-today-rec-result--${resultMod}" aria-label="${escapeHtml(mark.aria)}">${escapeHtml(mark.html)}${mark.dateChip ? `<span class="pm320-rec-mark-date">${escapeHtml(mark.dateChip)}</span>` : ''}${mark.mddChip ? `<span class="pm320-rec-mark-mdd">${escapeHtml(mark.mddChip)}</span>` : ''}</div>`
      : '';
    const headLabel = isPast ? '이날의 추천' : '오늘 PM320 추천';
    // R28 P2 (조니 2심, 2026-06-11) — D+0 기준 시점 1줄 정의. "(D+1/+3)" 토큰이 정의 없이 노출돼
    //   손님이 기준일을 추측해야 했음. 진행중(running) mark 가 있는 카드에만 1줄 (청산 완료는 D 미노출).
    const _dNoteHtml = (mark && mark.mod === 'running')
      ? `<div class="cal-pm320-today-rec-dnote">D+0 = 추천일(진입 당일) · D+N = 진입 후 N번째 거래일</div>`
      : '';
    const nameV = name || '';
    const codeV = code || '';
    const titleAria = `${headLabel} ${nameV} ${codeV}`;
    return `<div class="cal-pm320-today-rec" role="group" aria-label="${escapeHtml(titleAria)}">
      <div class="cal-pm320-today-rec-head">
        <span class="cal-pm320-today-rec-star" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span>
        <span class="cal-pm320-today-rec-headlabel">${escapeHtml(headLabel)}</span>
        <span class="cal-pm320-today-rec-name">${escapeHtml(nameV)}</span>
        ${codeV ? `<span class="cal-pm320-today-rec-code">${escapeHtml(codeV)}</span>` : ''}
      </div>
      <div class="cal-pm320-today-rec-grid">
        <div class="cal-pm320-today-rec-cell"><span class="cal-pm320-today-rec-k">매수</span><span class="cal-pm320-today-rec-v">${escapeHtml(buyV)}</span></div>
        <div class="cal-pm320-today-rec-cell"><span class="cal-pm320-today-rec-k">익절${tpAfterV ? '<span class="cal-pm320-today-rec-k-cond">(조건부)</span>' : ''}</span><span class="cal-pm320-today-rec-v cal-pm320-today-rec-v--up">${escapeHtml(tpV)}</span>${tpAfterV ? `<span class="cal-pm320-today-rec-v-sub">물타기 후 익절가 ${escapeHtml(tpAfterV)}</span>` : ''}</div>
        <div class="cal-pm320-today-rec-cell"><span class="cal-pm320-today-rec-k">물타기</span><span class="cal-pm320-today-rec-v cal-pm320-today-rec-v--dn">${escapeHtml(waterV)}</span></div>
        <div class="cal-pm320-today-rec-cell"><span class="cal-pm320-today-rec-k">만기</span><span class="cal-pm320-today-rec-v">${escapeHtml(expiryV)}</span></div>
      </div>
      ${resultHtml}
      ${_dNoteHtml}
      ${codeV ? `<button class="cal-pm320-today-rec-more" type="button" data-rec-jump="${escapeHtml(codeV)}" aria-expanded="false" aria-label="${escapeHtml(nameV)} 추천 카드 상세 보기">상세 보기 <span aria-hidden="true">↓</span></button>` : ''}
    </div>`;
  };

  // 오늘의 종목: 거래대금 TOP을 base로, 카페·해석 정보 join
  let todayStocks;
  if (kiwoomStocks.length > 0) {
    todayStocks = kiwoomStocks.map((s, i) => {
      const interp = interpByName.get(s.name);
      // 등락률: cycle20 P1 — limit-up/down status_badges 우선 (build_daily SoT 결함 회피)
      // 그 외 stock JSON 종가 기준 우선 (키움 max_change_pct는 장중 최대라 부정확)
      const _limitEff = _extractLimitEffect(interp);
      const pct = _limitEff ? _limitEff.flu_rt : (interp?.change_pct ?? s.change_pct ?? s.max_change_pct ?? null);
      let themes;
      if (interp && Array.isArray(interp.themes) && interp.themes.length > 0) {
        themes = interp.themes.slice(0, 3).map(t => typeof t === 'string' ? { name: t } : t);
      } else {
        themes = (themesData?.stocks?.[s.ticker]?.themes || []).slice(0, 2);
      }
      // price도 limit-up 시 cur_prc 우선 (candle direction 정합). 비-limit = 마감 종가 SSOT(dailybars
      //   daily_20[-1].c, Q-20260606-111) 우선 → kiwoom last_price snapshot 보다 정본. (limit-up 라이브는 cur_prc 유지.)
      const _priceBase = _dailybarsClose(interp) ?? s.last_price ?? s.price ?? interp?.close_price;
      const price = _limitEff ? _limitEff.cur_prc : _priceBase;
      return { rank: i + 1, name: s.name, ticker: s.ticker, code: s.ticker, pct, amount: s.max_trade_amount ?? s.trade_amount, themes, interp, links: [], open: s.open ?? interp?.open_price, high: s.high ?? interp?.high_price, low: s.low ?? interp?.low_price, price, _source_union: s._source_union };
    });
  } else if (interpByName.size > 0) {
    // kiwoom JSON 없음 → stock-*.json (interpretedByName)에서 종목 구성
    todayStocks = [];
    let idx = 0;
    for (const [name, interp] of interpByName) {
      idx++;
      let themes = [];
      if (Array.isArray(interp.themes) && interp.themes.length > 0) {
        themes = interp.themes.slice(0, 3).map(t => typeof t === 'string' ? { name: t } : t);
      }
      // cycle20 P1 — limit-up/down status_badges 우선 (no-kiwoom 분기)
      const _limitEff = _extractLimitEffect(interp);
      const _pct = _limitEff ? _limitEff.flu_rt : (interp.change_pct ?? null);
      // Q-20260606-111 — 비-limit 종가 = dailybars SSOT(daily_20[-1].c) 우선 (interp.close_price snapshot 폐기).
      const _price = _limitEff ? _limitEff.cur_prc : (_dailybarsClose(interp) ?? null);
      todayStocks.push({
        rank: interp.rank || idx,
        name,
        code: interp.code || interp.ticker || '',
        ticker: interp.code || interp.ticker || '',
        pct: _pct,
        amount: interp.trade_amount ?? null,
        price: _price,
        open: interp.open_price ?? null,
        high: interp.high_price ?? null,
        low: interp.low_price ?? null,
        themes,
        interp,
        links
      });
    }
    // 거래대금 순 정렬
    todayStocks.sort((a, b) => (b.amount || 0) - (a.amount || 0));
    todayStocks.forEach((s, i) => { s.rank = i + 1; });
  } else {
    todayStocks = [];
  }

  // Phase 2c-1 (2026-05-23) — single-card mode 동적 분기
  // 본질: URL param `?stock={code}` 또는 `?stock={code}&date={date}` 진입 시
  //   todayStocks를 본 종목 1개만 filter → 단독 카드 render.
  // 외부 호출 사이트 (news.html fragment fetch 또는 외부 임베딩) 본 본 본 sparkline/chart-tv/bullish/status_badges
  //   본 본 전체 render 본 본 본 시각 일관성 본 본.
  // backward compat: ?stock= 본 본 본 본 본 본 본 기존 다중 카드 path (kiwoom.latest_stocks 전체).
  // Phase 2c-2 후행: news.html 또는 외부 페이지에서 fetch + innerHTML 임베딩 본 본 spec hint.
  let _isSingleCardMode = false;
  let _singleCardCode = null;
  try {
    if (typeof window !== 'undefined' && window.location) {
      const _urlParams = new URLSearchParams(window.location.search);
      const _qStock = _urlParams.get('stock');
      if (_qStock && /^\d{4,6}$/.test(_qStock)) {
        _singleCardCode = _qStock;
        _isSingleCardMode = true;
      }
    }
  } catch (_) { /* graceful */ }
  if (_isSingleCardMode && _singleCardCode) {
    const _filtered = todayStocks.filter(s => (s.ticker || s.code) === _singleCardCode);
    todayStocks = _filtered;
    // cycle23 (2026-05-23) — original rank 보존. 본질: 다중 카드 mode 본 거래대금 정렬+rank 부여 (line 555-556)
    //   완료 후 filter만 수행 → 본 종목 원래 순위 (예: #5, #12 등) 그대로 유지.
    //   이전: filter 직후 forEach((s, i) => { s.rank = i + 1; }) → 본 종목 rank 무조건 #1로 덮어쓰기 = 사고.
    //   대표 verbatim "단독 카드를 공유할 때 #1이라고 순위가 바뀌는데 원래 숫자를 그대로 보여줄 수 있어?" (2026-05-23 07:24 KST).
    // cycle23 Q-CYCLE23-002 Phase 2c-1-extend — single-card mode 페이지 frame 완전 격리.
    // 본질: body class `single-card-mode` 부여 → CSS `body.single-card-mode header/nav/footer/page-header/cal-side/theme-tree/limit-up-trend/theme-trend/theme-map` hide.
    // 대표 verbatim "정말로 종목카드만 하나 존재" (2026-05-23 02:15 KST) 정합.
    // backward compat: ?stock param 없으면 class 미부여 → 다중 카드 mode 본 페이지 frame 정상 표시.
    try {
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.add('single-card-mode');
      }
    } catch (_) { /* graceful */ }
  }

  // 메타
  const newsTotal = todayStocks.reduce((acc, i) => acc + (i.links ? i.links.length : 0), 0);
  const interpCount = todayStocks.filter(i => i.interp).length;
  // pick_count >= 2: 카드 chip "연속선정+N" 표시와 동일 정의 (DSN §3.6.3 단일 출처, cycle20 P1).
  // 이전 정의 (prev_pick != null) 은 어제 1회 등장 종목까지 포함 → 헤더 N종 vs 카드 chip 노출 종목수 mismatch.
  const streakCount = todayStocks.filter(i => (i.interp?.pick_count || 0) >= 2).length;
  const streakSuffix = streakCount > 0 ? ` · 연속선정 ${streakCount}종` : '';
  const sourceSuffix = '';
  // REQ-033 — 마지막 업데이트 시각 (SPEC-001 §I.4). build_daily.py generated_at 표시.
  // 시간대 정합 (개발팀 비판): naive ISO("YYYY-MM-DDTHH:MM:SS.fff") 직접 substring 추출 — Date 파싱 시 브라우저 timezone 의존성 회피. KST 가정 명시.
  // 대표 발화 (2026-05-27) — 라벨 "HH:MM 업데이트" → "HH:MM 기준" (live 오인 방지).
  //   stale (장중 30분+ 지연 등) 일 때만 앞에 점(•) + is-stale 클래스 → 정직한 신선도 표시. 차단 없음.
  const generatedAt = data.generatedAt || '';
  const lastSnapshotAt = data.lastSnapshotAt || '';
  // 테스트 hook: window._freshnessNow 설정 시 해당 시각으로 평가 (시뮬레이션용)
  const _nowMs = (typeof window !== 'undefined' && typeof window._freshnessNow === 'number') ? window._freshnessNow : Date.now();
  const _fresh = _computeFreshnessLabel(generatedAt, lastSnapshotAt, date, _nowMs);
  // Q-20260608-134 (대표 verbatim "마지막 갱신 라인은 필요가 없다. 이미 시간이 표시되고 있었으니까.
  //   시간이 표시가 되지않는 주말이나 휴장이 문제였던거지") — 별도 "마지막 갱신" 라인(Q-113) 폐기.
  //   본질 fix = 헤더 인라인 "HH:MM 기준" 시각을 주말·휴장에도 항상 노출.
  //   기존엔 generatedSuffix 가 국내장 generated_at 에만 의존 → 주말·휴장(거래 부재)엔 빈 값으로 사라졌다.
  //   소스 우선순위(실존 값만 — FLR-AGT-002 거짓 표시 차단):
  //     1) 국내장 build generated_at (평일 PM320 생성 시각)
  //     2) kiwoom 마지막 폴링 last_snapshot_at (장중/장후 스냅샷)
  //     3) 야간 미국증시 built_at_kst (주말·휴장 = 국내장 부재 시 최신 갱신 = 미장 빌드)
  //   세 소스 모두 부재 시 빈 값 → 미표시(거짓 추정 금지).
  const _nightlyBuiltAt = (data && data.nightlyUs && typeof data.nightlyUs.built_at_kst === 'string')
    ? data.nightlyUs.built_at_kst : '';
  const _freshSrc = generatedAt || lastSnapshotAt || _nightlyBuiltAt;
  const generatedSuffix = _freshSrc
    ? ` · ${_fresh.stale ? '<span class="cal-day-meta__dot" aria-hidden="true">•</span>' : ''}<span class="cal-day-meta__updated${_fresh.stale ? ' is-stale' : ''}">${escapeHtml(_formatGeneratedAt(_freshSrc))} 기준</span>`
    : '';
  // Q-20260606-113 — 주말·휴장 suppress 상태에서는 국내장 종목 수("N개")를 헤더에 노출하지 않는다
  //   (카드가 숨겨졌는데 "오늘의 종목 N개"는 모순). suppress 시 "주말·휴장" 라벨 + 항상 기준 시각.
  const _metaSuppressDomestic = (typeof window !== 'undefined' && window._pm320SuppressDomesticCards === true);
  // R27 P1④ (조니 2심, 2026-06-11) — 과거 날짜 페이지 day-meta "오늘의 종목"은 시점 거짓
  //   (보는 날짜 ≠ 오늘). 과거 날짜는 "이날의 종목"으로 날짜 기준 라벨 (R26 _dayWord 동형 패턴).
  const _nowMeta = new Date();
  const _todayMeta = `${_nowMeta.getFullYear()}-${String(_nowMeta.getMonth() + 1).padStart(2, '0')}-${String(_nowMeta.getDate()).padStart(2, '0')}`;
  const _dayWordMeta = (date && date < _todayMeta) ? '이날의' : '오늘의';
  // R28 P0-2 (조니 2심 확정, 2026-06-11) — 휴장일 자기모순 봉쇄. 과거 휴장일(예 6/3 지방선거,
  //   kiwoom 수집 데이터 실재) 뷰가 "이날의 종목: N개·시각 기준" 헤더 + 종목 카드 + "수집되지
  //   않은 날짜" 문구를 동시 렌더 → 휴장·수집·발행이 한 화면에서 모순. 휴장일 뷰는
  //   "M월 D일 (요일)은 휴장일입니다 — 픽이 발행되지 않는 날입니다." 한 줄만 (날짜·요일 동적).
  //   "수집되지 않은 날짜"는 비휴장 미수집일 전용 유지. 오늘(주말·휴장) 자동 폴백 suppress 뷰는
  //   기존 승인 동작(Q-20260606-113) 무회귀 — 과거 날짜(date < today)만 본 분기.
  const _isHolidayView = !_isSingleCardMode
    && typeof isMarketClosed === 'function'
    && !!(date && date < _todayMeta && isMarketClosed(date));
  const metaText = _isHolidayView
    ? `휴장일${generatedSuffix}`
    : (_metaSuppressDomestic
      ? `주말·휴장${generatedSuffix}`
      : (todayStocks.length > 0
        ? `${_dayWordMeta} 종목: ${todayStocks.length}개${streakSuffix}${sourceSuffix}${generatedSuffix}`
        : `—${generatedSuffix}`));

  // (1) 매크로 이벤트 (내러티브 폴백에도 사용)
  // R27 P1⑥ (조니 2심, 2026-06-11) — 의미 동일 사실 중복 칩 표시단 dedup (데이터 수정 0).
  const macroEvents = _dedupSimilarMacro(
    (data.macroEvents || []).filter(m => m.summary && m.summary.length >= 10)
  ).slice(0, 5);
  const macroHtml = macroEvents.length > 0
    ? `<div class="cal-macro-strip">${macroEvents.map(m => `<span class="cal-macro-chip" title="${escapeHtml(sanitize(m.title || ''))}">${escapeHtml(sanitize(m.summary))}</span>`).join('')}</div>`
    : '';

  // 내러티브: 카페 제거로 빈 값 (하위 호환용 유지)
  const narrPillsHtml = '';

  const renderFactors = (st) => {
    const ff = st.five_factors || {};
    const ev = st.five_factors_evidence || {};
    const labels = { freshness: '신선', durability: '지속', magnitude: '크기', spreadability: '전파', liquidity: '환급' };
    const entries = Object.entries(ff)
      .map(([k, v]) => ({ k, v, label: labels[k] || k, ev: ev[k] || '' }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3);
    return entries.map(e => {
      const filled = Math.round(e.v * 5);
      const dots = Array.from({ length: 5 }, (_, i) => `<span class="cal-dot ${i < filled ? 'on' : ''}"></span>`).join('');
      return `<span class="cal-factor" title="${escapeHtml(e.ev)}"><span class="label">${e.label}</span><span class="cal-dots">${dots}</span></span>`;
    }).join('');
  };

  const renderTodayCard = (it) => {
    const pct = it.pct;
    const dir = (pct ?? 0) >= 0 ? 'up' : 'down';           // 등락률 텍스트 색상용 (전일 대비)
    const candleDir = (it.open && it.price) ? (it.price >= it.open ? 'up' : 'down') : dir;  // 캔들/sparkline용 (시가 대비)
    const sign = (pct ?? 0) >= 0 ? '+' : '';
    const pctText = pct != null ? `${sign}${pct.toFixed(2)}%` : '';
    const amountText = it.amount ? fmtTradeAmount(it.amount) : '';
    // Q-20260515-CANDLE-SOURCE-UNIFY: 일봉캔들 OHLC를 daily_20[-1]과 동일 source 통일 (sparkline 정합).
    // it.price (라이브 cur_prc) ≠ daily_20[-1].c (dailybars close) mismatch 시 양봉/음봉 색상 mismatch 발생.
    // 대표 catch 23:34: 일봉캔들 vs sparkline 마지막 색상 mismatch (앤로보틱스 음봉 vs 양봉).
    const d20 = it.interp?.daily_20;
    const lastBar = (Array.isArray(d20) && d20.length > 0) ? d20[d20.length - 1] : null;
    const candleHtml = lastBar
      ? miniCandle(lastBar.o, lastBar.h, lastBar.l, lastBar.c, it.pct)
      : miniCandle(it.open, it.high, it.low, it.price, it.pct);
    // 테마칩: 같은 루트 트리는 합쳐서 중복 노드 제거
    // REQ-P1 #7 (2026-04-29): chip별 data-tooltip = 해당 노드가 속한 path 전체 ("부모 > 자식")
    const tp = it.interp?.theme_paths || [];
    const themesHtml = (() => {
      if (tp.length === 0) return it.themes.slice(0, 3).map(t => `<span class="cal-ind-chip">${escapeHtml(t.name)}</span>`).join('');
      // 같은 루트끼리 그룹핑 → 노드 합집합 (순서 유지)
      const groups = {};
      const groupOrder = [];
      tp.forEach(p => {
        const root = p.path[0];
        if (!groups[root]) { groups[root] = []; groupOrder.push(root); }
        groups[root].push(p.path);
      });
      return groupOrder.map((root, gi) => {
        const paths = groups[root];
        // 모든 경로의 노드를 순서 유지하며 합집합 + 노드별 가장 긴 path 기록
        const seen = new Set();
        const merged = [];
        const nodeFullPath = {}; // node → path 전체 (복수면 가장 긴 것)
        paths.forEach(path => {
          path.forEach(node => {
            if (!seen.has(node)) { seen.add(node); merged.push(node); }
            const cur = nodeFullPath[node];
            if (!cur || path.length > cur.length) nodeFullPath[node] = path;
          });
        });
        const chips = merged.map(s => {
          const fullPath = nodeFullPath[s] || [s];
          const tooltipText = fullPath.join(' > ');
          // 단일 노드(부모-자식 관계 없음)면 tooltip 생략
          const tooltipAttr = fullPath.length > 1 ? ` data-tooltip="${escapeHtml(tooltipText)}"` : '';
          return `<span class="cal-ind-chip"${tooltipAttr}>${escapeHtml(s)}</span>`;
        }).join('');
        return (gi > 0 ? '<span class="cal-theme-sep">│</span>' : '') + chips;
      }).join('');
    })();

    // 해석 있으면 full 카드 확장 (아래 if 블록), 없으면 같은 full 구조 + "뉴스 없음" placeholder (else 블록 하단)
    // 대표 지시 2026-04-22: compact 한 줄 분기 제거 — 카드 간 레이아웃 일관성 유지
    if (it.interp) {
      const st = it.interp;
      // R27 P1⑦ (조니 2심) — 분석가 화법(자료 메타 언급) 표시단 sanitize. 인과사슬 항목은
      //   메타 문장 제거 후 빈 항목 drop (생성 프롬프트 차단은 backend 별건).
      const causal = (st.causal_chain || []).slice(0, 3)
        .map((c) => _sanitizeAnalystVoice(c)).filter((c) => c && c.trim());
      const styledArrow = '<span class="arrow">→</span>';
      const causalHtml = causal.length > 0
        ? `<div class="cal-causal">${causal.map((c, i) => `${escapeHtml(sanitize(c)).replace(/→/g, styledArrow)}${i < causal.length - 1 ? styledArrow : ''}`).join('')}</div>`
        : '';
      // 뉴스 제목은 미표시 (대표 지시: 로봇 제목은 무가치. 인과사슬만 표시)
      const headlineHtml = '';
      // differentiator가 causal_chain과 동일하면 중복 제거
      const causalText = (causal[0] || '').trim();
      // R27 P1⑦ — differentiator/outlook 도 동일 sanitize (양끝 동시, FLR-20260428-TEC-001 동형 예방).
      const diffRaw = _sanitizeAnalystVoice((st.differentiator || st.outlook || '').trim());
      let ishikawaLine = (diffRaw && diffRaw !== causalText) ? diffRaw : '';
      // 뉴스 없는 종목: industry/sector로 fallback
      if (!ishikawaLine && !causalText) {
        const parts = [];
        if (st.industry) parts.push(st.industry);
        if (st.sector) parts.push(st.sector);
        ishikawaLine = parts.join(' · ');
      }
      const ishikawaHtml = ishikawaLine ? `<div class="cal-ishikawa-line">${escapeHtml(sanitize(ishikawaLine))}</div>` : '';
      // 공시 (DART) — 뱃지는 namecell, 목록은 카드 최하단
      // 2026-04-22 대표 정정: status_badges에 이미 표시되는 공시(투자경고 등)는 공시 리스트 itemsHtml에서 제외 (중복 방지)
      // REQ-030 §1 — 헤더 "공시" 배지는 모든 KRX 공시 포함 트리거 (SPEC-001 §III.4):
      //   - stock.disclosures.length > 0 OR status_badges.filter(source='disclosure').length > 0
      //   - 사용자가 헤더에서 공시 존재 인지 → 펼침 동기 제공
      // discListHtml(상세 영역)은 기존대로 STATUS_DISC_CATS 제외 (사유 박스에서 KRX 단계 공시 표시).
      const STATUS_DISC_CATS = ['투자주의', '투자경고', '투자위험', '단기과열', '단기과열예고', '관리종목', '매매거래정지', '상장폐지'];
      const allDiscs = st.disclosures || [];
      const discs = allDiscs.filter(d => !STATUS_DISC_CATS.includes(d.category));
      const krxDiscBadges = (st.status_badges || []).filter(b => b.source === 'disclosure');
      const totalDiscCount = allDiscs.length + (allDiscs.length === 0 ? krxDiscBadges.length : 0);
      let discBadgeHtml = '';
      let discListHtml = '';
      if (totalDiscCount > 0) {
        // REQ-039 표기 통일 — "공시+N" (1건도 +1).
        const discBadgeLabel = `공시+${totalDiscCount}`;
        const cbWarnEarly = allDiscs.some(d => d.is_cb) ? '<span class="cal-disc-cb-warn">CB</span>' : '';
        // REQ-030 §1 — 헤더 공시 배지 (SPEC-001 §III.4). 칩 디자인 (📋 아이콘 CSS ::before).
        discBadgeHtml = `<span class="cal-disclosure-badge" aria-label="공시 ${totalDiscCount}건">${escapeHtml(discBadgeLabel)}</span>${cbWarnEarly}`;
      }
      if (discs.length > 0) {
        const sentSum = discs.reduce((s, d) => s + (d.sentiment || 0), 0);
        const health = sentSum > 0 ? 'positive' : sentSum < 0 ? 'negative' : 'neutral';
        const hasCb = discs.some(d => d.is_cb);
        const cbWarn = hasCb ? '<span class="cal-disc-cb-warn">CB</span>' : '';
        const maxShow = 3;
        const shown = discs.slice(0, maxShow);
        const moreCount = discs.length - maxShow;
        const _DOW = ['일','월','화','수','목','금','토'];
        const formatDateWithDow = (s) => {
          if (!s) return '';
          const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (!m) return '';
          const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
          return `${m[1]}-${m[2]}-${m[3]}(${_DOW[dt.getUTCDay()]})`;
        };
        const formatPeriodText = (ps, pe) => {
          const a = formatDateWithDow(ps), b = formatDateWithDow(pe);
          if (a && b && a !== b) return `${a} ~ ${b}`;
          if (a && b) return a;
          if (a) return `${a} 부터`;
          if (b) return `~ ${b}`;
          return '';
        };
        const itemsHtml = shown.map(d => {
          const catCls = d.is_cb ? 'cal-disc-cat cb' : 'cal-disc-cat';
          const catLabel = d.category || '기타';
          const periodText = formatPeriodText(d.period_start, d.period_end);
          const periodHtml = periodText
            ? `<span class="cal-disc-period"><span class="cal-disc-period-label">기간</span>${escapeHtml(periodText)}</span>`
            : '';
          // v2.5: 조건 박스 제거 (대표 정정 16:57 KST) — 빨간 뱃지가 같은 정보. title 1줄 클램프.
          return `<a class="cal-disc-item" href="${escapeHtml(d.url || '#')}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(d.title)}"><span class="${catCls}">${escapeHtml(catLabel)}</span><span class="cal-disc-summary">${escapeHtml(d.title)}${periodHtml}</span><svg class="cal-disc-ext" width="10" height="10" viewBox="0 0 10 10"><path d="M3 1h6v6M9 1L4 6" stroke="currentColor" stroke-width="1.2" fill="none"/></svg></a>`;
        }).join('');
        const moreHtml = moreCount > 0 ? `<span class="cal-disc-more">+${moreCount}건 더보기</span>` : '';
        const codeId = it.code || it.name;
        const sectionId = `disc-${escapeHtml(codeId)}`;
        // REQ-030 §1 — discBadgeHtml은 위에서 이미 설정 (모든 KRX 공시 트리거).
        // 여기서는 discListHtml만 설정 (STATUS_DISC_CATS 제외 정합 유지).
        discListHtml = `<div class="cal-disc-section" id="${sectionId}">${itemsHtml}${moreHtml}</div>`;
      }
      // 뉴스 제목 + 링크 (제목 표시)
      const linkSeen = new Set();
      const sourceMap = {'hankyung.com':'한경','mk.co.kr':'매경','edaily.co.kr':'이데일리','biz.chosun.com':'조선비즈','etoday.co.kr':'이투데이','news.naver.com':'네이버','n.news.naver.com':'네이버'};
      const allLinks = [...(st.news_digest || []).map(n => ({ url: n.url, title: n.inferred_title, source: n.source })), ...(it.links || []).map(l => ({ url: l.url, title: '', source: '' }))];
      const uniqueLinks = allLinks.filter(l => { if (!l.url || linkSeen.has(l.url)) return false; linkSeen.add(l.url); return true; }).map(l => {
        const host = (() => { try { return new URL(l.url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } })();
        const src = l.source || sourceMap[host] || host;
        return { url: l.url, src };
      });
      // 소스명 중복 제거 — 같은 소스의 복수 기사는 첫 번째 URL로 대표
      const srcSeen = new Set();
      const dedupedLinks = uniqueLinks.filter(l => { if (srcSeen.has(l.src)) return false; srcSeen.add(l.src); return true; });
      const linksHtml = dedupedLinks.length > 0 ? `<div class="cal-feature-links">${dedupedLinks.map(l => {
        return `<a class="cal-feature-link" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sanitize(l.src))}</a>`;
      }).join('')}</div>` : '';
      // 연속 선정 메타 (부수적 정보 — 뉴스 요약과 분리)
      const pp = st.prev_pick;
      const pc = st.pick_count;
      // REQ-059 명명 재정정 — "연속선정" (REQ-039 "거래대금"이 맥락 부족 → "연속선정+N"으로 정정).
      const pickMeta = (pp && pc >= 2)
        ? `<div class="cal-pick-meta"><div class="cal-disc-item"><span class="cal-disc-cat streak">연속선정+${pc}</span><span class="cal-disc-summary">전일 순위 #${pp.rank} · ${fmtTradeAmount(pp.trade_amount)} · ${(pp.change_pct||0)>=0?'+':''}${(pp.change_pct||0).toFixed(2)}%</span></div></div>`
        : '';
      // 종목명 우측 거래대금 연속 선정 배지 (헤더): 2+ → "연속선정+N", 1이면 비표시
      const pickBadge = pc != null && pc >= 2
        ? `<span class="cal-streak-badge">연속선정+${pc}</span>`
        : '';
      // REQ-039 — 강세 배지 (헤더, 종목명 우측, pickBadge 옆).
      // REQ-048 본질: data-loader.js가 entry → interp 합성 시 bullish 필드 패스스루 (REQ-048 data-loader 정정).
      // 따라서 st(=it.interp).bullish_today/streak 참조가 올바름. it.bullish_today 폴백도 안전성 확보.
      // streak >= 1 + bullish_today=true 일 때만 노출. streak=1이면 "강세", 2+면 "강세+N".
      const bullishStreak = (st && st.bullish_streak) || it.bullish_streak || 0;
      const bullishToday = !!((st && st.bullish_today) || it.bullish_today);
      const bullishBadge = (bullishToday && bullishStreak >= 1)
        ? `<span class="cal-bullish-badge">${bullishStreak > 1 ? `강세+${bullishStreak}` : '강세'}</span>`
        : '';
      // REQ-020c — cal-credit-badge 폐기. KRX 무관 신용 사유(회사한도초과·ETF 등)는
      // utils.js collectEffectBadges에 creditRiskInfo로 전달 → "신용불가(오늘)" v95 형식 통일.
      // dedup으로 KRX disclosure credit-block과 중복 자연 차단.
      const creditBadgeHtml = '';
      // REQ-021 v9.6 §II + §IV — 신용 사유 박스는 renderCreditBlockReasonBox로 통합 (KRX 단계 + 증권사 사유).
      // 본 위치 별도 출력은 이중 노출 우려로 무력화. dead code 잔존 (회귀 안전성).
      // const creditReasonHtml = (st.credit_risk && st.credit_reason) ? (() => { ... })() : '';
      const creditReasonHtml = '';
      // 종목 상태 뱃지 (투자주의/경고/위험/단기과열)
      // REQ-020 v9.5 §II.3 — 헤더 = 효과 배지 (효과 + 시점). v9.3 통합 라벨(`dsn-v93-header-badge`) 대체.
      // SSOT: build_daily.py status_badges[].effect_badges[] (각 항목 = {effect, when, severity, source_label, source_kind}).
      // utils.js collectEffectBadges = 카드 단위 머지(A1) + 우선순위 정렬(A4) + dedup.
      // A4 우선순위: 거래정지 > 신용불가 > 단일가 / today > today_and_tomorrow > tomorrow (v9.8 — DSN-010 §I).
      // 최대 N=3 노출 + "+N" 표기.
      const _v92HeaderViewDate = date || '';
      const _v92AllBadges = st.status_badges || [];
      // REQ-020c — KRX 무관 신용 사유 합성 effect_badge 통합 (라벨 형식 통일).
      // st = it.interp (라인 296), data-loader.js:198 credit_risk = !!entry.credit_risk.
      const _v95CreditRiskInfo = (st && st.credit_risk)
        ? { credit_risk: true, credit_reason: st.credit_reason || '신용 제한' }
        : null;
      const _v95EffectBadges = (typeof collectEffectBadges === 'function')
        ? collectEffectBadges(_v92AllBadges, _v92HeaderViewDate, _v95CreditRiskInfo)
        : [];
      const _v95VisibleN = 3;  // A4 — 최대 3개 노출
      const _v95Overflow = Math.max(0, _v95EffectBadges.length - _v95VisibleN);
      const _v95Visible = _v95EffectBadges.slice(0, _v95VisibleN);
      const _v95EffectBadgesHtml = _v95Visible.map(eb => {
        const label = (typeof dsnV95FormatEffectBadge === 'function') ? dsnV95FormatEffectBadge(eb) : '';
        const title = (typeof dsnV95EffectBadgeTitle === 'function') ? dsnV95EffectBadgeTitle(eb) : label;
        const cls = `dsn-v95-effect-badge dsn-v95-effect-badge--${eb.effect} dsn-v95-effect-badge--when-${eb.when}`;
        const krxStage = eb.source_label || '';
        return `<span class="${cls}" data-krx-stage="${escapeHtml(krxStage)}" data-effect="${escapeHtml(eb.effect)}" data-when="${escapeHtml(eb.when)}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" role="button" tabindex="0">${escapeHtml(label)}</span>`;
      }).join('');
      // P2 함정 #4 — 가려진 효과 라벨 hover 텍스트 join (cropping bias 보강).
      const _v95MoreTitle = _v95Overflow > 0
        ? _v95EffectBadges.slice(_v95VisibleN)
            .map(eb => (typeof dsnV95FormatEffectBadge === 'function') ? dsnV95FormatEffectBadge(eb) : '')
            .filter(Boolean)
            .join(' / ')
        : '';
      const _v95MoreHtml = _v95Overflow > 0
        ? `<span class="dsn-v95-effect-badge dsn-v95-effect-badge--more" title="${escapeHtml(_v95MoreTitle || _v95Overflow + '건 추가')}" aria-label="${_v95Overflow}건 더 보기">+${_v95Overflow}</span>`
        : '';
      const _v95InnerHtml = _v95EffectBadgesHtml + _v95MoreHtml;
      const statusBadges = _v95InnerHtml
        ? `<span class="dsn-v95-effect-badges">${_v95InnerHtml}</span>`
        : '';
      // v9.2 §III: predicted only 카드 트리거 핀 (disclosure 0 + strict 미충족 predicted ≥1)
      const v92TriggerPinHtml = (typeof renderTriggerPin === 'function')
        ? renderTriggerPin(_v92AllBadges, _v92HeaderViewDate)
        : '';

      // 상태 뱃지 상세 v3 — 표 형태 + 기간 + 인사이트 (대표 정정 18:52 KST)
      // FLR-20260423-002 (P0-1, DSN-001 §15.5 / §17.4): 하드코딩 금지 원칙 단계 적용.
      // SSOT = rules/krx-stage-conditions.json → build_daily.py가 badge.auto_effects[]에 복제.
      // renderer는 badge.auto_effects[] 있으면 그것만 사용. 없으면 아래 _insightsFallback 사용.
      // 데이터 주입(data-dev) 완료 후 후속 PR에서 _insightsFallback 완전 삭제 예정.
      const _insightsFallback = {
        '투자주의': '이상 급등·거래량 급증 등 주의 신호가 포착된 종목입니다. 자동 규제는 없으며, 조건 지속 시 익일 투자경고 예고로 승급될 수 있습니다.',
        '투자경고': '신용거래 금지·위탁증거금 100% 현금·대용증권 불인정이 자동 적용됩니다. 지정 후 10거래일 경과 시 재심사로 해제 또는 투자위험 승급을 결정합니다.',
        '투자위험': '투자경고 효과(신용 금지·현금 증거금·대용 불인정)가 유지되며, 지정 직전 1거래일 매매거래정지가 적용됩니다. 승급 후 10거래일 경과 시 재심사.',
        '단기과열': '단기과열완화제도에 따라 D+2 1거래일 매매거래정지 후 D+3~D+5 3거래일간 30분 단위 단일가매매가 적용됩니다. D+5 자동 해제.',
        '단일가매매': '단기과열종목 지정에 따른 30분 단위 단일가매매 적용 기간입니다. 시장경보 3단계와 무관합니다.',
        '거래정지': '거래 정지 기간 — 정지 사유 해소 후 재개.',
        '관리종목': '관리종목 지정 — 신용거래·대용증권 불가, 미공시법인 추가 제재 가능.',
        '상장폐지': '상장폐지 절차 진행 — 정리매매 후 거래 종료.',
        '단기과열예고': '예고일부터 10거래일 이내 모든 조건 충족 시 단기과열 지정.',
      };
      // auto_effects 우선, 없으면 _insightsFallback 맵에서 label 기반 탐색.
      // auto_effects[]는 togusa JSON 직렬화 배열. 각 item: {id, label, quote, source_article}.
      const _resolveAutoEffects = (b) => {
        if (b && Array.isArray(b.auto_effects) && b.auto_effects.length > 0) {
          return b.auto_effects.map(e => (e && (e.quote || e.label)) || '').filter(Boolean);
        }
        return null; // null = 폴백 경로로 이동 신호
      };
      const _resolveInsightFallback = (label) => {
        for (const k in _insightsFallback) if (label.includes(k)) return _insightsFallback[k];
        return '';
      };
      // legacy API 유지 (v6 블록 호출부 호환). auto_effects 있으면 ul, 없으면 legacy 문구 폴백
      const _resolveInsight = (labelOrBadge) => {
        if (typeof labelOrBadge === 'object' && labelOrBadge !== null) {
          const ae = _resolveAutoEffects(labelOrBadge);
          if (ae) return ae.join(' · ');
          return _resolveInsightFallback(labelOrBadge.label || '');
        }
        return _resolveInsightFallback(labelOrBadge || '');
      };
      // v4: KRX 단계 진행 표 — "현재 X → 익일 Y 진입"
      // 라벨이 "X 예고"면 현재=X 직전 단계, 다음=X.
      // 라벨이 "X" (예고 없음)면 현재=X, 다음=X 다음 단계.
      const _stageNext = {
        '투자주의': '투자경고',
        '투자경고': '투자위험',
        '투자위험': '매매거래 정지',
        '단기과열': '단기과열 (1회 연장)',
      };
      const _stagePrev = {
        '투자경고': '투자주의',
        '투자위험': '투자경고',
        '단기과열': '단기과열 예고',
      };
      // 라벨에서 핵심 단계명 추출 (예: "투자경고 예고" → "투자경고", "[예고]" 제거 등)
      const _extractStage = (label) => {
        const cleaned = (label || '').replace(/[\[\]\(\)]/g, ' ').trim();
        const stages = ['투자주의', '투자경고', '투자위험', '단기과열', '관리종목', '상장폐지', '거래정지'];
        for (const s of stages) if (cleaned.includes(s)) return s;
        return '';
      };
      const _resolveProgress = (b) => {
        const label = b.label || '';
        const stage = _extractStage(label);
        if (!stage) return '';
        // v4: source='predicted'(자체 추정 라벨)는 "예상/근접" 텍스트 — 단계 진행 표시 생략
        // "예상/근접"은 가격 조건만 충족, 거래량 미검증 → 진짜 KRX 단계 진입 보장 X
        if ((b.source === 'predicted') || label.includes('예상') || label.includes('근접')) return '';
        const isNotice = label.includes('예고') || (b.view_date && b.start && b.view_date < b.start && !((b.source === 'predicted') || label.includes('예상') || label.includes('근접')));
        // FLR-011 v6: "현재" = view_date(t, 페이지 날짜). "익일" = t+1 거래일.
        // b.end/b.start는 공시 효력 기간 — "현재" 시점이 아님 (별도 기간 행에 표시).
        // view_date가 없고 b.start가 페이지 날짜보다 미래면 "현재"로 표기 금지 (예고 구간 오노출 차단).
        let curDate = b.view_date || '';
        if (!curDate) {
          if (b.start && (!date || b.start <= date)) {
            curDate = b.start;
          } else {
            // view_date 미주입 + start가 미래/없음 → "현재→다음" 표시 생략
            return '';
          }
        }
        let nextDate = b.next_trading_day || '';
        if (!nextDate) {
          try {
            const d = new Date(curDate + 'T00:00:00');
            d.setDate(d.getDate() + 1);
            nextDate = d.toISOString().slice(0, 10);
          } catch (e) {}
        }
        const dateText = nextDate ? `익일(${nextDate})` : '익일';
        if (isNotice) {
          // 예고 단계: 현재 = 직전 단계 (또는 "예고 상태"), 다음 = stage 본체
          const prev = _stagePrev[stage] || `${stage} 예고`;
          return `현재: ${prev} (${curDate}) → ${dateText} 조건 충족 시 ${stage} 진입`;
        }
        const next = _stageNext[stage];
        if (!next) return '';
        return `현재: ${stage} (${curDate}) → ${dateText} 조건 충족 시 ${next} 진입`;
      };
      // === v8 (DSN-20260425-DSN-002, REQ-010): 시제 분리 정보 위계 ===
      // §3·§4·§5.1·§6.1·§6.2 — 시제 칩 + 5줄 요약 + 🎯 thresholds + 통합 펼침.
      // 복수 배지는 시제 순서(현재 → 예측)로 배치 (§9 시나리오 A).
      const _v8FilteredBadges = (st.status_badges || []).filter(b =>
        b.thresholds || b.regulation || b.start || b.label || (b.single_price === true && (b.label || '').includes('단기과열'))
      );
      const _v8SortedBadges = dsnV8SortBadges(_v8FilteredBadges);
      const _v8AllDiscs = st.disclosures || [];
      const _v8DartByStage = (label) => {
        const stripped = dsnV8StripStageLabel(label || '');
        if (!stripped || _v8AllDiscs.length === 0) return '';
        const m = _v8AllDiscs.find(d => (d.category || '').includes(stripped));
        return (m && m.url) || '';
      };
      const _v8CtxFor = (b) => ({
        currentDate: date || b.view_date || '',
        stockCode: it.code || '',
        dartUrl: _v8DartByStage(b.label),
        stageDefinition: '',  // togusa krx-stage-rules.json 후속 주입
        regulationDetail: '', // togusa krx-stage-rules.json 후속 주입
        // v9.1 strict: getPredictedTenseVariant 인접 검증용 (4/24 027360 단계 도약 케이스 차단)
        allBadges: _v8SortedBadges,
      });
      // REQ-021 v9.6 §III.4 — 단계별 v6/v5 표 통째 무력화. 신용불가 사유 박스(§II)로 대체.
      // dsnV8RenderBlock·sections.push(v6SectionsHtml)·"준비 중" 폴백 등 모두 dead code 잔존 (회귀 1줄 부활 안전성).
      // const v8DetailHtml = _v8SortedBadges.map(b => dsnV8RenderBlock(b, _v8CtxFor(b))).join('');
      const v8DetailHtml = '';

      // === v6/v5.1 legacy 블록 통째 제거 (REQ-082 Phase2 — 2026-04-29) ===
      // statusDetailLegacyHtml + .map() 545줄 통째 폐기 (어디서도 사용 안 됨, FLR-20260429-FLR-001 §10).
      // 상한가 +N chip은 dsn-v95-effect-badges 시스템(utils.js limit-up effect)으로 이전 — 카드 head 영역 라이브 노출.
      // 회귀 시 git history (worktree-req-chip-recovery 이전) 에서 변수 + 545줄 블록 부활 가능.
      // REQ-021 v9.6 §I.1 — 그래프 박스 통째 제거 (이중 가드). utils.js renderStageFlowV9 무력화 정합.
      // 함수 자체는 첫 줄 return '' 보유 — 본 호출부도 명시 빈 문자열로 dead code 회귀 차단.
      const v9StageFlowHtml = '';
      // REQ-021 v9.6 §III.4 — predicted detail-only 영역도 명시 빈 문자열 (renderPredictedDetailOnly 자체도 첫 줄 return ''. 이중 가드)
      const v92PredictedDetailOnlyHtml = '';
      // REQ-021 v9.6 §IV.2 — 신용불가 사유 박스 (KRX 단계 + 증권사 사유 통합). 그래프 박스·v6 표 대체.
      const v96CreditBlockHtml = (typeof renderCreditBlockReasonBox === 'function')
        ? renderCreditBlockReasonBox(_v8SortedBadges, date || '', _v95CreditRiskInfo)
        : '';
      const statusDetailHtml = `${v96CreditBlockHtml}`;
      // causal 있으면 ishikawa는 details, 없으면 summary에 가므로 details 대상 아님
      const hasDetails = !!(statusDetailHtml || discListHtml || creditReasonHtml || (causalHtml && ishikawaHtml) || pickMeta);
      // toggle 요약 v3: period + label 만 (대표 정정 18:52 KST — 임계 정보는 표로 이동)
      const _badgeForSummary = (st.status_badges || []).find(b => b.start) || (st.status_badges || [])[0];
      let summarySnippet;
      if (_badgeForSummary) {
        const ps = _badgeForSummary.start || '';
        const pe = _badgeForSummary.end || '';
        const dateText = ps && pe && ps !== pe ? `${ps}~${pe}` : (ps || pe || '');
        const lbl = _badgeForSummary.label || '';
        summarySnippet = dateText ? `${dateText} ${lbl}`.trim() : lbl;
      } else if ((st.disclosures || []).length > 0) {
        summarySnippet = `공시 ${st.disclosures.length}건`;
      } else {
        summarySnippet = '';
      }
      // REQ-030 §2 — 접기 버튼 칩 디자인 (SPEC-001 §III.5). chevron-only 폐기.
      // 텍스트 "상세 보기" + 화살표 ▾ (CSS .cal-feature-card.expanded 시 회전 + ::after content "접기").
      const truncatedSummary = '';
      // REQ-045 §D — span → div 통일 (inline width:100% 무효 → 데스크탑 흐릿함 원인). chevron 폐기 (텍스트만).
      const chevronHtml = hasDetails
        ? `<div class="cal-detail-toggle" aria-label="상세 보기"><span class="cal-toggle-text">상세 보기</span></div>`
        : '';
      // REQ-064 (2026-04-28): v9.2 §III 트리거 핀 제거 — renderTriggerPin은 빈 문자열 반환 (utils.js).
      // v92TriggerPinHtml은 항상 ''이므로 조건/삽입 모두 무영향. 호출 보존(미래 부활 안전성).
      // DOC-20260603-DSN-001 §2 — PM320 PICK 배지 (좌측 첫 자리 prepend, 기존 배지 0건 수정).
      const pm320Pick = st.pm320_pick || null;
      // r5 (2026-06-11) — 과거 날짜 보기 판정(배지 "오늘"→"이날의"). 아래 divider 의 시점 판정과 동일 식.
      const _nowBadge = new Date();
      const _todayBadge = `${_nowBadge.getFullYear()}-${String(_nowBadge.getMonth() + 1).padStart(2, '0')}-${String(_nowBadge.getDate()).padStart(2, '0')}`;
      const _isPastBadge = !!(date && date < _todayBadge);
      const pm320PickBadge = _buildPm320PickBadge(pm320Pick, _isPastBadge);
      const badgesRowHtml = (pm320PickBadge || pickBadge || bullishBadge || discBadgeHtml || creditBadgeHtml || statusBadges || v92TriggerPinHtml)
        ? `<div class="cal-feature-badges">${pm320PickBadge}${statusBadges}${pickBadge}${bullishBadge}${discBadgeHtml}${creditBadgeHtml}${v92TriggerPinHtml}</div>`
        : '';
      // DOC-20260603-DSN-001 §3 — PM320 추천/결과 row (default 접힘, 모든 카드).
      // Q-20260606-111 — 매매 진입가 SSOT = 카드 마감 종가(daily_20[-1].c = dailybars close, Q-20260515-CANDLE-
      //   SOURCE-UNIFY 정합). pk.entry_price(pick 시점 stale 가능)와 다르면 본 값 우선 + 물타기·익절 재계산.
      //   chain: daily_20[-1].c → interp.close_price → range_240d.current (모두 dailybars close 동일 소스).
      const _d20Last = (Array.isArray(it.interp?.daily_20) && it.interp.daily_20.length > 0)
        ? it.interp.daily_20[it.interp.daily_20.length - 1] : null;
      const _pm320AuthClose = (_d20Last && typeof _d20Last.c === 'number') ? _d20Last.c
        : (typeof it.interp?.close_price === 'number' ? it.interp.close_price
          : (typeof it.interp?.range_240d?.current === 'number' ? it.interp.range_240d.current : null));
      const pm320RecRowHtml = _buildPm320RecRow(pm320Pick, it.code || '', _pm320AuthClose);
      // 테마 칩은 링크 아래 별도 줄
      const sparkHtml = it.interp?.intraday
        ? `<div class="cal-feature-sparkline">${buildSparkline(it.interp.intraday.prices, it.interp.intraday.base ?? it.interp.intraday.open, candleDir)}</div>`
        : '<div class="cal-feature-sparkline cal-spark-empty"></div>';
      // REQ-pm320-ux-cycle #3 — 20영업일 일봉 캔들 (sparkline 우측, 모바일은 CSS로 sparkline 숨김 + candles20만).
      const d20 = it.interp?.daily_20;
      // #4 안전망: daily_20 마지막 봉 일자 < 카드 일자 시 라벨 노출 (design-news-time-state-v1, catch 2)
      // 위치 변경: candles20 내부 absolute → cal-feature-meta sibling으로 이동 (PRE_MARKET 자연 봉쇄 + 11px 가독성).
      // 텍스트 정정: "데이터 05/07" → "5/7 종가 기준" (의미 명료).
      let candles20Html;
      let staleMetaHtml = '';

      // P0-23 Fix-79 (2026-05-21 19:38 KST 대표 verbatim
      //   "제주반도체 일봉캔들 영웅문을 보면 강세 날짜가 상당히 많다. 그런데 오늘 하루만 강세로 표시가 된다"):
      //   분홍 vertical line 본문 SoT (backend) 직접 사용 본질 — P0-21 backend rollout cascade.
      //   - P0-18 Fix-61 backward derive (streak=N → daily_20 마지막 N건) 본질 폐기
      //   - root cause = streak 본문 "연속 강세 N영업일" 본질 (오늘 + N-1일 cap) → 강세 history 단속 영업일 (예: 4/24, 5/14 등 비연속) 부재
      //   - SoT = backend build_daily.py L3188 entry["bullish_dates"] (list[str] YYYY-MM-DD, 30일 range 강세 영업일 모두)
      //   - data-loader.js Fix-79 (L240) bullish_dates pass-through 본문 합성 → it.bullish_dates / it.interp.bullish_dates
      //
      //   §11.15 외부 spec 사전 검증 PASS:
      //     - build_daily.py _prefetch_bullish_info L2509-2609 verbatim grep (30일 range 강세 영업일 list[str])
      //     - build_daily.py L3188 entry["bullish_dates"] = bullish_dates verbatim grep
      //     - 라이브 evidence: curl 본문 제주반도체 080220 → bullish_dates 4건 ['2026-04-24','2026-05-14','2026-05-18','2026-05-21']
      //     - 영웅문 image 797cf4ef direct read evidence: 제주반도체 분홍 vertical line 4건+ visible (4/24, 5/14, 5/18, 5/21)
      //
      //   §16 self-catch:
      //   - bullish_dates 부재 path (old data / IPO 첫날 등) → backward derive 폴백 본문 graceful 유지
      //   - 광전자 (#2) bullish_today=false 본문 → bullish_dates 부재 / 빈 array → 분홍 vertical line 0건 정합
      const _bullishDatesRaw = (Array.isArray(it.bullish_dates) ? it.bullish_dates : null)
        || (it.interp && Array.isArray(it.interp.bullish_dates) ? it.interp.bullish_dates : null);
      let _pinkSignalDates = [];
      if (Array.isArray(_bullishDatesRaw) && _bullishDatesRaw.length > 0) {
        // SoT 직접 사용 — backend 본문 30일 range 모든 강세 영업일 (오름차순, today 마지막)
        _pinkSignalDates = _bullishDatesRaw.filter(d => typeof d === 'string' && d.length === 10);
      } else {
        // 폴백 — bullish_dates 부재 path (old data) backward derive 본문 graceful 유지
        const _bullishToday = !!(it.bullish_today || (it.interp && it.interp.bullish_today));
        const _bullishStreak = (it.bullish_streak || (it.interp && it.interp.bullish_streak)) || 0;
        if (_bullishToday && _bullishStreak >= 1 && Array.isArray(d20) && d20.length >= 1) {
          const _streakN = Math.min(_bullishStreak, d20.length);
          for (let _i = d20.length - _streakN; _i < d20.length; _i++) {
            const _bar = d20[_i];
            if (_bar && _bar.date) _pinkSignalDates.push(_bar.date);
          }
        }
      }

      // Q-20260512-FRESH-LISTING-DATA — 자연 데이터 1건 이상이면 그대로 렌더.
      // 신규 상장(코스모로보틱스 5/11)은 build_daily가 1건 적재 → 자연 노출 (합성 폐기).
      if (Array.isArray(d20) && d20.length >= 1) {
        const lastBarDate = d20[d20.length - 1]?.date;
        const isStale = lastBarDate && date && lastBarDate < date;
        if (isStale) {
          const md = lastBarDate.slice(5).replace('-', '/').replace(/^0/, '');
          staleMetaHtml = `<div class="cal-feature-stale-note" aria-label="가격 데이터 시점">${md} 종가 기준</div>`;
        }
        // cycle22 P1: 미니캔들 클릭 → 확대 차트 expand. data-daily20 = 20영업일 raw (JSON stringified).
        // Phase 3 240일 backend swap 시 data-daily20을 240bar로 교체 가능 (구조 변경 없음).
        const _d20Json = JSON.stringify(d20).replace(/"/g, '&quot;');
        // P0-18 Fix-61: data-pinksignal attribute 본문 신축 (bullish 종목 본문만 visible).
        const _pinkAttr = _pinkSignalDates.length > 0
          ? ` data-pinksignal="${JSON.stringify(_pinkSignalDates).replace(/"/g, '&quot;')}"`
          : '';
        // SPEC §5.6 MAJOR-1 — aria-controls anchor (stable id `chart-{code}` slot 측 정합)
        candles20Html = `<div class="cal-feature-candles20" data-expand-trigger="chart" data-daily20="${_d20Json}"${_pinkAttr} role="button" tabindex="0" aria-label="20영업일 일봉, 클릭 시 확대 차트" aria-expanded="false" aria-controls="chart-${escapeHtml(it.code || '')}">${buildCandles20(d20)}</div>`;
      } else {
        // cycle21 P1 (2026-05-20 15:57 KST) — IPO 첫날 일봉 spec 정합 (장대양봉 → 점상 fix).
        // 본질: build_daily가 IPO 첫날 종목(마키나락스 477850 등)은 daily_20=None 적재 → 미니캔들 빈 영역.
        // 대표 catch 15:08 (cycle20): "마키나락스는 일봉캔들차트가 보이지 않는다" → frontend 폴백 신설.
        // 대표 catch 15:57 (cycle21): "마키나락스 일봉캔들의 경우 점상인데 장대양봉 처럼 보이는 이유가 뭐지".
        // 본질 evidence (WebSearch 2건 corroborating 2026-05-20):
        //   - 서울경제/뉴스핌: 마키나락스 5/20 시초가 60,000원 형성 + 개장 직후 상한가 직행 (공모가 15,000원 ×4 따따블).
        //   - 한국 시장 관습: '점 상한가(쩜상)' = 시초가가 상한가에서 시작 → OHLC 모두 동일.
        // 일봉차트 spec (영웅문 정합):
        //   - 일봉 OHLC = '거래 가격' 기준 (시초가/고가/저가/종가). 공모가(청약 가격)는 일봉 OHLC에 포함 안 됨.
        //   - IPO 첫날 점상: o = h = l = c = 시초가 (60,000) → mini-candle.js L31-32 isFlat 분기 → 회색 horizontal line.
        //   - 공모가 정보(15,000)는 title hover에 정보 가치 보존 (사용자 학습 효과).
        // before (cycle20): o=공모가, c=현재가 → 장대양봉 (잘못된 일봉 semantic).
        // after (cycle21): o=시초가, c=현재가, h/l=시초가·현재가·intraday prices (공모가 제외) → 점상 또는 정상 캔들.
        // 영웅문 spec 가정 (lead 추정 — 직접 캡처 부재): IPO 첫날 시초가 동결 시 점상 표시. 영웅문 캡처 evidence 부재 시 대표 cross-check 의무.
        const _themes = it.interp?.themes || it.themes || [];
        const _isIpoFirst = _themes.some(t => {
          const _tname = typeof t === 'string' ? t : (t && t.name) || '';
          return _tname === '신규상장' || _tname.includes('신규상장');
        });
        const _intra = it.interp?.intraday;
        const _ipoBase = _intra?.base; // 공모가 (title hover 정보 보존용)
        const _ipoOpen = _intra?.open ?? it.interp?.open_price ?? it.open; // 시초가 (일봉 OHLC의 o)
        const _ipoClose = it.interp?.close_price ?? it.price ?? (Array.isArray(_intra?.prices) && _intra.prices.length ? _intra.prices[_intra.prices.length - 1] : null);
        const _intraPricesValid = Array.isArray(_intra?.prices) ? _intra.prices.filter(p => typeof p === 'number' && p > 0) : [];
        if (_isIpoFirst && _ipoClose && _ipoClose > 0) {
          // 1-bar synthesis: 일봉 OHLC = 거래 가격 기준 (공모가 제외).
          // 시초가 fallback: _ipoOpen 부재 시 _ipoClose 사용 (점상 보장).
          const _openPrice = (_ipoOpen && _ipoOpen > 0) ? _ipoOpen : _ipoClose;
          const _allPoints = [_openPrice, _ipoClose, ..._intraPricesValid];
          const _ipoHigh = Math.max(..._allPoints);
          const _ipoLow = Math.min(..._allPoints);
          const _ipoBar = [{
            date: date,
            o: _openPrice,
            h: _ipoHigh,
            l: _ipoLow,
            c: _ipoClose,
          }];
          // title: 공모가 정보 보존 (있을 때만), 일봉 OHLC는 시초가→현재가 명시.
          const _titleParts = [`IPO 첫날 일봉`];
          if (_ipoBase && _ipoBase > 0) _titleParts.push(`공모가 ${_ipoBase.toLocaleString()}원`);
          _titleParts.push(`시초가 ${_openPrice.toLocaleString()}원 → 현재가 ${_ipoClose.toLocaleString()}원`);
          const _title = _titleParts.join(' / ');
          // cycle22 P1: IPO 1-bar 합성도 클릭 trigger 부여. 보조지표 대부분은 데이터 부족 placeholder 표시.
          const _ipoJson = JSON.stringify(_ipoBar).replace(/"/g, '&quot;');
          // SPEC §5.6 MAJOR-1 — aria-controls anchor (stable id `chart-{code}` slot 측 정합)
          candles20Html = `<div class="cal-feature-candles20 cal-candles20-ipo" data-expand-trigger="chart" data-daily20="${_ipoJson}" role="button" tabindex="0" aria-label="IPO 첫날 일봉, 클릭 시 확대 차트" aria-expanded="false" aria-controls="chart-${escapeHtml(it.code || '')}" title="${_title}">${buildCandles20(_ipoBar)}</div>`;
        } else {
          candles20Html = '<div class="cal-feature-candles20 cal-candles20-empty"></div>';
        }
      }

      // 240영업일 가격 레인지 바 (REQ-001 Phase 2 안 B / 레이아웃 v2 — 4행 분해)
      const r240 = it.interp?.range_240d;
      let rangeHtml = '';
      if (r240 && r240.high > 0 && r240.low > 0 && r240.current) {
        const span = r240.high - r240.low;
        const markerLeft = span > 0
          ? Math.max(0, Math.min(100, ((r240.current - r240.low) / span) * 100))
          : 50;
        const lowFillPct = 0;
        const highFillPct = markerLeft;
        const fmtPct = (v) => {
          if (v == null) return '';
          const sign = v > 0 ? '+' : '';
          return `${sign}${v.toFixed(1)}%`;
        };
        // 대표 지시 (2026-04-25 09:31~09:32):
        // - 신고가/신저가 양 끝 갱신 시 텍스트로 표시 ('신고가'/'신저가')
        // - 좌측 신저가 → 파랑(.down), 우측 신고가 → 빨강(.up)
        const isNewLow = r240.low === r240.current;
        const isNewHigh = r240.high === r240.current;
        const lowText = isNewLow ? '신저가' : fmtPct(r240.low_pct);
        const highText = isNewHigh ? '신고가' : fmtPct(r240.high_pct);
        const lowCls = isNewLow ? 'down' : ((r240.low_pct ?? 0) >= 0 ? 'up' : 'down');
        const highCls = isNewHigh ? 'up' : ((r240.high_pct ?? 0) <= 0 ? 'down' : 'up');
        rangeHtml = `<div class="stock-range v2">
          <div class="range-bar">
            <div class="range-fill" style="--low-pct:${lowFillPct}%;--high-pct:${highFillPct}%"></div>
            <div class="range-marker" style="left:${markerLeft}%"></div>
          </div>
          <div class="range-row range-prices">
            <span class="r-low">${r240.low.toLocaleString('ko-KR')}원</span>
            <span class="r-now">${r240.current.toLocaleString('ko-KR')}원</span>
            <span class="r-high">${r240.high.toLocaleString('ko-KR')}원</span>
          </div>
          <div class="range-row range-pcts">
            <span class="r-low ${lowCls}">${lowText}</span>
            <span class="r-now r-now-label">현재</span>
            <span class="r-high ${highCls}">${highText}</span>
          </div>
          <div class="range-row range-dates">
            <span class="r-low">${escapeHtml(r240.low_date || '')}</span>
            <span class="r-now">${escapeHtml(date || '')}</span>
            <span class="r-high">${escapeHtml(r240.high_date || '')}</span>
          </div>
        </div>`;
      }
      // 메타 줄 (등락률 | 거래대금) — 좌측 정렬·파이프 구분·거래대금 골드 (대표 정정 v2.2)
      // PM320-D6 P1 — 용어 (?) 는 첫 카드(#1)에만 부착 (반복 (?) 노이즈 회피, "첫 등장" 원칙).
      //   양봉/음봉(candle)·거래대금(trade-amount) 풀이를 메타 줄에 그룹화.
      const metaRow = `<div class="cal-feature-meta">
        <span class="cal-feature-pct ${dir}">${pctText}</span>${it.rank === 1 ? _termTip('candle') : ''}
        <span class="cal-meta-sep">|</span>
        <span class="cal-trade-amount">${amountText}${it.rank === 1 ? _termTip('trade-amount') : ''}</span>
      </div>`;
      const _idAttr_full = it.code ? ` id="stock-${escapeHtml(it.code)}"` : '';
      // Q-20260519-CYCLE19-009 + cycle20 P1 (2026-05-20) — LU(상한가) 좌측 accent bar 시각 구분.
      // 기존: _source_union='limit_up' 단일 조건 → kiwoom.latest_stocks 內 상한가(녹십자엠에스 등) 누락.
      // 본질 fix: status_badges effect='limit-up' OR _source_union='limit_up' → source 무관 일관 적용 (대표 catch 15:08).
      const _isLU_full = it._source_union === 'limit_up' || _hasLimitUpEffect(it.interp);
      const _luClass_full = _isLU_full ? ' cal-feature-card--lu' : '';
      const _luAria_full = _isLU_full ? ' aria-label="상한가 종목"' : '';
      // DOC-20260603-DSN-001 §2.3 — PICK 좌측 액센트바 골드 (--lu 빨강 우선, §7.2 정합)
      const _isPm320Pick_full = !!(pm320Pick && pm320Pick.is_pick);
      const _pm320PickClass_full = _isPm320Pick_full ? ' cal-feature-card--pm320-pick' : '';
      // aria-label 결합 (--lu + PICK)
      let _ariaCombined_full = '';
      if (_isLU_full && _isPm320Pick_full) {
        _ariaCombined_full = ' aria-label="상한가 · PM320 추천 종목"';
      } else if (_isPm320Pick_full) {
        _ariaCombined_full = ' aria-label="PM320 추천 종목"';
      } else if (_isLU_full) {
        _ariaCombined_full = _luAria_full;
      }
      // PM320-D6 R22 (오전 동선, "단 한 종목" 시각 격리) — PICK 풀카드 직상에 "오늘의 추천" 구분 헤더
      //   prepend(카드 외부 sibling). 종목 카드 무리(거래대금 TOP)와 추천 1종을 경계로 분리.
      // R23 P1 (대표 catch, 과거 날짜 시점 오류) — 종전 divider 라벨이 "오늘의 추천" 하드코딩이라 과거
      //   날짜(예: 6/1 LG씨엔에스) 보기에서도 "오늘의 추천"으로 표시(요약 카드 headLabel·sticky 칩은
      //   이미 isPast 분기 있으나 본 divider 만 누락). date < KST 오늘이면 "이날의 추천"으로 강등
      //   (요약 카드 L1556 / picked card aria 와 동일 시점 SoT). _todayDivIso 직접 산출(스코프 독립).
      const _todayDivIso = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })();
      const _isPastDiv = !!(date && date < _todayDivIso);
      const _pickDividerLabel = _isPastDiv ? '이날의 추천' : '오늘의 추천';
      const _pickDivider_full = _isPm320Pick_full
        ? `<div class="cal-pm320-pick-divider" aria-hidden="true"><span class="cal-pm320-pick-divider-star"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span>${_pickDividerLabel}</div>`
        : '';
      return `
        ${_pickDivider_full}
        <div class="cal-feature-card v2${_luClass_full}${_pm320PickClass_full}"${_idAttr_full}${_ariaCombined_full} data-stock-code="${escapeHtml(it.code || '')}" data-stock-name="${escapeHtml(it.name || '')}" data-card-date="${escapeHtml(date || '')}">
          ${renderShareButton(it)}
          <div class="cal-feature-head v2">
            <div class="cal-feature-head-left">
              <div class="cal-trade-rank">#${it.rank}</div>
              <div class="cal-trade-candle">${candleHtml}</div>
              ${sparkHtml}
              ${candles20Html}
            </div>
            <div class="cal-feature-head-right">
              <div class="cal-feature-namecell">
                <span class="cal-feature-name">${escapeHtml(it.name)}</span>
              </div>
              ${metaRow}
              ${staleMetaHtml}
            </div>
          </div>
          ${rangeHtml}
          ${badgesRowHtml}
          <div class="cal-feature-body">
            ${headlineHtml || ishikawaHtml || causalHtml || linksHtml || discListHtml || themesHtml || pickMeta || pm320RecRowHtml
              ? `<div class="cal-feature-summary">${causalHtml || ishikawaHtml}${themesHtml ? `<div class="cal-theme-row">${themesHtml}</div>` : ''}${linksHtml}${pm320RecRowHtml}${hasDetails ? `<div class="cal-detail-toggle" aria-label="상세 보기"><span class="cal-toggle-text">상세 보기</span></div>` : ''}</div>${hasDetails ? `<div class="cal-feature-details">${statusDetailHtml}${discListHtml}${creditReasonHtml}${causalHtml ? ishikawaHtml : ''}${pickMeta}${(typeof renderMicroDisclaimerIfShared === 'function') ? renderMicroDisclaimerIfShared() : ''}</div>` : ''}`
              : `<div class="cal-feature-news-empty">뉴스 분석 대기 중</div>`}
          </div>
        </div>`;
    }

    // ===== interp 없음: full 카드 구조 유지 + "뉴스 없음" placeholder =====
    // 대표 지시 (B안, 2026-04-22 16:07 KST): 레이아웃 일관성 유지. compact 한 줄 폐지.
    // kiwoom JSON 기반 데이터만 사용 (range_240d/intraday/news 없음 → 해당 영역은 생략 또는 placeholder)
    const compactPC = it.interp?.pick_count;
    // REQ-059 표기 재정정 — "연속선정+N" (REQ-039 "거래대금"이 맥락 부족).
    const compactBadge = compactPC != null && compactPC >= 2
      ? `<span class="cal-streak-badge">연속선정+${compactPC}</span>`
      : '';
    // REQ-048 — no-interp 카드 (와이제이링크 등)에도 강세 배지 노출.
    // it.interp 부재 케이스: it.bullish_today/streak 직접 참조 (entry 루트 패스스루).
    // it.interp 존재 케이스: data-loader 합성된 interp 객체에서 추출.
    const compactBullishStreak = it.interp?.bullish_streak || it.bullish_streak || 0;
    const compactBullishToday = !!(it.interp?.bullish_today || it.bullish_today);
    const compactBullishBadge = (compactBullishToday && compactBullishStreak >= 1)
      ? `<span class="cal-bullish-badge">${compactBullishStreak > 1 ? `강세+${compactBullishStreak}` : '강세'}</span>`
      : '';
    // 테마 칩: interp 없어도 it.themes는 kiwoom merge 단계에서 있을 수 있음
    const simpleThemesHtml = (it.themes && it.themes.length > 0)
      ? `<div class="cal-theme-row">${it.themes.slice(0, 3).map(t => `<span class="cal-ind-chip">${escapeHtml(t.name)}</span>`).join('')}</div>`
      : '';
    // sparkline: intraday 없음 → 빈 영역(full 카드와 정렬 맞춤)
    const emptySparkHtml = '<div class="cal-feature-sparkline cal-spark-empty"></div>';
    // range bar: 데이터 부재 → 생략 (대표 지시: 빈 공간 두지 말 것)
    // 메타 줄 (등락률 | 거래대금)
    // PM320-D6 P1 — 용어 (?) 는 첫 카드(#1)에만 (no-interp 분기 정합, full 카드와 동일).
    const metaRow = `<div class="cal-feature-meta">
      <span class="cal-feature-pct ${dir}">${pctText}</span>${it.rank === 1 ? _termTip('candle') : ''}
      <span class="cal-meta-sep">|</span>
      <span class="cal-trade-amount">${amountText}${it.rank === 1 ? _termTip('trade-amount') : ''}</span>
    </div>`;
    // 본문: 뉴스 부재 placeholder — 기존 .cal-feature-news-empty 스타일 재사용.
    // PM320-D6 P1 (손님 판정 — "빈 깡통" 인상) — "관련 뉴스 없음"(9연속 동일) → 톤 개선.
    //   뉴스가 없는 건 사실이므로 거짓 없이(FLR-AGT-002) 표현만 부드럽게: 수집 시 자동 표시됨을 안내.
    const _newsEmptyHtml = `<div class="cal-feature-news-empty">이 종목 관련 속보는 아직 없습니다<span class="cal-feature-news-empty-sub">뉴스가 수집되면 자동으로 표시됩니다</span></div>`;
    const emptyBodyHtml = simpleThemesHtml
      ? `${simpleThemesHtml}${_newsEmptyHtml}`
      : _newsEmptyHtml;
    const _idAttr_nointerp = it.code ? ` id="stock-${escapeHtml(it.code)}"` : '';
    // Q-20260519-CYCLE19-009 + cycle20 P1 (2026-05-20) — LU(상한가) 좌측 accent bar (no-interp 분기 정합)
    // status_badges effect 우선 (it.interp 없어도 it.status_badges 패스스루 시 동작), _source_union 폴백.
    const _isLU_nointerp = it._source_union === 'limit_up' || _hasLimitUpEffect(it.interp) || _hasLimitUpEffect(it);
    const _luClass_nointerp = _isLU_nointerp ? ' cal-feature-card--lu' : '';
    const _luAria_nointerp = _isLU_nointerp ? ' aria-label="상한가 종목"' : '';
    return `
      <div class="cal-feature-card v2 no-interp${_luClass_nointerp}"${_idAttr_nointerp}${_luAria_nointerp} data-stock-code="${escapeHtml(it.code || '')}" data-stock-name="${escapeHtml(it.name || '')}" data-card-date="${escapeHtml(date || '')}">
        ${renderShareButton(it)}
        <div class="cal-feature-head v2">
          <div class="cal-feature-head-left">
            <div class="cal-trade-rank">#${it.rank}</div>
            <div class="cal-trade-candle">${candleHtml}</div>
            ${emptySparkHtml}
          </div>
          <div class="cal-feature-head-right">
            <div class="cal-feature-namecell">
              <span class="cal-feature-name">${escapeHtml(it.name)}</span>
              ${compactBadge}
              ${compactBullishBadge}
            </div>
            ${metaRow}
          </div>
        </div>
        <div class="cal-feature-body">
          ${emptyBodyHtml}
        </div>
      </div>`;
  };

  const rankingBanner = '';

  // Q-20260605-103 Phase 3 — 야간 미국증시 요약 섹션 (날짜 헤드 ↔ "오늘의 뉴스요약" 사이).
  //   DSN §3.6.9. data.nightlyUs 부재/null 시 빈 문자열 → 섹션 전체 미렌더 (FLR-AGT-002).
  //   single-card mode 에서도 미표시 (외부 임베딩 단독 카드 = 미국증시 무관).
  const _nightlyUsHtml = (!_isSingleCardMode) ? _buildNightlyUsHtml(data && data.nightlyUs, date) : '';

  // Phase 2c-1 (2026-05-23) — single-card mode 본 본 section title / 뉴스요약 / macro / ranking 본 본 hide.
  // 단독 카드 본 본 본 본 본 본 sparkline + chart-tv + bullish lines + status_badges 전체 본 본 본 본 본 본.
  // R28 P1① (조니 2심, 2026-06-11) — 과거 뷰 "오늘의 뉴스요약" 시점 거짓 → "M월 D일 뉴스 요약"
  //   (날짜 동적, _dayWordMeta 동형 패턴). 오늘 뷰는 종전 라벨 유지 (무회귀).
  const _newsTitleLabel = (date && date < _todayMeta)
    ? `${parseInt(date.slice(5, 7), 10)}월 ${parseInt(date.slice(8, 10), 10)}일 뉴스 요약`
    : '오늘의 뉴스요약';
  const _sectionTitleHtml = _isSingleCardMode ? '' : `<div class="cal-section-title">${escapeHtml(_newsTitleLabel)}</div>`;
  const _narrPillsHtmlOut = _isSingleCardMode ? '' : narrPillsHtml;
  const _macroHtmlOut = _isSingleCardMode ? '' : macroHtml;
  const _rankingBannerOut = _isSingleCardMode ? '' : rankingBanner;
  // PM320-D6 (손님 판정 R1, 대표 결정 2026-06-10) — 4/8 이후 트랙레코드 승률 카드.
  //   대표 결정: 수익률 X, "4/8 이후 승률"만 공개. data.pm320Summary (build_summary 산출) 에서 렌더.
  //   🔴 수익률·손익% 0건 (승률·익절수·손실수만). 손실 건수 숨기지 않고 병기 (정직성, FLR-AGT-002).
  //   summary null(404·schema 미달) 또는 settled=0 시 미렌더 (추정 표시 금지). 단독모드 hide.
  const _pm320WinRateHtml = (() => {
    if (_isSingleCardMode) return '';
    const s = data && data.pm320Summary;
    if (!s || typeof s.settled !== 'number' || s.settled <= 0 || typeof s.win_rate !== 'number') return '';
    const rate = s.win_rate.toFixed(1);
    // 시점 라벨 (대표 20:48 지적 — 과거 날짜 화면에서 승률을 '그 날짜까지의 성적'으로 오독).
    //   summary.json 은 선택일과 무관한 단일 '오늘 기준 누적' 스냅샷(per-date 분해 없음, 매일 15:25 갱신).
    //   과거 날짜를 보는 중에도 동일 누적치가 노출되므로, '오늘 기준 누적'임을 라벨·보조문구로 명시한다.
    //   per-date 시점 재계산은 전수 history 를 클라이언트에 싣는 별 작업(task #26)으로 분리.
    const _nowW = new Date();
    const _todayW = `${_nowW.getFullYear()}-${String(_nowW.getMonth() + 1).padStart(2, '0')}-${String(_nowW.getDate()).padStart(2, '0')}`;
    const _isPastW = !!(date && date < _todayW);
    const tp = s.take_profit, loss = s.expired_loss || 0, gain = s.expired_gain || 0;
    const lossGainHtml = (loss > 0 || gain > 0)
      ? `<span class="cal-pm320-wr-loss">손실 ${loss}건${gain > 0 ? ` · 만기이익 ${gain}건` : ''}</span>`
      : '';
    const mddValue = (typeof s.account_mdd_pct === 'number')
      ? s.account_mdd_pct
      : (typeof s.worst_mdd_pct === 'number' ? s.worst_mdd_pct : null);
    const mddLabel = (typeof s.account_mdd_pct === 'number') ? '계좌 MDD' : '장중 최대낙폭';
    const detail = (s.backtest_detail && typeof s.backtest_detail === 'object') ? s.backtest_detail : null;
    const rows = (detail && Array.isArray(detail.table)) ? detail.table : [];
    const curve = (detail && Array.isArray(detail.equity_curve)) ? detail.equity_curve : [];
    const fmtBtPct = (v) => (typeof v === 'number' ? `${v > 0 ? '+' : ''}${v.toFixed(2)}%` : '-');
    const fmtBtWon = (v) => (typeof v === 'number' ? Math.round(v).toLocaleString('ko-KR') : '-');
    const equityHtml = (() => {
      const pts = curve
        .map((p) => ({ date: p.date, balance: (typeof p.balance === 'number') ? p.balance : null }))
        .filter((p) => p.balance !== null);
      if (pts.length < 2) return '';
      const w = 360, h = 86, pad = 8;
      const vals = pts.map((p) => p.balance);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const span = Math.max(1, max - min);
      const points = pts.map((p, i) => {
        const x = pad + (i * (w - pad * 2)) / Math.max(1, pts.length - 1);
        const y = h - pad - ((p.balance - min) / span) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      const last = pts[pts.length - 1];
      return `<div class="cal-pm320-bt-equity" aria-label="백테스트 잔고 흐름">`
        + `<div class="cal-pm320-bt-equity-meta"><span>${escapeHtml(pts[0].date || '')}</span><b>${escapeHtml(fmtBtWon(last.balance))}원</b><span>${escapeHtml(last.date || '')}</span></div>`
        + `<svg class="cal-pm320-bt-equity-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">`
        + `<line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" />`
        + `<polyline points="${points}" />`
        + `</svg></div>`;
    })();
    const tableHtml = rows.length ? `<div class="cal-pm320-bt-table-wrap" aria-label="PM320 백테스트 전수표"><table class="cal-pm320-bt-table">`
      + `<thead><tr><th>일자</th><th>종목</th><th>결과</th><th>수익률</th><th>잔고</th></tr></thead>`
      + `<tbody>${rows.map((r) => {
        const ret = (typeof r.ret_pct === 'number') ? r.ret_pct : null;
        const retCls = ret === null ? '' : (ret >= 0 ? ' cal-pm320-bt-td--pos' : ' cal-pm320-bt-td--neg');
        const exitClass = String(r.exit_class || '-');
        const exitLabel = (r.watered === true && exitClass.includes('익절'))
          ? exitClass.replace('익절', '물타기 익절')
          : (r.watered === true ? `${exitClass} · 물타기` : exitClass);
        const rowDate = r.exit_date || r.date || '';
        return `<tr><td>${escapeHtml(rowDate)}</td><td>${escapeHtml(r.name || r.code || '')}</td><td>${escapeHtml(exitLabel)}</td><td class="cal-pm320-bt-num${retCls}">${escapeHtml(fmtBtPct(ret))}</td><td class="cal-pm320-bt-num">${escapeHtml(fmtBtWon(r.balance_after))}</td></tr>`;
      }).join('')}</tbody></table></div>` : '';
    const _historyHtml = (rows.length || equityHtml)
      ? `<details class="cal-pm320-wr-fine cal-pm320-wr-history"><summary>전수표·잔고 흐름</summary>`
        + `<div class="cal-pm320-wr-fine-body cal-pm320-wr-history-body">`
        + equityHtml + tableHtml + `</div></details>`
      : '';
    const _winContextHtml = '';
    // R26 P0-2② (2026-06-11, stale 정직화) — '오늘'을 데이터 생성 시점(generated_at) 날짜로 치환.
    //   summary 는 매일 15:25 갱신 스냅샷이라 동결 시 "오늘"이 거짓이 된다. generated_at(ISO,
    //   build_card_history 산출) 에서 동적 추출(하드코딩 금지). 부재/형식 미달 시 '오늘' fallback
    //   (구버전 summary graceful — 추정 표시 0, FLR-AGT-002).
    const _asOfDateLabel = (() => {
      const g = s.generated_at;
      if (typeof g === 'string' && /^\d{4}-\d{2}-\d{2}/.test(g)) {
        return `${parseInt(g.slice(5, 7), 10)}월 ${parseInt(g.slice(8, 10), 10)}일`;
      }
      return '오늘';
    })();
    // since(첫 픽일)도 summary 실측 사용 (부재 시 종전 문구 fallback).
    const _sinceLabel = (typeof s.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.since))
      ? `${parseInt(s.since.slice(5, 7), 10)}월 ${parseInt(s.since.slice(8, 10), 10)}일`
      : '4월 8일';
    // 과거 날짜 선택 중에는 '선택일 시점 성적'이 아님을 기준일과 함께 1줄 명시 (R26 P0-2③ —
    //   "오늘 기준 누적" 도 stale 시 모순이므로 generated_at 기준일로 표기).
    const _asOfNoteHtml = _isPastW
      ? `<div class="cal-pm320-wr-asof">이 성적은 선택한 날짜 시점이 아니라 <b>${escapeHtml(_asOfDateLabel)} 기준 누적</b>입니다</div>`
      : '';
    const _trioCells = [];
    _trioCells.push(
      `<div class="cal-pm320-wr-cell">`
      + `<span class="cal-pm320-wr-cell-k">승률</span>`
      + `<span class="cal-pm320-wr-cell-v cal-pm320-wr-cell-v--rate">${escapeHtml(rate)}%</span>`
      + `<span class="cal-pm320-wr-cell-sub">청산 ${escapeHtml(String(s.settled))}건 기준</span>`
      + `</div>`);
    if (typeof mddValue === 'number') {
      _trioCells.push(
        `<div class="cal-pm320-wr-cell">`
        + `<span class="cal-pm320-wr-cell-k">${escapeHtml(mddLabel)}</span>`
        + `<span class="cal-pm320-wr-cell-v cal-pm320-wr-cell-v--neg">${escapeHtml(mddValue.toFixed(1))}%</span>`
        + `</div>`);
    }
    const _trioHtml = `<div class="cal-pm320-wr-trio">${_trioCells.join('')}</div>`;
    const _ariaWr = `${_sinceLabel}부터 ${_asOfDateLabel}까지 누적 성적 — 승률 ${rate}%`
      + (typeof mddValue === 'number' ? `, ${mddLabel} ${mddValue.toFixed(1)}%` : '');
    const _fineHtml = _historyHtml;
    return `<div class="cal-pm320-winrate" role="group" aria-label="${escapeHtml(_ariaWr)}">`
      + `<div class="cal-pm320-wr-head">`
      + `<span class="cal-pm320-wr-eyebrow">${escapeHtml(_sinceLabel)} ~ ${escapeHtml(_asOfDateLabel)} 누적 성적</span>`
      + `</div>`
      + _trioHtml
      + _asOfNoteHtml
      + `<div class="cal-pm320-wr-stats">`
      + `<span class="cal-pm320-wr-stat">총 ${s.total_picks}픽</span>`
      + `<span class="cal-pm320-wr-sep">·</span>`
      + `<span class="cal-pm320-wr-win">익절 ${tp}건</span>`
      + (lossGainHtml ? `<span class="cal-pm320-wr-sep">·</span>${lossGainHtml}` : '')
      + (s.running > 0 ? `<span class="cal-pm320-wr-sep">·</span><span class="cal-pm320-wr-running">보유중 ${s.running}건</span>` : '')
      + `</div>`
      + _winContextHtml
      + _fineHtml
      + `</div>`;
  })();
  // DSN-frontend §3.6.8 (2026-06-05) — PM320 추천 부재(보류일) 안내.
  //   통합 모델 보류일(선제거로 잔존<2 → PICK 0건, 예: 4/16)에는 추천 종목 카드가 없어
  //   화면이 빈 것처럼 보인다. data.pm320NoPick===true(보류 확정) + 거래일 + 비단독모드 시
  //   뉴스요약 섹션 상단에 안내 라인 1줄을 띄운다. 색은 매크로/내러티브 칩(amber)과 구분되는
  //   중립 슬레이트(--neu/--neu-bg)로 표시. pm320NoPick===null(404·미신뢰)이면 미표시
  //   (FLR-AGT-002 거짓 충실성 차단 — 추정 고지 금지). 추천 있는 날(false)도 미표시(무회귀).
  // R26 P1 (2026-06-11, 무픽 날 침묵 해소 — 신뢰 철학 §1.3) — 과거/오늘 시점 분기 + "기준 미달" 명시
  //   + 데이터 누락과 구분되는 보조 1줄. 픽 슬롯(승률 박스 위)으로 위치 승격 (종전: 뉴스요약 하단에
  //   묻혀 무픽 날(6/2·6/8) 픽 영역이 완전 침묵으로 읽힘).
  const _pm320NoPickHtml = (() => {
    if (_isSingleCardMode || !data || data.pm320NoPick !== true || isMarketClosed(date)) return '';
    const _nowNp = new Date();
    const _todayNp = `${_nowNp.getFullYear()}-${String(_nowNp.getMonth() + 1).padStart(2, '0')}-${String(_nowNp.getDate()).padStart(2, '0')}`;
    const _dayWord = (date && date < _todayNp) ? '이날은' : '오늘은';
    return `<div class="cal-pm320-no-pick" role="status" aria-label="${_dayWord} 추천 없음, 기준 미달로 픽을 내지 않은 날입니다"><svg class="cal-pm320-no-pick-icon" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9 12h6"/></svg><span><b>${_dayWord} 추천 없음 (기준 미달)</b>${_termTip('pending')} — 데이터 누락이 아니라 기준을 만족하는 종목이 없어 픽을 내지 않은 날입니다</span></div>`;
  })();
  // R27 P0-3 (조니 2심, 2026-06-11) — 임의 결측 날짜 공통 "데이터 없음" 상태 (특정일 전용 패치 금지).
  //   pm320NoPick == null = pm320_history 404/미생성 (보류 확정 true 와 구분, data-loader.js 3상태.
  //   loose == 비교: 폴백 path 객체에 키 자체가 없는 undefined 도 동일 의미 — 미신뢰).
  //   과거 거래일에서 픽 파일이 없으면 종전엔 픽 슬롯 완전 침묵 (6/3 재현 — 픽도 무픽 안내도 없음).
  //   "이 날짜의 데이터가 없습니다" 1줄로 정직 고지. 무픽 보류일(기준 미달)과 의미 구분 명시.
  //   isMarketClosed 가드는 두지 않는다 — 순수 휴장(데이터 0)은 !hasAny early-return 이 이미 처리,
  //   본 path 도달 = 종목 데이터가 실재하는 날(예: 6/3 지방선거 휴장일 + kiwoom 수집 존재)이므로
  //   픽 슬롯 침묵은 동일하게 결함. 주말 자동 폴백(suppress) 시에는 카드와 함께 비노출(모순 차단).
  //   오늘 view 는 제외 — PRE_MARKET path·장중 pending 배너가 시점별 상태를 이미 담당 (무회귀).
  //   결측일이 백필되면 pm320NoPick 이 true/false 로 바뀌어 본 상태는 자연 소멸 (코드는 영구 잔존).
  const _pm320NoDataHtml = (() => {
    if (_isSingleCardMode || !data || data.pm320NoPick != null) return '';
    // R28 P0-2 — 휴장일 뷰에서 "수집되지 않은 날짜" 렌더 금지 (비휴장 미수집일 전용).
    if (_isHolidayView) return '';
    if (typeof window !== 'undefined' && window._pm320SuppressDomesticCards === true) return '';
    const _nowNd = new Date();
    const _todayNd = `${_nowNd.getFullYear()}-${String(_nowNd.getMonth() + 1).padStart(2, '0')}-${String(_nowNd.getDate()).padStart(2, '0')}`;
    if (!(date && date < _todayNd)) return '';
    return `<div class="cal-pm320-no-data" role="status" aria-label="이 날짜의 데이터가 없습니다"><svg class="cal-pm320-no-data-icon" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg><span><b>이 날짜의 데이터가 없습니다</b> — 픽 추적 데이터가 수집되지 않은 날짜입니다</span></div>`;
  })();
  // R28 P0-2 (조니 2심 확정) — 휴장일 뷰 한 줄. 날짜·요일은 formatKoDate(동적), 하드코딩 0.
  //   종목 카드·"이날의 종목 N개" 헤더·"수집되지 않은 날짜"는 본 뷰에서 렌더 금지 (자기모순 봉쇄).
  const _pm320HolidayHtml = (() => {
    if (!_isHolidayView) return '';
    const _dl = (typeof formatKoDate === 'function') ? formatKoDate(date) : date;
    const _msg = `${_dl}은 휴장일입니다 — 픽이 발행되지 않는 날입니다.`;
    return `<div class="cal-pm320-holiday" role="status" aria-label="${escapeHtml(_msg)}"><svg class="cal-pm320-holiday-icon" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span><b>${escapeHtml(_dl)}은 휴장일입니다</b> — 픽이 발행되지 않는 날입니다.</span></div>`;
  })();
  // PM320-D6 P0 (손님 판정 — 시점 혼란) — 장중 "오늘의 추천 15:20 공개" 안내 배너.
  //   손님(주식 초보)이 아침 09시에 자정/장전 스냅샷 데이터를 "오늘의 추천"으로 오인하고
  //   "고장났나?" 하고 이탈하는 문제. 조건: 오늘 view + 장중(OPEN, 09:00~15:20) + 픽 미생성.
  //   - 픽 미생성 판정: data.pm320NoPick !== false (false=오늘 픽 확정 존재 → 배너 미표시, 무회귀).
  //     true(보류 확정)·null(아직 미생성/404) 모두 "아직 안 나옴"이므로 배너 표시.
  //   - 시각 표현: "00:14 KST 기준" 같은 raw 시각 대신 "지금은 장 시작 전 집계 데이터"로 의미 치환.
  //     실제 추천 산출 시점(15:20)을 카운트다운으로 명시 → 손님 시점 혼란 해소.
  //   _wirePickCountdown() 가 렌더 직후 1초 tick (15:20 도달 시 "곧 갱신됩니다" 전환).
  let _pm320PendingHtml = '';
  try {
    const _stateForBanner = (typeof getMarketState === 'function') ? getMarketState(date) : null;
    const _nowB = new Date();
    const _todayB = `${_nowB.getFullYear()}-${String(_nowB.getMonth() + 1).padStart(2, '0')}-${String(_nowB.getDate()).padStart(2, '0')}`;
    const _pickPending = !data || data.pm320NoPick !== false;
    if (!_isSingleCardMode && _stateForBanner === 'OPEN' && date === _todayB && _pickPending) {
      const _cd = _formatCountdownToPick(_nowB);
      _pm320PendingHtml =
        `<div class="cal-pm320-pending" role="status" aria-label="오늘의 추천은 오후 3시 20분에 공개됩니다">`
        + `<svg class="cal-pm320-pending-icon" width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`
        + `<div class="cal-pm320-pending-body">`
        + `<div class="cal-pm320-pending-title">오늘의 추천은 <b>오후 3시 20분</b>에 공개됩니다</div>`
        + `<div class="cal-pm320-pending-sub">지금 보이는 종목은 장 시작 전 집계된 거래대금 상위 종목으로, 오늘 추천 후보가 되는 종목들입니다. 오후 3시 20분에 이 중 한 종목이 오늘의 최종 추천으로 확정됩니다.</div>`
        + `<div class="cal-pm320-pending-cd-wrap"><span class="cal-pm320-pending-cd-label">공개까지</span> <span class="cal-pm320-pending-countdown" data-pick-cd="1">${_cd}</span></div>`
        + `</div>`
        + `</div>`;
    }
  } catch (_) { /* getMarketState 미정의 시 graceful — 배너 생략 */ }
  // R28 P1⑤ (조니 2심, 2026-06-11) — INTRADAY 첫 화면(fold 390×844) 심장 = "공개까지" 카운트다운.
  //   장중 pending 배너는 야간 미국증시·뉴스요약 아래(y≈1141, fold 밖 1.4스크린 — 조니 측정)라
  //   손님 첫 화면에 "오늘 뭐가 나오는지" 시점 단서 0. PRE_MARKET portal(R23, #pm320-prepick-portal
  //   헤더 직하) 패턴 그대로 — 장중 픽 미확정 동안 컴팩트 카운트다운 칩을 portal 에 주입(additive,
  //   섹션 순서 불변). 본문 pending 배너는 유지(맥락 설명 담당). 픽 확정/과거 view/장외 = portal
  //   정리(hidden). PRE_MARKET 은 renderPreMarketEmpty 가 자체 주입 — 본 path 미진입(무회귀).
  //   _wirePickCountdown 이 data-pick-cd 전수(querySelectorAll) tick — 본문·portal 동시 갱신.
  try {
    const _cdPortal = (typeof document !== 'undefined') ? document.getElementById('pm320-prepick-portal') : null;
    if (_cdPortal && !_isSingleCardMode) {
      if (_pm320PendingHtml) {
        const _cdP = _formatCountdownToPick(new Date());
        _cdPortal.innerHTML =
          `<div class="cal-pm320-portal-cd" role="status" aria-label="오늘의 추천은 오후 3시 20분에 공개됩니다">`
          + `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`
          + `<span class="cal-pm320-portal-cd-label">오늘의 추천 <b>공개까지</b></span>`
          + `<span class="cal-pm320-pending-countdown" data-pick-cd="1">${_cdP}</span>`
          + `</div>`;
        _cdPortal.hidden = false;
      } else {
        _cdPortal.innerHTML = '';
        _cdPortal.hidden = true;
      }
    }
  } catch (_) { /* portal 부재(과거 빌드) graceful — 본문 배너만 */ }
  // PM320-D6 (2026-06-10) — 카운트다운 슬롯의 "오늘의 추천" 전용 요약 카드.
  //   픽 확정(_pm320PendingHtml='' = 15:20 이후/픽 존재) 시 todayStocks 중 is_pick 종목 1개로 빌드.
  //   진입가 SSOT = 매매 row와 동일 chain (daily_20[-1].c → close_price → range_240d.current).
  //   픽 부재(보류/미생성/카운트다운 진행중) 시 빈 문자열 → 미렌더 (무회귀).
  let _pm320TodayRecHtml = '';
  if (!_isSingleCardMode && !_pm320PendingHtml) {
    // pm320_pick 은 data-loader.js 합성으로 interp 에 패스스루 (renderTodayCard st=it.interp 정합).
    const _pickIt = todayStocks.find((s) => s && s.interp && s.interp.pm320_pick && s.interp.pm320_pick.is_pick === true);
    if (_pickIt) {
      const _pk = _pickIt.interp.pm320_pick;
      const _interp = _pickIt.interp || null;
      const _d20 = (_interp && Array.isArray(_interp.daily_20) && _interp.daily_20.length > 0)
        ? _interp.daily_20[_interp.daily_20.length - 1] : null;
      const _authClose = (_d20 && typeof _d20.c === 'number') ? _d20.c
        : (typeof _interp?.close_price === 'number' ? _interp.close_price
          : (typeof _interp?.range_240d?.current === 'number' ? _interp.range_240d.current : null));
      const _nowR = new Date();
      const _todayR = `${_nowR.getFullYear()}-${String(_nowR.getMonth() + 1).padStart(2, '0')}-${String(_nowR.getDate()).padStart(2, '0')}`;
      const _isPastR = !!(date && date < _todayR);
      _pm320TodayRecHtml = _buildPm320TodayRecCard(
        _pk, _pickIt.code || '', _pickIt.name || '', _authClose, _isPastR);
    }
  }
  // Q-20260606-113 (대표 verbatim "국내장 종목은 토요일에는 안보이게 해야지") — 주말·휴장일 국내장 카드 비노출.
  //   suppress 플래그(calendar.js initCalendar 자동 폴백 시 set, 사용자 날짜 클릭 시 clear)가 true 면
  //   국내장 종목 카드 list 를 렌더하지 않고 graceful 안내 한 줄로 대체한다. 야간 미국증시 섹션
  //   (_nightlyUsHtml) 은 본 분기 밖 별 path → 토요일 아침 최신 미장 데이터 그대로 유지.
  //   안내 톤 = 기존 "오늘은 장이 쉽니다"(휴장 안내) + DSN §3.6.8(추천 부재 안내) 패턴과 통일.
  const _suppressDomestic = !_isSingleCardMode
    && (typeof window !== 'undefined' && window._pm320SuppressDomesticCards === true);
  const _suppressDomesticHtml = (() => {
    const dl = formatKoDate(date);   // 표시 중 데이터 기준일(직전 거래일)
    return `<div style="text-align:center;padding:32px 0;">`
      + `<div style="font-size:15px;font-weight:700;color:var(--tx2);margin-bottom:6px;">주말·휴장일에는 국내장 종목을 표시하지 않습니다</div>`
      + `<div style="font-size:12px;color:var(--dm);line-height:1.6;">직전 거래일${dl ? ' (' + escapeHtml(dl) + ')' : ''} 데이터는 위 야간 미국증시 아래에서 확인하거나, 왼쪽 달력에서 날짜를 선택하세요</div>`
      + `</div>`;
  })();
  // R25 P1⑧ (2026-06-11) — 히어로 "하루 단 한 종목" vs 첫 화면 후보 N장 충돌 해명 1줄 (카드 리스트 상단).
  //   장중 pending 배너(_pm320PendingHtml)가 이미 동일 해명을 포함 → 배너 부재 시(픽 확정 후·과거일)만
  //   노출(동일 해명 2회 중복 차단 — P1④ 동형 원칙). 종목 1장 이하 시 "후보 N장 충돌" 자체가 없어 생략.
  const _candidateNoteHtml = (!_isSingleCardMode && !_isHolidayView && !_pm320PendingHtml && !_suppressDomestic && todayStocks.length > 1)
    ? `<div class="cal-trade-list-note">아래는 거래대금 상위 <b>추천 후보</b> 종목입니다 — 추천은 이 중 <b>하루 단 한 종목</b>입니다</div>`
    : '';
  const todayHtml = `
    <div class="cal-section${_isSingleCardMode ? ' cal-section--single-card' : ''}">
      ${_sectionTitleHtml}
      ${_pm320HolidayHtml}
      ${_pm320PendingHtml}
      ${_pm320TodayRecHtml}
      ${_pm320NoPickHtml}
      ${_pm320NoDataHtml}
      ${_pm320WinRateHtml}
      ${_narrPillsHtmlOut}
      ${_macroHtmlOut}
      ${_rankingBannerOut}
      ${_isHolidayView ? '' : _suppressDomestic ? _suppressDomesticHtml : (todayStocks.length > 0 ? `
        ${_candidateNoteHtml}
        <div class="cal-trade-list" style="margin-top:10px;">
          ${todayStocks.map(renderTodayCard).join('')}
        </div>
      ` : `
        ${_isSingleCardMode
          ? `<div class="cal-empty" style="padding:24px 0;">단독 카드 mode — 종목 코드 ${escapeHtml(_singleCardCode || '')} 본 본 데이터 없음</div>`
          : (isMarketClosed(date) ? (() => { const nd = getNextTradingDate(date); const nl = nd ? formatKoDate(nd) : ''; return `<div style="text-align:center;padding:32px 0;"><div style="font-size:15px;font-weight:700;color:var(--tx2);margin-bottom:6px;">오늘은 장이 쉽니다</div><div style="font-size:12px;color:var(--dm);">${nl ? '다음 거래일 ' + escapeHtml(nl) : ''}</div></div>`; })() : '<div class="cal-empty" style="padding:24px 0;">데이터 준비 중입니다 — 장 마감 후 자동 업데이트됩니다</div>')}
      `)}
    </div>
  `;

  const _rulesVersionBanner = _buildRulesVersionBanner(data && data.rules_version);
  // Phase 2c-1 (2026-05-23) — single-card mode 본 본 rules-version banner / cal-content-head 본 본 hide.
  // 외부 임베딩 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 본 단독.
  if (_isSingleCardMode) {
    inner.innerHTML = todayHtml;
  } else {
    inner.innerHTML = `
      ${_rulesVersionBanner}
      <div class="cal-content-head" role="button" tabindex="0" aria-label="달력으로 이동" data-scroll-to-cal="1">
        <div class="cal-content-date">${formatKoDate(date)}</div>
        <div class="cal-content-meta">${metaText}</div>
      </div>
      ${_nightlyUsHtml}
      ${todayHtml}
    `;
  }

  // PM320 정보 위계 개편 (대표 2026-06-10 A안) — 야간 미국증시 섹션 접힘 상태 + localStorage 복원.
  //   innerHTML 으로 새로 그려졌으므로 매 렌더 재적용(getElementById('nightly-us')). 부재 시 graceful no-op.
  if (typeof _applySectionCollapse === 'function') {
    const _nuRoot = document.getElementById('nightly-us');
    if (_nuRoot) _applySectionCollapse(_nuRoot, 'nightly-us');
  }

  // Q-20260608-140 (A안) — 미장 정규장/선물 토글 wiring. innerHTML 갱신 직후 매 렌더 호출.
  //   섹션 DOM 새로 그려지므로(data-fut-wired 가드 자동 리셋) 매 호출 안전. 선물 부재 시 no-op.
  if (typeof _wireUsFutToggle === 'function') _wireUsFutToggle();

  // PM320-D6 P0 — 장중 "오늘 추천 15:20 공개" 배너 카운트다운 wiring. 배너 미존재 시 no-op(타이머 정리).
  _wirePickCountdown();
  // PM320-D6 P1 — 용어 (?) 팝오버 전역 위임 핸들러 (1회만 등록, 모바일 터치).
  _wireTermTips();

  // 접기/펼치기 이벤트 위임 (1회만 등록)
  // REQ-046 — CSS font-size:0 + ::after content trick 폐기 → JS textContent 직접 변경.
  // aria-label 동시 갱신 (스크린리더 정합).
  if (!window._cardCollapseInit) {
    document.addEventListener('click', e => {
      const toggle = e.target.closest('.cal-detail-toggle');
      if (!toggle) return;
      const card = toggle.closest('.cal-feature-card');
      if (!card) return;
      card.classList.toggle('expanded');
      const isExpanded = card.classList.contains('expanded');
      const txt = toggle.querySelector('.cal-toggle-text');
      if (txt) txt.textContent = isExpanded ? '접기' : '상세 보기';
      toggle.setAttribute('aria-label', isExpanded ? '접기' : '상세 보기');
    });
    window._cardCollapseInit = true;
  }

  // DOC-20260603-DSN-001 §3.2 — PM320 추천/결과 row 토글 (default 접힘, 클릭 시 expand).
  // 기존 cal-detail-toggle 핸들러와 독립 (.pm320-rec-toggle 별 selector).
  if (!window._pm320RecToggleInit) {
    document.addEventListener('click', e => {
      const toggle = e.target.closest('.pm320-rec-toggle');
      if (!toggle) return;
      e.stopPropagation();
      const row = toggle.closest('.pm320-rec-row');
      if (!row) return;
      const detail = row.querySelector('.pm320-rec-detail');
      const isExpanded = row.classList.toggle('pm320-rec-row--expanded');
      toggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      // §3.1 정정 옵션 B (2026-06-03) — chevron 폐기 후 텍스트 토글 "매매" ↔ "접기".
      // 22:11 정정 (대표 verbatim "매매 보기 대신 매매 라고 이름 바꿔") — " 보기" suffix 폐기.
      // PM320-D6 P0 — 접힘 라벨은 행 variant(픽="매매" / 가상="가상매매")를 data-collapse-label로 보존.
      //   종전 하드코딩 '매매'는 가상 행 토글 시 라벨을 픽처럼 덮어써 구분 소실(half-applied 버그) → 회피.
      const toggleText = toggle.querySelector('.pm320-rec-toggle-text');
      if (toggleText) {
        const collapseLabel = row.getAttribute('data-collapse-label') || '매매';
        toggleText.textContent = isExpanded ? '접기' : collapseLabel;
      }
      if (detail) {
        if (isExpanded) {
          detail.removeAttribute('hidden');
        } else {
          detail.setAttribute('hidden', '');
        }
      }
    });
    window._pm320RecToggleInit = true;
  }

  // REQ-pm320-ux-cycle #1 — cal-content-head 클릭/Enter/Space → #toss-cal scrollIntoView.
  // 모바일에서 카드 list 깊이 스크롤 후 달력 역접근 어려움 해소. 데스크탑은 sticky로 이미 보이지만
  // page top 정렬 시 toss-cal이 시야 중앙으로 회귀하여 다른 날짜 클릭 부담 ↓.
  if (!window._calHeadScrollInit) {
    const scrollToCal = () => {
      const target = document.getElementById('toss-cal');
      if (!target) return;
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const isMobile = window.innerWidth <= 880;
      // sticky nav header 68px(데스크탑) / 76px(모바일 nav 추정) 보정.
      const navOffset = isMobile ? 76 : 84;
      const rect = target.getBoundingClientRect();
      const top = window.pageYOffset + rect.top - navOffset;
      window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
    };
    document.addEventListener('click', e => {
      const head = e.target.closest('[data-scroll-to-cal]');
      if (!head) return;
      // 헤더 내부 다른 인터랙티브 요소(링크/버튼) bubble 차단 — 현재는 하위 요소 없음, 안전망.
      if (e.target.closest('a, button, input, [role="button"]:not([data-scroll-to-cal])')) return;
      // 시각 펄스 (reduced-motion 시 transform 생략 — CSS @media 처리)
      head.classList.add('cal-content-head--pulse');
      setTimeout(() => head.classList.remove('cal-content-head--pulse'), 200);
      scrollToCal();
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const head = e.target.closest('[data-scroll-to-cal]');
      if (!head) return;
      e.preventDefault();
      head.classList.add('cal-content-head--pulse');
      setTimeout(() => head.classList.remove('cal-content-head--pulse'), 200);
      scrollToCal();
    });
    window._calHeadScrollInit = true;
  }

  // PM320-D6 (2026-06-10) — "오늘의 추천" 요약 카드 "상세 보기 ↓" → 해당 풀 카드(#stock-{code}) scrollIntoView.
  //   기존 scrollToCal 패턴 재사용 (nav 보정 + reduced-motion). 대상 카드 부재 시 no-op (graceful).
  // PM320 여정 fix (2026-06-11, FLR-20260605-AGT-002 동선 절단) — 동일 #stock-{code} 가 오늘 view 와
  //   "전일 데이터 보기" 박스([data-pre-prev]) 양쪽에 동시 존재할 수 있다(POST_MARKET 에 전일 토글 시).
  //   document.getElementById 는 DOM 선두(=오늘 카드)를 반환하므로, 전일 박스 안에서 "상세 보기 ↓"를
  //   누르면 사용자가 보던 전일 카드 대신 위쪽 오늘 섹션으로 튀어 동선이 절단된다("위로 점프").
  //   → 클릭이 전일 박스 안에서 발생했으면 그 박스 안의 카드를 우선 탐색(scope) 후 fallback 으로 document.
  // PM320 여정 fix r4 (2026-06-11, 대표 catch) — 요약 카드 "상세 보기 ↓"는 인라인 보존이 아니라
  //   풀 카드로 이동하는 버튼이다. r3의 scrollY 복원은 이동을 상쇄하므로 제거하고, 픽바와 같은
  //   card jump 동작(목적지 자동 펼침 + sticky nav 보정)으로 통일한다.
  //   dup-id 분기(전일 박스 scope 우선) + aria-expanded 동기화는 그대로 유지.
  if (!window._pm320RecJumpInit) {
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-rec-jump]');
      if (!btn) return;
      const code = btn.getAttribute('data-rec-jump');
      if (!code) return;
      const scope = btn.closest('[data-pre-prev]');
      const target = (scope && scope.querySelector('#stock-' + code)) || document.getElementById('stock-' + code);
      if (!target) return;
      e.preventDefault();
      // 목적지 풀 카드 상세 자동 펼침 — 이미 펼쳐져 있으면 그대로. (접힌 채 도착해 "빈 카드" 인상 회피)
      const detailToggle = target.querySelector('.cal-detail-toggle');
      if (detailToggle && !target.classList.contains('expanded')) {
        target.classList.add('expanded');
        const _txt = detailToggle.querySelector('.cal-toggle-text');
        if (_txt) _txt.textContent = '접기';
        detailToggle.setAttribute('aria-label', '접기');
      }
      // 누른 요약 버튼 aria-expanded 동기화 (요약 → 풀 카드 펼침 관계 표현).
      if (btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', 'true');
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const _jump = () => {
        const navOffset = _pm320StickyJumpOffset();
        const rect = target.getBoundingClientRect();
        const top = window.pageYOffset + rect.top - navOffset;
        window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(_jump));
      } else { _jump(); }
    });
    window._pm320RecJumpInit = true;
  }

  // PM320 여정 fix (2026-06-11, FLR-20260605-AGT-002 첫 화면 가치) — sticky 미니 픽 바 동기화.
  //   첫 뷰포트가 비어 보이는 문제 해소: 현재 선택일의 픽(.cal-pm320-today-rec)을 헤더 아래 1줄로 mirror.
  //   SSOT = DOM (실제 렌더된 픽). 별도 데이터 path 없음 → stale/타 종목 노출 불가(FLR-AGT-002 회피).
  //   가시성: 픽 카드가 뷰포트 상단 밖으로 스크롤될 때만 노출(IntersectionObserver). 탭 = 픽 카드로 scroll.
  //   매 렌더 재호출(_cal-content innerHTML 리셋 후) — pickbar 미존재(과거 빌드) 시 graceful no-op.
  _syncPickBar();

  // REQ-homepage-news-polish #2 — 섹션 헤더 sticky + 클릭 → 자기 섹션 scrollIntoView.
  // design-lead-2 spec (2026-04-29 17:18 KST): scrollIntoView({behavior:'smooth', block:'start'}).
  // sticky nav 가림은 CSS scroll-margin-top: 132/120px 으로 회피.
  if (!window._sectionHeaderScrollInit) {
    const pulseClassFor = (head) => {
      const cls = head.classList;
      if (cls.contains('theme-trend-header')) return 'theme-trend-header--pulse';
      if (cls.contains('lut-header')) return 'lut-header--pulse';
      if (cls.contains('theme-tree-header')) return 'theme-tree-header--pulse';
      return '';
    };
    const scrollToSection = (head) => {
      const id = head.getAttribute('data-scroll-to-section');
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    };
    const triggerPulse = (head) => {
      const pc = pulseClassFor(head);
      if (!pc) return;
      head.classList.add(pc);
      setTimeout(() => head.classList.remove(pc), 200);
    };
    document.addEventListener('click', e => {
      const head = e.target.closest('[data-scroll-to-section]');
      if (!head) return;
      if (e.target.closest('a, button, input, [role="button"]:not([data-scroll-to-section])')) return;
      triggerPulse(head);
      scrollToSection(head);
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const head = e.target.closest('[data-scroll-to-section]');
      if (!head) return;
      e.preventDefault();
      triggerPulse(head);
      scrollToSection(head);
    });
    window._sectionHeaderScrollInit = true;
  }

  // REQ-020 v9.5 §II.6 — 헤더 효과 배지 click 시 카드 자동 펼침 (v9.3 호환 — 셀렉터만 교체).
  // 함정 P2 #5: legacy `dsn-v93-header-badge` 셀렉터는 DOM 출력 0건 자연 차단 (잔존 CSS는 dead).
  // 함정 #11: 이벤트 버블링 충돌 방어 — stopPropagation 후 명시적 expanded 부착 (toggle 아닌 add).
  // REQ-046 — 헤더 배지 → expanded 추가 시도 토글 텍스트 동기 (CSS trick 폐기 정합).
  const _syncToggleText = (card) => {
    if (!card) return;
    const t = card.querySelector('.cal-detail-toggle');
    if (!t) return;
    const txt = t.querySelector('.cal-toggle-text');
    if (txt) txt.textContent = '접기';
    t.setAttribute('aria-label', '접기');
  };
  if (!window._headerBadgeExpandInit) {
    document.addEventListener('click', e => {
      const badge = e.target.closest('.dsn-v95-effect-badge');
      if (!badge) return;
      // "+N" 더보기 배지는 펼침 트리거 X (후속 toolitp 영역)
      if (badge.classList.contains('dsn-v95-effect-badge--more')) return;
      const card = badge.closest('.cal-feature-card');
      if (!card) return;
      e.stopPropagation();
      card.classList.add('expanded');
      _syncToggleText(card);
    });
    // 키보드 a11y — Enter·Space 키
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const badge = e.target.closest && e.target.closest('.dsn-v95-effect-badge');
      if (!badge) return;
      if (badge.classList.contains('dsn-v95-effect-badge--more')) return;
      const card = badge.closest('.cal-feature-card');
      if (!card) return;
      e.preventDefault();
      e.stopPropagation();
      card.classList.add('expanded');
      _syncToggleText(card);
    });
    window._headerBadgeExpandInit = true;
  }

  // cycle22 P1 (2026-05-20) — 미니캔들 클릭 → 카드 하단 확대 차트 expand (SPEC-001 §5 + DSN §3.6.6).
  // .cal-feature-candles20[data-expand-trigger="chart"] click → 카드에 .chart-expanded class + .cal-feature-chart-expanded 슬롯 lazy fill.
  //
  // Phase 2.2 (2026-05-20) — lazy fetch swap:
  // - 1차 fetch `/data/dailybars/{code}.json` (240영업일, Phase 3 emit_dailybars_per_stock.py 산출)
  // - fetch 성공 시 240행 dailyData 채택
  // - fetch 실패 (404 / network / parse err) 시 fallback = data-daily20 raw (20영업일, Phase 2 prototype) — graceful degradation
  // - per-stock JSON 부재 (Phase 3 cron 미배포) = 정상 fallback. 콘솔 warn 없음 (정상 흐름).
  // ChartTV.render — js/lib/chart-tv/expanded-chart.js (Phase 7c, TradingView v5 wrapper). 13종 보조지표 + marker primitive + localStorage 영구화.
  // 본 핸들러 = .cal-feature-card.expanded (기존 상세 보기 accordion)와 별개 — chart-expanded class 분리.
  if (!window._chartExpandInit) {
    // 종목별 fetch 결과 메모이즈 (재클릭 시 재 fetch 회피)
    const _dailybarsCache = new Map();
    async function _fetchDailybars(code) {
      if (!code) return null;
      // PM320-D6 (task #32 ⑤): 지수/선물 합성 코드(idx-*)는 per-stock dailybars 파일이 없음(index-card.js:196 idxCode).
      //   fetch 시 항상 404 2건(dailybars-nxt/idx-*.json + dailybars/idx-*.json) 콘솔 노이즈 → 네트워크 호출 생략하고
      //   곧장 data-daily20 prototype fallback(null 반환). 렌더 동작 무변(이미 의도된 graceful 경로, index-card.js:194 주석).
      if (code.startsWith('idx-')) {
        _dailybarsCache.set(code, null);
        return null;
      }
      if (_dailybarsCache.has(code)) return _dailybarsCache.get(code);
      try {
        // 2026-06-10 대표 GO — NXT(넥스트레이드) 장 포함 일봉 우선 (대표 차트 기준).
        //   1차 `/data/dailybars-nxt/{code}.json` (4/8~ NXT splice, gen_dailybars_nxt.py 산출)
        //   2차 fallback `/data/dailybars/{code}.json` (KRX 정규장 only) — NXT 미산출 종목/구간 graceful.
        //   NXT splice = OHLC 전체 교체이므로 캔들 꼬리·MA·피보 저점 앵커 전부 NXT 일관 (앵커-꼬리 정합).
        //   ※ 한계: NXT 미커버 최근일(예 6/9~)은 KRX OHLC (splice 0일). 종가=정규장 종가 동일이라 양봉/음봉·MA 왜곡 0, 저가만 영향.
        let payload = null;
        for (const url of [`/data/dailybars-nxt/${code}.json`, `/data/dailybars/${code}.json`]) {
          try {
            const resp = await fetch(url, { credentials: 'omit' });
            if (!resp.ok) continue;
            const body = await resp.json();
            if (body && Array.isArray(body.rows) && body.rows.length > 0) {
              payload = body;
              break;
            }
          } catch (e) { /* 다음 url 시도 */ }
        }
        if (!payload) {
          _dailybarsCache.set(code, null);
          return null;
        }
        const rows = Array.isArray(payload && payload.rows) ? payload.rows : null;
        if (!rows || rows.length === 0) {
          _dailybarsCache.set(code, null);
          return null;
        }
        // Phase 3 schema {d,o,h,l,c,v,ta} → expanded-chart.js normalize 입력 schema {date,o,h,l,c,v,tv} 정합
        // build_daily prototype {date,o,h,l,c,v,tv} 와 lazy fetch {d,o,h,l,c,v,ta} 양 호환 — d→date / ta→tv alias.
        const normalized = rows.map(r => ({
          date: r.date || r.d || null,
          o: r.o, h: r.h, l: r.l, c: r.c,
          v: typeof r.v === 'number' ? r.v : 0,
          tv: typeof r.tv === 'number' ? r.tv : (typeof r.ta === 'number' ? r.ta : (r.c || 0) * (r.v || 0)),
        }));
        _dailybarsCache.set(code, normalized);
        return normalized;
      } catch (err) {
        _dailybarsCache.set(code, null);
        return null;
      }
    }

    async function _openChartExpand(trigger, card) {
      const isOpen = card.classList.contains('chart-expanded');
      if (isOpen) {
        card.classList.remove('chart-expanded');
        card.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-expanded', 'false');
        return;
      }
      const ticker = card.getAttribute('data-stock-code') || '';
      // 슬롯 lazy 생성 — SPEC-001 v2 §5.2/§5.3 옵션 B 채택 (Phase 5 design-lead 본질 갱신, cluster v21 99회차 critical FLR-001 catch).
      // `.cal-feature-details`는 `.cal-feature-body` 직접 자식 (card 직접 자식 아님). 따라서 `insertBefore(slot, details)` 호출 시 NotFoundError throw.
      // 옵션 B: `card.appendChild(slot)` 단일 분기 — details/hasDetails 분기 자체 제거.
      // selector `:scope >` 명시 — card 직접 자식만 매칭 (body 내부 잘못된 위치 슬롯 검색 회피).
      // cycle23 layout 정정 (2026-05-22 15:56 KST 대표 verbatim "현대 확대용 차트가 상세보기 버튼 아래쪽에 있는데 종목이름과 미니캔들 로우의 바로 아래로 옮기고 싶다"):
      //   slot 위치 본문 = card 마지막 자식 (body sibling) → cal-feature-head 직후 (rangeHtml 위) insert 본질.
      //   `card.appendChild(slot)` → `card.insertBefore(slot, headEl.nextSibling)` 본질 (head 부재 시 graceful appendChild fallback).
      let slot = card.querySelector(':scope > .cal-feature-chart-expanded');
      if (!slot) {
        slot = document.createElement('div');
        slot.className = 'cal-feature-chart-expanded';
        slot.id = `chart-${ticker}`; // SPEC §5.6 MINOR-1 — stable id (aria-controls anchor)
        slot.setAttribute('aria-live', 'polite');
        const headEl = card.querySelector(':scope > .cal-feature-head');
        if (headEl && headEl.nextSibling) {
          card.insertBefore(slot, headEl.nextSibling); // cycle23 layout — head row 바로 아래
        } else if (headEl) {
          card.appendChild(slot); // head 마지막 자식 케이스 fallback
        } else {
          card.appendChild(slot); // head 부재 graceful fallback (SPEC §5.2 옵션 B 원본 동작)
        }
      }
      let exDividendDates = [];
      try {
        const exd = trigger.getAttribute('data-exdividend');
        if (exd) exDividendDates = JSON.parse(exd);
      } catch (err) { /* noop */ }
      // P0 hotfix (cycle22 라이브 배포 보조지표 누락 catch, 대표 2026-05-21 07:37 KST):
      // pinkSignalDates source = data-pinksignal attribute (별건 cycle 본질, 현 시점 빈 배열 graceful).
      // 본질: ChartTV.render options 누락 본질 (Phase 7c integration mismatch — markers attach 호출 시 옵션 omit) 봉쇄.
      let pinkSignalDates = [];
      try {
        const pink = trigger.getAttribute('data-pinksignal');
        if (pink) pinkSignalDates = JSON.parse(pink);
      } catch (err) { /* noop */ }

      // 1차 prototype fallback (20영업일) — 즉시 render (사용자 perceived latency ↓)
      let prototypeData = [];
      try {
        const stash = trigger.getAttribute('data-daily20');
        if (stash) prototypeData = JSON.parse(stash);
      } catch (err) {
        prototypeData = [];
      }
      // accordion 즉시 open + 1차 render (20일) — 사용자 인지 부담 0 ms 정합 (AC-13 <200ms)
      card.classList.add('chart-expanded');
      card.setAttribute('aria-expanded', 'true');
      trigger.setAttribute('aria-expanded', 'true'); // SPEC §5.1/§5.6 — trigger 동기화
      // Phase 7c — ChartExpanded (자체 SVG, git rm) → ChartTV (TradingView v5 wrapper, ESM module) 교체.
      // contract 정합: window.ChartTV.render(slot, dailyArr, { ticker, exDividendDates, pinkSignalDates, ... })
      // ESM module은 async load이므로 ChartTV global 등록 지연 가능 — graceful fallback "로딩 중" 유지.
      // exDividendDates / pinkSignalDates 본질 = marker primitive layer (SPEC §3.4 v6 + §15 verbatim).
      if (window.ChartTV && typeof window.ChartTV.render === 'function') {
        window.ChartTV.render(slot, prototypeData, { ticker, exDividendDates, pinkSignalDates });
      } else {
        slot.innerHTML = '<div class="cal-chart-empty">차트 모듈 로딩 중...</div>';
      }
      requestAnimationFrame(() => {
        const closeBtn = slot.querySelector('.cal-chart-close');
        if (closeBtn) closeBtn.focus();
      });

      // 2차 lazy fetch 240영업일 → 성공 시 swap. 차트가 닫혀있으면 swap skip (race).
      const lazyData = await _fetchDailybars(ticker);
      if (!lazyData || lazyData.length === 0) return; // fallback 유지
      if (!card.classList.contains('chart-expanded')) return; // 닫힘
      if (window.ChartTV && typeof window.ChartTV.render === 'function') {
        window.ChartTV.render(slot, lazyData, { ticker, exDividendDates, pinkSignalDates });
      }
    }

    document.addEventListener('click', e => {
      const trigger = e.target.closest('[data-expand-trigger="chart"]');
      if (!trigger) return;
      const card = trigger.closest('.cal-feature-card');
      if (!card) return;
      e.stopPropagation();
      _openChartExpand(trigger, card);
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const trigger = e.target.closest('[data-expand-trigger="chart"]');
      if (!trigger) return;
      e.preventDefault();
      trigger.click();
    });
    window._chartExpandInit = true;
  }

  // 공유 버튼 이벤트 위임 (1회만 등록)
  if (!window._cardShareInit) {
    _loadPageManifest(); // prefetch (논블로킹) — 첫 공유 클릭 전 캐시 워밍
    document.addEventListener('click', async e => {
      const btn = e.target.closest('.cal-share-btn');
      if (!btn) return;
      e.stopPropagation();
      e.preventDefault();
      const card = btn.closest('.cal-feature-card');
      if (!card) return;
      const code = card.getAttribute('data-stock-code') || '';
      const name = card.getAttribute('data-stock-name') || '';
      const urlParams = new URLSearchParams(window.location.search);
      const dateParam = urlParams.get('date');
      // 2026-06-05 (대표 catch, P1 라이브 버그 — 공유 URL 잘못된 날짜 404):
      //   공유 URL 날짜 = "보고 있는 그 카드가 실제로 속한 날짜" 여야 한다. 종래엔 전역
      //   calSelectedDate(현재 선택 셀=오늘)를 썼는데, PRE_MARKET "전일 데이터 보기" 토글은
      //   전일(예: 6/4) 카드를 렌더하면서도 calSelectedDate는 오늘(6/5) → 공유 URL이 6/5 →
      //   6/5 종목페이지 미생성(장 전) → 404 + OG 미표시. 본질 fix: 각 카드에 렌더 시점의
      //   실제 날짜(renderCalExpandContent(date,...))를 data-card-date 로 박제 → 그 값을 1순위.
      //   폴백 chain: data-card-date > ?date= 쿼리 > calSelectedDate(전역) > ''.
      const cardDate = card.getAttribute('data-card-date') || '';
      const dateStr = cardDate || dateParam || (typeof calSelectedDate !== 'undefined' ? calSelectedDate : '');
      // 2026-05-27 (대표 결정, 카톡 미리보기 개선): 공유 URL = OG landing 경로
      //   `/pm320/{date}/{code}.html` (generate_stock_og.py 산출, OG 메타 + 미니캔들 PNG, Q-119 stock 제거).
      //   기존 `?stock={code}&date={date}` query는 OG 메타 부재 → 카톡 미리보기 안 뜸.
      //   landing HTML이 `?stock={code}&date={date}` single-card mode로 JS redirect (Phase 2c-1 정합).
      //   feedback_share_url_ticker_only.md 정합 — URL 경로엔 code 6자리만 (한글 X). 한글은 OG title만.
      //   fallback: date 없으면 OG landing 경로 불가(날짜 디렉토리 필수) → 기존 query URL 유지.
      // 2026-06-01 (대표 catch, FLR-AGT-002 meta 변종 — 메신저 OG scraper HTML 캐시 stale 봉쇄):
      //   shareUrl 에 `?v=YYYYMMDDHH` query (시간 단위) 추가 → 매 시간 신규 URL → 메신저가
      //   landing HTML re-fetch → 새 og:image content (generate_stock_og.py L1014 ?v={mtime}) 적용.
      //   URL path는 그대로 유지 (서버 routing 무관, query param은 정적 파일 fetch에 영향 없음).
      //   양 layer cascade 봉쇄 — HTML 캐시 stale + PNG 캐시 stale 모두 break.
      const _cacheToken = new Date().toISOString().slice(0, 13).replace(/[-T]/g, '');
      // 🔴 404 가드 (2026-06-05) + P0-2 manifest (FLR-20260605-TEC-001):
      //   카드 날짜의 OG landing 페이지가 라이브에 실제 배포돼 있는지 manifest 로 검증 →
      //   배포돼 있으면 OG 경로(`/pm320/{date}/{code}.html`, OG 미리보기 유지),
      //   없으면 정적 news.html(200) 폴백 → 404 URL 절대 생성 금지.
      //   manifest 미신뢰 시엔 기존 PRE_MARKET 휴리스틱으로 degrade (보수적·무회귀).
      //   결정 로직 = _computeShareUrl SSOT (핸들러·셀프테스트 공용, drift 봉쇄).
      await _loadPageManifest();
      const shareUrl = _computeShareUrl(
        window.location.origin, code, dateStr, _cacheToken,
        window._pageManifest, Date.now(),
        (typeof getMarketState === 'function' ? getMarketState : null),
      );
      try {
        if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
          // URL만 공유 — 메신저가 title+text+url을 모두 붙여 중복 생기는 이슈 회피
          await navigator.share({ url: shareUrl });
          return;
        }
      } catch (err) {
        // 사용자 취소(AbortError)는 무시, 그 외엔 폴백
        if (err && err.name === 'AbortError') return;
      }
      // 폴백: 클립보드 복사
      try {
        await navigator.clipboard.writeText(shareUrl);
        showShareToast('링크가 복사되었습니다');
      } catch (err) {
        // 최후 폴백: execCommand
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); showShareToast('링크가 복사되었습니다'); }
        catch { showShareToast('복사 실패 — URL: ' + shareUrl); }
        document.body.removeChild(ta);
      }
    });
    window._cardShareInit = true;
  }

  // P0-3 옵션 A anchor scroll (2026-05-21 09:42 KST 대표 catch):
  //   페이지 진입 시 URL hash `#stock-{ticker}` 감지 → 해당 종목카드 scroll.
  //   본 함수는 카드 렌더 종결 시점 → DOM 본질 보장. swap 분기 (cal-content id 임시 변경) 회피.
  //   1회만 실행 (window._stockHashScrolled flag). popstate/onCalCellClick은 별건 path.
  try {
    const _hashRaw = (window.location.hash || '').replace(/^#/, '');
    const _hashMatch = /^stock-(\d{6})$/.exec(_hashRaw);
    if (_hashMatch && !window._stockHashScrolled) {
      const _ticker = _hashMatch[1];
      const _calContent = document.getElementById('cal-content');
      // swap 분기 회피 — id 임시 변경 시 cal-content 부재 → skip
      if (_calContent) {
        const _target = document.getElementById('stock-' + _ticker);
        if (_target) {
          window._stockHashScrolled = true;
          // sticky 헤더 offset 고려 — block: 'center' 사용 시 자연스러운 가시성
          const _prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          // 데이터 로드 완료 직후 layout 안정화 대기 (raf 1프레임)
          requestAnimationFrame(() => {
            try {
              _target.scrollIntoView({ behavior: _prefersReduce ? 'auto' : 'smooth', block: 'center' });
              // 시각 강조 — 기존 .card-highlight (news.css L1591) 본문 재사용 (2s glow)
              _target.classList.add('card-highlight');
              setTimeout(() => _target.classList.remove('card-highlight'), 2400);
            } catch (_) { /* graceful */ }
          });
        }
      }
    }
  } catch (_) { /* graceful — hash 부재/jsdom 미지원 시 */ }
}

// 공유 버튼 HTML 생성 (SVG 아이콘 + 접근성 속성)
function renderShareButton(it) {
  if (!it || !it.code) return ''; // code 없으면 딥링크 불가 → 버튼 자체 미노출
  const label = `${it.name || ''} 카드 공유하기`;
  return `<button type="button" class="cal-share-btn" aria-label="${escapeHtml(label)}" title="이 카드 공유하기">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  </button>`;
}

// 토스트 알림 (aria-live)
function showShareToast(msg) {
  let toast = document.getElementById('share-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'share-toast';
    toast.className = 'share-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.remove('show');
  // 리플로우 강제하여 재애니메이션
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// design-theme-tree-time-state-v1 — PRE_MARKET 시점 분기 (Option A, 종목카드 동형).
// 테마트리 + 거래대금 추이 섹션도 거래일 09:00 미만 시 빈 상태 + 카운트다운 + 전일 토글 표시.
// theme-tree.json date=5/8 + nodes=5/7 misleading 봉쇄. (대표 04:45 catch)
function _findPrevTradingIso(iso) {
  try {
    const dt = new Date(iso + 'T00:00:00');
    for (let i = 0; i < 10; i++) {
      dt.setDate(dt.getDate() - 1);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      const ps = `${y}-${m}-${dd}`;
      if (typeof isMarketClosed === 'function' && !isMarketClosed(ps)) return ps;
    }
  } catch (_) { /* graceful */ }
  return null;
}

let _themeSectionPreMarketTimer = null;
let _themeSectionPreMarketVisHandler = null;
function _stopThemeSectionPreMarketTimer() {
  if (_themeSectionPreMarketTimer) { clearInterval(_themeSectionPreMarketTimer); _themeSectionPreMarketTimer = null; }
  if (_themeSectionPreMarketVisHandler) {
    document.removeEventListener('visibilitychange', _themeSectionPreMarketVisHandler);
    _themeSectionPreMarketVisHandler = null;
  }
}

// container = 빈 상태 영역 root (theme-tree-container 또는 theme-trend),
// headerHtml = 섹션 헤더 (테마트리 / 거래대금 추이 등 호출자 결정),
// onShowPrev = 전일 토글 시 호출 callback (호출자가 실제 데이터 렌더 책임)
function renderPreMarketThemeSection(container, todayIso, prevIso, headerHtml, onShowPrev) {
  if (!container) return;
  _stopThemeSectionPreMarketTimer();
  const prevLabel = prevIso && typeof formatKoDate === 'function' ? formatKoDate(prevIso) : (prevIso || '');
  container.innerHTML = `
    ${headerHtml || ''}
    <div class="cal-pre-market-empty theme-pre-market-empty" role="status" aria-live="polite">
      <svg class="cal-pre-market-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <polyline points="12 7 12 12 15 14"></polyline>
      </svg>
      <div class="cal-pre-market-title">장 시작 전</div>
      <div class="cal-pre-market-sub">09:00에 신규 데이터가 표출됩니다</div>
      <div class="cal-pre-market-countdown" data-cd-theme="1">${_formatCountdownToOpen()}</div>
      ${prevIso ? `<button type="button" class="cal-pre-market-toggle" data-pre-theme-toggle="1" aria-expanded="false">전일(${prevLabel}) 보기 ▾</button>` : ''}
      <div class="cal-pre-market-prev theme-pre-market-prev" data-pre-theme-prev hidden></div>
    </div>
  `;
  const cdEl = container.querySelector('[data-cd-theme]');
  const tick = () => {
    if (!cdEl || !document.body.contains(cdEl)) { _stopThemeSectionPreMarketTimer(); return; }
    cdEl.textContent = _formatCountdownToOpen();
    const nowH = new Date();
    if (nowH.getHours() >= 9 && (typeof getMarketState !== 'function' || getMarketState() !== 'PRE_MARKET')) {
      _stopThemeSectionPreMarketTimer();
      // 09:00 도달 시 호출자가 알아서 다시 init할 수 있도록 reload-light 시그널만
      try { window.dispatchEvent(new CustomEvent('themeSectionPreMarketEnd')); } catch (_) {}
    }
  };
  _themeSectionPreMarketTimer = setInterval(tick, 1000);
  _themeSectionPreMarketVisHandler = () => {
    if (document.hidden) {
      if (_themeSectionPreMarketTimer) { clearInterval(_themeSectionPreMarketTimer); _themeSectionPreMarketTimer = null; }
    } else if (!_themeSectionPreMarketTimer) {
      tick();
      _themeSectionPreMarketTimer = setInterval(tick, 1000);
    }
  };
  document.addEventListener('visibilitychange', _themeSectionPreMarketVisHandler);

  const toggleBtn = container.querySelector('[data-pre-theme-toggle]');
  const prevBox = container.querySelector('[data-pre-theme-prev]');
  if (toggleBtn && prevBox && prevIso && typeof onShowPrev === 'function') {
    toggleBtn.addEventListener('click', async () => {
      const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      if (expanded) {
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.textContent = `전일(${prevLabel}) 보기 ▾`;
        prevBox.hidden = true;
        prevBox.innerHTML = '';
      } else {
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.textContent = `전일(${prevLabel}) 접기 ▴`;
        prevBox.hidden = false;
        prevBox.setAttribute('data-stale', 'true');
        try { await onShowPrev(prevBox, prevIso); }
        catch (e) { prevBox.textContent = '전일 데이터 로드 실패'; }
      }
    });
  }
}

// ───── PM320 정보 위계 개편 (대표 2026-06-10 결합안) — 섹션 기본 접힘 + 미니요약 + localStorage 펼침 기억 ─────
//   슬롯 이동·섹션 순서 변경 없음. theme-trend / limit-up-trend / theme-tree 3섹션을 기본 접힘으로 전환해
//   장중 동선의 "오늘의 뉴스/픽" 슬롯을 1.3스크롤(390px y<1000) 내로 끌어올린다. 캘린더(toss-cal)는 제외.
//   펼침 상태는 localStorage 'pm320SectionExpand'(JSON {sectionId:true}) 에 기억 → 재방문 복원(대표 동선 보호).
const _PM320_EXPAND_KEY = 'pm320SectionExpand';
function _pm320ExpandState() {
  try { return JSON.parse(localStorage.getItem(_PM320_EXPAND_KEY) || '{}') || {}; }
  catch (_) { return {}; }
}
function _pm320SetExpand(sectionId, expanded) {
  try {
    const st = _pm320ExpandState();
    if (expanded) st[sectionId] = true; else delete st[sectionId];
    localStorage.setItem(_PM320_EXPAND_KEY, JSON.stringify(st));
  } catch (_) { /* private mode silent */ }
}
// 접힘 헤더 HTML — title/sub 기존 구조 보존 + 미니요약 span + chevron + a11y(role/aria-expanded/aria-controls).
//   data-collapse-section 으로 토글 위임 식별. 기존 data-scroll-to-section 은 제거(스크롤→토글 전환).
function _collapseHeaderHtml(sectionId, headerCls, title, sub, summary, titleCls, subCls) {
  const bodyId = 'sec-body-' + sectionId;
  return '<div class="' + headerCls + ' pm320-section-header" role="button" tabindex="0"'
    + ' data-collapse-section="' + sectionId + '" aria-expanded="false" aria-controls="' + bodyId + '"'
    + ' aria-label="' + escapeHtml(title) + ' 섹션 펼치기/접기">'
    + '<div class="pm320-section-headline">'
    + '<div class="' + titleCls + '">' + escapeHtml(title) + '</div>'
    + '<div class="' + subCls + '">' + escapeHtml(sub) + '</div>'
    + '</div>'
    + '<span class="pm320-section-summary" data-collapse-summary="1">' + summary + '</span>'
    + '<span class="pm320-section-chevron" aria-hidden="true">▾</span>'
    + '</div>';
}
// 렌더 직후 호출 — section root 에 collapsed 클래스 + body id 부여 + localStorage 펼침 상태 복원.
function _applySectionCollapse(root, sectionId) {
  if (!root) return;
  const body = root.querySelector('.section-collapse-body');
  if (body) body.id = 'sec-body-' + sectionId;
  const header = root.querySelector('[data-collapse-section="' + sectionId + '"]');
  const expanded = _pm320ExpandState()[sectionId] === true;
  root.classList.add('pm320-collapsible');
  if (expanded) {
    root.classList.remove('pm320-section-collapsed');
    if (header) header.setAttribute('aria-expanded', 'true');
    if (body) body.removeAttribute('hidden');
  } else {
    root.classList.add('pm320-section-collapsed');
    if (header) header.setAttribute('aria-expanded', 'false');
    if (body) body.setAttribute('hidden', '');
  }
}
// 토글 위임 (1회 등록) — 헤더 click/Enter/Space → collapsed 토글 + aria + hidden + localStorage 기억.
function _wireSectionCollapse() {
  if (window._pm320SectionCollapseInit) return;
  const toggle = (header) => {
    const sectionId = header.getAttribute('data-collapse-section');
    if (!sectionId) return;
    const root = document.getElementById(sectionId);
    if (!root) return;
    const body = root.querySelector('.section-collapse-body');
    const nowCollapsed = root.classList.toggle('pm320-section-collapsed');
    const expanded = !nowCollapsed;
    header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    if (body) { if (expanded) body.removeAttribute('hidden'); else body.setAttribute('hidden', ''); }
    _pm320SetExpand(sectionId, expanded);
  };
  document.addEventListener('click', (e) => {
    const header = e.target.closest('[data-collapse-section]');
    if (!header) return;
    if (e.target.closest('a, button, input')) return;
    toggle(header);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const header = e.target.closest('[data-collapse-section]');
    if (!header) return;
    e.preventDefault();
    toggle(header);
  });
  window._pm320SectionCollapseInit = true;
}

// ───── 테마 거래대금 트렌드 ─────
// P0-1 (2026-06-11, 서빙 표류 diag 확정) — theme-trend window·정렬·trim 공통 SSOT 함수.
//   종전: 본체 renderer = "20영업일 누적 trade_amount desc" 정렬 / lut fallback(L4280대) =
//   "마지막날 trade_amount desc" 정렬 — 5/13·14 무데이터 테마가 fallback 1순위가 되어 trim 2일
//   발생. 로드 race(window.__chartDates 승자)에 따라 "20영업일·5/13~" vs "18영업일·5/15~" 헤더가
//   로드마다 교차하던 P0. 한쪽 fix 양끝 누락 동형(FLR-20260428-TEC-001) — 공통 함수 1개로 양 경로
//   호출(구조 차단). 정렬 SSOT = 20영업일 누적 trade_amount desc (대표 5/8 07:42 박제).
function _themeTrendWindow(themeData) {
  let dates = ((themeData && themeData.dates) || []).slice(-20);
  let dateSet = new Set(dates);
  const cumAmtOf = (t) => (t.data || []).reduce((s, d) => s + ((d.stock_count || 0) > 0 ? (d.trade_amount || 0) : 0), 0);
  let roots = ((themeData && themeData.themes) || [])
    .map(t => ({ ...t, data: (t.data || []).filter(d => dateSet.has(d.date)) }))
    .filter(t => t.data.some(d => (d.stock_count || 0) > 0)) // 20영업일 동안 어느 일자라도 활성
    .map(t => ({ ...t, _cumAmt: cumAmtOf(t) }))
    .sort((a, b) => (b._cumAmt || 0) - (a._cumAmt || 0));
  // roots[0](정렬 1순위, 가장 두드러진 polyline) 첫 활성일 기준 선두 trim (REQ-006 v196 — qa-lead 권고 A)
  if (roots.length > 0 && dates.length > 0) {
    const first = roots[0];
    let firstDataIdx = 0;
    for (let i = 0; i < dates.length; i++) {
      if (first && first.data && first.data.some(d => d.date === dates[i] && d.stock_count > 0)) { firstDataIdx = i; break; }
    }
    if (firstDataIdx > 0) {
      dates = dates.slice(firstDataIdx);
      dateSet = new Set(dates);
      roots = roots.map(t => ({ ...t, data: t.data.filter(d => dateSet.has(d.date)) }));
    }
  }
  return { dates, roots };
}
async function initThemeTrend() {
  try {
    // 대표 catch (5/8 04:58): 거래대금 추이는 트렌드 차트 — 장 개시 여부/휴장 무관 항상 표시.
    // 종전 a3555362(5/8 04:48) PRE_MARKET 분기는 잘못된 적용 → rollback (대표 정합).
    // PRE_MARKET 분기는 일자별 카드성 데이터(테마트리 initThemeTree)에만 유지.
    const res = await fetch('/data/themes/theme-trend.json');
    if (!res.ok) return;
    const data = await res.json();
    const container = document.getElementById('theme-trend');
    if (!container || !data.themes || !data.dates) return;

    // 단계 2 (대표 07:17 명령, design-trend-chart-viewport-legend 07:20 명세):
    // VISIBLE_DAYS 분기 — 모바일 7 / 데스크탑 10. isMobile은 L1390 → 여기로 이전 (FIXED_SLOT/VISIBLE_DAYS 정합 우선 계산).
    // REQ-007 5/4 v190 정합: 880px breakpoint (lut-trend 정합).
    const isMobile = window.innerWidth < 880;
    const VISIBLE_DAYS = isMobile ? 7 : 10;
    const allDates = data.dates;
    if (allDates.length < 1) return;
    // 대표 catch (5/8 04:52): theme-trend window = 최근 20영업일 (limit-up-trend 정합).
    // 대표 명세 (5/8 07:42 재정정 verbatim): "테마트리 최상위 노드가 다 나와서 윈도우에 보이는 애들만 활성화 나머진 비활성화"
    // = legend = 20일 union root 모두 (~33개) 표시 / polyline도 모두 그리기 / viewport 외 = dim (display:none X).
    // P0-1 (2026-06-11) — window·정렬(누적 trade_amount desc)·trim = _themeTrendWindow 공통 SSOT
    //   (lut fallback 과 단일 출처 — 헤더 "20영업일 vs 18영업일" race 표류 구조 차단).
    const _win = _themeTrendWindow(data);
    let dates = _win.dates;
    let dateSet = new Set(dates);
    const unionRoots = _win.roots;
    let themes = unionRoots; // cap 폐기 — viewport 활성/비활성 dim 정책으로 가독성 확보
    const legendThemes = unionRoots; // 20영업일 union 전체 (themes와 동일, 1:1)
    // lut renderer가 참조할 SSOT 저장 (race-free: theme이 먼저 fetch+render되면 lut가 사용,
    // 미존재 시 lut가 동일 로직으로 fallback 계산)
    window.__chartDates = dates;
    const needsScroll = dates.length > VISIBLE_DAYS;

    if (themes.length === 0) {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const closedToday = isMarketClosed(todayStr);
      const nextDate = closedToday ? getNextTradingDate(todayStr) : null;
      const nextLabel = nextDate ? formatKoDate(nextDate) : '';
      const emptyMsg = closedToday
        ? `<div style="text-align:center;padding:32px 0;"><div style="font-size:15px;font-weight:700;color:var(--tx2);margin-bottom:6px;">오늘은 장이 쉽니다</div><div style="font-size:12px;color:var(--dm);">${nextLabel ? '다음 거래일 ' + escapeHtml(nextLabel) : ''}</div></div>`
        : '<div class="cal-empty" style="padding:24px 0;">테마 트렌드 데이터가 없습니다</div>';
      container.innerHTML =
        _collapseHeaderHtml('theme-trend', 'theme-trend-header', '테마별 거래대금 추이',
          '최근 거래대금 흐름', '데이터 없음', 'theme-trend-title', 'theme-trend-sub')
        + '<div class="section-collapse-body">' + emptyMsg + '</div>';
      _applySectionCollapse(container, 'theme-trend');
      return;
    }

    // COLORS palette = 36색 (33+ 보장, 5/8 07:42 cap 폐기 정합 — viewport union root ~30~33 모두 1:1).
    // 12색 base palette 확장 — 채도/명도 변주로 인접 hue 충돌 회피. dark theme bg(#0E1116)에서 명도 확보.
    const COLORS = [
      '#C49930','#5B8DEF','#E06B6B','#4BC9A0','#A97BDB','#E8963E','#6BB5E0','#D46BAD','#7B9E3D','#E0886B','#6B8FD4','#B86BD4',
      '#F0C674','#7FB3F0','#F08A8A','#7DD9B5','#C49AE5','#F0AD60','#8FCEEB','#E89AC9','#9BBE5C','#F0A88A','#8FA8E0','#CC8FE0',
      '#A87E1F','#3F6FCF','#C04A4A','#2E9E80','#8855B5','#C77518','#4A95C0','#B5478C','#5C7E1F','#C0664A','#4A6FB0','#9B4AB0'
    ];

    // SVG 치수 — 반응형 (모바일 vs 데스크탑)
    // REQ-007 5/4 v190: isMobile breakpoint 640→880 (CSS @media + lut 정합)
    // 단계 2: isMobile은 L1324 직전으로 이전됨 (VISIBLE_DAYS 분기 우선 계산). 여기서 재선언 불가.
    const yAxisW = isMobile ? 36 : 44;
    const H = isMobile ? 180 : 180; // REQ-003: desktop 160→180 (lut-trend 정합, viewBox 비율 정합)
    const PAD = isMobile
      ? { top: 10, right: 8, bottom: 26 }
      : { top: 12, right: 8, bottom: 28 };
    const plotH = H - PAD.top - PAD.bottom;

    // REQ-003 5/4 v185: SLOT pixel 고정 강제 — lut와 chart layout 100% 동일 보장 (chartW = (N-1)*SLOT + 2*EDGE_PAD)
    // 두 chart 같은 SLOT + 같은 EDGE_PAD + 같은 plotW 식 → 같은 방식 렌더링/표시/동작
    const wrapPadding = isMobile ? 28 : 40;
    const measuredW = container.clientWidth || 720;
    const availableW = Math.max(280, measuredW - wrapPadding - yAxisW);
    const baseW = isMobile ? 320 : availableW;
    const FIXED_SLOT = isMobile ? 53 : 80;
    const chartW = needsScroll ? ((dates.length - 1) * FIXED_SLOT + 2 * 32) : baseW;
    const plotW = chartW - PAD.right;

    // 날짜 인덱스 맵
    const dateIdx = {};
    dates.forEach((d, i) => { dateIdx[d] = i; });

    // Y축 최대값
    let yMax = 0;
    themes.forEach(t => t.data.forEach(d => { if (d.trade_amount > yMax) yMax = d.trade_amount; }));
    yMax = yMax * 1.1; // 10% headroom

    // REQ-003 5/4 v184: chart svg 양 끝 32px padding (yAxis 시각 거리 충분 확보, lut와 정합)
    const CHART_EDGE_PAD = 32;
    const plotInnerW = Math.max(1, chartW - 2 * CHART_EDGE_PAD);
    const slot = plotInnerW / Math.max(dates.length - 1, 1);
    function toX(i) { return CHART_EDGE_PAD + i * slot; }
    function toY(v) { return PAD.top + plotH - (v / yMax) * plotH; }
    function fmtTril(v) { return (v / 1e12).toFixed(1) + '조'; }
    function fmtDate(d) { const m = parseInt(d.slice(5, 7), 10); const day = parseInt(d.slice(8, 10), 10); return `${m}/${day}`; } // REQ-004 5/4 v187: lut fmtMD 정합 (5/4 형식, 04/04 → 4/4)

    // Y축 별도 SVG (고정)
    let yAxisSvg = '<svg class="theme-trend-svg" viewBox="0 0 ' + yAxisW + ' ' + H + '" width="' + yAxisW + '" xmlns="http://www.w3.org/2000/svg">';
    const axisFontSize = isMobile ? 9 : 10; // REQ-002: 데스크탑 7→10 (lut-trend 정합)
    for (let i = 0; i <= 2; i++) {
      const v = (yMax / 2) * i;
      const y = toY(v);
      yAxisSvg += '<text x="' + (yAxisW - 4) + '" y="' + (y + 3) + '" text-anchor="end" fill="#64748B" font-size="' + axisFontSize + '">' + fmtTril(v) + '</text>'; // REQ-003: fill 색 lut-trend 정합 (#8B95A8 → #64748B)
    }
    yAxisSvg += '</svg>';

    // 차트 SVG 빌드
    let svg = '<svg class="theme-trend-svg" viewBox="0 0 ' + chartW + ' ' + H + '" width="' + chartW + '" xmlns="http://www.w3.org/2000/svg">';

    // 가로 눈금선 (3개)
    for (let i = 0; i <= 2; i++) {
      const v = (yMax / 2) * i;
      const y = toY(v);
      svg += '<line x1="0" y1="' + y + '" x2="' + chartW + '" y2="' + y + '" stroke="#E8ECF2" stroke-width="0.5"/>';
    }

    // X축 날짜 라벨 — REQ-007 v177: 첫/마지막 anchor 변경 (chart 가장자리 침범 회피)
    const xFontSize = isMobile ? 9 : 10;
    dates.forEach((d, i) => {
      const anchor = i === 0 ? 'start' : (i === dates.length - 1 ? 'end' : 'middle');
      svg += '<text x="' + toX(i) + '" y="' + (H - 4) + '" text-anchor="' + anchor + '" fill="#64748B" font-size="' + xFontSize + '">' + fmtDate(d) + '</text>';
    });

    // 각 테마 polyline + 투명 히트 서클
    // R28 P1⑥ — y domain 동적 재산출용 시리즈 좌표 registry (x·amount 불변, y만 재계산 대상).
    const _seriesPts = [];
    themes.forEach((theme, ti) => {
      const color = COLORS[ti % COLORS.length];
      const points = [];
      const dataMap = {};
      theme.data.forEach(d => { dataMap[d.date] = d; });

      dates.forEach((d, i) => {
        if (dataMap[d]) {
          points.push({ x: toX(i), y: toY(dataMap[d].trade_amount), date: d, amount: dataMap[d].trade_amount });
        }
      });

      if (points.length < 1) return;
      _seriesPts.push({ ti, pts: points });

      if (points.length === 1) {
        svg += '<circle cx="' + points[0].x + '" cy="' + points[0].y + '" r="3" fill="#FFF" stroke="' + color + '" stroke-width="1.5" data-theme="' + escapeHtml(theme.name) + '" data-amount="' + points[0].amount + '" data-date="' + points[0].date + '" data-theme-idx="' + ti + '" data-color="' + color + '" class="tt-hit tt-dot" style="cursor:pointer"/>';
      } else {
        const polyPts = points.map(p => p.x + ',' + p.y).join(' ');
        const strokeW = isMobile ? 2 : 1.2;
        const dotR = isMobile ? 3.5 : 2;
        const hitR = isMobile ? 16 : 12;
        svg += '<polyline points="' + polyPts + '" fill="none" stroke="' + color + '" stroke-width="' + strokeW + '" stroke-linecap="round" stroke-linejoin="round" opacity="0.8" data-theme-idx="' + ti + '"/>';
        points.forEach(p => {
          svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + hitR + '" fill="transparent" stroke="none" data-theme="' + escapeHtml(theme.name) + '" data-amount="' + p.amount + '" data-date="' + p.date + '" data-theme-idx="' + ti + '" data-color="' + color + '" class="tt-hit" style="cursor:pointer"/>';
          svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + dotR + '" fill="#FFF" stroke="' + color + '" stroke-width="1.5" data-theme-idx="' + ti + '" data-color="' + color + '" data-amount="' + p.amount + '" class="tt-dot"/>';
        });
      }
    });

    // REQ-005-2026-05-04 v183: cover rect 제거 (자연 mask는 .trend-y-axis absolute z-index:2가 담당)
    svg += '</svg>';

    // 레전드 — 대표 명세 (5/8 07:42 verbatim): 33 root 모두 표시. viewport 활성 = 정상, viewport 외 = dim.
    // legend ↔ polyline 1:1 (themes === legendThemes === unionRoots 전체).
    // viewport-inactive 정책: news.css에서 opacity 0.4 + pointer-events none (display:none X — 33개 가시성 유지).
    // PM320 정보 위계 개편 (대표 2026-06-10) — 모바일 범례 40+개 clamp(접기안과 양립, 대표 18:09 유지 지시).
    //   섹션 펼침 시에도 범례가 길면 모바일에서 상위 ~2행만 노출 + "범례 모두 보기/접기" 토글(≥12개일 때).
    //   데스크탑은 clamp 미적용(전체 노출) + 토글 CSS 숨김. polyline↔legend 1:1 무손상.
    const LEGEND_COLLAPSE_MIN = 12;
    const _legendCollapsible = legendThemes.length >= LEGEND_COLLAPSE_MIN;
    let legend = '<div class="theme-trend-legend' + (_legendCollapsible ? ' is-collapsible collapsed' : '') + '">';
    legendThemes.forEach((t, idx) => {
      legend += '<span class="theme-trend-legend-item" data-legend-idx="' + idx + '"><span class="swatch" style="background:' + COLORS[idx % COLORS.length] + '"></span>' + escapeHtml(t.name) + '</span>';
    });
    legend += '</div>';
    if (_legendCollapsible) {
      legend += '<button type="button" class="theme-trend-legend-toggle" data-legend-toggle="1" aria-expanded="false">'
        + '범례 모두 보기 (' + legendThemes.length + ')</button>';
    }

    const dateRange = fmtDate(dates[0]) + ' ~ ' + fmtDate(dates[dates.length - 1]);
    // PM320 정보 위계 개편 (대표 2026-06-10 결합안) — 섹션 기본 접힘. 헤더에 미니요약 1줄.
    //   요약 = 1위 테마(거래대금 union 최상위) 강세. legendThemes[0] (= unionRoots[0]).
    const _ttTop = (legendThemes && legendThemes[0] && legendThemes[0].name) ? legendThemes[0].name : '';
    const _ttSummary = _ttTop ? escapeHtml(_ttTop) + ' 강세' : '거래대금 흐름';
    container.innerHTML =
      _collapseHeaderHtml('theme-trend', 'theme-trend-header', '테마별 거래대금 추이',
        '최근 ' + dates.length + '영업일 · ' + dateRange, _ttSummary, 'theme-trend-title', 'theme-trend-sub') +
      '<div class="section-collapse-body">' +
        '<div class="theme-trend-wrap">' +
          '<div class="trend-y-axis">' + yAxisSvg + '</div>' +
          '<div class="trend-scroll-area">' + svg + '</div>' +
          legend +
          '<div id="trend-detail" class="trend-detail"></div>' +
          '<div class="theme-trend-tooltip" id="tt-trend"></div>' +
        '</div>' +
      '</div>';
    _applySectionCollapse(container, 'theme-trend');

    // PM320 (대표 2026-06-10) — 모바일 범례 접기/펼치기 토글 wiring (모바일 전용 효과, 데스크탑 CSS 숨김).
    const _legendToggleBtn = container.querySelector('[data-legend-toggle="1"]');
    const _legendEl = container.querySelector('.theme-trend-legend');
    if (_legendToggleBtn && _legendEl) {
      _legendToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const _collapsed = _legendEl.classList.toggle('collapsed');
        _legendToggleBtn.setAttribute('aria-expanded', _collapsed ? 'false' : 'true');
        _legendToggleBtn.textContent = _collapsed
          ? '범례 모두 보기 (' + legendThemes.length + ')'
          : '범례 접기';
      });
    }

    // -- 횡스크롤 초기화 (대표 catch 5/8: trend-fade-left 흰박스 제거, yaxis-col 자연 mask로 충분) --
    const scrollArea = container.querySelector('.trend-scroll-area');
    if (scrollArea && needsScroll) {
      requestAnimationFrame(() => {
        scrollArea.scrollLeft = scrollArea.scrollWidth;
      });
    }

    // -- 레전드 토글 (단일 선택) --
    let selectedIdx = -1; // -1 = 전체 표시
    const legendItems = container.querySelectorAll('.theme-trend-legend-item');
    const svgEl = scrollArea.querySelector('.theme-trend-svg');

    function applyLegendFilter() {
      const none = selectedIdx === -1;
      // SVG 요소 opacity — 비활성 포인트는 완전 숨김 + 클릭 차단
      // 5/8 fix (qa D7/D8): selectedIdx 활성 polyline 강조 (opacity 1 + stroke-width +0.6) / 비활성 0.15
      svgEl.querySelectorAll('[data-theme-idx]').forEach(el => {
        const idx = parseInt(el.dataset.themeIdx);
        const active = none || idx === selectedIdx;
        const isDot = el.classList.contains('tt-dot');
        const isHit = el.classList.contains('tt-hit');
        const isPolyline = el.tagName === 'polyline';
        if (isDot) {
          // 시각 dot (단일 포인트는 tt-hit+tt-dot 동시): 비활성이면 완전 숨김
          el.style.opacity = active ? '' : '0';
          el.style.pointerEvents = active ? '' : 'none';
          if (!isHit) return; // tt-dot 전용이면 여기서 끝
        }
        if (isHit) {
          // 히트 서클: 비활성이면 이벤트 차단
          el.style.pointerEvents = active ? '' : 'none';
          return;
        }
        // polyline: selectedIdx 단일 선택 시 active = 강조(opacity 1), 비active = 0.15. 전체 표시 시 default 복원
        if (isPolyline) {
          if (none) {
            el.style.opacity = '';
            el.removeAttribute('data-selected');
          } else if (active) {
            el.style.opacity = '1';
            el.setAttribute('data-selected', '1');
          } else {
            el.style.opacity = '0.15';
            el.removeAttribute('data-selected');
          }
          return;
        }
        el.style.opacity = active ? '' : '0.1';
      });
      // 레전드 스타일
      legendItems.forEach(li => {
        const idx = parseInt(li.dataset.legendIdx);
        const active = none || idx === selectedIdx;
        li.classList.toggle('selected', idx === selectedIdx);
        li.classList.toggle('dimmed', !none && !active);
      });
    }

    legendItems.forEach(li => {
      li.addEventListener('click', () => {
        const idx = parseInt(li.dataset.legendIdx);
        // 이미 선택된 테마를 다시 클릭하면 전체 표시로 복귀
        selectedIdx = (selectedIdx === idx) ? -1 : idx;
        applyLegendFilter();
        // 수동 선택 변경 시 viewport 필터 재평가 (수동 우선 정책)
        updateViewportLegend();
      });
    });

    // ─── 단계 2: viewport-aware legend sync (대표 07:17 명령, design 07:20 명세) ───
    // §2 viewport idx = round((scrollLeft - 32) / FIXED_SLOT), §3 rAF debounce, §4 polyline opacity 0.08
    // 잠재 결함: selectedIdx !== -1 (수동 선택) 시 viewport 필터 비활성. 수동 우선 정책 (design 권고).
    function computeViewportRange() {
      if (!scrollArea) return { firstIdx: 0, lastIdx: dates.length - 1 };
      const firstIdx = Math.max(0, Math.round((scrollArea.scrollLeft - 32) / FIXED_SLOT));
      const lastIdx = Math.min(dates.length - 1, firstIdx + VISIBLE_DAYS - 1);
      return { firstIdx, lastIdx };
    }
    const legendContainer = container.querySelector('.theme-trend-legend');
    // ─── R28 P1⑥ (조니 2심, 2026-06-11) — y축 domain 가시 윈도우 데이터 기반 동적 산출 ───
    //   종전: yMax = 20영업일 전체 max(예 AI 6/1 8.2조 outlier) 단일 고정 → 축이 항상 "9.0조"로
    //   읽히고(조니 "9조 고정"), 초기 우측 정렬 윈도우(최근 7일 max ~1조)의 전 라인이 바닥 ~11%
    //   압착. 스크롤 시 가시 날짜 범위 max 로 domain 재산출(rAF) — polyline/dot y좌표 + y축 라벨
    //   동시 갱신. x축 라벨은 기간 전체 유지(전 일자 라벨 존속 — 데이터·기간 손실 0).
    let _curYMax = yMax;
    const _yAxisSvgEl = container.querySelector('.trend-y-axis svg');
    function _applyYDomain(newMax) {
      if (!(newMax > 0) || !svgEl) return;
      if (Math.abs(newMax - _curYMax) / _curYMax < 0.02) return; // 미세 변동 skip (tick 안정)
      _curYMax = newMax;
      const toY2 = v => PAD.top + plotH - (v / _curYMax) * plotH;
      _seriesPts.forEach(s => {
        const pl = svgEl.querySelector('polyline[data-theme-idx="' + s.ti + '"]');
        if (pl) pl.setAttribute('points', s.pts.map(p => p.x + ',' + toY2(p.amount)).join(' '));
      });
      svgEl.querySelectorAll('circle[data-amount]').forEach(c => {
        const amt = Number(c.getAttribute('data-amount'));
        if (Number.isFinite(amt)) c.setAttribute('cy', String(toY2(amt)));
      });
      // 활성 골드 링은 구좌표 잔존 — 정리 (재클릭 시 신좌표로 재생성, detail 테이블은 유지)
      svgEl.querySelectorAll('.tt-gold-ring').forEach(el => el.remove());
      if (_yAxisSvgEl) {
        _yAxisSvgEl.querySelectorAll('text').forEach((t, i) => {
          t.textContent = fmtTril((_curYMax / 2) * i);
        });
      }
    }
    function _updateYDomain() {
      const { firstIdx, lastIdx } = computeViewportRange();
      let m = 0;
      themes.forEach(t => (t.data || []).forEach(d => {
        const di = dateIdx[d.date];
        if (di != null && di >= firstIdx && di <= lastIdx && (d.trade_amount || 0) > m) m = d.trade_amount;
      }));
      _applyYDomain(m > 0 ? m * 1.1 : yMax); // 가시 데이터 0 → 전체 domain 폴백 (빈 축 방지)
    }
    function updateViewportLegend() {
      // 수동 선택 시 viewport 필터 비활성 — applyLegendFilter가 단일 root만 표시 (수동 우선)
      if (selectedIdx !== -1) {
        // viewport-inactive 클래스만 정리. polyline opacity는 applyLegendFilter가 설정한 값(1/0.15) 보존.
        // 5/8 10:02 fix (대표 catch 회귀): 이전 코드 pl.style.opacity = '' 가 applyLegendFilter inline 값을 덮어써서
        // 강조 효과 무력화 → 모든 polyline SVG attribute opacity=0.8 으로 회귀. 본 라인 제거로 selectedIdx 강조 복원.
        legendItems.forEach(li => li.classList.remove('viewport-inactive'));
        legendContainer && legendContainer.querySelector('.theme-trend-legend-empty-hint')?.remove();
        return;
      }
      const { firstIdx, lastIdx } = computeViewportRange();
      const viewportDates = new Set(dates.slice(firstIdx, lastIdx + 1));
      legendItems.forEach(li => {
        const idx = parseInt(li.dataset.legendIdx);
        const theme = themes[idx];
        // §2 옵션 A: viewport 일자 중 어느 하나라도 stock_count > 0 → 활성
        const isActive = !!(theme && theme.data && theme.data.some(d => viewportDates.has(d.date) && (d.stock_count || 0) > 0));
        li.classList.toggle('viewport-inactive', !isActive);
        // §4 viewport-inactive polyline opacity 0.08 (완전 hide X, 컨텍스트 단서)
        const polyline = svgEl.querySelector(`polyline[data-theme-idx="${idx}"]`);
        if (polyline) polyline.style.opacity = isActive ? '' : '0.08';
        // 단일 dot (points.length === 1) — circle.tt-hit.tt-dot 합쳐진 경우도 흐리게
        const singleDot = svgEl.querySelector(`circle.tt-hit.tt-dot[data-theme-idx="${idx}"]`);
        if (singleDot && !polyline) singleDot.style.opacity = isActive ? '' : '0.08';
      });
      // §3 fallback: viewport 활성 root 0개 시 hint
      if (!legendContainer) return;
      const activeCount = legendContainer.querySelectorAll('.theme-trend-legend-item:not(.viewport-inactive)').length;
      const existingHint = legendContainer.querySelector('.theme-trend-legend-empty-hint');
      if (activeCount === 0) {
        if (!existingHint) {
          const hint = document.createElement('span');
          hint.className = 'theme-trend-legend-empty-hint';
          hint.textContent = '이 기간에 활성 테마 없음 ← 좌측 스크롤';
          legendContainer.appendChild(hint);
        }
      } else if (existingHint) {
        existingHint.remove();
      }
    }
    if (scrollArea && needsScroll) {
      scrollArea.addEventListener('scroll', () => {
        requestAnimationFrame(() => { updateViewportLegend(); _updateYDomain(); });
      }, { passive: true });
    }
    // 초기 진입 1회 (rAF) — 우측 정렬 후 viewport 평가 + y domain 가시 윈도우 산출 (R28 P1⑥)
    requestAnimationFrame(() => { updateViewportLegend(); _updateYDomain(); });

    // -- 포인트 클릭 → 종목 테이블 --
    const detailDiv = document.getElementById('trend-detail');
    let activePoint = null; // "theme|date" key

    function fmtAmount(v) {
      if (v == null) return '-';
      if (v >= 1e12) return (v / 1e12).toFixed(1) + '조';
      if (v >= 1e8) return (v / 1e8).toFixed(0) + '억';
      if (v >= 1e4) return Math.round(v / 1e4).toLocaleString() + '만';
      return v.toLocaleString();
    }

    function showStockDetail(themeName, dateStr, themeIdx) {
      const key = themeName + '|' + dateStr;
      // 기존 골드 링 제거 + active 해제 (fill #FFF 복원 — 빈 default)
      svgEl.querySelectorAll('.tt-gold-ring').forEach(el => el.remove());
      svgEl.querySelectorAll('.tt-dot.tt-dot--active').forEach(el => {
        el.classList.remove('tt-dot--active');
        el.setAttribute('fill', '#FFF');
      });
      activePoint = key;
      // 테마 데이터에서 stocks 찾기
      const theme = themes[themeIdx];
      if (!theme) return;
      const dayData = theme.data.find(d => d.date === dateStr);
      // 종목코드/종목명 기준 dedup
      const rawStocks = dayData && dayData.stocks ? dayData.stocks : [];
      const seenStockKey = new Set();
      const stocks = rawStocks.filter(s => {
        const key = s.stock_code || s.code || s.name || '';
        if (!key || seenStockKey.has(key)) return false;
        seenStockKey.add(key);
        return true;
      });
      // 골드 링 추가 + 해당 dot active 클래스 부여 (CSS stroke=#FFF + r 확대)
      const hits = svgEl.querySelectorAll('.tt-hit[data-theme="' + themeName.replace(/"/g, '\\"') + '"][data-date="' + dateStr + '"]');
      hits.forEach(h => {
        const cx = h.getAttribute('cx');
        const cy = h.getAttribute('cy');
        const matchDot = svgEl.querySelector('circle.tt-dot[cx="' + cx + '"][cy="' + cy + '"][data-theme-idx="' + themeIdx + '"]');
        if (matchDot) {
          matchDot.classList.add('tt-dot--active');
          matchDot.setAttribute('fill', h.getAttribute('data-color') || '#C49930');
        }
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('cx', cx);
        ring.setAttribute('cy', cy);
        ring.setAttribute('r', '5');
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', h.getAttribute('data-color') || '#C49930');
        ring.setAttribute('stroke-width', '2');
        ring.classList.add('tt-gold-ring');
        svgEl.appendChild(ring);
      });
      // 테이블 렌더
      const chipDate = dateStr.slice(5).replace('-', '/');
      let html = '<div class="trend-detail-chip">' + chipDate + ' &middot; ' + escapeHtml(themeName) + '</div>';
      if (stocks.length === 0) {
        html += '<div style="font-size:12px;color:var(--dm);padding:8px 0;">종목 데이터가 없습니다</div>';
      } else {
        html += '<table class="trend-detail-table"><thead><tr><th class="th-name">종목명</th><th class="th-price">종가</th><th class="th-pct">등락률</th><th class="th-candle"></th><th class="th-amount">거래대금</th></tr></thead><tbody>';
        stocks.forEach(s => {
          const pctClass = s.change_pct > 0 ? '#E03131' : s.change_pct < 0 ? '#1971C2' : 'var(--tx)';
          const pctStr = (s.change_pct > 0 ? '+' : '') + s.change_pct.toFixed(2) + '%';
          // 종목명 (anchor click 폐기 — 대표 결정 2026-04-30, 텍스트만 노출)
          const nameCell = escapeHtml(s.name);
          html += '<tr><td class="td-name">' + nameCell + '</td><td class="td-price">' + (s.price ? s.price.toLocaleString() : '-') + '</td><td class="td-pct" style="color:' + pctClass + ';font-weight:600">' + pctStr + '</td><td class="td-candle">' + miniCandle(s.open_price, s.high_price, s.low_price, s.price, s.change_pct) + '</td><td class="td-amount">' + fmtAmount(s.trade_amount) + '</td></tr>';
        });
        html += '</tbody></table>';
      }
      detailDiv.innerHTML = html;
      // 트랜지션
      detailDiv.classList.remove('open');
      requestAnimationFrame(() => { detailDiv.classList.add('open'); });
    }

    // -- 툴팁 + 클릭 --
    const tooltip = document.getElementById('tt-trend');
    const wrap = container.querySelector('.theme-trend-wrap');

    if (!isMobile) {
      wrap.addEventListener('mousemove', function(e) {
        const hit = e.target.closest('.tt-hit');
        if (!hit) { tooltip.classList.remove('show'); return; }
        // 비활성 테마 포인트는 툴팁 표시 안 함
        const hitIdx = parseInt(hit.dataset.themeIdx);
        if (selectedIdx !== -1 && hitIdx !== selectedIdx) { tooltip.classList.remove('show'); return; }
        const name = hit.dataset.theme;
        const amount = Number(hit.dataset.amount);
        tooltip.textContent = name + ' ' + fmtTril(amount);
        tooltip.classList.add('show');
        const wrapRect = wrap.getBoundingClientRect();
        let left = e.clientX - wrapRect.left + 12;
        const ttWidth = tooltip.offsetWidth || 120;
        if (left + ttWidth > wrapRect.width) left = e.clientX - wrapRect.left - ttWidth - 12;
        tooltip.style.left = left + 'px';
        tooltip.style.top = (e.clientY - wrapRect.top - 28) + 'px';
      });
      wrap.addEventListener('mouseleave', function() { tooltip.classList.remove('show'); });
    }

    wrap.addEventListener('click', function(e) {
      // 정정 #12 (대표 18:30): trend-stock-link anchor 클릭은 wrap handler가 가로채면 안 됨.
      // outside-click logic으로 detail 닫히고 navigation 직전 DOM 변경 → anchor 동작 깨짐.
      if (e.target.closest('.trend-stock-link, a[href]')) return;
      const hit = e.target.closest('.tt-hit');
      if (!hit) {
        // 포인트 외 클릭 → 선택 해제 (fill #FFF 복원)
        svgEl.querySelectorAll('.tt-gold-ring').forEach(el => el.remove());
        svgEl.querySelectorAll('.tt-dot.tt-dot--active').forEach(el => {
          el.classList.remove('tt-dot--active');
          el.setAttribute('fill', '#FFF');
        });
        activePoint = null;
        detailDiv.classList.remove('open');
        detailDiv.innerHTML = '';
        return;
      }
      tooltip.classList.remove('show');
      const themeName = hit.dataset.theme;
      const dateStr = hit.dataset.date;
      const themeIdx = parseInt(hit.dataset.themeIdx);
      // 레전드 필터 활성 시, 비선택 테마 클릭 무시
      if (selectedIdx !== -1 && selectedIdx !== themeIdx) return;
      showStockDetail(themeName, dateStr, themeIdx);
    });

  } catch (e) { console.warn('theme-trend:', e); }
}

// ───── REQ-pm320-ux-cycle #2 — 상한가 종목 추이 (theme-trend 직하) ─────
async function initLimitUpTrend() {
  try {
    const res = await fetch('/data/limit-up-trend.json');
    if (!res.ok) return;
    const data = await res.json();
    const container = document.getElementById('limit-up-trend');
    if (!container || !Array.isArray(data.items) || data.items.length === 0) return;

    // 6영업일 윈도우 + 가로 스크롤 (theme-trend SoT 정합)
    const VISIBLE_DAYS = 6;
    // REQ-006 5/4 v195: theme renderer가 trim한 windowDates(window.__chartDates) 우선 사용.
    // 두 차트의 dates[0] 동일 + 첫 dot/line cx 동일(=32) 보장. (대표 발화 17:27 KST)
    let windowDates = Array.isArray(window.__chartDates) && window.__chartDates.length > 0
      ? window.__chartDates.slice()
      : null;
    if (!windowDates) {
      // theme renderer 미동작/지연 시 fallback — 동일 trim 로직 직접 실행
      try {
        const themeRes = await fetch('/data/themes/theme-trend.json');
        if (themeRes.ok) {
          const themeData = await themeRes.json();
          if (Array.isArray(themeData.dates) && themeData.dates.length > 0) {
            // P0-1 (2026-06-11, 서빙 표류 diag) — 종전 본 fallback 은 "마지막날 trade_amount desc"
            //   자체 정렬(5/8 본체 누적 정렬 변경 미반영, 주석만 "동일하게")로 trim 기준 테마가 달라
            //   18영업일 산출 → 본체(20영업일)와 로드 race 표류. _themeTrendWindow 공통 SSOT 호출로 통일.
            windowDates = _themeTrendWindow(themeData).dates;
            if (!windowDates || windowDates.length === 0) windowDates = null;
          }
        }
      } catch (_) { /* fallback below */ }
    }
    if (!windowDates) {
      // theme-trend.json fetch 실패 시 최종 fallback — lut 자체 items
      // 대표 catch (5/8 04:58): theme-trend 정합 — 20영업일
      windowDates = data.items.slice(-20).map(it => it.date);
    }
    const itemMap = new Map(data.items.map(it => [it.date, it]));
    const items = windowDates.map(d => itemMap.get(d) || { date: d, count: 0 });
    const dates = items.map(it => it.date);
    const counts = items.map(it => it.count);
    const maxCount = Math.max(1, ...counts);
    const needsScroll = dates.length > VISIBLE_DAYS;
    // Y-axis ticks (auto-scale 정수)
    const yMax = Math.max(5, Math.ceil(maxCount / 5) * 5);
    const yTicks = [];
    for (let v = 0; v <= yMax; v += Math.max(1, Math.ceil(yMax / 5))) yTicks.push(v);

    // REQ-007 5/4 v190: lut isMobile breakpoint 640→880 (theme + CSS @media 정합)
    const isMobile = window.innerWidth < 880;
    const containerW = container.clientWidth || 800;
    const wrapPadding = isMobile ? 28 : 40;
    const yAxisW = isMobile ? 36 : 44;
    const innerW = Math.max(280, containerW - wrapPadding - yAxisW);
    const baseW = innerW;
    const FIXED_SLOT = isMobile ? 53 : 80;
    const chartW = needsScroll ? ((items.length - 1) * FIXED_SLOT + 2 * 32) : baseW;
    const slot = FIXED_SLOT;
    const H = isMobile ? 140 : 180;
    const padTop = 12, padBottom = 28;
    const plotH = H - padTop - padBottom;
    const yScale = v => padTop + plotH * (1 - v / yMax);

    const fmtMD = (d) => {
      const m = parseInt(d.slice(5, 7), 10);
      const day = parseInt(d.slice(8, 10), 10);
      return `${m}/${day}`;
    };

    // Y axis SVG (sticky)
    let yAxisSvg = '<svg class="lut-svg lut-yaxis" viewBox="0 0 ' + yAxisW + ' ' + H + '" width="' + yAxisW + '" height="' + H + '" xmlns="http://www.w3.org/2000/svg">';
    for (const v of yTicks) {
      const y = yScale(v).toFixed(1);
      yAxisSvg += '<line x1="' + (yAxisW - 4) + '" y1="' + y + '" x2="' + yAxisW + '" y2="' + y + '" stroke="#CBD5E1" stroke-width="0.5"/>';
      yAxisSvg += '<text x="' + (yAxisW - 6) + '" y="' + y + '" font-size="' + (isMobile ? 9 : 10) + '" fill="#64748B" text-anchor="end" dominant-baseline="middle">' + v + '</text>';
    }
    yAxisSvg += '</svg>';

    // Chart SVG (라인+포인트 — design-lead 명세)
    let chartSvg = '<svg class="lut-svg lut-chart" viewBox="0 0 ' + chartW + ' ' + H + '" width="' + chartW + '" height="' + H + '" xmlns="http://www.w3.org/2000/svg">';
    // 영역 그라디언트 정의
    chartSvg += '<defs><linearGradient id="lutAreaGrad" x1="0" y1="0" x2="0" y2="1">';
    chartSvg += '<stop offset="0%" stop-color="#C49930" stop-opacity="0.18"/>';
    chartSvg += '<stop offset="100%" stop-color="#C49930" stop-opacity="0"/>';
    chartSvg += '</linearGradient></defs>';
    // gridlines
    for (const v of yTicks) {
      const y = yScale(v).toFixed(1);
      chartSvg += '<line x1="0" y1="' + y + '" x2="' + chartW + '" y2="' + y + '" stroke="#E5E7EB" stroke-width="0.5" stroke-dasharray="2,3"/>';
    }
    // 좌표 사전 계산 (line, area 공유)
    const baseline = padTop + plotH;
    // REQ-003 5/4 v184: chart svg 양 끝 32px padding (theme 정합)
    const LUT_EDGE_PAD = 32;
    const lutInnerW = Math.max(1, chartW - 2 * LUT_EDGE_PAD);
    const lutSlot = lutInnerW / Math.max(items.length - 1, 1);
    const pts = items.map((it, i) => {
      const cx = LUT_EDGE_PAD + i * lutSlot;
      const cy = yScale(it.count);
      return { cx, cy, it };
    });
    // 영역 path
    if (pts.length >= 2) {
      let areaD = 'M ' + pts[0].cx.toFixed(1) + ' ' + baseline.toFixed(1);
      for (const p of pts) areaD += ' L ' + p.cx.toFixed(1) + ' ' + p.cy.toFixed(1);
      areaD += ' L ' + pts[pts.length - 1].cx.toFixed(1) + ' ' + baseline.toFixed(1) + ' Z';
      chartSvg += '<path class="lut-area" d="' + areaD + '" fill="url(#lutAreaGrad)"/>';
    }
    // 라인 path
    if (pts.length >= 2) {
      let lineD = 'M ' + pts[0].cx.toFixed(1) + ' ' + pts[0].cy.toFixed(1);
      for (let i = 1; i < pts.length; i++) lineD += ' L ' + pts[i].cx.toFixed(1) + ' ' + pts[i].cy.toFixed(1);
      chartSvg += '<path class="lut-line" d="' + lineD + '" stroke="var(--am, #C49930)" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>';
    }
    // dot + hit-area + label — theme-trend SoT 정합 (r=3.5 mobile / 2 desktop, active 시 fill=color + 골드 링)
    // REQ-006 5/4 v192: lutIsMobile breakpoint 640→880 — theme isMobile + 차트 layout 전체와 정합
    // (640~879 구간에서 theme dot 3.5 / lut dot 2 비대칭 잔존하던 회귀 fix)
    const lutIsMobile = window.innerWidth < 880;
    const lutDotR = lutIsMobile ? 3.5 : 2;
    const lutDotActiveR = lutIsMobile ? 5 : 5; // 골드 링 반경 (theme-trend SoT)
    items.forEach((it, i) => {
      const cx = LUT_EDGE_PAD + i * lutSlot; // REQ-008 v178: edge padding 20
      const cy = yScale(it.count);
      const isZero = it.count === 0;
      const dotCls = isZero ? 'lut-dot lut-dot-zero' : 'lut-dot';
      const stroke = isZero ? '#CBD5E1' : 'var(--am, #C49930)';
      chartSvg += '<rect class="lut-dot-hit" data-date="' + it.date + '" x="' + Math.max(0, cx - lutSlot / 2).toFixed(1) + '" y="0" width="' + lutSlot.toFixed(1) + '" height="' + plotH + '" fill="transparent"/>';
      // R28 P1④ (조니 2심, 2026-06-11) — 상한가 dot 터치 타깃 7px → 44px 투명 오버레이.
      //   시각 dot(r=' + lutDotR + ')은 비인터랙티브(aria-hidden, 포커스/탭 대상 제외)로 강등,
      //   role/tabindex/aria/title 은 r=22(44px) 투명 오버레이(.lut-dot-touch)가 승계. 시각 크기 불변.
      chartSvg += '<circle class="' + dotCls + '" data-date="' + it.date + '" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + lutDotR + '" fill="#FFF" stroke="' + stroke + '" stroke-width="1.5" aria-hidden="true" pointer-events="none"/>';
      chartSvg += '<circle class="lut-dot-touch" data-date="' + it.date + '" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="22" fill="transparent" stroke="none" role="button" tabindex="0" aria-label="' + it.date + ' 상한가 ' + it.count + '건"><title>' + it.date + '\n상한가 ' + it.count + '건</title></circle>';
      // X-axis label — REQ-007 v177: 첫/마지막 anchor 변경 (chart 가장자리 침범 회피)
      const lutAnchor = i === 0 ? 'start' : (i === items.length - 1 ? 'end' : 'middle');
      chartSvg += '<text x="' + cx.toFixed(1) + '" y="' + (baseline + 14) + '" font-size="' + (isMobile ? 9 : 10) + '" fill="#64748B" text-anchor="' + lutAnchor + '">' + fmtMD(it.date) + '</text>';
    });
    // REQ-005-2026-05-04 v183: cover rect 제거 (lut-yaxis-col을 theme-trend 패턴 absolute z-index:2 자연 mask 통일)
    chartSvg += '</svg>';

    const dateRange = dates.length > 1 ? (fmtMD(dates[0]) + '~' + fmtMD(dates[dates.length - 1])) : fmtMD(dates[0]);
    // PM320 정보 위계 개편 (대표 2026-06-10 결합안) — 미니요약 = 최신일 상한가 N종목.
    const _lutLatest = counts.length ? counts[counts.length - 1] : 0;
    const _lutSummary = '오늘 ' + _lutLatest + '종목';
    // P0-1(b) (2026-06-11) — 헤더 총 건수 = 표시 윈도우(windowDates) 합산 재계산.
    //   종전 data.total_count(전체 누적)는 윈도우 일수와 무관 → "18영업일·총 208건" 모순 가능.
    const _lutWindowTotal = counts.reduce((s, c) => s + (c || 0), 0);
    container.innerHTML =
      _collapseHeaderHtml('limit-up-trend', 'lut-header', '상한가 종목 추이',
        '최근 ' + dates.length + '영업일 · ' + dateRange + ' · 총 ' + _lutWindowTotal + '건', _lutSummary, 'lut-title', 'lut-sub') +
      '<div class="section-collapse-body">' +
        '<div class="lut-wrap">' +
          '<div class="lut-yaxis-col">' + yAxisSvg + '</div>' +
          '<div class="lut-scroll">' + chartSvg + '</div>' +
        '</div>' +
        '<div class="lut-detail" id="lut-detail" hidden></div>' +
      '</div>';
    _applySectionCollapse(container, 'limit-up-trend');

    // 횡스크롤 초기화 — 최신일자가 우측 끝, 초기 진입 시 우측 정렬 (theme-trend SoT)
    const lutScroll = container.querySelector('.lut-scroll');
    if (lutScroll && needsScroll) {
      requestAnimationFrame(() => {
        lutScroll.scrollLeft = lutScroll.scrollWidth;
      });
    }

    // Inline expand on dot click/keydown
    const detail = container.querySelector('#lut-detail');
    const chartSvgEl = container.querySelector('.lut-chart');
    let activeDate = null;
    const clearActive = () => {
      container.querySelectorAll('.lut-dot.lut-dot--active').forEach(b => {
        b.classList.remove('lut-dot--active');
        b.setAttribute('fill', '#FFF');
      });
      if (chartSvgEl) chartSvgEl.querySelectorAll('.lut-gold-ring').forEach(el => el.remove());
    };
    const closeDetail = () => {
      detail.hidden = true;
      detail.innerHTML = '';
      activeDate = null;
      clearActive();
    };
    const openDetail = (date) => {
      const it = items.find(x => x.date === date);
      if (!it || it.count === 0) return;
      if (activeDate === date) { closeDetail(); return; }
      activeDate = date;
      clearActive();
      const dot = container.querySelector('.lut-dot[data-date="' + date + '"]');
      if (dot && chartSvgEl) {
        dot.classList.add('lut-dot--active');
        // SVG fill attr이 CSS보다 우선이므로 JS로 직접 설정 (active 채움)
        dot.setAttribute('fill', '#C49930');
        // 골드 링 추가 — theme-trend SoT (.tt-gold-ring r=5)
        const cx = dot.getAttribute('cx');
        const cy = dot.getAttribute('cy');
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('cx', cx);
        ring.setAttribute('cy', cy);
        ring.setAttribute('r', String(lutDotActiveR));
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', '#C49930');
        ring.setAttribute('stroke-width', '2');
        ring.classList.add('lut-gold-ring');
        chartSvgEl.appendChild(ring);
      }
      const fmtPct = v => v == null ? '' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
      const fmtAmt = v => {
        if (v == null) return '';
        const eok = v / 1e8;
        if (eok >= 10000) return (eok / 10000).toFixed(1) + '조';
        if (eok >= 1) return Math.round(eok).toLocaleString() + '억';
        return v.toLocaleString();
      };
      detail.hidden = false;
      // 거래대금 추이 종목 list 완전 복제 — 타이틀 chip + 5컬럼 (종목명+연속칩 | 종가 | 미니캔들 | 등락률 | 거래대금)
      // 타이틀 박스 = .trend-detail-chip (theme-trend SoT) — 황금 pill, 11px 700w, var(--am4) bg
      const chipDate = it.date.slice(5).replace('-', '/');
      let html = '<div class="trend-detail-chip">' + chipDate + ' &middot; 상한가 ' + it.count + '건</div>';
      html += '<table class="trend-detail-table lut-detail-table"><thead><tr><th class="th-name">종목명</th><th class="th-price">종가</th><th class="th-pct">등락률</th><th class="th-candle"></th><th class="th-amount">거래대금</th></tr></thead><tbody>';
      // 거래대금 역순(DESC) 정렬
      const sortedStocks = it.stocks.slice().sort((a, b) => (b.trade_amount || 0) - (a.trade_amount || 0));
      sortedStocks.forEach(s => {
        // "+N" → "연속+N"
        const cc = s.consecutive_count >= 2 ? '<span class="lut-streak">연속+' + s.consecutive_count + '</span>' : '';
        // 종목명 (anchor click 폐기 — 대표 결정 2026-04-30, 텍스트만 노출)
        const nameLink = escapeHtml(s.name || s.code || '');
        const pctClass = s.change_pct > 0 ? '#E03131' : s.change_pct < 0 ? '#1971C2' : 'var(--tx)';
        const candleHtml = miniCandle(s.open_price, s.high_price, s.low_price, s.price, s.change_pct);
        html += '<tr>' +
          '<td class="td-name"><span class="lut-stock-main">' + nameLink + cc + '</span></td>' +
          '<td class="td-price">' + (s.price != null ? s.price.toLocaleString() : '-') + '</td>' +
          '<td class="td-pct" style="color:' + pctClass + ';font-weight:600">' + fmtPct(s.change_pct) + '</td>' +
          '<td class="td-candle">' + candleHtml + '</td>' +
          '<td class="td-amount">' + fmtAmt(s.trade_amount) + '</td>' +
        '</tr>';
      });
      html += '</tbody></table>';
      detail.innerHTML = html;
    };
    container.addEventListener('click', e => {
      // R28 P1④ — 시각 dot 은 pointer-events:none 강등, 탭/클릭 대상 = .lut-dot-touch(44px) + 열 hit rect.
      const target = e.target.closest('.lut-dot-touch, .lut-dot-hit');
      if (!target) return;
      openDetail(target.getAttribute('data-date'));
    });
    container.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const dot = e.target.closest('.lut-dot-touch');
      if (!dot) return;
      e.preventDefault();
      openDetail(dot.getAttribute('data-date'));
    });
  } catch (e) { console.warn('limit-up-trend:', e); }
}

// ───── 테마 지도 ─────
async function initThemeMap() {
  try {
    const res = await fetch('/data/themes/theme-map.json');
    if (!res.ok) return;
    const data = await res.json();
    const grid = document.getElementById('theme-map-grid');
    const expand = document.getElementById('theme-map-expand');
    if (!grid || !data.themes) return;

    // 종목 2개 이상 테마만 표시
    const themes = data.themes.filter(t => t.stock_count >= 2);
    if (themes.length === 0) return;

    let activeTheme = null;

    grid.innerHTML = themes.map(t =>
      `<span class="theme-map-chip" data-theme-id="${t.id}">${escapeHtml(t.name)}<span class="chip-count">${t.stock_count}</span></span>`
    ).join('');

    grid.addEventListener('click', (e) => {
      const chip = e.target.closest('.theme-map-chip');
      if (!chip) return;
      const tid = parseInt(chip.dataset.themeId);
      const theme = themes.find(t => t.id === tid);
      if (!theme) return;

      // 토글
      if (activeTheme === tid) {
        activeTheme = null;
        expand.classList.remove('show');
        chip.classList.remove('active');
        return;
      }

      // 이전 active 해제
      grid.querySelectorAll('.active').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeTheme = tid;

      // 확장 패널
      const stocksHtml = theme.stocks.slice(0, 10).map(s =>
        `<div class="theme-map-stock">
          <span class="theme-map-stock-name">${escapeHtml(s.name)}</span>
          <span class="theme-map-stock-industry">${escapeHtml(s.industry || '')}</span>
        </div>`
      ).join('');

      expand.innerHTML = `
        <div class="theme-map-expand-title">${escapeHtml(theme.name)} — ${theme.stock_count}종목</div>
        ${stocksHtml}
      `;
      expand.classList.add('show');
    });
  } catch (e) { console.warn('theme-map:', e); }
}

// ───── 테마 트리 (Indented Tree + Inline Bar) ─────
async function initThemeTree(dateOverride) {
  try {
    // 휴장일이면 안내 메시지 표시 후 종료 (테마 트리는 거래일 데이터 기반)
    if (dateOverride && isMarketClosed(dateOverride)) {
      const tc = document.getElementById('theme-tree-container');
      if (tc) {
        const nextDate = getNextTradingDate(dateOverride);
        const nextLabel = nextDate ? formatKoDate(nextDate) : '';
        tc.innerHTML = `<div style="text-align:center;padding:32px 0;"><div style="font-size:15px;font-weight:700;color:var(--tx2);margin-bottom:6px;">오늘은 장이 쉽니다</div><div style="font-size:12px;color:var(--dm);">${nextLabel ? '다음 거래일 ' + escapeHtml(nextLabel) : ''}</div></div>`;
      }
      return;
    }
    // design-theme-tree-time-state-v1 — PRE_MARKET 시점 분기 (catch).
    // theme-tree.json date(예 5/8) + nodes(5/7) misleading 차단. 종목카드 동형.
    try {
      const _now = new Date();
      const _todayIso = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
      const _state = (typeof getMarketState === 'function') ? getMarketState(dateOverride || _todayIso) : null;
      const _isToday = !dateOverride || dateOverride === _todayIso;
      if (_state === 'PRE_MARKET' && _isToday && !window.__themeTreeBypassPreMarket) {
        const tc = document.getElementById('theme-tree-container');
        if (tc) {
          const _prev = _findPrevTradingIso(_todayIso);
          // 정적 헤더(news.html .theme-tree-header) 신뢰 — 동적 _hdr 추가 시 중복 (대표 catch 2026-05-08 06:06)
          renderPreMarketThemeSection(tc, _todayIso, _prev, '', async (prevBox, prevIso) => {
            // 전일 테마트리 토글 — bypass 플래그 + 전일 dateOverride로 재진입
            window.__themeTreeBypassPreMarket = true;
            try {
              const tmp = document.createElement('div');
              const orig = document.getElementById('theme-tree-container');
              const origId = orig ? orig.id : null;
              if (orig) orig.id = '_theme-tree-container-saved';
              tmp.id = 'theme-tree-container';
              document.body.appendChild(tmp);
              try {
                await initThemeTree(prevIso);
                prevBox.innerHTML = tmp.innerHTML;
              } finally {
                tmp.remove();
                if (orig && origId) orig.id = origId;
                window.__themeTreeBypassPreMarket = false;
              }
            } catch (e) { prevBox.textContent = '전일 테마트리 로드 실패'; window.__themeTreeBypassPreMarket = false; }
          });
        }
        return;
      }
    } catch (_) { /* getMarketState 미정의 시 graceful */ }
    // theme-tree.json 캐시 (최초 1회만 fetch)
    if (!_themeTreeCache) {
      const res = await fetch('/data/themes/theme-tree.json');
      if (!res.ok) return;
      _themeTreeCache = await res.json();
    }
    const data = JSON.parse(JSON.stringify(_themeTreeCache)); // deep copy
    if (!data.nodes || data.nodes.length === 0) {
      const tc = document.getElementById('theme-tree-container');
      if (tc) {
        const _n2 = new Date();
        const _t2 = `${_n2.getFullYear()}-${String(_n2.getMonth()+1).padStart(2,'0')}-${String(_n2.getDate()).padStart(2,'0')}`;
        const isLive = (dateOverride === _t2 || !dateOverride) && _n2.getHours() < 16 && !isMarketClosed(_t2);
        tc.innerHTML = `<div class="cal-empty" style="padding:24px 0;">${isLive ? '테마 데이터가 없습니다' : '테마 데이터가 없습니다'}</div>`;
      }
      return;
    }

    // 날짜 지정 시: 해당 날짜의 stock JSON에서 테마 필터링
    const targetDate = dateOverride || data.date;
    // P0/P1 (Q-20260609) — 테마트리 날짜 종속 정직 라벨. dateOverride(오늘) 의 당일 stock JSON 이
    //   아직 없으면(09:00~수집완료 전 OPEN-empty 윈도우) tree 는 theme-tree.json 의 source_date(전일
    //   종가) 데이터로 렌더된다. 이때 날짜 표시 없이 노출 → 사용자가 오늘 것으로 오인(대표 catch 09:0x
    //   "테마트리 여전히 어제거 아니야? 날짜 종속이잖아"). backend(build_theme_stats.py L818-823)는
    //   date(발효일) ≠ source_date(stocks 실 source 시점) 를 명시적으로 분리 emit 하며 frontend 가
    //   source_date 를 표시해 오해를 차단하라고 contract 화돼 있으나, 종래 renderer 는 source_date 미참조.
    //   → tree 가 실제로 표출 중인 데이터 시점(_themeRenderedSourceDate)을 추적해 캡션으로 정직 명시한다.
    let _themeStockLoadedForToday = false;     // 당일 live stock JSON 으로 tree 를 채웠는가
    if (dateOverride) {
      try {
        // REQ-055 P0 — 빈 stocks=[] 파일도 200 OK로 반환되므로 stocks 비어있으면 7일 이내 fallback.
        //   이 가드 없이는 4/28 같은 신규 거래일 새벽에 theme tree가 "테마 데이터가 없습니다"로 빈 표시되는 결함 발생.
        async function _loadStockJsonWithFallback(d0) {
          // REQ-055 P0 — toISOString()는 KST→UTC 변환되어 하루 전 날짜를 반환하는 버그.
          //   날짜 산술은 로컬 getFullYear/getMonth/getDate 사용.
          const _localYmd = (dt) => {
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const dd = String(dt.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
          };
          // DSN-frontend §3.6.2.2 (2026-05-28) — 오늘 view + 09:00 이후 시 7일 fallback 차단.
          //   기존 동작 (어제 데이터 자동 호출) → 사용자 매매 판단 misread risk.
          //   테마트리는 종목카드와 동일 정책 cumulative — '테마 데이터가 없습니다' 표시 default.
          const _nowLocal = new Date();
          const _todayLocal = _localYmd(_nowLocal);
          const _isTodayPastOpenLocal = (d0 === _todayLocal && _nowLocal.getHours() >= 9);
          const tryDate = async (d) => {
            try {
              const r = await fetch(`/data/interpreted/stock-${d}.json`);
              if (!r.ok) return null;
              const j = await r.json();
              return (j && Array.isArray(j.stocks) && j.stocks.length > 0) ? j : null;
            } catch { return null; }
          };
          let j = await tryDate(d0);
          if (j) return j;
          if (_isTodayPastOpenLocal) return null; // 본 fallback 차단
          const dt = new Date(d0 + 'T00:00:00');
          for (let i = 1; i <= 7; i++) {
            const prev = new Date(dt);
            prev.setDate(prev.getDate() - i);
            const ps = _localYmd(prev);
            j = await tryDate(ps);
            if (j) return j;
          }
          return null;
        }
        const stockData = await _loadStockJsonWithFallback(dateOverride);
        if (stockData) {
          _themeStockLoadedForToday = true;  // 당일 live 데이터로 채움 → 캡션 불필요
          // 해당 날짜 종목들의 테마 이름 수집
          const activeThemes = new Set();
          const themeStocks = {}; // theme_name -> [{code, name, change_pct, trade_amount}]
          for (const s of (stockData.stocks || [])) {
            for (const t of (s.themes || [])) {
              const tName = typeof t === 'string' ? t : t.name;
              activeThemes.add(tName);
              if (!themeStocks[tName]) themeStocks[tName] = [];
              themeStocks[tName].push({
                code: s.code, name: s.name,
                change_pct: s.change_pct || 0,
                trade_amount: s.trade_amount || 0
              });
            }
          }
          // 해당 날짜 테마가 있는 노드만 유지 + 종목 교체
          const nodeById = {};
          data.nodes.forEach(n => { nodeById[n.id] = n; });
          // 활성 노드 ID 수집 (이름 매칭)
          const activeIds = new Set();
          data.nodes.forEach(n => {
            if (activeThemes.has(n.name)) {
              activeIds.add(n.id);
              // 종목 정보 교체
              n.stocks = (themeStocks[n.name] || []);
              n.stock_count = n.stocks.length;
              n.total_stock_count = n.stock_count;
              n.trade_amount = n.stocks.reduce((s, x) => s + (x.trade_amount || 0), 0);
            }
          });
          // 조상 노드도 유지 (트리 연결용)
          data.nodes.forEach(n => {
            if (activeIds.has(n.id)) {
              let pid = n.parent_id;
              while (pid && nodeById[pid] && !activeIds.has(pid)) {
                activeIds.add(pid);
                pid = nodeById[pid].parent_id;
              }
            }
          });
          // 조상-전용 노드의 stocks도 해당 날짜 데이터로 교체
          data.nodes.forEach(n => {
            if (activeIds.has(n.id) && !activeThemes.has(n.name)) {
              n.stocks = (themeStocks[n.name] || []);
              n.stock_count = n.stocks.length;
              n.total_stock_count = n.stock_count;
              n.trade_amount = n.stocks.reduce((s, x) => s + (x.trade_amount || 0), 0);
            }
          });
          // 활성 노드만 필터
          data.nodes = data.nodes.filter(n => activeIds.has(n.id));
          // 부모-자식 종목 중복 제거: 모든 자손에 있는 종목은 부모에서 제외
          const nodeByIdD = {};
          const childrenMapD = {};
          data.nodes.forEach(n => { nodeByIdD[n.id] = n; });
          data.nodes.forEach(n => {
            if (n.parent_id) {
              if (!childrenMapD[n.parent_id]) childrenMapD[n.parent_id] = [];
              childrenMapD[n.parent_id].push(n.id);
            }
          });
          function collectDescendantCodes(nid) {
            const codes = new Set();
            (childrenMapD[nid] || []).forEach(cid => {
              const child = nodeByIdD[cid];
              if (child && child.stocks) child.stocks.forEach(s => codes.add(s.code));
              collectDescendantCodes(cid).forEach(c => codes.add(c));
            });
            return codes;
          }
          // 라이브 종목 코드 → 거래대금 맵 (막대용 unique_trade_amount 재산출 소스).
          //   당일 stock JSON 의 종목별 trade_amount 를 코드 단위로 dedup. 같은 종목이
          //   여러 테마에 속해도 한 번만 계산한다.
          const _liveAmtByCode = {};
          for (const s of (stockData.stocks || [])) {
            _liveAmtByCode[s.code] = s.trade_amount || 0;
          }
          data.nodes.forEach(n => {
            const descCodes = collectDescendantCodes(n.id);
            // descendant_stock_count: 자신 + 모든 자손의 고유 종목 수
            const ownCodes = new Set((n.stocks || []).map(s => s.code));
            const allCodes = new Set([...ownCodes, ...descCodes]);
            n.descendant_stock_count = allCodes.size;
            // FLR(테마트리 막대 정합) — 라이브 enrich 시 unique_trade_amount 를 당일 데이터로
            //   재산출. 종래에는 stocks/trade_amount 만 갱신하고 unique_trade_amount 는 정적
            //   theme-tree.json 캐시값을 잔존시켜 막대(unique 우선, sumTradeAmount L3505)가
            //   낡은 값, 종목행(live trade_amount)이 신선한 값으로 불일치했다. 막대 소스 =
            //   서브트리(자신+모든 자손) 고유 종목 코드의 라이브 거래대금 합으로 재대입한다
            //   (형제 테마 중복 제거 의도 보존). 형제 간 종목 중복은 코드 dedup 으로 자동 제거.
            let _uniqueAmt = 0;
            allCodes.forEach(c => { _uniqueAmt += (_liveAmtByCode[c] || 0); });
            n.unique_trade_amount = _uniqueAmt;
            if (descCodes.size > 0 && n.stocks) {
              n.stocks = n.stocks.filter(s => !descCodes.has(s.code));
              n.stock_count = n.stocks.length;
              n.trade_amount = n.stocks.reduce((sum, s) => sum + (s.trade_amount || 0), 0);
            }
          });
        }
      } catch (e) { /* stock JSON 없으면 기본 트리 사용 */ }
    }

    // 필터링 후 노드가 없으면 빈 상태 표시
    if (!data.nodes || data.nodes.length === 0) {
      const tc = document.getElementById('theme-tree-container');
      if (tc) {
        const _n3 = new Date();
        const _t3 = `${_n3.getFullYear()}-${String(_n3.getMonth()+1).padStart(2,'0')}-${String(_n3.getDate()).padStart(2,'0')}`;
        const isLive = (dateOverride === _t3) && _n3.getHours() < 16 && !isMarketClosed(_t3);
        tc.innerHTML = `<div class="cal-empty" style="padding:24px 0;">${isLive ? '테마 데이터가 없습니다' : '해당 날짜의 테마 데이터가 없습니다'}</div>`;
      }
      return;
    }

    const ROOT_COLORS = ['#C9A962','#7C8CBA','#E07C5A','#6BA37E','#B47CC7','#5CABB5','#D4A05A','#8B7EC8','#C75C7C'];
    const nodes = data.nodes;
    const nodeMap = {};
    nodes.forEach(n => { nodeMap[n.id] = { ...n, children: [] }; });
    const roots = [];
    nodes.forEach(n => {
      if (n.parent_id && nodeMap[n.parent_id]) {
        nodeMap[n.parent_id].children.push(nodeMap[n.id]);
      } else if (!n.parent_id) {
        roots.push(nodeMap[n.id]);
      }
    });

    // 자식 거래대금 합산 (재귀, 상향식)
    // unique_trade_amount: 형제 테마 간 종목 중복을 제거한 정확한 합산값 (Python에서 계산)
    function sumTradeAmount(node) {
      // 자식 먼저 재귀 처리 (avg_change_pct 가중평균에 필요)
      node.children.forEach(c => sumTradeAmount(c));
      // 거래대금: unique_trade_amount가 양수면 사용, 0이면 자식 합산으로 대체
      if (node.unique_trade_amount != null && node.unique_trade_amount > 0) {
        node._totalAmt = node.unique_trade_amount;
      } else {
        let childSum = 0;
        node.children.forEach(c => { childSum += c._totalAmt; });
        node._totalAmt = node.trade_amount + childSum;
      }
      // avg_change_pct도 자식 가중 평균 계산
      if (node.trade_amount === 0 && node.children.length > 0) {
        let wSum = 0, wDiv = 0;
        node.children.forEach(c => {
          if (c._totalAmt > 0) { wSum += c._avgPct * c._totalAmt; wDiv += c._totalAmt; }
        });
        node._avgPct = wDiv > 0 ? wSum / wDiv : 0;
      } else {
        node._avgPct = node.avg_change_pct;
      }
      return node._totalAmt;
    }
    roots.forEach(r => sumTradeAmount(r));

    // 거래대금 내림차순 정렬 (재귀)
    function sortByAmt(arr) {
      arr.sort((a, b) => b._totalAmt - a._totalAmt);
      arr.forEach(n => sortByAmt(n.children));
    }
    sortByAmt(roots);

    // _totalAmt > 0인 루트만 표시 (거래대금 0 자식만 있는 루트도 제외)
    let visRoots = roots.filter(r => r._totalAmt > 0);

    // R28 제거① (조니 2심, 2026-06-11) — 동일 종목 구성(코드셋 완전 일치) 루트 테마 N행 중복 제거.
    //   예: 단일 종목 1개가 건설·태양광·에너지정책·풍력에너지 4테마 소속 → 같은 금액·같은 종목이
    //   4행 반복(조니 "동일 종목 다중 테마 4행 중복"). 한 행으로 합치고 나머지 테마명은 칩으로 병기.
    //   보수 범위: 자식 없는 leaf 루트 + 종목 보유 시에만 병합(서브트리 구조 보유 루트는 비병합).
    //   정렬 1순위(거래대금 desc 선두) 루트가 대표 행 — 데이터 수정 0, 표시단 병합만.
    const _mergedVisRoots = [];
    const _rootByStockSig = new Map();
    visRoots.forEach(r => {
      const _isLeaf = (!r.children || r.children.length === 0) && Array.isArray(r.stocks) && r.stocks.length > 0;
      const _sig = _isLeaf ? r.stocks.map(s => s.code || s.stock_code || s.name || '').sort().join('|') : null;
      if (_sig && _rootByStockSig.has(_sig)) {
        _rootByStockSig.get(_sig)._mergedNames.push(r.name);
        return;
      }
      r._mergedNames = [];
      if (_sig) _rootByStockSig.set(_sig, r);
      _mergedVisRoots.push(r);
    });
    visRoots = _mergedVisRoots;

    // 글로벌 최대 거래대금
    const globalMax = Math.max(...visRoots.map(r => r._totalAmt), 1);

    function fmtAmt(v) {
      if (v >= 1e12) return (v / 1e12).toFixed(1) + '조';
      if (v >= 1e8) return Math.round(v / 1e8).toLocaleString() + '억';
      if (v >= 1e4) return Math.round(v / 1e4).toLocaleString() + '만';
      return v.toString();
    }

    function lighten(hex, pct) {
      const num = parseInt(hex.slice(1), 16);
      let r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
      r = Math.min(255, Math.round(r + (255 - r) * pct));
      g = Math.min(255, Math.round(g + (255 - g) * pct));
      b = Math.min(255, Math.round(b + (255 - b) * pct));
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    const container = document.getElementById('theme-tree-container');
    if (!container) return;
    container.innerHTML = '';  // 날짜 변경 시 기존 트리 제거 (누적 방지)

    // P0/P1 (Q-20260609) — 날짜 종속 정직 라벨. tree 가 실제 표출 중인 데이터 시점 결정:
    //   - dateOverride(오늘) 인데 당일 live stock JSON 미적재 → theme-tree.json 의 source_date(전일
    //     종가) 데이터로 채워짐 → 그 source_date 를 캡션으로 명시("N월 N일 종가 기준").
    //   - 당일 live 적재 성공(_themeStockLoadedForToday) → 오늘 데이터 → 캡션 불필요.
    //   - 특정 과거 날짜 조회(dateOverride ≠ today) → 이미 그 날짜 데이터이므로 캡션 불필요(달력 컨텍스트가 날짜 제공).
    //   미장 빈상태 fix(1ff66c780)와 동형 — "어떤 날짜 데이터인지 화면에 정직히"(FLR-AGT-002 거짓 충실성 차단).
    try {
      const _nowCap = new Date();
      const _todayCap = `${_nowCap.getFullYear()}-${String(_nowCap.getMonth()+1).padStart(2,'0')}-${String(_nowCap.getDate()).padStart(2,'0')}`;
      const _isTodayView = !dateOverride || dateOverride === _todayCap;
      const _srcDate = data.source_date || data.date || null;
      if (_isTodayView && !_themeStockLoadedForToday && _srcDate && _srcDate !== _todayCap) {
        const _srcLabel = (typeof formatKoDate === 'function') ? formatKoDate(_srcDate) : _srcDate;
        const cap = document.createElement('div');
        cap.className = 'theme-tree-source-caption';
        cap.setAttribute('role', 'note');
        cap.setAttribute('aria-label', '테마트리 데이터 기준 시점');
        cap.textContent = `${_srcLabel} 종가 기준 · 오늘 데이터는 장 마감 후 갱신됩니다`;
        container.appendChild(cap);
      }
    } catch (_) { /* graceful — 캡션 실패해도 트리 렌더는 유지 */ }

    function renderNode(node, depth, rootColor) {
      const hasChildren = node.children.length > 0 && node.children.some(c => c._totalAmt > 0 || c.trade_amount > 0);
      const amt = node._totalAmt;
      const pct = node._avgPct;
      const descStocks = node.descendant_stock_count || (Array.isArray(node.stocks) ? node.stocks.length : 0);
      const isZero = amt === 0 && descStocks === 0;
      // design-theme-tree-bar-sqrt-scale-v1 (2026-06-04 design-lead 권고 채택)
      // 라이브 86 roots 중 76개 (88%) linear MIN 4px clamp 균질화 catch → sqrt scale 채택
      // sqrt: 상위 비율 합리적 유지 + 하위 분해능 회복 + MIN 4px clamp 유지 (amt>0 본격 0px 회피)
      // 모바일 ≤720px CSS max-width 120px cap 정합 (news.css:978, 80→120 design 권고 옵션 A 2026-06-04)
      const barW = isZero ? 0 : Math.max(4, Math.sqrt(amt / globalMax) * 120);
      const barColor = depth === 0 ? rootColor : lighten(rootColor, depth * 0.2);
      const pctColor = pct >= 0 ? '#EF4444' : '#3B82F6';
      const indent = depth * 24;

      const wrapper = document.createElement('div');
      const row = document.createElement('div');
      row.className = 'theme-tree-row';
      row.style.paddingLeft = indent + 'px';

      const arrow = document.createElement('span');
      arrow.className = 'theme-tree-arrow' + (hasChildren ? '' : ' leaf');
      arrow.textContent = '\u25B6';
      row.appendChild(arrow);

      const bar = document.createElement('span');
      bar.className = 'theme-tree-bar';
      bar.style.width = barW + 'px';
      bar.style.maxWidth = '120px';
      bar.style.background = barColor;
      if (isZero) bar.style.display = 'none';
      row.appendChild(bar);

      const name = document.createElement('span');
      name.className = 'theme-tree-name' + (isZero ? ' zero' : '');
      name.textContent = node.name;
      row.appendChild(name);

      // R28 제거① — 동일 종목 구성으로 병합된 형제 테마명 칩 병기 (한 행 + 테마 칩 합침).
      if (Array.isArray(node._mergedNames) && node._mergedNames.length > 0) {
        const chips = document.createElement('span');
        chips.className = 'theme-tree-merged-chips';
        chips.setAttribute('aria-label', '같은 종목 구성 테마: ' + node._mergedNames.join(', '));
        node._mergedNames.forEach(nm => {
          const chip = document.createElement('span');
          chip.className = 'theme-tree-merged-chip';
          chip.textContent = nm;
          chips.appendChild(chip);
        });
        row.appendChild(chips);
      }

      if (!isZero) {
        const amtEl = document.createElement('span');
        amtEl.className = 'theme-tree-amt';
        amtEl.textContent = fmtAmt(amt);
        row.appendChild(amtEl);

        // 등락률 제거 (대표 지시 4/14 — 테마트리에 불필요)

        const ownCount = node.stock_count || (Array.isArray(node.stocks) ? node.stocks.length : 0);
        const descCount = node.descendant_stock_count || ownCount;
        if (descCount > 0) {
          const cntEl = document.createElement('span');
          cntEl.className = 'theme-tree-stock-count';
          cntEl.textContent = descCount + '\uC885\uBAA9';
          row.appendChild(cntEl);
        }
      } else {
        // trade_amount=0: dateOverride 후 종목이 채워질 수 있으므로 일단 표시
        // descendant_stock_count로 판단 — 자손 포함 종목이 0이면 숨김
        const descAny = node.descendant_stock_count || 0;
        if (descAny === 0) {
          wrapper.style.display = 'none';
        }
      }

      wrapper.appendChild(row);

      // --- 종목 행 렌더링 헬퍼 ---
      function renderStockRows(stocks, stockIndent) {
        // 종목코드(or 종목명) 기준 dedup — 같은 테마에 동일 종목 2회 표시 방지
        const seenKey = new Set();
        const dedupedStocks = stocks.filter(s => {
          const key = s.stock_code || s.code || s.name || s.stock_name || '';
          if (!key || seenKey.has(key)) return false;
          seenKey.add(key);
          return true;
        });
        const MAX_VISIBLE = 5;
        const frag = document.createDocumentFragment();
        const visible = dedupedStocks.slice(0, MAX_VISIBLE);
        const rest = dedupedStocks.slice(MAX_VISIBLE);

        visible.forEach(s => frag.appendChild(makeStockRow(s, stockIndent)));

        if (rest.length > 0) {
          const hiddenContainer = document.createElement('div');
          hiddenContainer.style.display = 'none';
          rest.forEach(s => hiddenContainer.appendChild(makeStockRow(s, stockIndent)));
          frag.appendChild(hiddenContainer);

          const moreRow = document.createElement('div');
          moreRow.className = 'theme-tree-stock-row';
          moreRow.style.paddingLeft = stockIndent + 'px';
          const moreLabel = document.createElement('span');
          moreLabel.className = 'theme-tree-stock-more';
          moreLabel.textContent = '\u00B7\u00B7\u00B7 \uC678 ' + rest.length + '\uC885\uBAA9';
          moreLabel.addEventListener('click', (e) => {
            e.stopPropagation();
            hiddenContainer.style.display = '';
            moreRow.style.display = 'none';
          });
          moreRow.appendChild(moreLabel);
          frag.appendChild(moreRow);
        }
        return frag;
      }

      function makeStockRow(s, stockIndent) {
        const sr = document.createElement('div');
        sr.className = 'theme-tree-stock-row';
        sr.style.paddingLeft = stockIndent + 'px';

        const sName = document.createElement('span');
        sName.className = 'theme-tree-stock-name';
        sName.textContent = s.name || s.stock_name || '';
        sr.appendChild(sName);

        const sPct = s.change_pct != null ? s.change_pct : s.pct;
        if (sPct != null) {
          const sPctEl = document.createElement('span');
          sPctEl.className = 'theme-tree-stock-pct';
          sPctEl.style.color = sPct >= 0 ? '#EF4444' : '#3B82F6';
          sPctEl.textContent = (sPct >= 0 ? '+' : '') + sPct.toFixed(2) + '%';
          sr.appendChild(sPctEl);
        }

        const sAmt = s.trade_amount != null ? s.trade_amount : s.amount;
        if (sAmt != null && sAmt > 0) {
          const sAmtEl = document.createElement('span');
          sAmtEl.className = 'theme-tree-stock-amt';
          sAmtEl.textContent = fmtAmt(sAmt);
          sr.appendChild(sAmtEl);
        }
        return sr;
      }

      const hasStocks = Array.isArray(node.stocks) && node.stocks.length > 0;
      const hasExpandable = hasChildren || hasStocks;
      const stockIndent = (depth + 1) * 24;

      if (hasChildren || hasStocks) {
        const childContainer = document.createElement('div');
        childContainer.className = 'theme-tree-children collapsed';
        if (hasChildren) {
          node.children.forEach(c => {
            // 거래대금 0인 자식도 표시 (연한 회색)
            childContainer.appendChild(renderNode(c, depth + 1, rootColor));
          });
        }
        if (hasStocks) {
          childContainer.appendChild(renderStockRows(node.stocks, stockIndent));
        }
        wrapper.appendChild(childContainer);

        row.addEventListener('click', () => {
          const isCollapsed = childContainer.classList.contains('collapsed');
          if (isCollapsed) {
            childContainer.classList.remove('collapsed');
            childContainer.style.maxHeight = childContainer.scrollHeight + 'px';
            arrow.classList.add('expanded');
          } else {
            childContainer.style.maxHeight = '0px';
            childContainer.classList.add('collapsed');
            arrow.classList.remove('expanded');
          }
        });

        // max-height transition 후 auto로 전환 (중첩 펼침 대응)
        childContainer.addEventListener('transitionend', () => {
          if (!childContainer.classList.contains('collapsed')) {
            childContainer.style.maxHeight = 'none';
          }
        });

        // hasStocks만 있고 children이 없으면 arrow 표시
        if (!hasChildren && hasStocks) {
          arrow.classList.remove('leaf');
        }
      }

      return wrapper;
    }

    const frag = document.createDocumentFragment();
    visRoots.forEach((root, i) => {
      frag.appendChild(renderNode(root, 0, ROOT_COLORS[i % ROOT_COLORS.length]));
    });
    container.appendChild(frag);

    // PM320 정보 위계 개편 (대표 2026-06-10 결합안) — 테마트리 미니요약 = N개 테마 (visRoots 렌더 수).
    //   헤더는 pm320.html 정적 토글이라 렌더 후 summary 텍스트 + 펼침 상태(localStorage) 복원만 갱신.
    try {
      const _treeRoot = document.getElementById('theme-tree');
      if (_treeRoot) {
        const _sumEl = _treeRoot.querySelector('.pm320-section-summary[data-collapse-summary="1"]');
        if (_sumEl) _sumEl.textContent = visRoots.length + '개 테마';
        if (typeof _applySectionCollapse === 'function') _applySectionCollapse(_treeRoot, 'theme-tree');
      }
    } catch (_) { /* graceful */ }

  } catch (e) { console.warn('theme-tree:', e); }
}

/* ───── 초기화 호출 ───── */
// initThemeTrend/initThemeMap/initThemeTree는 _refreshDataAsync에서 비동기 호출
// PM320 정보 위계 개편 (대표 2026-06-10 결합안) — 섹션 접힘 토글 위임 1회 등록 (theme-trend/limit-up-trend/theme-tree).
if (typeof _wireSectionCollapse === 'function') _wireSectionCollapse();
initCalendar();

/* Q-20260608-144 — 날짜 헤더(.cal-content-head) sticky top을 nav(header) 실제 height에 바인딩.
   하드코딩 top:68px(데스크탑)/72px(모바일)는 뷰포트별 실제 nav height(69~73px 변동, 특히
   landscape Samsung)와 불일치 → nav 아래 간격/겹침 발생. nav offsetHeight 측정 → CSS 변수
   --nav-h 노출 → news.css에서 top: var(--nav-h)로 바인딩. 기기·뷰포트 무관 flush 보장. */
(function _syncNavHeightVar() {
  var _raf = 0;
  function apply() {
    _raf = 0;
    var nav = document.querySelector('header');
    if (!nav) return;
    var h = Math.round(nav.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty('--nav-h', h + 'px');
  }
  function schedule() {
    if (_raf) return;
    _raf = window.requestAnimationFrame ? window.requestAnimationFrame(apply) : setTimeout(apply, 16);
  }
  apply();
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  // 폰트 로드 완료 시 nav 높이 재측정 (웹폰트 metrics로 height 변동 가능)
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(schedule);
  }
})();
