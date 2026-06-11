# DSN-arch-frontend 동시 갱신분 — wave5-pm320 (R28 2심 조니 확정)

- 작성: @agent:개발팀(dev-pm320-wave5) · 2026-06-11 (목) · branch fix/wave5-pm320
- 본 파일 = 메인 repo `records/2026-04/DOC-20260430-DSN-001-arch-frontend.md` 멀티세션 회피용
  워크트리 내 delta 기록. 머지 시 본문 DSN에 흡수 요망.
- flr_reference: FLR-20260428-TEC-001 (한쪽 코드 양끝 누락), FLR-AGT-002 (거짓 충실성)

## §3.6 (PM320 캘린더/픽 슬롯) delta

1. **P0-1 서빙 표류**: `js/renderer.js` `_themeTrendWindow(themeData)` 신설 (initThemeTrend 직전).
   theme-trend window(20영업일)·정렬(누적 trade_amount desc)·선두 trim 의 단일 SSOT.
   본체 initThemeTrend + initLimitUpTrend fallback 양 경로 호출 (race 표류 구조 차단).
   lut 헤더 총 건수 = 윈도우 합산 재계산(`_lutWindowTotal`) — `data.total_count` 사용 폐기.
2. **P0-2 휴장 뷰**: renderCalExpandContent `_isHolidayView` (과거 + isMarketClosed) 분기.
   휴장일 뷰 = `.cal-pm320-holiday` 한 줄("M월 D일 (요일)은 휴장일입니다 — 픽이 발행되지
   않는 날입니다.") + 메타 라벨 `휴장일 · HH:MM 기준`. 종목 카드·"이날의 종목 N개"·
   "수집되지 않은 날짜"(no-data) 미렌더. 오늘 주말·휴장 suppress 뷰(Q-20260606-113)는 무회귀.
3. **P1① 뉴스 요약 시점**: 과거 뷰 섹션 타이틀 = "M월 D일 뉴스 요약" (`_newsTitleLabel`).
4. **P1⑤ INTRADAY fold**: OPEN+픽 미확정 시 `#pm320-prepick-portal`(헤더 직하)에
   `.cal-pm320-portal-cd` 카운트다운 칩 주입 (R23 PRE_MARKET portal 패턴 공유).
   `_wirePickCountdown` = data-pick-cd 전수(querySelectorAll) tick (본문 배너 + portal 동시).
5. **P1⑥ 테마 차트 y domain**: 가시 스크롤 윈도우 데이터 기반 동적 재산출
   (`_updateYDomain`/`_applyYDomain`, scroll rAF). polyline/dot(cy)·y축 라벨 동기 갱신.
   x축 라벨 = 기간 전체(전 일자) 유지. tt-dot 에 data-amount 부여.
6. **제거① 테마트리**: 동일 종목 코드셋 leaf 루트 병합 — 대표 행 + `.theme-tree-merged-chip`
   테마명 칩 병기. "N개 테마" 카운트 = 병합 후 visRoots.
7. **P1④ 터치 44×44**: cal-term-tip ::before 24→44 / cal-share-btn·toss-cal-nav·menu-toggle
   ::after 44 오버레이 / toss-cal-cell ::before 40(조니 승인 하한 예외) / 상한가 dot =
   `.lut-dot-touch` r=22 투명 오버레이(role·tabindex 승계, 시각 dot aria-hidden 강등).
8. **P1② 다크 muted 분리**: `--dm-hi` 토큰 신설 (라이트 = --dm 동일값, 다크 `--dk-dm-hi:#A9A18E`).
   사용처 4: cal-pm320-pending-sub / -cd-label / idx-fut-disclaimer / cal-pm320-wr-running.
9. **P1③ trio**: wr-cell-sub keep-all + wr-cell-k nowrap (3셀 baseline 정렬 유지).
10. **제거②**: 모바일 범례 collapsed = 60px 정확 클립 + mask 폐기 (유령 텍스트 제거).
11. **제거③**: `.toss-cal-cell.holiday::after` 적색 점 룰 삭제.
12. **P2**: menu.js 드로어 ESC·본체 탭 닫기 / running mark "(잠정 집계)" 무날짜 폴백 칩 폐기
    (snapshot_date 실재 시만 "(집계 기준 M/D)") / `.cal-pm320-today-rec-dnote` D+0 정의 1줄.
13. **cache-bust**: pm320.html news.css·renderer.js → `20260611v322`, sw.js `news-v318`.
