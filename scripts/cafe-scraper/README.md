# 뉴지 — 주식차트연구소 카페 스크레이퍼

매 시간 GitHub Actions cron으로 실행되어, 주식차트연구소 카페의 메뉴 167(`viewType=L`)에서 새 글을 발견하면 본문을 파싱하여 종목·뉴스 카드·호재/악재 판단을 JSON으로 저장합니다.

## 파이프라인

```
GitHub Actions cron (매 시간)
  ↓
main.py
  ├─ 1. 네이버 로그인 (Playwright)
  ├─ 2. 메뉴 글 목록 → article ID 수집
  ├─ 3. state.json과 비교 → 신규 ID만 처리
  ├─ 4. 글 본문 fetch → HTML
  ├─ 5. 종목 표 + 테마 라벨 + 뉴스 링크 추출
  ├─ 6. 각 뉴스 → Gemini로 요약 + 호재/악재 판단
  └─ 7. data/cafe/posts/<id>.json 저장 + index.json 갱신
  ↓
git add data/cafe/ → commit → push
  ↓
news.html 가 index.json + posts/*.json 을 fetch 하여 카드 형태로 렌더
```

## 출력 스키마

- `data/cafe/state.json` — 처리 완료된 article ID 캐시 (최근 500개)
- `data/cafe/index.json` — 최신 100개 게시글 manifest (news.html이 fetch)
- `data/cafe/posts/<post_id>.json` — 개별 글 상세 (종목·뉴스·판단)

### 개별 post JSON 예시
```json
{
  "post_id": "2632338",
  "post_url": "https://cafe.naver.com/...",
  "fetched_at": "2026-04-08T13:00:00+09:00",
  "stock_count": 15,
  "sections": [
    {
      "type": "상승",
      "stocks": [
        {
          "rank": 1,
          "name": "캡스톤파트너스",
          "ticker": null,
          "price_won": 4645,
          "change_pct": 29.93,
          "theme_label": "당근마켓 투자 성과 기대감",
          "strength_score": 50.5
        }
      ]
    }
  ],
  "news_cards": [
    {
      "url": "https://...",
      "source": "naver.com",
      "summary": "3-5줄 한국어 요약",
      "judgment": "호재",
      "confidence": 0.78,
      "reasoning": "1-2줄 판단 근거"
    }
  ]
}
```

## 환경변수

| 변수 | 용도 | 발급처 |
|------|------|--------|
| `NAVER_CAFE_ID` | 네이버 로그인 ID | (대표 계정) |
| `NAVER_CAFE_PASSWORD` | 네이버 로그인 PW | (대표 계정) |
| `GOOGLE_AI_API_KEY` | Gemini API | https://aistudio.google.com |

로컬 개발: `cp .env.example .env` 후 값 채우기. **`.env`는 절대 커밋 금지**.

GitHub Actions: 레포 Settings → Secrets and variables → Actions → New repository secret 으로 위 3개를 추가.

## 로컬 실행

```bash
cd scripts/cafe-scraper
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
export NAVER_CAFE_ID=...
export NAVER_CAFE_PASSWORD=...
export GOOGLE_AI_API_KEY=...
python main.py
```

성공하면 `data/cafe/` 아래에 JSON이 떨어집니다.

## 인증 — 쿠키 권장

**ID/PW 자동 로그인은 GitHub Actions 환경에서 거의 항상 실패**합니다 (IP보안, 봇 감지, 캡차). 쿠키 기반 인증이 유일한 안정 해법.

### 쿠키 추출 (5분, 1회)

1. Chrome에 **Cookie-Editor** 확장 설치 ([크롬 웹스토어](https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm))
2. 일반 Chrome에서 https://www.naver.com 로그인 (IP보안 인증 정상 절차)
3. Cookie-Editor 아이콘 클릭 → naver.com 도메인 쿠키 표시
4. **`Export` → `JSON`** → 클립보드 복사
5. GitHub Secrets에 `NAVER_COOKIES` 이름으로 등록 (대괄호 `[` `]` 포함 전체 JSON)

### sameSite 정규화

Cookie-Editor export는 sameSite 값을 다양한 형식으로 출력합니다 (`no_restriction`, `unspecified`, `lax` 등). main.py가 자동으로 Playwright 형식 (`Strict`/`Lax`/`None`)으로 변환:

| Cookie-Editor | Playwright |
|---------------|-----------|
| `no_restriction` / `none` | `None` |
| `lax` / `unspecified` / 빈값 | `Lax` |
| `strict` | `Strict` |

`expirationDate` (Cookie-Editor) → `expires` (Playwright)도 자동 변환.

### 쿠키 인증 검증

스크레이퍼는 쿠키 주입 후 https://www.naver.com에 접근해서 body에 "로그아웃" 또는 "MY" 텍스트가 있는지 확인합니다. 없으면 *쿠키 만료/무효*로 간주하고 종료 (ID/PW fallback 안 함).

### 쿠키 만료 시 (1~3개월)

워크플로 실패 → 디버그 PNG에서 로그인 페이지 확인 → 동일 절차로 새 쿠키 추출 → secret 갱신.

## 알려진 위험

1. **네이버 봇 감지** — 자동 로그인은 captcha/2FA/IP보안으로 막힘. 쿠키 인증이 답.
2. **HTML 구조 변경** — 카페 신/구 버전 + iframe 변동성. 셀렉터 다중 시도로 방어하지만 깨질 수 있음.
3. **Gemini 비용** — 게시글 1건당 최대 5개 뉴스 → 5번 호출. 한 시간에 1글이라도 하루 ~120 호출. flash 모델 무료 tier로 충분.
4. **저작권** — 카페·뉴스 원문은 저장하지 않음. 요약 + 메타데이터만.
5. **rate limit** — 페이지당 2초 sleep. 너무 빠르면 차단 위험.

## TODO

- [ ] 글 목록 SPA 파싱 검증 (현재는 HTML grep 방식)
- [ ] 종목명 → KRX 티커 매핑
- [ ] 종목별 뉴스 매칭 (현재는 글 단위)
- [ ] 작성자 필터 정보(상승≥10% 등) 보존
- [ ] 거래대금/거래량 컬럼 파싱 정확도 향상
- [ ] 동일 작성자 패턴 학습 (글 작성 시각)
- [ ] 호재/악재 판단에 박성진 피드백 반영하는 메모리 (별도 파일)
- [ ] mock 모드 (`--mock` flag로 가짜 데이터 생성, 페이지 테스트용)
