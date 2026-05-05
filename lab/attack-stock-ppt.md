---
marp: true
theme: default
size: 16:9
paginate: true
backgroundColor: '#FFFFFF'
color: '#212529'
header: '강의 자료 · 매매자 자기방어 · 외부 유포 금지'
footer: '100M1S · 사례북 v0.5 · 매매자 자기방어 강의 · 외부 유포 금지'
style: |
  /* === v0.5 산뜻 강의 톤 (DSN-001 정합) === */
  /* 회사 홈페이지 SoT 차용: 샴페인 골드 메인 (#C49930) + 본문 진검정 + 미세 wash */
  :root {
    /* 베이스 — 회사 홈페이지 정합 */
    --ppt-bg:       #FFFFFF;
    --ppt-bg2:      #F7F8FB;
    --ppt-bg3:      #FFF6E5;
    --ppt-bd:       #E8ECF2;

    /* 텍스트 — 진검정 본문 (가독성 최우선) */
    --ppt-tx:       #1A1D26;
    --ppt-tx2:      #3D4351;
    --ppt-dm:       #8B95A8;

    /* 메인 강조 — 샴페인 골드 (회사 정체성) */
    --ppt-am:       #C49930;
    --ppt-am2:      #E8C063;
    --ppt-am3:      #FBE9B5;
    --ppt-am4:      #FFF6E5;
    --ppt-am-dark:  #8B6F1F;

    /* 보조 — 위험·신뢰 */
    --ppt-ru:       #A01528;
    --ppt-bl:       #2D5F8B;
    --ppt-pos:      #2F9E44;
    --ppt-neg:      #C92A2A;
  }
  section {
    background: var(--ppt-bg);
    color: var(--ppt-tx);
    font-family: 'Pretendard', 'Inter', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif;
    padding: 56px 72px 56px;
    line-height: 1.65;
    letter-spacing: -0.01em;
    position: relative;
  }
  /* === v0.5 Fix 1: 일러스트 컨테인 (페이지 분리 자유 활용 +확대) === */
  section img {
    max-width: 80%;
    max-height: 380px;
    object-fit: contain;
    display: block;
    margin: 16px auto;
  }
  section.lead img {
    max-height: 420px;
    max-width: 82%;
  }
  /* === v0.5 Fix 2: 워터마크 폐기 그대로 === */
  section > * { position: relative; z-index: 2; }
  header {
    background: transparent; color: var(--ppt-dm);
    padding: 12px 24px; font-size: 16px; font-weight: 700;
    letter-spacing: 0.5px; text-align: center;
  }
  footer {
    color: var(--ppt-dm); font-size: 16px; letter-spacing: 0.4px;
    text-align: right;
  }
  /* === v0.5 Fix 3: 폰트 가시성 (DSN-001 §3 발표 뒷줄 가독) === */
  h1 {
    font-size: 48px; font-weight: 900; letter-spacing: -1.0px; line-height: 1.15;
    color: var(--ppt-tx); margin-bottom: 12px;
  }
  section.lead h1 { font-size: 64px; line-height: 1.1; }
  h1 .accent, h1 strong { color: var(--ppt-am); }
  h2 {
    font-size: 32px; font-weight: 800; letter-spacing: -0.4px;
    color: var(--ppt-am-dark); margin-bottom: 12px;
  }
  section.lead h2 { font-size: 28px; }
  h3 { font-size: 24px; font-weight: 700; color: var(--ppt-tx2); margin-bottom: 8px; }
  p, li { font-size: 24px; line-height: 1.65; color: var(--ppt-tx); }
  small, .meta { font-size: 16px; color: var(--ppt-dm); }
  strong { color: var(--ppt-am-dark); font-weight: 800; }
  em { color: var(--ppt-tx2); font-style: normal; }
  blockquote {
    background: var(--ppt-bg2);
    border-left: 4px solid var(--ppt-am);
    padding: 18px 24px; margin: 16px 0;
    font-size: 22px; line-height: 1.6;
    border-radius: 12px;
    color: var(--ppt-tx);
  }
  table {
    width: 100%; border-collapse: collapse; font-size: 18px;
    background: var(--ppt-bg); border: 1px solid var(--ppt-bd); border-radius: 12px;
    overflow: hidden;
  }
  th {
    background: var(--ppt-am-dark); color: #FFFFFF;
    padding: 12px 14px; text-align: left; font-weight: 800;
    font-size: 17px; letter-spacing: 0.4px;
    border-bottom: 1px solid var(--ppt-bd);
  }
  td {
    padding: 10px 14px; border-bottom: 1px solid var(--ppt-bd);
    color: var(--ppt-tx); font-size: 18px; line-height: 1.5;
  }
  tr:nth-child(even) td { background: var(--ppt-bg2); }
  tr:last-child td { border-bottom: none; }
  code {
    background: var(--ppt-bg2); color: var(--ppt-am-dark);
    padding: 2px 6px; border-radius: 4px; font-size: 18px;
    font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace;
  }
  /* === Phase Label (DSN-001 §4.2 hero-eyebrow 정합) === */
  .phase-label {
    display: inline-block;
    padding: 6px 16px 6px 18px;
    background: var(--ppt-am3);
    border-left: 4px solid var(--ppt-am);
    border-radius: 0 999px 999px 0;
    font-size: 18px; font-weight: 700;
    color: var(--ppt-am-dark);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  /* === 양면 분석 박스 (DSN-001 §4.3) === */
  .twoside {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin: 16px 0;
  }
  .twoside .adversary {
    background: #FFF5F5;
    border-left: 4px solid var(--ppt-ru);
    padding: 24px 28px; border-radius: 12px;
    font-size: 20px; line-height: 1.6;
  }
  .twoside .defense {
    background: var(--ppt-am3);
    border-left: 4px solid var(--ppt-am);
    padding: 24px 28px; border-radius: 12px;
    font-size: 20px; line-height: 1.6;
  }
  .twoside .label {
    font-size: 15px; font-weight: 800; letter-spacing: 1.2px;
    text-transform: uppercase; margin-bottom: 8px; display: block;
  }
  .twoside .adversary .label { color: var(--ppt-ru); }
  .twoside .defense .label { color: var(--ppt-am-dark); }
  .principle-line {
    background: var(--ppt-am4);
    border-left: 6px solid var(--ppt-am-dark);
    padding: 20px 28px; border-radius: 12px;
    font-size: 20px; line-height: 1.6;
    margin: 16px 0;
    color: var(--ppt-tx);
  }
  .principle-line .label {
    font-size: 15px; font-weight: 800; letter-spacing: 1.2px;
    text-transform: uppercase; color: var(--ppt-am-dark); margin-bottom: 6px; display: block;
  }
  /* === 핵심 수치 카드 (DSN-001 §4.4 about-card 정합) === */
  .num-row {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0;
  }
  .num-card {
    background: var(--ppt-bg);
    border: 1px solid var(--ppt-bd);
    border-left: 4px solid var(--ppt-am);
    border-radius: 16px;
    padding: 20px 24px;
  }
  .num-card .nb-label {
    font-size: 15px; color: var(--ppt-dm); font-weight: 600;
    letter-spacing: 0.4px; margin-bottom: 6px;
  }
  .num-card .nb-value {
    font-size: 24px; font-weight: 900; color: var(--ppt-tx);
    font-feature-settings: 'tnum';
  }
  .num-card .nb-value .pos { color: var(--ppt-pos); }
  .num-card .nb-value .neg { color: var(--ppt-neg); }
  .num-card .nb-value .am { color: var(--ppt-am-dark); }
  /* === 시간선 (DSN-001 §4.5) === */
  .timeline {
    margin-top: 24px;
    font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace;
    font-size: 15px; color: var(--ppt-dm); letter-spacing: 0.4px;
    border-top: 1px solid var(--ppt-am2);
    padding-top: 12px;
    display: flex; justify-content: space-between;
  }
  .timeline .here {
    color: var(--ppt-am-dark); font-weight: 800;
    position: relative;
  }
  .timeline .here::before {
    content: '●'; color: var(--ppt-am);
    margin-right: 6px;
  }
  /* === 매트릭스 (보존, 골드 wash 정합) === */
  .matrix-cell-strong { background: var(--ppt-am) !important; color: #FFFFFF; font-weight: 800; }
  .matrix-cell-medium { background: var(--ppt-am3) !important; color: var(--ppt-am-dark); font-weight: 700; }
  .matrix-cell-weak   { color: var(--ppt-dm); }
  /* === 100M1S 워드마크 (DSN-001 §4.9) === */
  .brand {
    position: absolute; right: 32px; top: 28px;
    font-size: 14px; font-weight: 900; letter-spacing: 1.8px;
    color: var(--ppt-am); text-transform: uppercase;
  }
  /* === SVG 인라인 컨테이너 (DSN-001 §4.7) === */
  .svg-figure {
    margin: 16px 0; text-align: center;
  }
  .svg-figure svg, .svg-figure img {
    max-width: 100%; height: auto;
    border: 1px solid var(--ppt-bd);
    border-radius: 12px;
    background: var(--ppt-bg);
    max-height: 380px;
    object-fit: contain;
    margin: 16px auto;
  }
  .svg-figure .caption {
    font-size: 15px; color: var(--ppt-dm);
    margin-top: 8px; font-style: italic;
  }
---

<!-- _class: lead -->
<!-- _paginate: false -->

<div class="brand">● 100M1S</div>

# 한국 코스닥 작전주 12 사례
## 매매자 자기방어 강의

<br>

<div class="phase-label">[강의 자료 · 매매자 보호용]</div>

> "세력 행태를 인지하는 만큼 매매자는 함정을 회피하고, 세력 수익 구간을 역으로 추출할 수 있다."

<small class="meta">100M1S · 매매자 자기방어 강의</small>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 1 · 통정매매 (WASH TRADE)</div>

# **사례 1** — 보이지 않는 핑퐁

## 자본시장법 §176 시세조종

<div class="svg-figure">

![강의 일러스트 case-03](./images/q046-v04/case-03.png)

</div>

<div class="timeline">
<span>D-90 매집</span><span>D-30</span><span class="here">D-7 띄움</span><span>D+0 분배</span><span>D+30</span><span>D+90 이탈</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 1 · 변칙 사례 + 행위주체</div>

# 가상 사례 (㈜A 모델)

> **통정매매 행태 관찰** — 차명 5계좌의 핑퐁
> D-90 K급 주포가 차명 5계좌(평균 3,000만원/계좌)로 ㈜A 시총 600억 코스닥 종목을 1.5억으로 분할 매집하는 행태가 관찰된다.
> D-30. 5분봉 거래량 평소 ×8, 거래대금 50억 → 380억. 통정매매 ×3회/일 식별.
> D-7 16:30 호재 공시 + 익일 +28% 갭상승 + D+1 분할매도 시작.

<div class="num-row">
<div class="num-card"><div class="nb-label">시총·평균매집가</div><div class="nb-value">600억 / <span class="am">3,000원</span></div></div>
<div class="num-card"><div class="nb-label">D-7 종가</div><div class="nb-value">8,400원 <span class="pos">+180%</span></div></div>
<div class="num-card"><div class="nb-label">K 차익</div><div class="nb-value"><span class="am">+45억</span></div></div>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 1 · 매매자 대응</div>

# 양면박스 + 매매 원칙

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
"거래대금 ×7 폭증 = 큰 호재" 추격매수 → D+1 갭상승 매수가 11,000원 → D+5 종가 6,200원 → <strong>-44% 손실</strong></div>
<div class="defense"><span class="label">매매자 인지·대응</span>
2막 후반 첫 윗꼬리 → 1분봉 RSI 30 → MA20 터치 → <strong>대표 동행 진입</strong> (분봉 스캘핑, 손절 -3%)</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
패턴 3 (띄움) 첫 윗꼬리 직후 = <strong>눌림매매 진입 후보</strong> (변칙 2-2 윗꼬리 후 RSI 30 신호). 통정매매 ×3회/일 + 거래원 분포 변화 식별 시 패턴 5 분배 임박 = 즉시 청산.</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 2 · 가장매매 (PRE-ARRANGED TRADE)</div>

# **사례 2** — 혼자 치는 핑퐁

## 자본시장법 §176 시세조종 (단독 행위주체)

<div class="svg-figure">

![강의 일러스트 case-04](./images/q046-v04/case-04.png)

</div>

<div class="timeline">
<span>D-60 매집</span><span class="here">D-20 띄움</span><span>D-2 풍문</span><span>D+0 분배</span><span>D+30</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 2 · 변칙 사례 + 행위주체</div>

# 가상 사례 (㈜B 모델)

> **가장매매 단독 행위주체 관찰** — HTS 8대 + 8 차명계좌
> J(38, 단독 작전수)가 HTS 8대 + 8 차명계좌 운영. ㈜B 시총 200억 저시총 코스닥에서 5분봉 1회 자기매매로 거래량 ×8 폭발을 위장하는 행태가 관찰된다.
> D-20 호가 페인팅: 매수 잔량 30초 내 70% 취소 ×40회. 매매자가 호가창 두께를 보고 추격하는 시점.
> D-2 09:30 텔레그램방 "오늘 마감 직전 상한가 갑니다" 풍문 → 11:00 매매자 추격매수 절정 → 11:30 분배 시작.

<div class="num-row">
<div class="num-card"><div class="nb-label">HTS·차명</div><div class="nb-value"><span class="am">8대 / 8계좌</span></div></div>
<div class="num-card"><div class="nb-label">5분봉 거래량</div><div class="nb-value">평소 <span class="am">×8</span></div></div>
<div class="num-card"><div class="nb-label">텔레그램 외주</div><div class="nb-value"><span class="am">월 200만원</span></div></div>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 2 · 매매자 대응</div>

# 양면박스 + 매매 원칙

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
호가 두께 + 5분봉 거래량 ×8 = "거래량 폭발 호재" 추격 → 11:30 분배 시작 시점 매수가 평균 9,800원 → 종가 7,200원 <strong>-26%</strong></div>
<div class="defense"><span class="label">매매자 인지·대응</span>
호가 잔량 30초 70% 취소 ×5회 = <strong>-15 페널티</strong> + 진입 차단. 5분봉 ×8 단독 = -10 + 게이트 차단 (PM320)</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
사례 2는 매집 단계 식별 = <strong>HTS 8대 동일 IP 클러스터 적발</strong>로만 활용 (사후). 진입 영역 0. 텔레그램 유료방 신규 가입 폭증 + 종목 노출 = 풍문 작전 의심 → 패턴 3 (띄움) 직격 회피.</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 3 · 풍문 유포형 (디지털 군중 동원)</div>

# **사례 3** — 텔레그램 리딩방 + 카페 알바 12명

## 자본시장법 §178 부정거래 (풍문 유포)

<div class="svg-figure">

![강의 일러스트 case-05](./images/q046-v04/case-05.png)

</div>

<div class="timeline">
<span>D-60 인프라</span><span>D-30 풍문</span><span class="here">D-1 절정</span><span>D+0 분배</span><span>D+1 컷오프</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 3 · 변칙 사례 + 행위주체</div>

# 가상 사례 (㈜Q 모델)

> **풍문 유포 인프라 관찰** — 텔레그램 + 카페 동조성 게시
> 풍문책 N(41, 전직 증권사 RA)이 텔레그램 유료방 3개 + 무료방 12개 운영. 월 99만원 ×800명 = 매출 8억 규모의 행태가 관찰된다.
> N의 카페 알바 12명, 시간당 1만원, 1인 일 30~50건 게시·댓글. 동일 IP 회피 위해 카페별 1~2명 분담.
> D-1 12:00:00 N의 유료방 3개 동시: "㈜Q 주목. 다음 작전 대장. 종목코드 XXXX." + 12:01 카페 알바 12명 동시 게시: "AI 자회사 설립 임박, 친구가 IR쪽이라 들었음." (동조성 게시 패턴)

<div class="num-row">
<div class="num-card"><div class="nb-label">유료방 회원</div><div class="nb-value">800 → <span class="am">2,400명</span></div></div>
<div class="num-card"><div class="nb-label">알바 게시량</div><div class="nb-value">일 <span class="am">47건</span> (동조성 80%+)</div></div>
<div class="num-card"><div class="nb-label">작성자 다양성</div><div class="nb-value"><span class="neg">≤ 5명</span></div></div>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 3 · 매매자 대응</div>

# 양면박스 + 매매 원칙

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
"카페에서 다들 추천하는 종목" 인식 → 후기 위장글 ("어제 +30%") 보고 추격매수 → D+1 09:30 N 컷오프 + 알바 키워드 중지 → 종가 -18%</div>
<div class="defense"><span class="label">매매자 인지·대응</span>
<strong>카페 작성자 다양성 ≤ 5명 + 거래대금 폭증 = 풍문 작전 = 진입 금지</strong>. 텔레그램 유료방 신규 가입 1주 ×3 = 풍문 채널 본진 의심 → -20 페널티</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
이시카와 영역 직격: 풍문 채널 다양성 메트릭 + 동일 시점 거래대금 동조 식별 → PM320 게이트 차단. 매매자는 <strong>차트만 본다</strong> (카페·텔레그램 후기 0% 신뢰). 패턴 3 (띄움)·패턴 5 (분배 직전) 모두 회피.</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 4 · 허위공시 작전</div>

# **사례 4** — 거짓 호재의 기술

## 자본시장법 §178 부정거래 (사기적 부정거래)

<div class="svg-figure">

![강의 일러스트 case-06](./images/q046-v04/case-06.png)

</div>

<div class="timeline">
<span>D-60 매집</span><span>D-30</span><span class="here">D-2 16:30 거짓 공시</span><span>D-1 갭상승</span><span>D+5 분배</span><span>D+30 정정</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 4 · 변칙 사례 + 행위주체</div>

# 거짓 공시 메커니즘

> **거짓 호재 구조 — CEO + IR + 변호사 사전 인지**
> 매집 윈도우 D-60 ~ D-20 (60일). 매집 단계에서 본주식 분할 매집 + "MOU/양해각서/추후 협의/구속력 없음" 류 부풀림 키워드 공시 준비.
> D-2 16:30 "분기 매출 +52% YoY" 거짓 공시 → D-1 시초가 +30% 갭상승 → 매매자 추격매수 절정 → D+5 분할매도 = -45% 손실 분배.
> D+30 정정 공시 = 공시 후 사실 변경 시퀀스 = §178 사기적 부정거래 직격.

<div class="num-row">
<div class="num-card"><div class="nb-label">매집 윈도우</div><div class="nb-value"><span class="am">D-60 ~ D-20</span></div></div>
<div class="num-card"><div class="nb-label">D-1 갭상승</div><div class="nb-value"><span class="pos">+30%</span></div></div>
<div class="num-card"><div class="nb-label">D+5 손실</div><div class="nb-value"><span class="neg">-45%</span></div></div>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 4 · 매매자 대응</div>

# 양면박스 + 매매 원칙

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
"분기 매출 +52% YoY" 풍문으로 매매자 추격 유인 → D-1 시초가 +30% 갭상승 → D+5 분할매도 절정 → 종가 -45% 손실 분배</div>
<div class="defense"><span class="label">매매자 인지·대응</span>
공시 본문 <strong>"MOU/양해각서/구속력 없음" 키워드 = 진입 차단</strong>. 16:00~17:30 공시 + 익일 갭상승 ≥ +20% = 진입 금지</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
사례 4 = §178 부정거래 가담 위험. <strong>풍문 (D-15 ~ D-7) 거래대금 ≥ 200억 + 본 계약 키워드 공시 0건 = 작전 의심 윈도우 → 진입 금지</strong>. 부당이득 환수 가능 (사실 변경 사후 정정).</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 5 · CB/BW 헐값 발행</div>

# **사례 5** — 사채로 짓는 작전

## 11원칙 §7 직격 (CB 종목 회피)

<div class="svg-figure">

![강의 일러스트 case-07](./images/q046-v04/case-07.png)

</div>

<div class="timeline">
<span class="here">D-180 매집</span><span>D-90 띄움</span><span>D-7 전환청구</span><span>D+30 분배</span><span>D+60 이탈</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 5 · 변칙 사례 + 행위주체</div>

# 가상 사례 (㈜D 모델)

> **사모 CB 인수 행위주체 관찰** — ㈜S캐피탈
> D-180 ㈜D 이사회 결의: 운영자금 100억 조달을 위한 사모 CB 발행. 인수자 ㈜S캐피탈로 식별된다.
> S가 100억으로 CB 200만주 분 인수 = 전환 시 시총 12% 확보. 전환가 5,000원, 현재가 6,200원 = **미실현 차익 즉시 +24% 구조**.
> D-90 풍문 부양 → D-7 전환청구 → D+30 분배 절정 → D+60 이탈 시퀀스.

<div class="num-row">
<div class="num-card"><div class="nb-label">회사 시총</div><div class="nb-value">400억 <span class="neg">코스닥</span></div></div>
<div class="num-card"><div class="nb-label">CB 발행</div><div class="nb-value"><span class="am">100억</span></div></div>
<div class="num-card"><div class="nb-label">전환가/현재가</div><div class="nb-value">5,000 / 6,200원 <span class="am">+24%</span></div></div>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 5 · 매매자 대응</div>

# 양면박스 + 매매 원칙

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
"운영자금 100억 = 정상 회사 활동" 오인 → DART CB 공시 미열람 → D-7 전환청구 후 D+30 분배 절정 매수 → <strong>-40% 손실</strong></div>
<div class="defense"><span class="label">매매자 인지·대응</span>
<strong>CB 발행 공시 30일 윈도우 = 진입 차단 (-15 페널티)</strong>. 본주식 매집 + 풍문 부양은 별개 (D-90 ~ D-30 거래대금 ×2 + RSI ≤ 30 + CB 공시 30일 외 = 진입 후보)</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
사례 5 = 11원칙 §7 "CB 종목 회피" 직격. <strong>전건 회피 (사용 0건)</strong>. 단, 본주식 매집 단계 (CB 공시 30일 외) + 거래대금 ×2 + 1분봉 RSI 30 + MA20 터치 = 분단위 스캘핑 진입 후보.</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 6 · 무자본 M&A</div>

# **사례 6** — 회사 돈으로 회사 사기

## 자본시장법 §178 + 자산 횡령

<div class="svg-figure">

![강의 일러스트 case-08](./images/q046-v04/case-08.png)

</div>

<div class="timeline">
<span>D-90 인수</span><span class="here">D-30 신사업</span><span>D-3 제3자배정</span><span>D+0 분배</span><span>D+60 자산노출</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 6 · 변칙 사례 + 행위주체</div>

# 가상 사례 (㈜M 모델)

> **무자본 M&A 인수 행위주체 관찰** — ㈜H (자기자본 0)
> D-90 인수자 ㈜H (자기자본 0, 사채 200억)가 ㈜M (시총 600억, 자산 250억) 경영권 인수 + 50% 프리미엄으로 진입.
> 인수 후 30일 자산 매각 → 사채 200억 상환 → 자기자본 0 무자본 M&A 확정 패턴.
> D-30 "신사업 진출" 공시 + 풍문 부양 → D-3 16:30 제3자배정 신주 공시 → D+0 분배 시점.

<div class="num-row">
<div class="num-card"><div class="nb-label">인수자 자기자본</div><div class="nb-value"><span class="neg">0원</span> (사채 200억)</div></div>
<div class="num-card"><div class="nb-label">인수 프리미엄</div><div class="nb-value"><span class="am">+50%</span></div></div>
<div class="num-card"><div class="nb-label">D+60 자산</div><div class="nb-value">50억 <span class="neg">-80%</span></div></div>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 6 · 매매자 대응</div>

# 양면박스 + 매매 원칙

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
"경영권 변경 = 신성장 호재" 매수 → "신사업 진출" 공시 + 거래대금 ×3 추격 → 제3자배정 신주 분배 → D+60 자산 -80% = <strong>폭락</strong></div>
<div class="defense"><span class="label">매매자 인지·대응</span>
<strong>인수자 설립 1년 미만 = 게이트 차단</strong>. DART 자산 처분 공시 30일 = 즉시 청산. 분기 자산 -50% = 즉시 시장가 청산</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
사례 6 = "자기자본 0 인수" 검증 게이트 (G2+). DART 인수 공시 + 인수자 설립일 + 자기자본 SoT 매핑 의무. 패턴 3 (띄움) "신사업 + 거래대금 ×3" = 분단위 스캘핑 진입은 <strong>눌림 시에만 + 손절 -3%</strong>.</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 7 · CFD SG증권형</div>

# **사례 7** — 익명 레버리지 매집

## 2023.04 SG증권 사태 패턴

<div class="svg-figure">

![강의 일러스트 case-09](./images/q046-v04/case-09.png)

</div>

<div class="timeline">
<span class="here">D-730 매집</span><span>D-365 잠복</span><span>D-30 띄움</span><span>D+0 마진콜</span><span>D+1 8종목 동시 하한가</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 7 · 변칙 사례 + 매매자 대응</div>

# CFD 익명성 + 5배 레버리지

> **메커니즘**: CFD 익명성 + 5배 레버리지로 2~3년 잠복 매집 → 마진콜 발동 시 8종목 동시 하한가 (2023.04.24~27 SG증권 사태 패턴 관찰).
> 외국계 창구 비중 ≥ 30% + 그룹 동조성 폭증 = CFD 청산 트리거 임박.

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
2~3년 잠복 매집으로 일반 매매자 식별 불가 → 마진콜 D+0 시점 8종목 동시 -30% 하한가 → 신용 매수 매매자 강제 청산 = <strong>영구 손실</strong></div>
<div class="defense"><span class="label">매매자 인지·대응</span>
<strong>외국계 창구 ≥ 30% = 진입 금지</strong>. 8종목 동시 -10% = 즉시 청산. G3 미만 절대 진입 X. CFD 비중 < 10% + 그룹 동조성 < 5% 동시 충족 시에만 진입 후보</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
사례 7 = <strong>전건 회피</strong>. 시드 3% 한정 (CFD 청산 트리거 위험). 강제 청산 = 동일 그룹 5종목+ 동시 -10% 시 즉시.</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 8 · 사모펀드 라임형</div>

# **사례 8** — "사모 = 안전" 환상

## 환매 중단 청산 시퀀스

<div class="svg-figure">

![강의 일러스트 case-09](./images/q046-v04/case-09.png)

</div>

<div class="timeline">
<span>D-365 모집</span><span class="here">D-180 NAV 부풀리기</span><span>D-30 환매 요청</span><span>D+0 환매 중단</span><span>D+30 청산</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 8 · 변칙 사례 + 매매자 대응</div>

# NAV 부풀리기 + 환매 중단

> **메커니즘**: "사모 = 안전" 마케팅으로 1조원 모집 → 부실자산 +200% 매입으로 NAV 부풀리기 → 환매 요청 폭증 시 환매 중단 = 청산 시퀀스 강행.
> 사모펀드가 시총 5% 이상 보유한 종목 = 환매 중단 발동 시 강제 매도 폭격 직격.

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
"사모 안전 호재" 인식으로 사모 보유 종목 추격매수 → 환매 중단 발동 D+0 시점 펀드 청산 매도 폭격 → -50% 폭락 = <strong>영구 손실</strong></div>
<div class="defense"><span class="label">매매자 인지·대응</span>
<strong>사모펀드 시총 5%+ 보유 = 진입 금지</strong>. DART 환매 중단 공시 = 즉시 청산 + 영구 차단. 환매 이슈 0건 + 거래대금 ≥ 200억 동시 충족 시에만 후보</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
사례 8 = <strong>전건 회피</strong>. 시드 5% 한정. 강제 청산 = 펀드 환매 중단 공시 즉시. 청산 시퀀스 = 시간 매매자에게 1초도 반응 시간 없음.</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 9 · 바이오 임상 미공개정보</div>

# **사례 9** — 임상 종료 ~ 공시 윈도우

## 자본시장법 §174 미공개정보 이용

<div class="svg-figure">

![강의 일러스트 case-09](./images/q046-v04/case-09.png)

</div>

<div class="timeline">
<span>D-90 임상 진행</span><span class="here">D-30 종료</span><span>D-7 풍문</span><span>D+0 16:30 결과 공시</span><span>D+1 분배</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 9 · 변칙 사례 + 매매자 대응</div>

# 친인척 5명 사전 인지

> **메커니즘**: CTO 사전 인지 + 친인척 5명 D-30 매집 → D-7 풍문 거래대금 ×7 → D-day 16:30 임상 결과 공시 → D+1 09~11 분배 시퀀스.
> 사례 4 (허위공시)와 표면 동일하지만 **공시 진위 = 진실** + **법조 = §174 미공개정보 이용** + **반환 = 차익 환수 불가** 차이.

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
"임상 성공 임박" 풍문으로 매매자 추격 유인 → 익일 갭상승 +30% → D+5 분할매도 절정 → 종가 -45% 손실 분배. 친인척은 사전 매집 보유분 청산 = 차익 환수 불가</div>
<div class="defense"><span class="label">매매자 인지·대응</span>
<strong>임상 종료~공시 윈도우 거래대금 ×5 = -15 페널티</strong>. 임상 결과 공시 16:00~17:30 = 익일 진입 금지. 친인척 매수 공시 0건 + 윈도우 외 한정 진입 후보</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
사례 9 = <strong>임상 윈도우 외 한정 + 시드 3%</strong>. 16:00~17:30 공시 + 익일 갭상승 ≥ +20% = 진입 금지. §174 미공개정보 가담 위험 (사전 정보 보유자와 같은 시점 매수 = 형사처벌).</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 10 · 테마 그룹 동시 작전</div>

# **사례 10** — 테마 5종목 동시 부양

## 거래대금 1등 대장 진입 영역

<div class="svg-figure">

![강의 일러스트 case-09](./images/q046-v04/case-09.png)

</div>

<div class="timeline">
<span>D-60 매집</span><span class="here">D-30 통합 부양</span><span>D-7 풍문 절정</span><span>D+0 대장 분배</span><span>D+5 5종목 동시 -10%</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 10 · 변칙 사례 + 매매자 대응</div>

# 통합 마케팅 + 대장 분배

> **메커니즘**: 테마 5종목+ 매집 + 통합 마케팅으로 동시 부양 → 대장 분배 → 2~3등 매물 → 동시 -10% 사망 시퀀스.
> 매매자가 2등·3등 종목에 진입 시 = 대장 분배 매물에 따라 가격 동조 폭락 직격.

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
"테마 5종목 동시 거래대금 폭증 = 대형 호재" 인식 → 2등·3등 종목 추격 → 대장 분배 시점 동조 폭락 → 5종목 동시 -10% = <strong>전체 손실 분배</strong></div>
<div class="defense"><span class="label">매매자 인지·대응</span>
<strong>거래대금 1등 (대장)만 진입</strong>. 테마 5종목 동시 -10% = 즉시 청산. 다음 테마 Rotation 추적 + 신규 대장 식별</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
사례 10 = <strong>거래대금 1등 대장 진입 영역 (시드 10%, 가장 안정적)</strong>. 진입 조건: 테마 대장 + 거래대금 ≥ 300억 + 1분봉 RSI ≤ 30 + 테마 5종목 동시 폭증 단계 아님. 강제 청산 = 테마 5종목 동시 -10% 시 즉시.</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 11 · 회계감사 의견거절</div>

# **사례 11** — 재무제표 신뢰 붕괴

## 자본시장법 §174 사전 통보 분배 (의심)

<div class="svg-figure">

![강의 일러스트 case-10](./images/q046-v04/case-10.png)

</div>

<div class="timeline">
<span>D-180 위장</span><span>D-90 풍문</span><span>D-30 감사</span><span class="here">D-15 사전분배</span><span>D+0 의견거절</span><span>D+1 거래정지</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 11 · 변칙 사례 + 행위주체</div>

# 가상 사례 (㈜U 모델)

> **회계 부정 + 사전인지 분배 행태 관찰** — CEO + CFO 합의
> 현장 대화 기록 (가상): "D-180 CEO U + CFO 합의 — 다음 분기 매출 +50% 부풀려서 표시. 관계회사 ㈜W2와 거짓 매출 거래 100억. 외부 감사 통과 가능 수준."
> 차명 12계좌로 D-180 ~ D-90 매집 60만주, 평균 13,000원 패턴.
> D-15 외부 감사인 의견거절 검토 통보 → CEO 사전 인지 → 차명 12계좌 분할매도 시작 = **사전 통보 분배 절정** 행태.
> D+0 16:30 DART 감사보고서 공시: "관계회사 매출 인식 부적정 = **의견거절**". D+1 09:00 거래정지.

<div class="num-row">
<div class="num-card"><div class="nb-label">매출 위장</div><div class="nb-value">+52% YoY <span class="neg">(실제 +0%)</span></div></div>
<div class="num-card"><div class="nb-label">신용잔고</div><div class="nb-value">18억 → 92억 <span class="neg">+411%</span></div></div>
<div class="num-card"><div class="nb-label">사후 1심</div><div class="nb-value">CEO <span class="neg">징역 7년</span></div></div>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 11 · 매매자 대응</div>

# 양면박스 + 매매 원칙

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
"분기 매출 ×1.5 호재" 카페 폭증 + 사모펀드 신규 진입 보고 추격 → D-15 거래대금 폭증을 "조정 매수 기회" 인식 → D+1 거래정지 = <strong>영구 손실</strong></div>
<div class="defense"><span class="label">매매자 인지·대응 (회피만)</span>
<strong>관계회사 매출 비중 ≥ 30% = -15 / 재고회전율 ×2 악화 = -10 / 감사인 변경 1년 + 매출 +50% YoY = -20 / 감사 의견 한정·의견거절·부적정 = 진입 차단 게이트 + 영구 차단</strong></div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
사례 11 = <strong>회피만 (시드 0%, 진입 권한 0)</strong>. 재무제표 신뢰 붕괴 = 펀더멘털 자체 위험 = 영구 회피. 모든 의견거절이 작전은 아니므로, 매매자 자기방어 회피 가이드로만 활용한다.</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 5.X · CB 고급 패턴</div>

# **사례 5.X** — 리픽싱 + 풋옵션 무한 사이클

## 11원칙 §7 직격 + 무한 함정

<div class="svg-figure">

![강의 일러스트 case-11](./images/q046-v04/case-11.png)

</div>

<div class="timeline">
<span>D-180 1회차 매집</span><span class="here">D-90 1회차 리픽싱</span><span>D-7 풋옵션 풍문</span><span>D+0 풋옵션 행사</span><span>D+30 신규 CB</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 5.X · 변칙 사례 + 행위주체</div>

# 변칙 6건 표 (리픽싱·풋옵션 메커니즘)

> **개념 정의** — CB 고급 메커니즘
> 리픽싱(Refixing): 주가 하락 시 전환가 자동 하향 조정. 한도 70% (공격적) = 발행가의 30%까지 전환가 인하 가능.
> 풋옵션(Put Option): CB 보유자가 만기 전 원금+이자 청구권. 세력 행태 = 본주식 분배 + 풋옵션 차익 + 신규 CB 인수 = **무한 사이클** 구조.

| 변칙 (6건) | 메커니즘 | 식별 신호 | 패턴 매핑 |
|---|---|---|---|
| 리픽싱 한도 70% (공격적) | 발행 시점 하락 비대칭 차익 사전 확보 | DART CB 조건 70% 한도 | P1 (매집) |
| 1회차 리픽싱 발동 | 주가 -30% → 전환가 자동 인하 | 1회차 리픽싱 공시 | P2 (매집후털기) |
| 1회차 후 부양 | 인하된 전환가 기준 추가 차익 확보 | 거래대금 ×3 + 풍문 재가속 | P6 (재매집/재띄움) |
| 2회차 리픽싱 | 추가 하락 → 전환가 추가 인하 | 2회차 리픽싱 공시 | P7 (다시 분배) |
| 풋옵션 행사 1주 전 풍문 | "사채 상환 호재" 추격매수 유인 | 카페 "사채 상환" + 풋옵션 D-7 | P5 (분배) |
| **풋옵션 + 신규 CB 인수** | 무한 사이클 시작 | 신규 CB 발행 공시 + 30일 회피 | P9 → P1 (재매집) |

---

<div class="brand">● 100M1S</div>

<div class="phase-label">CASE 5.X · 매매자 대응</div>

# 양면박스 + 매매 원칙

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
"1회 사이클 분석 = 다음 사이클 진입 가능" 오인 → 리픽싱 후 부양에 추격 → 풋옵션 행사 시점 분배 폭격 → 신규 CB 발행 시 다시 매집 단계 진입 = <strong>무한 손실</strong></div>
<div class="defense"><span class="label">매매자 인지·대응</span>
<strong>신규 CB 발행 공시 = 새 사이클 매집 시작 = 다시 30일 회피</strong>. 풋옵션 D-7 카페 풍문 = 진입 금지. 리픽싱 한도 70% = -10 페널티 + 30일 회피</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
사례 5.X = 11원칙 §7 직격 + 무한 사이클 함정. <strong>CB 종목 = 매집·재매집 모든 시점 회피</strong>. 다음 사이클 진입 0%. 리픽싱·풋옵션 메커니즘 = 식별 + 영구 차단 게이트.</div>

---

---

<!-- _class: legal -->
<!-- _paginate: false -->

<div class="brand">● 100M1S</div>

# **LEGAL · DISCLAIMER**

본 자료는 **100M1S 비공개 연구 자료**입니다.

1. 본 자료는 **교육·연구 목적** 작성된 비공개 자료로 외부 유포·공유·2차 가공·언론 인용 모두 금지됩니다.
2. 본 자료의 사례(작전 패턴 분석)는 시장에서 관찰된 패턴을 일반화한 것으로, **특정 종목·특정 인물·특정 사건을 지칭하지 않습니다**. 모든 종목명·회사명·인명은 가상입니다.
3. 본 자료는 **투자 권유·투자 자문이 아닙니다**. 본 자료를 근거로 투자 결정 시 발생하는 모든 손실은 투자자 본인 책임입니다.
4. 본 자료의 기법·신호·진입 시점은 검증된 알파를 보장하지 않으며, 시장 환경에 따라 작동하지 않을 수 있습니다.
5. 본 자료의 시세조종 패턴 식별은 **자기방어 목적**이며, 동일 패턴을 모방·실행하는 행위는 **자본시장법 §176, §178 위반으로 형사처벌 대상**입니다.

---

**의심 사례 신고**: 한국거래소 1577-0088 / 금감원 1332

<small class="meta">100M1S · 비공개 연구자료</small>

<!-- ================================================================================ -->
<!-- LEGAL P0-4 EXCLUDE BLOCK — source-only mirror (slide 본문 인용 0건)              -->
<!-- 9쌍 marker 본문 source 보존 (정합 주석).                                          -->
<!-- 빌드 시 marker 사이 콘텐츠 sed 사전 제거 (Marp .pptx/.pdf/.html 모두 인용 0건).   -->
<!-- 명령: sed -e '/LEGAL_P0_4_EXCL_START/,/LEGAL_P0_4_EXCL_END/d' (실제 패턴은 hyphen) -->
<!-- ================================================================================ -->

[case 3 — 텔레그램·카페 알바 풍문 작전]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 매매자 자기방어 가이드

- **회피·관찰 우선**: 풍문 단계 (D-15 ~ D-7) 카페 게시 ≥ 평소 ×15 + 작성자 다양성 5명 미만 = **풍문 작전 의심 윈도우 → 진입 금지**
- 진입 검증 조건: 작성자 다양성 ≥ 10명 + 후속 검증 가능 IR 출처 + 거래대금 ≥ 200억 + 1분봉 RSI ≤ 30 동시 충족
- 강제 청산: "MOU/양해각서/추후 협의/구속력 없음" 키워드 공시 발견 즉시
- 비중: 시드 3% (풍문 작전 의심 종목 보수적)
<!-- LEGAL-P0-4-EXCLUDE-END -->

[case 4 — 허위공시 작전]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 매매자 자기방어 가이드

- **회피·관찰 우선**: 풍문 단계 (D-15 ~ D-7) 거래대금 ≥ 200억 + 본 계약 키워드 공시 0건 = **작전 의심 윈도우 → 진입 금지**
- 진입 검증 조건: 거래대금 ≥ 200억 + 1분봉 RSI ≤ 30 + MA10 터치 + 미공개정보 누출 신호 부재 (친인척 매수 공시 0건 + 공시 직전 거래량 평소 ×3 미만) 동시 충족
- 강제 청산: "MOU/양해각서/검토중" 키워드 공시 발견 즉시
- 비중: 시드 5% (허위공시 위험)
<!-- LEGAL-P0-4-EXCLUDE-END -->

[case 5 — CB/BW 헐값 발행]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 매매자 자기방어 가이드
- 진입 조건: 거래대금 ≥ 평소 ×2 + 1분봉 RSI ≤ 30 + 종가 = MA20 ±1% + CB 공시 30일 외
- 청산 조건: 익절 = 직전 5일 고점 / 손절 = 진입가 -3% / 강제 청산 = 전환청구 공시 즉시
- 비중: 시드 10%
<!-- LEGAL-P0-4-EXCLUDE-END -->

[case 6 — 무자본 M&A]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 매매자 자기방어 가이드
- 진입 조건: 거래대금 ≥ 평소 ×3 + 1분봉 RSI ≤ 30 + 인수자 자금 출처 명확 + 인수 후 30일 경과
- 청산 조건: 익절 = +5% / 손절 = -3% / 강제 청산 = 자산 처분 공시 즉시
- 비중: 시드 5% (무자본 M&A 의심 종목 보수적)
<!-- LEGAL-P0-4-EXCLUDE-END -->

[case 7 — CFD SG증권형]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 매매자 자기방어 가이드
- 진입 조건: CFD 비중 < 10% + 그룹 동조성 < 5% + 거래대금 ≥ 200억 + 1분봉 RSI ≤ 30 (눌림목)
- 청산 조건: 익절 = +5% / 손절 = -3% / 강제 청산 = 동일 그룹 5종목+ 동시 -10% 시 즉시
- 비중: 시드 3% (CFD 청산 트리거 위험)
<!-- LEGAL-P0-4-EXCLUDE-END -->

[case 8 — 사모펀드 라임형]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 매매자 자기방어 가이드
- 진입 조건: 사모펀드 보유 < 5% + 환매 이슈 0건 + 거래대금 ≥ 200억
- 청산 조건: 익절 = +5% / 손절 = -3% / 강제 청산 = 펀드 환매 중단 공시 즉시
- 비중: 시드 5%
<!-- LEGAL-P0-4-EXCLUDE-END -->

[case 9 — 바이오 임상 미공개정보]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 매매자 자기방어 가이드 (임상 미공개정보 윈도우 외 한정)

- **회피·관찰 우선**: 임상 종료~공시 사이 D-30~D-day 윈도우 = **진입 금지**. 본 윈도우 거래대금 폭증 = §174 의심 신호 → 매매 가담 위험
- 진입 검증 조건 (윈도우 외 한정): 임상 결과 공시 후 D+30 이후 + 거래대금 ≥ 200억 + 1분봉 RSI ≤ 30 + 친인척 매수 공시 0건 + 후속 임상 실패 신호 부재 동시 충족
- 강제 청산: 임상 결과 공시 직전 일봉 윗꼬리 시 + 친인척 매수 공시 발견 즉시
- 비중: 시드 3% (바이오 변동성 위험)
<!-- LEGAL-P0-4-EXCLUDE-END -->

[case 10 — 테마 그룹 동시 작전]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 매매자 자기방어 가이드
- 진입 조건: 테마 대장(거래대금 1등) + 거래대금 ≥ 300억 + 1분봉 RSI ≤ 30 + 테마 5종목 동시 폭증 단계 아님
- 청산 조건: 익절 = +5% / 손절 = -3% / 강제 청산 = 테마 5종목 동시 -10% 시 즉시 (테마 사망)
- 비중: 시드 10% (대장만 진입 시 가장 안정적)
<!-- LEGAL-P0-4-EXCLUDE-END -->

[case 11 — 회계감사 의견거절·한정·강조사항]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 매매자 자기방어 가이드

- **회피·관찰 우선**: 감사 보고서 작성 단계 (D-15 ~ D-7) 거래대금 폭증 + 신용잔고 감소 = **사전 통보 분배 의심 윈도우 → 진입 금지**. 감사 의견거절 윈도우 사전 통보 분배 의심 = §174 미공개정보 가담 위험
- 진입 검증 조건: 감사 보고서 발표 후 **거래정지 해제 + 적정 의견 + 관계회사 매출 비중 < 20% + 재고회전율 정상화** 동시 충족
- 강제 청산: DART 감사 의견 "한정/의견거절/부적정/계속기업 불확실" 공시 발견 즉시
- 비중: 시드 0% — **재무제표 신뢰 붕괴 = 펀더멘털 자체 위험 = 영구 회피**
<!-- LEGAL-P0-4-EXCLUDE-END -->

<!-- ================================================================================ -->
<!-- END LEGAL P0-4 EXCLUDE BLOCK                                                     -->
<!-- ================================================================================ -->
