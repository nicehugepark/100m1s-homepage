# 100m1s.com — 회사 홈페이지

> **Far. One Step.** — 멀리, 한 걸음.

100M1S 회사 공식 홈페이지. 샴페인 골드 + 루비 액센트 톤. R5 (Pure S Serpent) 로고.

## 구조

```
.
├── index.html              # 메인 페이지 (Hero / About / Products / Contact)
├── privacy.html            # 개인정보처리방침
├── terms.html              # 이용약관
├── favicon.svg             # R5 로고 (모든 디지털 용도)
├── apple-touch-icon.png    # iOS 홈 화면 아이콘 (180x180)
├── og-image.svg            # OG 이미지 소스 (1200x630)
├── og-image.png            # OG 이미지 PNG (카카오톡/페이스북/트위터)
├── CNAME                   # 100m1s.com (GitHub Pages 커스텀 도메인)
├── SETUP.md                # 배포 + DNS 설정 가이드
└── README.md               # 이 파일
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
