// test_holding_pnl_freshness.mjs — 보유픽(running) 진입일 데이터 신선도 캐시 키 셀프테스트.
//   배경: 2026-06-24 대표 catch (제주반도체 080220 등락률 공란, 새로고침 무효). 직전 6/23 fix 가
//     *현재 OPEN(장중)* 일 때만 과거일 calDayCache 를 10분 버킷으로 무효화 → POST_MARKET/PRE_MARKET 누락(부분상태).
//     장 마감 후 stale 캐시(픽 당일 pnl≈0)가 -14.1% 신선값을 가려 _pnl 가드(current_price==null&&v===0)가 0% 숨김.
//   fix: _cacheKey 가 "오늘 기준 최근 _FRESH_WINDOW_BDAYS 영업일 이내 과거일"에 장 상태 전 구간(OPEN/POST/PRE/HOLIDAY)
//     신선도 토큰 부착(장중=10분 버킷·장후/장전=KST 날짜 버킷). 윈도우 밖 확정 청산일은 불변 단일 키(cold load 남발 0).
//   vm 샌드박스에 calendar.js 실 소스 로드(proxy 아님) + 통제된 now 로 결정적 검증.
//   FLR-20260428-TEC-001 "한쪽 수정·다른 끝 누락" recurring 회피. DSN-arch-frontend §3.6.2.4.
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync('js/calendar.js', 'utf8');

// 통제된 now 주입용 헬퍼 — 특정 시각으로 _cacheKey 호출
function makeCtx(nowDate) {
  const ctx = {
    // stubs (calendar.js 의존)
    localStorage: { getItem: () => '{}', setItem: () => {} },
    _kstNow: () => new Date(nowDate.getTime()),
    ymd: (y, m, d) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`,
    // holidays: 2026-06 주말만 휴장(평일 전부 영업일). 실제 holidays.json 미로드 시 주말 폴백과 동일.
    holidayData: null,
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx;
}

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  if (actual === expected) { pass++; }
  else { fail++; console.log(`  FAIL: ${label}\n    expected=${expected}\n    actual  =${actual}`); }
}

// === 시나리오 1: 현재 POST_MARKET (6/24 18:55) — 본 사고 재현 시점 ===
{
  const now = new Date(2026, 5, 24, 18, 55, 0); // 2026-06-24 18:55 KST (POST_MARKET)
  const ctx = makeCtx(now);
  const ck = ctx._cacheKey;
  // 제주(진입 6/22) = 최근 영업일 이내 → 날짜 버킷 토큰 (stale 무효화)
  eq(ck('2026-06-22'), '2026-06-22@d2026-06-24', 'S1 제주 진입일 6/22 POST_MARKET → 날짜 버킷');
  // 삼화(진입 6/18) = 최근 영업일 이내 → 날짜 버킷
  eq(ck('2026-06-18'), '2026-06-18@d2026-06-24', 'S1 삼화 진입일 6/18 POST_MARKET → 날짜 버킷');
  // 오늘(6/24) = today 분기 → @POST_MARKET (날짜 버킷 아님)
  eq(ck('2026-06-24'), '2026-06-24@POST_MARKET', 'S1 오늘 6/24 → @POST_MARKET');
  // 윈도우 밖 과거(6/1, 10영업일 초과) → 불변 date 단일 키
  eq(ck('2026-06-01'), '2026-06-01', 'S1 윈도우 밖 6/1 → 불변 단일 키');
}

// === 시나리오 2: 현재 OPEN 장중 (6/24 13:25) — 직전 6/23 동작 유지 검증 ===
{
  const now = new Date(2026, 5, 24, 13, 25, 0); // OPEN
  const ctx = makeCtx(now);
  const ck = ctx._cacheKey;
  // 과거일 = 10분 버킷 (13:25 → m132)
  eq(ck('2026-06-22'), '2026-06-22@m132', 'S2 제주 6/22 OPEN 13:25 → 10분 버킷 m132');
  // 윈도우 밖 = 불변
  eq(ck('2026-06-01'), '2026-06-01', 'S2 윈도우 밖 6/1 OPEN → 불변 단일 키');
}

// === 시나리오 3: 현재 PRE_MARKET (6/25 08:30) — 다음날 장전 재방문 ===
{
  const now = new Date(2026, 5, 25, 8, 30, 0); // PRE_MARKET (목)
  const ctx = makeCtx(now);
  const ck = ctx._cacheKey;
  // 어제(6/24) 박제 캐시가 오늘(6/25) 날짜 버킷으로 자연 miss → refetch
  eq(ck('2026-06-22'), '2026-06-22@d2026-06-25', 'S3 제주 6/22 PRE_MARKET(6/25) → 날짜 버킷(오늘=6/25)');
}

// === 시나리오 4: 무효화 동작 — 6/24 캐시 vs 6/25 캐시 키 분리 (날짜 넘김) ===
{
  const ckPrev = makeCtx(new Date(2026, 5, 24, 19, 0, 0))._cacheKey;
  const ckNext = makeCtx(new Date(2026, 5, 25, 19, 0, 0))._cacheKey;
  const k1 = ckPrev('2026-06-22');
  const k2 = ckNext('2026-06-22');
  eq(k1 !== k2, true, 'S4 6/24 캐시 키 ≠ 6/25 캐시 키 (날짜 넘김 무효화)');
  // 같은 날 같은 키 (재방문 캐시 HIT)
  const ckSame = makeCtx(new Date(2026, 5, 24, 21, 0, 0))._cacheKey;
  eq(ckPrev('2026-06-22'), ckSame('2026-06-22'), 'S4 같은 날(6/24) 19:00 vs 21:00 동일 키 (POST 재방문 HIT)');
}

// === 시나리오 5: 윈도우 경계 — _withinFreshWindowBdays 직접 ===
{
  const ctx = makeCtx(new Date(2026, 5, 24, 19, 0, 0));
  const w = ctx._withinFreshWindowBdays;
  eq(w('2026-06-24', '2026-06-24'), false, 'S5 오늘==오늘 → false (today 분기)');
  eq(w('2026-06-25', '2026-06-24'), false, 'S5 미래일 → false');
  eq(w('2026-06-23', '2026-06-24'), true, 'S5 어제(1영업일) → true');
  // 6/24 기준 10영업일 전 경계: 주말 제외 카운트. 6/10(수)은 10영업일 이내여야
  eq(w('2026-06-10', '2026-06-24'), true, 'S5 6/10 (≈10영업일) → true (경계 내)');
}

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail > 0 ? 1 : 0);
