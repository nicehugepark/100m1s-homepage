---
marp: true
theme: default
size: 16:9
paginate: true
backgroundColor: '#0F1218'
color: '#F2F4F8'
header: '비공개 연구 자료 · 영구 비공개 · 외부 공유 금지'
footer: '100M1S · 작전주 케이스북 v0.3 · DSN-003 + EDU-002 v0.2.1-bis'
style: |
  /* === 다크 누아르 + 햇살 골드 (DSN-003 §2.2 정합) === */
  :root {
    --ppt-bg:       #0F1218;
    --ppt-bg2:      #1A1F28;
    --ppt-bg3:      #252B36;
    --ppt-bd:       #3D4351;
    --ppt-tx:       #F2F4F8;
    --ppt-tx2:      #B8C0CC;
    --ppt-dm:       #6B7280;
    --ppt-am:       #C49930;
    --ppt-am2:      #E8C063;
    --ppt-am-glow:  rgba(232,192,99,0.18);
    --ppt-ru:       #A01528;
    --ppt-ru-glow:  rgba(160,21,40,0.20);
    --ppt-pos:      #4ADE80;
    --ppt-neg:      #F87171;
  }
  section {
    background: var(--ppt-bg);
    background-image: radial-gradient(ellipse at 75% 75%, rgba(232,192,99,0.06) 0%, transparent 60%);
    color: var(--ppt-tx);
    font-family: 'Pretendard', -apple-system, 'Segoe UI', sans-serif;
    padding: 56px 64px 64px;
    position: relative;
  }
  section::before {
    content: "비공개 연구자료 100M1S";
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 110px; font-weight: 900; letter-spacing: 4px;
    color: rgba(232,192,99,0.04);
    pointer-events: none;
    white-space: nowrap;
    z-index: 0;
  }
  section > * { position: relative; z-index: 2; }
  header {
    background: var(--ppt-ru); color: #fff;
    padding: 6px 16px; font-size: 12px; font-weight: 800;
    letter-spacing: 0.5px; text-align: center;
  }
  footer {
    color: var(--ppt-dm); font-size: 11px; letter-spacing: 0.5px;
  }
  h1 {
    font-size: 48px; font-weight: 900; letter-spacing: -1.4px; line-height: 1.15;
    color: var(--ppt-tx); margin-bottom: 12px;
  }
  h1 .accent, h1 strong { color: var(--ppt-am2); }
  h2 {
    font-size: 28px; font-weight: 800; letter-spacing: -0.6px;
    color: var(--ppt-am2); margin-bottom: 16px;
  }
  h3 { font-size: 18px; font-weight: 700; color: var(--ppt-tx2); margin-bottom: 8px; }
  p, li { font-size: 16px; line-height: 1.6; color: var(--ppt-tx); }
  small, .meta { font-size: 12px; color: var(--ppt-dm); }
  strong { color: var(--ppt-am2); font-weight: 800; }
  em { color: var(--ppt-tx); font-style: italic; }
  blockquote {
    background: var(--ppt-bg3);
    border-left: 4px solid var(--ppt-am);
    padding: 18px 22px; margin: 12px 0;
    font-size: 16px; font-style: italic; line-height: 1.7;
    border-radius: 0 8px 8px 0;
    color: var(--ppt-tx);
  }
  table {
    width: 100%; border-collapse: collapse; font-size: 13px;
    background: var(--ppt-bg2); border: 1px solid var(--ppt-bd); border-radius: 10px;
    overflow: hidden;
  }
  th {
    background: var(--ppt-bg3); color: var(--ppt-am);
    padding: 8px 12px; text-align: left; font-weight: 800;
    font-size: 12px; letter-spacing: 0.5px;
    border-bottom: 1px solid var(--ppt-bd);
  }
  td {
    padding: 8px 12px; border-bottom: 1px solid var(--ppt-bd);
    color: var(--ppt-tx); font-size: 13px; line-height: 1.5;
  }
  tr:nth-child(even) td { background: rgba(0,0,0,0.15); }
  tr:last-child td { border-bottom: none; }
  code {
    background: var(--ppt-bg3); color: var(--ppt-am2);
    padding: 2px 6px; border-radius: 4px; font-size: 13px;
    font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace;
  }
  /* === Scene Label === */
  .scene-label {
    display: inline-block;
    padding: 4px 12px;
    background: var(--ppt-am-glow);
    border: 1px solid rgba(232,192,99,0.35);
    border-radius: 999px;
    font-size: 12px; font-weight: 800;
    color: var(--ppt-am2);
    letter-spacing: 1.6px;
    text-transform: uppercase;
    margin-bottom: 14px;
  }
  /* === 양면 분석 박스 (STRAT-002 §3.2) === */
  .twoside {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 14px 0;
  }
  .twoside .trap {
    background: var(--ppt-bg2);
    border-left: 4px solid var(--ppt-neg);
    padding: 14px 16px; border-radius: 0 8px 8px 0;
    font-size: 14px; line-height: 1.55;
  }
  .twoside .villain {
    background: var(--ppt-bg2);
    border-left: 4px solid var(--ppt-am);
    padding: 14px 16px; border-radius: 0 8px 8px 0;
    font-size: 14px; line-height: 1.55;
  }
  .twoside .label {
    font-size: 11px; font-weight: 800; letter-spacing: 1.5px;
    text-transform: uppercase; margin-bottom: 6px; display: block;
  }
  .twoside .trap .label { color: var(--ppt-neg); }
  .twoside .villain .label { color: var(--ppt-am); }
  .ceo-line {
    background: var(--ppt-am-glow);
    border-left: 4px solid var(--ppt-am);
    padding: 12px 16px; border-radius: 0 8px 8px 0;
    font-size: 14px; line-height: 1.55;
    margin: 8px 0 12px;
  }
  .ceo-line .label {
    font-size: 11px; font-weight: 800; letter-spacing: 1.5px;
    text-transform: uppercase; color: var(--ppt-am); margin-bottom: 4px; display: block;
  }
  /* === 핵심 수치 카드 === */
  .num-row {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0;
  }
  .num-card {
    background: var(--ppt-bg2);
    border: 1px solid var(--ppt-bd);
    border-left: 3px solid var(--ppt-am);
    border-radius: 8px;
    padding: 10px 14px;
  }
  .num-card .nb-label {
    font-size: 11px; color: var(--ppt-dm); font-weight: 600;
    letter-spacing: 0.5px; margin-bottom: 4px;
  }
  .num-card .nb-value {
    font-size: 18px; font-weight: 800; color: var(--ppt-tx);
    font-feature-settings: 'tnum';
  }
  .num-card .nb-value .pos { color: var(--ppt-pos); }
  .num-card .nb-value .neg { color: var(--ppt-neg); }
  .num-card .nb-value .am { color: var(--ppt-am); }
  /* === 시간선 (하단 footer 위) === */
  .timeline {
    margin-top: 14px;
    font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace;
    font-size: 11px; color: var(--ppt-dm); letter-spacing: 0.5px;
    border-top: 1px solid var(--ppt-bd);
    padding-top: 8px;
    display: flex; justify-content: space-between;
  }
  .timeline .here { color: var(--ppt-am); font-weight: 800; }
  /* === 매트릭스 (heatmap) === */
  .matrix-cell-strong { background: var(--ppt-am-glow) !important; color: var(--ppt-am); font-weight: 800; }
  .matrix-cell-medium { background: rgba(232,192,99,0.08) !important; color: var(--ppt-am2); }
  .matrix-cell-weak   { color: var(--ppt-dm); }
  /* === 100M1S 워드마크 === */
  .brand {
    position: absolute; right: 32px; top: 32px;
    font-size: 11px; font-weight: 900; letter-spacing: 2px;
    color: var(--ppt-am); text-transform: uppercase;
  }
---

<!-- _class: lead -->
<!-- _paginate: false -->

<div class="brand">● 100M1S</div>

# 작전주의 본질
## 영화 시나리오로 보는 한국 코스닥 작전주 12 케이스 × 시간선 9패턴

<br>

<div class="scene-label">PROLOGUE · 비공개 연구 교육자료</div>

> "세력에게 놀아나는 매매자의 반대 = 세력의 관점 = 대표의 진입."
> — STRAT-002 §0.1 (2026-05-04 22:54 KST)

**12 케이스 × 9 패턴 = 108 변칙 사례 매트릭스**
**12건 양면 분석 박스 · 영화 대본 인용 · D-180 ~ D+90 시간선**

<br>

<div class="num-row">
<div class="num-card"><div class="nb-label">EDU-002 v0.2.1-bis</div><div class="nb-value"><span class="am">1,904줄</span></div></div>
<div class="num-card"><div class="nb-label">변칙 사례</div><div class="nb-value"><span class="am">132건+</span></div></div>
<div class="num-card"><div class="nb-label">시간선 패턴</div><div class="nb-value"><span class="am">9패턴</span></div></div>
</div>

<small class="meta">교육 자료 · 100M1S 비공개 PoC · 2026-05-05 · 영화 시나리오 톤 · 매매자 vs 세력 양면 분석 · STRAT-001 §6.8 트리거 데이터 정합</small>

---

<div class="brand">● 100M1S</div>

<div class="scene-label">SLIDE 1 · INTRO</div>

# 부록 G 매트릭스 — **12 케이스 × 9 패턴**

> EDU-002 §부록 G 인용. 각 셀 = 해당 케이스의 변칙이 본 패턴에 위치하는 빈도. ✓✓ = 다수 / ✓ = 1~2건 / 빈칸 = 미매핑.

| 케이스 | P1 매집 | P2 매집후털기 | P3 띄움 | P4 띄움후털기 | P5 분배 | P6 재매집 | P7 다시분배 | P8 세력난입 | P9 이탈경합 |
|---|---|---|---|---|---|---|---|---|---|
| **1 통정매매** | ✓✓ | ✓ | ✓✓ | ✓ | ✓✓ | ✓ | — | ✓ | ✓ |
| **2 가장매매** | ✓✓ | — | ✓✓ | — | ✓✓ | — | — | ✓ | ✓ |
| **3 풍문 유포형** | ✓ | — | ✓✓ | — | ✓✓ | ✓ | — | ✓ | ✓ |
| **4 허위공시** | ✓ | — | ✓✓ | — | ✓✓ | — | — | — | ✓ |
| **5 CB/BW 헐값** | ✓✓ | — | ✓ | ✓ | ✓✓ | — | — | — | ✓ |
| **5.X CB 고급** | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | — | ✓ |
| **6 무자본 M&A** | ✓✓ | — | ✓ | — | ✓✓ | — | — | — | ✓ |
| **7 CFD SG증권** | ✓✓ | — | ✓✓ | — | ✓✓ | — | — | — | ✓ |
| **8 라임 사모펀드** | ✓✓ | — | ✓ | — | ✓✓ | — | — | — | ✓ |
| **9 바이오 임상** | ✓✓ | — | ✓✓ | — | ✓✓ | — | — | — | ✓ |
| **10 테마 그룹** | ✓ | — | ✓✓ | ✓ | ✓✓ | — | — | ✓ | ✓ |
| **11 회계감사 의견거절** | ✓✓ | — | ✓ | — | ✓✓ | — | — | — | ✓ |

**대표 매매 정수 (STRAT-001 §6.8 · 11원칙 매핑)**: P3 띄움 = 눌림매매·돌파매매 진입 핵심 / P5 분배 = 진입 절대 금지 + 청산만 / P9 이탈경합 = 5호가 양방향 두께 = 진입 보류

---

<div class="brand">● 100M1S</div>

<div class="scene-label">SLIDE 2 · CASE 1 · 통정매매 (Wash Trade)</div>

# **케이스 1** — 보이지 않는 핑퐁

> *"D-90 K급 주포가 차명 5계좌(평균 3,000만원/계좌)로 ㈜A 시총 600억 코스닥 종목을 1.5억으로 분할 매집한다."*
> *(D-30. 5분봉 거래량 평소 ×8, 거래대금 50억 → 380억. 통정매매 ×3회/일.)*
> *(D-7 16:30 호재 공시 + 익일 +28% 갭상승 + D+1 분할매도 시작.)*

<div class="num-row">
<div class="num-card"><div class="nb-label">시총·평균매집가</div><div class="nb-value">600억 / <span class="am">3,000원</span></div></div>
<div class="num-card"><div class="nb-label">D-7 종가</div><div class="nb-value">8,400원 <span class="pos">+180%</span></div></div>
<div class="num-card"><div class="nb-label">K 차익</div><div class="nb-value"><span class="am">+45억</span></div></div>
</div>

<div class="twoside">
<div class="trap"><span class="label">매매자 함정</span>
"거래대금 ×7 폭증 = 큰 호재" 추격매수 → D+1 갭상승 매수가 11,000원 → D+5 종가 6,200원 → <strong>-44% 손실</strong></div>
<div class="villain"><span class="label">세력 매매</span>
2막 후반 첫 윗꼬리 → 1분봉 RSI 30 → MA20 터치 → <strong>대표 동행 진입</strong> (분봉 스캘핑, 손절 -3%)</div>
</div>

<div class="ceo-line"><span class="label">대표 결정</span>
패턴 3 (띄움) 첫 윗꼬리 직후 = <strong>눌림매매 진입 후보</strong> (STRAT-001 §6.5 변칙 2-2 신뢰도 5/5). 통정매매 ×3회/일 + 거래원 분포 변화 식별 시 패턴 5 분배 임박 = 즉시 청산.</div>

<div class="timeline">
<span>D-90 매집</span><span>D-30</span><span class="here">D-7 띄움</span><span>D+0 분배</span><span>D+30</span><span>D+90 이탈</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="scene-label">SLIDE 3 · CASE 2 · 가장매매 (Pre-arranged Trade)</div>

# **케이스 2** — 혼자 치는 핑퐁

> *"J(38, 단독 작전수). HTS 8대 + 8 차명계좌 운영. ㈜B 시총 200억 저시총 코스닥, 5분봉 1회 자기매매로 거래량 ×8 폭발 위장."*
> *(D-20 호가 페인팅: 매수 잔량 30초 내 70% 취소 ×40회. 매매자 호가창 두께 보고 추격.)*
> *(D-2 09:30 텔레그램방 "오늘 마감 직전 상한가 갑니다" 풍문 → 11:00 추격매수 폭주 → 11:30 분배 시작.)*

<div class="num-row">
<div class="num-card"><div class="nb-label">HTS·차명</div><div class="nb-value"><span class="am">8대 / 8계좌</span></div></div>
<div class="num-card"><div class="nb-label">5분봉 거래량</div><div class="nb-value">평소 <span class="am">×8</span></div></div>
<div class="num-card"><div class="nb-label">텔레그램 외주</div><div class="nb-value"><span class="am">월 200만원</span></div></div>
</div>

<div class="twoside">
<div class="trap"><span class="label">매매자 함정</span>
호가 두께 + 5분봉 거래량 ×8 = "거래량 폭발 호재" 추격 → 11:30 분배 시작 시점 매수가 평균 9,800원 → 종가 7,200원 <strong>-26%</strong></div>
<div class="villain"><span class="label">세력 매매</span>
호가 잔량 30초 70% 취소 ×5회 = <strong>-15 페널티</strong> + 진입 차단. 5분봉 ×8 단독 = -10 + 게이트 차단 (PM320)</div>
</div>

<div class="ceo-line"><span class="label">대표 결정</span>
케이스 2는 매집 단계 식별 = <strong>HTS 8대 동일 IP 클러스터 적발</strong>로만 활용 (사후). 진입 영역 0. 텔레그램 유료방 신규 가입 폭증 + 종목 노출 = 풍문 작전 의심 → 패턴 3 (띄움) 직격 회피.</div>

<div class="timeline">
<span>D-60 매집</span><span class="here">D-20 띄움</span><span>D-2 풍문</span><span>D+0 분배</span><span>D+30</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="scene-label">SLIDE 4 · CASE 3 · 풍문 유포형 (디지털 군중 동원)</div>

# **케이스 3** — 텔레그램 리딩방 + 카페 알바 12명

> *"풍문책 N(41, 전직 증권사 RA). 텔레그램 유료방 3개 + 무료방 12개 운영. 월 99만원 ×800명 = 매출 8억."*
> *(N의 카페 알바 12명, 시간당 1만원, 1인 일 30~50건 게시·댓글. 동일 IP 회피 위해 카페별 1~2명 분담.)*
> *(D-1 12:00:00 N의 유료방 3개 동시: "㈜Q 주목. 다음 작전 대장. 종목코드 XXXX." + 12:01 카페 알바 12명 동시 게시: "AI 자회사 설립 임박, 친구가 IR쪽이라 들었음.")*

<div class="num-row">
<div class="num-card"><div class="nb-label">유료방 회원</div><div class="nb-value">800 → <span class="am">2,400명</span></div></div>
<div class="num-card"><div class="nb-label">알바 게시량</div><div class="nb-value">일 <span class="am">47건</span> (동조성 80%+)</div></div>
<div class="num-card"><div class="nb-label">작성자 다양성</div><div class="nb-value"><span class="neg">≤ 5명</span></div></div>
</div>

<div class="twoside">
<div class="trap"><span class="label">매매자 함정</span>
"카페에서 다들 추천하는 종목" 인식 → 후기 위장글 ("어제 +30%") 보고 추격매수 → D+1 09:30 N 컷오프 + 알바 키워드 중지 → 종가 -18%</div>
<div class="villain"><span class="label">세력 매매</span>
<strong>카페 작성자 다양성 ≤ 5명 + 거래대금 폭증 = 풍문 작전 = 진입 금지</strong>. 텔레그램 유료방 신규 가입 1주 ×3 = 풍문 채널 본진 의심 → -20 페널티</div>
</div>

<div class="ceo-line"><span class="label">대표 결정</span>
이시카와 영역 직격: 풍문 채널 다양성 메트릭 + 동일 시점 거래대금 동조 식별 → PM320 게이트 차단. 매매자는 <strong>차트만 본다</strong> (카페·텔레그램 후기 0% 신뢰). 패턴 3 (띄움)·패턴 5 (분배 직전) 모두 회피.</div>

<div class="timeline">
<span>D-60 인프라</span><span>D-30 풍문</span><span class="here">D-1 절정</span><span>D+0 분배</span><span>D+1 컷오프</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="scene-label">SLIDE 5 · CASE 4 vs CASE 9 · 차별 분석</div>

# **케이스 4 (허위공시)** vs **케이스 9 (바이오 임상)**

> 표면 동일 시퀀스 ("장 마감 후 16:30 공시 + 익일 시초가 +30% + 분할매도") = Jaccard 0.40 → **차별 12축**으로 해소.

| 차별 축 | 케이스 4 (허위공시) | 케이스 9 (바이오 임상) |
|---|---|---|
| **공시 진위** | 거짓 (사후 정정) | 진실 (임상 결과) |
| **법조 위험** | §178 부정거래 (사기적 부정거래) | §174 미공개정보 이용 |
| **사전 인지자** | CEO + IR + 변호사 (거짓 인지) | CTO + 친인척 5명 (사실 인지) |
| **매집 윈도우** | D-60 ~ D-20 (60일) | D-30 ~ D-7 (30일, 임상 종료~공시) |
| **부풀림 키워드** | "MOU·양해각서·구속력 약함" | "임상 성공 가능성·중간 데이터" |
| **D-day 메커니즘** | 공시 후 사실 변경 X (D+30 정정) | 공시 후 사실 확정 (정정 무관) |
| **반환 가능성** | 부당이득 환수 가능 | 차익 환수 불가 (사실 공시) |
| **회피 식별** | "MOU 호재" 카페 폭증 | 임상 종료 ~ 공시 거래대금 ×5 |

<div class="twoside">
<div class="trap"><span class="label">매매자 함정 (양 케이스 공통)</span>
"분기 매출 +52% YoY" 또는 "임상 성공 임박" → 익일 갭상승 +30% 추격 → D+5 분할매도 절정 → 종가 -45%</div>
<div class="villain"><span class="label">세력 매매 (각 케이스별)</span>
케이스 4: 공시 본문 "구속력 없음" 키워드 = 진입 차단<br>
케이스 9: 임상 종료~공시 윈도우 거래대금 ×5 = -15 페널티</div>
</div>

<div class="ceo-line"><span class="label">대표 결정</span>
양 케이스 모두 <strong>16:00~17:30 공시 + 익일 갭상승 ≥ +20% = 진입 금지</strong>. 케이스 9 친인척 분석 = 공정공시 §174 윈도우 직격. 케이스 4 = §178 가담 위험.</div>

---

<div class="brand">● 100M1S</div>

<div class="scene-label">SLIDE 6 · CASE 5 · CB/BW 헐값 발행 (Q-046b PoC C 매칭)</div>

# **케이스 5** — 사채로 짓는 작전 (D-180 매집 시작)

> *"D-180 ㈜D 이사회 결의: 운영자금 100억 조달을 위한 사모 CB 발행. 인수자 ㈜S캐피탈."*
> *"S가 100억으로 CB 200만주 분 인수 = 전환 시 시총 12% 확보. 전환가 5,000원, 현재가 6,200원 = 미실현 차익 즉시 +24%."*

<div class="num-row">
<div class="num-card"><div class="nb-label">회사 시총</div><div class="nb-value">400억 <span class="neg">코스닥</span></div></div>
<div class="num-card"><div class="nb-label">CB 발행</div><div class="nb-value"><span class="am">100억</span></div></div>
<div class="num-card"><div class="nb-label">전환가/현재가</div><div class="nb-value">5,000 / 6,200원 <span class="am">+24%</span></div></div>
</div>

<div class="twoside">
<div class="trap"><span class="label">매매자 함정</span>
"운영자금 100억 = 정상 회사 활동" 오인 → DART CB 공시 미열람 → D-7 전환청구 후 D+30 분배 절정 매수 → -40%</div>
<div class="villain"><span class="label">세력 매매</span>
<strong>CB 발행 공시 30일 윈도우 = 진입 차단 (-15 페널티)</strong>. 본주식 매집 + 풍문 부양은 별개 (D-90 ~ D-30 거래대금 ×2 + RSI ≤ 30 + CB 공시 30일 외 = 진입 후보)</div>
</div>

<div class="ceo-line"><span class="label">대표 결정</span>
케이스 5 = 11원칙 §7 "CB 종목 회피" 직격. <strong>전건 회피 (사용 0건)</strong>. 단, 본주식 매집 단계 (CB 공시 30일 외) + 거래대금 ×2 + 1분봉 RSI 30 + MA20 터치 = 분단위 스캘핑 진입 후보.</div>

<div class="timeline">
<span class="here">D-180 매집</span><span>D-90 띄움</span><span>D-7 전환청구</span><span>D+30 분배</span><span>D+60 이탈</span>
</div>

**📍 본 슬라이드 HTML mockup**: `lab/poc-design-sample.html` (Q-046b PoC C 케이스 5 장면 1)

---

<div class="brand">● 100M1S</div>

<div class="scene-label">SLIDE 7 · CASE 6 · 무자본 M&A</div>

# **케이스 6** — 회사 돈으로 회사 사기

> *"D-90 인수자 ㈜H (자기자본 0, 사채 200억)이 ㈜M (시총 600억, 자산 250억) 경영권 인수 + 50% 프리미엄."*
> *(인수 후 30일 자산 매각 → 사채 200억 상환 → 자기자본 0 무자본 M&A 확정.)*
> *(D-30 "신사업 진출" 공시 + 풍문 부양 → D-3 16:30 제3자배정 신주 공시 → D+0 분배.)*

<div class="num-row">
<div class="num-card"><div class="nb-label">인수자 자기자본</div><div class="nb-value"><span class="neg">0원</span> (사채 200억)</div></div>
<div class="num-card"><div class="nb-label">인수 프리미엄</div><div class="nb-value"><span class="am">+50%</span></div></div>
<div class="num-card"><div class="nb-label">D+60 자산</div><div class="nb-value">50억 <span class="neg">-80%</span></div></div>
</div>

<div class="twoside">
<div class="trap"><span class="label">매매자 함정</span>
"경영권 변경 = 신성장 호재" 매수 → "신사업 진출" 공시 + 거래대금 ×3 추격 → 제3자배정 신주 분배 → D+60 자산 -80% = <strong>폭락</strong></div>
<div class="villain"><span class="label">세력 매매</span>
<strong>인수자 설립 1년 미만 = 게이트 차단</strong>. DART 자산 처분 공시 30일 = 즉시 청산. 분기 자산 -50% = 즉시 시장가 청산</div>
</div>

<div class="ceo-line"><span class="label">대표 결정</span>
케이스 6 = "자기자본 0 인수" 검증 게이트 (G2+). DART 인수 공시 + 인수자 설립일 + 자기자본 SoT 매핑 의무. 패턴 3 (띄움) "신사업 + 거래대금 ×3" = 분단위 스캘핑 진입은 <strong>눌림 시에만 + 손절 -3%</strong>.</div>

<div class="timeline">
<span>D-90 인수</span><span class="here">D-30 신사업</span><span>D-3 제3자배정</span><span>D+0 분배</span><span>D+60 자산노출</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="scene-label">SLIDE 8 · CASES 7~10 · 합본</div>

# **케이스 7~10** — 핵심 변칙만

| 케이스 | 핵심 메커니즘 | 대표 결정 (회피·진입) |
|---|---|---|
| **7 CFD SG증권** | CFD 익명성 + 5배 레버리지 매집 (2~3년 잠복) → 마진콜 = 8종목 동시 하한가 (2023.04.24~27 SG증권 사태 패턴) | **외국계 창구 ≥ 30% = 진입 금지**. 8종목 동시 -10% = 즉시 청산. G3 미만 절대 진입 X |
| **8 라임 사모펀드** | "사모 = 안전" 마케팅 1조원 모집 → 부실자산 +200% 매입 NAV 부풀리기 → 환매 중단 = 청산 시퀀스 | **사모펀드 시총 5%+ 보유 = 진입 금지**. DART 환매 중단 = 즉시 청산 + 영구 차단 |
| **9 바이오 임상** | CTO 사전 인지 + 친인척 5명 D-30 매집 → D-7 풍문 거래대금 ×7 → D-day 16:30 임상 결과 공시 → D+1 09~11 분배 | **임상 종료~공시 거래대금 ×5 = -15**. 임상 결과 공시 16:00~17:30 = 익일 진입 금지 |
| **10 테마 그룹** | 테마 5종목+ 매집 + 통합 마케팅 동시 부양 → 대장 분배 → 2~3등 매물 → 동시 -10% 사망 | **거래대금 1등 (대장)만 진입** (11원칙 §1). 테마 5종목 동시 -10% = 즉시 청산. 다음 테마 Rotation 추적 (검색기 우선순위) |

<div class="ceo-line"><span class="label">대표 결정 (4 케이스 통합)</span>
케이스 10 = <strong>대표 사용 비율 가장 높음</strong> (11원칙 §1 직격, STRAT-001). 케이스 7·8·9 = 전건 회피 (G2~G3 시뮬레이션 한정). 공통 회피 = <strong>"외국계 창구 비중 + 사모펀드 보유 + 임상 윈도우" 3축 검증</strong>.</div>

---

<div class="brand">● 100M1S</div>

<div class="scene-label">SLIDE 9 · CASE 11 · 회계감사 의견거절</div>

# **케이스 11** — 재무제표 신뢰 붕괴

> *"D-180 CEO U + CFO 합의: '다음 분기 매출 +50% 부풀려서 표시. 관계회사 ㈜W2와 거짓 매출 거래 100억. 외부 감사 통과 가능 수준.'"*
> *(차명 12계좌로 D-180 ~ D-90 매집 60만주, 평균 13,000원.)*
> *(D-15 외부 감사인 의견거절 검토 통보 → CEO 사전 인지 → 차명 12계좌 분할매도 시작 = **사전 통보 분배 절정**.)*
> *(D+0 16:30 DART 감사보고서 공시: "관계회사 매출 인식 부적정 = **의견거절**". D+1 09:00 거래정지.)*

<div class="num-row">
<div class="num-card"><div class="nb-label">매출 위장</div><div class="nb-value">+52% YoY <span class="neg">(실제 +0%)</span></div></div>
<div class="num-card"><div class="nb-label">신용잔고</div><div class="nb-value">18억 → 92억 <span class="neg">+411%</span></div></div>
<div class="num-card"><div class="nb-label">사후 1심</div><div class="nb-value">CEO <span class="neg">징역 7년</span></div></div>
</div>

<div class="twoside">
<div class="trap"><span class="label">매매자 함정</span>
"분기 매출 ×1.5 호재" 카페 폭증 + 사모펀드 신규 진입 보고 추격 → D-15 거래대금 폭증을 "조정 매수 기회" 인식 → D+1 거래정지 = <strong>영구 손실</strong></div>
<div class="villain"><span class="label">세력 매매 (회피만)</span>
<strong>관계회사 매출 비중 ≥ 30% = -15 / 재고회전율 ×2 악화 = -10 / 감사인 변경 1년 + 매출 +50% YoY = -20 / 감사 의견 한정·의견거절·부적정 = 진입 차단 게이트 + 영구 차단</strong></div>
</div>

<div class="ceo-line"><span class="label">대표 결정 + 법무 검증 권고 (Q-016)</span>
케이스 11 = <strong>회피만 (시드 0%, G2 기준에서도 진입 권한 0)</strong>. 재무제표 신뢰 붕괴 = 펀더멘털 자체 위험 = 영구 회피. <strong>법무팀 LEGAL-001 §3.1 인용: 모든 의견거절이 작전은 아님 — 매매자 회피 가이드로만 활용 (Q-016 v2 외부 변호사 자문 후 결정)</strong>.</div>

<div class="timeline">
<span>D-180 위장</span><span>D-90 풍문</span><span>D-30 감사</span><span class="here">D-15 사전분배</span><span>D+0 의견거절</span><span>D+1 거래정지</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="scene-label">SLIDE 10 · CB §5.X · 고급 패턴</div>

# **CB 고급 §5.X** — 리픽싱 + 풋옵션 무한 사이클

> *"리픽싱(Refixing): 주가 하락 시 전환가 자동 하향 조정. 한도 70% (공격적) = 발행가의 30%까지 전환가 인하 가능."*
> *"풋옵션(Put Option): CB 보유자가 만기 전 원금+이자 청구권. 작전 세력 = 본주식 분배 + 풋옵션 차익 + 신규 CB 인수 = **무한 사이클**."*

| 변칙 (6건) | 메커니즘 | 식별 신호 | 패턴 매핑 |
|---|---|---|---|
| 리픽싱 한도 70% (공격적) | 발행 시점 하락 비대칭 차익 사전 확보 | DART CB 조건 70% 한도 | P1 (매집) |
| 1회차 리픽싱 발동 | 주가 -30% → 전환가 자동 인하 | 1회차 리픽싱 공시 | P2 (매집후털기) |
| 1회차 후 부양 | 인하된 전환가 기준 추가 차익 확보 | 거래대금 ×3 + 풍문 재가속 | P6 (재매집/재띄움) |
| 2회차 리픽싱 | 추가 하락 → 전환가 추가 인하 | 2회차 리픽싱 공시 | P7 (다시 분배) |
| 풋옵션 행사 1주 전 풍문 | "사채 상환 호재" 추격매수 유인 | 카페 "사채 상환" + 풋옵션 D-7 | P5 (분배) |
| **풋옵션 + 신규 CB 인수** | 무한 사이클 시작 | 신규 CB 발행 공시 + 30일 회피 | P9 → P1 (재매집) |

<div class="twoside">
<div class="trap"><span class="label">매매자 함정</span>
"1회 사이클 분석 = 다음 사이클 진입 가능" 오인 → 리픽싱 후 부양에 추격 → 풋옵션 행사 시점 분배 폭격 → 신규 CB 발행 시 다시 매집 단계 진입 = <strong>무한 손실</strong></div>
<div class="villain"><span class="label">세력 매매</span>
<strong>신규 CB 발행 공시 = 새 사이클 매집 시작 = 다시 30일 회피</strong>. 풋옵션 D-7 카페 풍문 = 진입 금지. 리픽싱 한도 70% = -10 페널티 + 30일 회피</div>
</div>

<div class="ceo-line"><span class="label">대표 결정</span>
케이스 5.X = 11원칙 §7 직격 + 무한 사이클 함정. <strong>CB 종목 = 매집·재매집 모든 시점 회피</strong>. 다음 사이클 진입 0%. 리픽싱·풋옵션 메커니즘 = 식별 + 영구 차단 게이트.</div>

---

<div class="brand">● 100M1S</div>

<div class="scene-label">SLIDE 11 · 부록 G 매트릭스 · 패턴별 우선순위</div>

# **9패턴 우선순위** — 매매 직결 SoT

| 패턴 | 케이스 수 | 대표 매매 정수 매핑 (STRAT-001 §6.5/6.8) | 우선순위 |
|---|---|---|---|
| **P1 매집** | 12/12 | 식별 후 진입 가능 (펀더멘털 OK 시) | 중간 (대표 = 매집 단계 진입 X, 식별만) |
| **P2 매집 후 개미털기** | 2/12 | 4축 score ≥ +4 + 양봉 전환 → G2+ 동행 | 낮음 (G1 금지) |
| **P3 띄움** | **11/12** | <strong>눌림매매 스윙 + 분단위 스캘핑 진입 핵심 영역</strong> (변칙 2-2 윗꼬리 후 RSI 30 / 2-3 아랫꼬리 / 2-4 대장만) | **최고 (대표 본질)** |
| **P4 띄움 후 개미털기** | 4/12 | 첫 윗꼬리 직후 RSI 30 + MA20 터치 = 진입 후보 | 높음 |
| **P5 분배** | **12/12** | <strong>진입 절대 금지 + 청산만</strong> (변칙 3-1~3-7 분배 7건 = 회피) | **최고 회피 영역** |
| **P6 재매집/재띄움** | 2/12 | D+90 후 새 사이클 진입 후보 | 중간 |
| **P7 다시 분배** | 1/12 | 회피 (희귀) | 낮음 |
| **P8 다른 세력 난입** | 4/12 | 거래원 분포 변화 식별 = 새 사이클 신호 | 중간 (G2+) |
| **P9 이탈 + 세력 경합** | **12/12** | <strong>5호가 양방향 두께 = 진입 보류</strong> | 회피 |

<div class="ceo-line"><span class="label">강력 강조: 패턴 1·3·5·9</span>
<strong>P1 (매집) = 식별 / P3 (띄움) = 진입 본질 / P5 (분배) = 회피 본질 / P9 (이탈경합) = 진입 보류</strong>. 12 케이스 전체 ✓✓ = 4 패턴 = <strong>매매 의사결정 90% 차지</strong>.<br>
<strong>본인 파동 × 세력 파동 = 교집합 = 수익구간</strong> (STRAT-002 §0.2). 세력에게 놀아나는 매매자의 반대 = 세력의 관점 = 대표의 진입.</div>

---

<div class="brand">● 100M1S</div>

<div class="scene-label">SLIDE 12 · 매매자 자가체크리스트 + 결론</div>

# **자가체크리스트** — 매매 진입 직전 5분

| # | 체크 항목 | PASS 조건 | 패턴 매핑 |
|---|---|---|---|
| 1 | DART CB·BW·M&A·감사 의견 공시 30일 윈도우 | 윈도우 외 | P1 회피 |
| 2 | 거래대금 1등 (대장)인가 | 1등 (테마 5종목 ↑ 시) | P3 진입 |
| 3 | 카페 작성자 다양성 ≥ 6명 | 6명 이상 | P3 회피 |
| 4 | 신용잔고 1주 변화 | -10% 이내 | P3·P5 경계 |
| 5 | 호가 잔량 30초 70% 취소 빈도 | ≤ 4회 | P3 진입 |
| 6 | 외국계 창구 비중 | < 30% | P1·P3 진입 |
| 7 | 사모펀드 시총 비중 | < 5% | P1 진입 |
| 8 | 1분봉 RSI ≤ 30 + MA20 터치 + 거래대금 ×2 | 3축 동시 | **P3 진입 신호** |
| 9 | 윗꼬리 ≥ +5% + 종가 -3% | NO (있으면 청산) | P5 회피 |
| 10 | 5호가 매수 두께 vs 매도 두께 | 매수 ≥ 매도 ×2 NO (의심) | P5·P9 회피 |
| 11 | 분당 매도 폭증 + 가격 -3% 미만 유지 | NO (있으면 분배 진행) | P5 회피 |
| 12 | DART 정정·환매중단·의견거절·임상결과 16:00~17:30 공시 | 없음 | P5·P9 영구 차단 |

<div class="twoside">
<div class="trap"><span class="label">세력 vs 매매자 양면 박스 12건 요약 (STRAT-002 §3.2)</span>
케이스 1·2·3·4·5·5.X·6·7·8·9·10·11 = <strong>매매자 함정 12건 + 세력 매매 12건 + 대표 결정 12건</strong>. EDU-002 §부록 G 매트릭스 정합.</div>
<div class="villain"><span class="label">회피 78건 재분류 (STRAT-002 §2.3)</span>
"사용 13건 / 회피 78건 / 미경험 26건" → <strong>"세력 동행 진입 / 매매자 함정 / 관찰"</strong> 4축 신규 분류로 v2 격상 의무 (대표 본인 확인 대기, Q-045 휴지 신규 spawn).</div>
</div>

<div class="ceo-line"><span class="label">결론 — 영화는 끝났다</span>
세력은 매집 → 띄움 → 분배 → 이탈을 영화처럼 반복한다. 매매자는 함정에 빠진다. <strong>본인 파동 × 세력 파동 = 교집합 = 수익구간</strong>. P3 (띄움) 진입 + P5 (분배) 청산만 한다. 패턴 1·5·9는 12/12 케이스 전체 = 매매 의사결정 90% 차지.<br>
<strong>"세력에게 놀아나는 매매자의 반대 = 세력의 관점 = 대표의 진입."</strong> — STRAT-002 §0.1</div>

---

<!-- _class: legal -->
<!-- _paginate: false -->

<div class="brand">● 100M1S</div>

# **LEGAL · DISCLAIMER**

본 자료는 **100M1S 비공개 연구 자료**입니다.

1. 본 자료는 **교육·연구 목적** 작성된 비공개 자료로 외부 유포·공유·2차 가공·언론 인용 모두 금지됩니다.
2. 본 자료의 케이스(작전 시나리오)는 시장에서 관찰된 패턴을 분석한 것으로, **특정 종목·특정 인물·특정 사건을 지칭하지 않습니다**. 모든 종목명·회사명·인명은 가상입니다.
3. 본 자료는 **투자 권유·투자 자문이 아닙니다**. 본 자료를 근거로 투자 결정 시 발생하는 모든 손실은 투자자 본인 책임입니다.
4. 본 자료의 기법·신호·진입 시점은 검증된 알파를 보장하지 않으며, 시장 환경에 따라 작동하지 않을 수 있습니다.
5. 본 자료의 시세조종 패턴 식별은 **자기방어 목적**이며, 동일 패턴을 모방·실행하는 행위는 **자본시장법 §176, §178 위반으로 형사처벌 대상**입니다.

---

**의심 사례 신고**: 한국거래소 1577-0088 / 금감원 1332

<small class="meta">
DOC-20260504-LEGAL-001 §3.5 5조항 12줄 인용 정합 / EDU-002 v0.2.1-bis LEGAL P0-4 marker 9쌍 본문 포함 (PPT는 lab/ 라우트 별도, 5중 차단 + 워터마크 + 슬라이드 12 LEGAL로 외부 노출 위험 차단) / DSN-003 §4 슬라이드 12 wireframe 정합
</small>
