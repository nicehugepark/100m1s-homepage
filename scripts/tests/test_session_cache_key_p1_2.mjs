/**
 * FLR-20260605-TEC-001 P1-2 — 장경계 캐시 키 구조화 셀프테스트.
 *
 * 검증 대상: js/calendar.js 의 _cacheKey(date, now) + getMarketState(date, now).
 *   캐시 키에 세션 구간(PRE_MARKET/OPEN/POST_MARKET/HOLIDAY) + 거래일(KST) 을 인코딩하여,
 *   장 시작/마감/날짜 변경 경계를 넘으면 stage-3 즉시 캐시 렌더가 이전 구간 캐시를
 *   "현재인 양" 재표시하는 stale 클래스를 구조적으로 봉쇄하는지 확인.
 *
 * 실행: node scripts/tests/test_session_cache_key_p1_2.mjs
 * 종료코드: 0 = 모두 PASS / 1 = 한 건이라도 FAIL.
 *
 * 방식: vm 샌드박스에 lib/format.js(ymd) + calendar.js 를 로드(파싱-타임 globals 스텁),
 *       샌드박스에서 노출된 _cacheKey / getMarketState 를 통제된 now 로 직접 호출.
 *       DOM/network 불요 — 키 산출 로직은 순수 함수(now 의존)이므로 결정적.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

// ── 샌드박스 구축: 파싱-타임 globals 스텁 ──────────────────────────────────
const _lsStore = {};
const sandbox = {};
sandbox.window = sandbox; // root.* 등록 + window 자기참조
sandbox.globalThis = sandbox;
sandbox.console = console;
sandbox.Date = Date;
sandbox.Map = Map;
sandbox.Array = Array;
sandbox.Object = Object;
sandbox.JSON = JSON;
sandbox.String = String;
sandbox.Number = Number;
sandbox.localStorage = {
  getItem: (k) => (k in _lsStore ? _lsStore[k] : null),
  setItem: (k, v) => { _lsStore[k] = String(v); },
  removeItem: (k) => { delete _lsStore[k]; },
};
sandbox.document = { getElementById: () => null, addEventListener: () => {} };

vm.createContext(sandbox);

function loadInSandbox(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
  vm.runInContext(src, sandbox, { filename: rel });
}

loadInSandbox('js/lib/format.js');   // ymd / pad2
loadInSandbox('js/calendar.js');     // getMarketState / _cacheKey / _isTodayIso

const { _cacheKey, getMarketState } = sandbox;

// holidayData 스텁: 휴장일 시나리오용 (2026-06-06 현충일 가정 — 검증 독립).
sandbox.holidayData = {
  holidays: { '2026-06-06': '현충일' },
  market_closed: { '2026-06-06': '현충일', '2026-06-07': '일요일' },
};

let failures = 0;
function check(label, cond) {
  if (cond) { console.log(`  PASS: ${label}`); }
  else { console.log(`  FAIL: ${label}`); failures += 1; }
}

// 통제된 now 헬퍼: 특정 KST 시각의 Date (로컬타임존 = KST 가정, 코드와 동일 가정)
function at(iso, h, m) {
  const [y, mo, d] = iso.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m, 0);
}

const TODAY = '2026-06-05'; // 평일(금) 거래일

console.log('[1] 장경계(장 시작) 캐시 키 무효화 — 오늘 사고(09:05 어제데이터) 재현 차단');
{
  // (a) PRE_MARKET(08:30)에 캐시 박제 → 키 = TODAY@PRE_MARKET
  const preKey = _cacheKey(TODAY, at(TODAY, 8, 30));
  // (b) OPEN(09:30)에 reload → stage-3 조회 키 = TODAY@OPEN
  const openKey = _cacheKey(TODAY, at(TODAY, 9, 30));
  check('PRE_MARKET 키에 PRE_MARKET 토큰 인코딩', preKey === `${TODAY}@PRE_MARKET`);
  check('OPEN 키에 OPEN 토큰 인코딩', openKey === `${TODAY}@OPEN`);
  check('장 시작 경계: 이전 구간 키 ≠ 현재 구간 키 → cache miss(재표시 0)', preKey !== openKey);
  // 시뮬: PRE_MARKET 박제 캐시 dict 에서 OPEN 키 조회 = undefined
  const cache = { [preKey]: { _fallbackDate: '2026-06-04' } };
  check('OPEN 조회 시 어제 fallback 캐시 노출 0', cache[openKey] === undefined);
}

console.log('[2] 장마감 경계 캐시 키 무효화 — OPEN 캐시가 POST_MARKET 에 재표시 안 됨');
{
  const openKey = _cacheKey(TODAY, at(TODAY, 14, 0));   // OPEN
  const postKey = _cacheKey(TODAY, at(TODAY, 15, 45));  // POST_MARKET (15:30 이후)
  check('OPEN(14:00) 토큰', openKey === `${TODAY}@OPEN`);
  check('POST_MARKET(15:45) 토큰', postKey === `${TODAY}@POST_MARKET`);
  check('장 마감 경계: OPEN 키 ≠ POST_MARKET 키 → 이전 구간 캐시 폐기', openKey !== postKey);
  const cache = { [openKey]: { stocks: ['장중데이터'] } };
  check('POST_MARKET 조회 시 OPEN 구간 캐시 노출 0', cache[postKey] === undefined);
}

console.log('[3] 날짜 변경 경계 — 어제 키 ≠ 오늘 키 (자정 넘김)');
{
  // 어제(6/4) POST_MARKET 박제 → 오늘(6/5) PRE_MARKET 조회
  const yKey = _cacheKey('2026-06-04', at('2026-06-04', 16, 0)); // 과거일 → flat
  const tKey = _cacheKey(TODAY, at(TODAY, 8, 0));                 // 오늘 PRE_MARKET
  check('어제(과거일) 키와 오늘 키 불일치', yKey !== tKey);
  const cache = { [yKey]: { stocks: ['6/4데이터'] } };
  check('오늘 조회 시 어제 캐시 노출 0', cache[tKey] === undefined);
}

console.log('[4] 무회귀 — fresh 사용자 / 과거 viewDate / 동일구간 재방문');
{
  // fresh 사용자: 빈 캐시에서 오늘 조회 = miss → 로딩 상태(정상)
  const cacheEmpty = {};
  check('fresh 사용자: 빈 캐시 miss (로딩 상태 진입, 무회귀)', cacheEmpty[_cacheKey(TODAY, at(TODAY, 9, 30))] === undefined);

  // 과거 viewDate: flat date 키 (세션 구간 무관) — 과거 카드 캐시 정상 hit
  const past = '2026-05-22';
  const pk1 = _cacheKey(past, at(TODAY, 9, 30));
  const pk2 = _cacheKey(past, at(TODAY, 16, 0));
  check('과거 viewDate 키 = flat date (세션 구간 미부착)', pk1 === past);
  check('과거 viewDate 키는 현재 세션 구간과 무관하게 안정(시각 바뀌어도 동일)', pk1 === pk2);
  const cachePast = { [past]: { stocks: ['확정과거데이터'] } };
  check('과거 카드: 같은 키로 캐시 hit(무회귀)', cachePast[_cacheKey(past, at(TODAY, 14, 0))] !== undefined);

  // 동일 OPEN 구간 내 재방문: 키 안정 → 캐시 hit (정상 즉시 렌더 유지)
  const o1 = _cacheKey(TODAY, at(TODAY, 9, 30));
  const o2 = _cacheKey(TODAY, at(TODAY, 11, 0));
  check('동일 OPEN 구간 내(09:30→11:00) 키 안정 → 정상 캐시 hit', o1 === o2);
}

console.log('[5] PRE_MARKET 전일보기 토글 무회귀 — PRE_MARKET 구간 캐시는 PRE_MARKET 내 유지');
{
  // PRE_MARKET opt-in "전일 데이터 보기"는 PRE_MARKET 구간 내 동작 → 같은 키로 안정 hit
  const p1 = _cacheKey(TODAY, at(TODAY, 8, 0));
  const p2 = _cacheKey(TODAY, at(TODAY, 8, 50));
  check('PRE_MARKET 구간 내(08:00→08:50) 키 안정 → 전일보기 토글 캐시 유지', p1 === p2);
  check('PRE_MARKET 토큰 정확', p1 === `${TODAY}@PRE_MARKET`);
}

console.log('[6] getMarketState 단일 출처 경계값 정합 (재사용 검증)');
{
  check('08:59 = PRE_MARKET', getMarketState(TODAY, at(TODAY, 8, 59)) === 'PRE_MARKET');
  check('09:00 = OPEN', getMarketState(TODAY, at(TODAY, 9, 0)) === 'OPEN');
  check('15:29 = OPEN', getMarketState(TODAY, at(TODAY, 15, 29)) === 'OPEN');
  check('15:30 = POST_MARKET', getMarketState(TODAY, at(TODAY, 15, 30)) === 'POST_MARKET');
  // 휴장일: HOLIDAY 토큰 → 키도 HOLIDAY (오늘이 휴장이면)
  check('휴장일 getMarketState = HOLIDAY', getMarketState('2026-06-06', at('2026-06-06', 11, 0)) === 'HOLIDAY');
}

console.log(failures === 0
  ? `\n✅ ALL PASS (FLR-20260605-TEC-001 P1-2 장경계 캐시 키 구조화)`
  : `\n❌ ${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
