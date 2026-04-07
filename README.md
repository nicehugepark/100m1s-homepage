# 100m1s.com — 회사 홈페이지

> **100 Million, 1 Step** — 1억, 한 걸음에.

100M1S 회사 공식 홈페이지. PM320 v2 라이트 테마 디자인 시스템 기반.

## 구조

```
.
├── index.html      # 메인 페이지 (Hero / About / Products / Contact)
├── privacy.html    # 개인정보처리방침
├── terms.html      # 이용약관
├── SETUP.md        # 배포 + DNS 설정 가이드
└── README.md       # 이 파일
```

## 로컬 미리보기

```bash
# Python 내장 서버
python3 -m http.server 8000

# 또는 임의의 정적 서버
npx serve .
```

→ http://localhost:8000

## 배포

GitHub Pages로 자동 배포됩니다 (main 브랜치 push 시).

- Production: https://100m1s.com (DNS 연결 후)
- 미리보기: https://nicehugepark.github.io/100m1s-homepage

## 도메인

가비아에서 6개 도메인 보유:
- **100m1s.com** (메인)
- 100m1s.kr / 100m1s.co.kr (한국 ccTLD, redirect)
- 100m1s.dev / 100m1s.me / 100m1s.app (특수 용도)

DNS 설정은 [SETUP.md](./SETUP.md) 참조.

## 라이선스

© 2026 100M1S. All rights reserved.
