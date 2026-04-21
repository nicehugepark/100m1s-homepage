# WORKLOG — UI 휴장 메시지 회귀 복구

- 브랜치: `ui-holiday-msg`
- 베이스: `origin/main` (d3abc3e)
- 등급: S
- 응답 시각: 2026-04-20 (월) 22:50 KST

## [작업 판단]

- 담당: 개발팀 직접 (S등급 단일 회귀 수정)
- 등급: S
- QA: 불필요 (보고 후 타치코마가 검증 spawn)
- 디자인 검토: 톤 일관성 자체 점검 (일관성 OK)

## 회귀 분석

### 베이스 커밋 (d872a3a)

`feat(news): 휴장일 메시지 + 중립 표현 교체 + 면책 문구 추가` 시점에는 `news.html` 단일 파일이었고, 휴장 메시지는 `renderCalExpandContent`(캘린더 확장 영역)에만 도입됨. 즉 휴장 안내 자체가 **그 영역에만** 존재.

### 회귀 (실은 신규 누락) 영역

리팩토링 (`9ee02aa`로 추정) 시 `js/` 4모듈 분리되며 새로운 영역이 추가됨:
- `theme-tree-container` (테마 트리)
- `theme-trend` (테마 트렌드 차트)

이 두 영역에 휴장 분기 자체가 신설되지 않았고, 더 결정적인 원인은 **`calendar.js`에서 휴장일이면 `initThemeTree()`를 호출조차 하지 않음** (line 287, 180). 결과: `theme-tree-container`는 빈 채로 남음 → 사용자에게 "데이터 로딩" 같은 placeholder만 보임.

회귀 시점은 분리 PR. 현재 코드의 정확한 원인:

| 위치 | 증상 |
|------|------|
| `js/calendar.js:287` (`_refreshDataAsync`) | `if (!isMarketClosed) initThemeTree()` → 휴장일 미호출, 컨테이너 빈 채 |
| `js/calendar.js:180` (`onCalCellClick`) | 동일하게 휴장일 미호출 |
| `js/renderer.js:851` (`initThemeTree`) | 휴장 분기 없음 |
| `js/renderer.js:501` (`initThemeTrend`) | 데이터 0건 시 휴장이라도 "데이터가 없습니다"만 |

## 변경

### `js/calendar.js`
- `_refreshDataAsync`: 휴장일에도 `initThemeTree(initialDate)` 호출
- `onCalCellClick`: 동일

### `js/renderer.js`
- `initThemeTree`: 함수 시작부에 `dateOverride`가 휴장일이면 `theme-tree-container`에 안내 메시지 표시 후 즉시 return
- `initThemeTrend`: 데이터 0건 + 오늘이 휴장일이면 휴장 안내 메시지로 교체

### 안내 문구 (캘린더 셀 메타와 톤 일관성 유지)

```
오늘은 장이 쉽니다 (주말) · 다음 거래일: 4월 21일(월)
```

기존 `renderCalExpandContent`의 휴장 빈 분기와 동일 표현. 캘린더 셀 메타 한 단어 `'휴장'`과 정합. 메모리 `feedback_design_consistency_aesthetics.md` 적용.

## 검증

### 시뮬레이션 (정적 코드 트레이싱)

휴장일 (`2026-04-19` 일요일) URL 진입:
1. `initialDate = 2026-04-19`
2. `_refreshDataAsync` → `loadCalDayData` → `renderCalExpandContent` → `hasAny=false` → 기존 휴장 분기로 "오늘은 장이 쉽니다 (주말)" 표시 (회귀 없음)
3. `initThemeTree('2026-04-19')` 신규 호출 → 휴장 분기 즉시 → "오늘은 장이 쉽니다 (주말) · 다음 거래일: ..." 표시
4. `initThemeTrend()` → 누적 데이터 있으면 차트 유지, 없으면 휴장 안내

평일 (`2026-04-20` 월요일):
1. 모든 분기 통과 (회귀 없음)
2. `initThemeTree(2026-04-20)` → 휴장 분기 미통과 → 정상 트리 빌드

평일↔휴장 토글 (`onCalCellClick`):
- 휴장 클릭 → 트리 컨테이너에 휴장 메시지 교체
- 평일 클릭 → 다시 트리 재빌드 (정상)

### 모바일·데스크탑

추가 메시지는 `cal-empty` 기본 클래스 사용 (`padding:24px 0`). 모바일 폰트 크기 동일, 정보 동일. 메모리 `feedback_mobile_equal_desktop.md` 적용.

### 헬퍼 함수 접근성

- `isMarketClosed`, `getHolidayName`, `getNextTradingDate`, `formatKoDate`: `js/calendar.js`에서 전역 선언
- `escapeHtml`: `js/utils.js`에서 전역 선언
- 로드 순서 (`news.html:119-122`): utils → data-loader → calendar → renderer. renderer에서 모든 헬퍼 접근 가능

## 변경 파일

```
 js/calendar.js | 12 ++++--------
 js/renderer.js | 22 +++++++++++++++++++++-
 2 files changed, 25 insertions(+), 9 deletions(-)
```

S등급 한도 ≤ 3 충족.

## 머지 권고

머지 전 타치코마/QA의 브라우저 시뮬레이션 권고:
- `?date=2026-04-19` (일요일) 접근 → 종목 카드 + 테마 트리 모두 안내 표시 확인
- `?date=2026-04-20` (월요일, 거래일) 평일 회귀 없음 확인
- 모바일 viewport (≤640px)에서 동일 정보 표시 확인

머지·push는 미실행. 보고 후 결정 대기.

---

## 후속 커밋 (옵션 A 적용, 61032dd)

### QA 발견 핵심 버그: 휴장일 fallback 카드 표출

원래 1차 커밋(706d739)은 트리 영역만 차단했음. 그러나 `data-loader.js:71-90`의 7일 fallback이 휴장일에도 동작 → `stockDailyData`가 이전 거래일 데이터로 채워지고 → `interpretedByName`도 채워지고 → `renderCalExpandContent`의 `hasAny=true` 분기로 빠져 fallback 카드가 그려짐. 휴장 안내 분기를 우회.

### 수정 (옵션 A: 휴장일은 휴장 안내만, fallback 숨김)

**`js/data-loader.js:71`** — fallback 진입 가드 한 줄:
```js
if (!stockDailyData && !isMarketClosed(date)) {
```
휴장일이면 fallback fetch 자체 skip → `stockDailyData=null` → `interpretedByName` 비어있음 → `hasAny=false` → 휴장 분기 자연 진입. macroEvent 안내(`최신 분석 데이터 준비 중 — ...`)도 함께 차단 (depends on `_fallback_date`).

### 디자인 통일 (디자인팀 권고 채택)

휴장 안내 4곳 모두 동일 2단 div 구조로 교체:
- `renderCalExpandContent` 빈 분기(line 64): 이미 2단이었음, 사유 표기 제거
- `renderCalExpandContent` todayHtml 빈 분기(line 447): 평문 → 2단 div
- `initThemeTree` 휴장 분기(line 862): 평문 → 2단 div
- `initThemeTrend` 휴장 분기(line 501): 평문 → 2단 div

문구: `오늘은 장이 쉽니다` (15px/700/var(--tx2)) + `다음 거래일 4월 21일(월)` (12px/var(--dm))

- (a) `(주말)` 괄호 제거 ✓
- (b) 시각 위계 통일 ✓
- (c) `getHolidayName`/`isWeekendDate` 호출 자체 제거 → KRX 임시휴장도 동일 문구 (사유 미표시이므로 분기 불필요) ✓

### 변경 파일 (후속 커밋)

```
 js/data-loader.js |  3 ++-
 js/renderer.js    | 15 ++++++---------
 2 files changed, 8 insertions(+), 10 deletions(-)
```

### 시뮬레이션 (정적 트레이싱)

휴장(`2026-04-19` 토):
- `loadCalDayData` → 직접 fetch 실패 → `!isMarketClosed` false → fallback skip → `stockDailyData=null`
- `renderCalExpandContent` → `hasAny=false` → 휴장 2단 div 안내
- `initThemeTree('2026-04-19')` → 휴장 분기 → 동일 2단 div
- `initThemeTrend()` → 누적 데이터 있으면 차트 유지, 없으면 동일 2단 div

평일(`2026-04-20` 월):
- `!stockDailyData && !isMarketClosed` → fallback 정상 동작 (회귀 없음)
- `initThemeTree(2026-04-20)` → 휴장 분기 미통과 → 정상 트리

평일↔휴장 토글: 정상

### 헬퍼 접근성

`isMarketClosed`는 `js/calendar.js:49`에서 전역. data-loader.js에서 `loadCalDayData`는 런타임(이벤트/_refreshDataAsync)에 호출되므로 calendar.js 로드 완료 후. 접근 가능.

### 누적 변경

```
 WORKLOG.md       | (보강)
 js/calendar.js   | 12 ++++--------
 js/data-loader.js |  3 ++-
 js/renderer.js   | 28 ++++++++++++----------------
```

3 파일, S등급 한도 ≤ 3 충족.

---

## 후속 patch (3939cdc, 2026-04-21 11:05 KST)

`fix(ui): 캐시 버스터 갱신 (휴장 안내 즉시 반영)` — `news.html`의 JS 3개(`data-loader.js`/`calendar.js`/`renderer.js`) 캐시 버스터를 `20260421a`로 갱신. 기존 방문자도 다음 페이지 로드 시 즉시 신규 코드 적용. utils.js·news.css는 변경 없어 보존.

