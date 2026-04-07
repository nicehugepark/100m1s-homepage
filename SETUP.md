# 100m1s.com 배포 + DNS 설정 가이드

대표님이 직접 진행할 단계 가이드입니다. 모두 1시간 이내 완료 가능합니다.

## 🎯 목표

- `100m1s.com` → 회사 홈페이지 (Vercel)
- `pm320.100m1s.com` → PM320 서비스 (별도 배포)
- 나머지 5개 도메인 (.kr, .co.kr, .dev, .me, .app) → `100m1s.com`으로 301 redirect

---

## 1단계: GitHub 레포에 홈페이지 푸시 (5분)

```bash
cd /Users/seongjinpark/company/100m1s
git add projects/100m1s-homepage/
git commit -m "feat(homepage): 100m1s.com 1페이지 회사 홈페이지 + 법무 페이지 초안"
git push
```

→ `github.com/nicehugepark/100m1s` 에 반영됨.

---

## 2단계: Vercel 가입 + 프로젝트 연결 (10분)

1. **Vercel 가입**: https://vercel.com/signup
   - "Continue with GitHub" 클릭
   - GitHub OAuth 승인
2. **프로젝트 import**:
   - Vercel 대시보드 → "Add New" → "Project"
   - GitHub 레포 목록에서 `nicehugepark/100m1s` 선택
   - "Import" 클릭
3. **빌드 설정** (이게 중요):
   - **Framework Preset**: Other
   - **Root Directory**: `projects/100m1s-homepage`
   - **Build Command**: (비워두기 — 정적 HTML이라 빌드 불필요)
   - **Output Directory**: `.` (현재 디렉토리)
4. "Deploy" 클릭

→ 약 1분 후 임시 도메인(예: `100m1s.vercel.app`) 발급. 여기서 시안 미리보기 가능.

---

## 3단계: 도메인 연결 — 100m1s.com (15분)

### Vercel 측 설정

1. Vercel 프로젝트 → Settings → **Domains**
2. `100m1s.com` 입력 → "Add"
3. Vercel이 알려주는 DNS 설정 값 메모:
   - **A 레코드**: `76.76.21.21`
   - **CNAME (www용)**: `cname.vercel-dns.com`

### 가비아 측 설정

1. 가비아 마이페이지 → **My가비아** → **도메인 통합관리**
2. `100m1s.com` 선택 → **DNS 정보** → **DNS 설정**
3. 다음 레코드 추가:

| 호스트 | 타입 | 값 | TTL |
|--------|------|-----|-----|
| @ | A | 76.76.21.21 | 600 |
| www | CNAME | cname.vercel-dns.com | 600 |

4. 저장
5. **DNS 전파 대기**: 10분~1시간 (보통 10분 이내)

→ `https://100m1s.com` 접속 시 회사 홈페이지가 보이면 성공.

---

## 4단계: 나머지 5개 도메인 → 100m1s.com 301 redirect (20분)

### 옵션 A: 가비아 포워딩 (가장 쉬움)

가비아는 도메인 포워딩 무료 제공.

1. 가비아 마이페이지 → **도메인 통합관리**
2. 각 도메인 (`100m1s.kr`, `100m1s.co.kr`, `100m1s.dev`, `100m1s.me`, `100m1s.app`) 차례로:
   - 도메인 선택 → **부가서비스** → **도메인 포워딩 신청**
   - 포워딩 URL: `https://100m1s.com`
   - **포워딩 방식: 301 (영구 이동)** ← 이거 중요. SEO 권한 통합됨.
   - 신청

→ 5개 도메인 모두 자동으로 100m1s.com으로 이동.

### 옵션 B: 모든 도메인을 Vercel에 추가 (더 좋음, 약간 더 복잡)

Vercel은 여러 도메인을 1개 프로젝트에 연결 가능. 이 경우 Vercel이 자동으로 메인 도메인(`100m1s.com`)으로 redirect 처리.

각 도메인마다 위 3단계를 반복:
1. Vercel Settings → Domains → 도메인 추가
2. 가비아 DNS에 A 레코드 (76.76.21.21) 또는 NS 변경

→ 더 빠르고 깔끔하지만 5번 반복해야 함.

**휴지 추천: 옵션 A** (가비아 포워딩 — 5분에 끝남)

---

## 5단계: PM320 서브도메인 — pm320.100m1s.com (나중에)

PM320은 현재 Flask 앱으로 `localhost:3320` 에서만 동작. 외부 호스팅 시점에 진행:

1. PM320을 별도 Vercel 프로젝트로 배포 (또는 Railway, Fly.io 등 Python 호스팅)
2. Vercel 프로젝트 → Domains → `pm320.100m1s.com` 추가
3. 가비아 DNS:
   | 호스트 | 타입 | 값 |
   |--------|------|-----|
   | pm320 | CNAME | cname.vercel-dns.com |

→ 나중에 Phase 1 출시 시점에 처리.

---

## 6단계: 이메일 (선택)

`hello@100m1s.com` 이메일 사용하려면:

### 옵션 A: Cloudflare Email Routing (무료)
- Cloudflare에 도메인 연결 → Email Routing → `hello@100m1s.com` → 본인 Gmail로 forwarding
- 받기만 가능. 보내기는 Gmail에서 별도 설정

### 옵션 B: Google Workspace ($6/월/사용자)
- 보내기/받기 모두 가능
- 전문적이지만 비용 발생
- 법인 설립 후 추천

**휴지 추천:** 지금은 **옵션 A**, 법인 설립 후 **옵션 B**로 전환.

---

## 7단계: AdSense 신청 (배포 후)

도메인 연결 + 법무 페이지 배포 완료 후:

1. https://www.google.com/adsense 가입
2. 사이트 추가: `100m1s.com`
3. 심사 대기 (보통 1~2주, 금융 카테고리는 까다로움)
4. 승인되면 광고 코드 받아서 PM320 `app.py` 의 광고 슬롯 placeholder를 실제 코드로 교체

---

## ✅ 체크리스트

- [ ] GitHub에 홈페이지 코드 push
- [ ] Vercel 가입 + 프로젝트 import
- [ ] Vercel 빌드 성공 확인 (임시 도메인 접속)
- [ ] 가비아 DNS — 100m1s.com A 레코드 설정
- [ ] https://100m1s.com 접속 확인
- [ ] 가비아 포워딩 — 나머지 5개 도메인 → 100m1s.com (301)
- [ ] 각 도메인에서 redirect 동작 확인
- [ ] (선택) Cloudflare Email Routing — hello@100m1s.com
- [ ] AdSense 신청

---

## 문제 발생 시

- **DNS 전파 안 됨**: `dig 100m1s.com` 으로 확인. 1시간 이상 안 되면 가비아 고객센터 (1588-7535)
- **Vercel 빌드 실패**: Root Directory 설정 확인 (`projects/100m1s-homepage`)
- **SSL 오류**: Vercel은 자동 SSL 발급. 1~2분 대기 후 재시도
- **포워딩 안 됨**: 가비아에서 "신청 완료" 상태인지 확인. 처리에 1~2시간 걸릴 수 있음
