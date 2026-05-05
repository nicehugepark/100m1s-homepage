---
marp: true
theme: default
size: 16:9
paginate: true
backgroundColor: '#FFFFFF'
color: '#212529'
header: '강의 자료 · 매매자 자기방어 · 외부 유포 금지'
footer: '100M1S · 사례북 v0.4 · 매매자 자기방어 강의'
style: |
  /* === A안 강의 톤 (DSN-003 §13 정합, 2026-05-05 v0.4) === */
  /* 흰 베이스 + 위험(C92A2A) + 신뢰(1864AB) + 햇살 보조(C49930) */
  :root {
    --ppt-bg:       #FFFFFF;
    --ppt-bg2:      #F1F3F5;
    --ppt-bg3:      #E9ECEF;
    --ppt-bd:       #DEE2E6;
    --ppt-tx:       #212529;
    --ppt-tx2:      #495057;
    --ppt-dm:       #868E96;
    --ppt-am:       #C92A2A;
    --ppt-am-soft:  #FFF5F5;
    --ppt-am-bd:    #FFA8A8;
    --ppt-mn:       #1864AB;
    --ppt-mn-soft:  #E7F5FF;
    --ppt-mn-bd:    #74C0FC;
    --ppt-pos:      #2F9E44;
    --ppt-neg:      #C92A2A;
    --ppt-id:       #C49930;
    --ppt-id-soft:  #FFF8E1;
  }
  section {
    background: var(--ppt-bg);
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
    color: var(--ppt-id-soft);
    pointer-events: none;
    white-space: nowrap;
    z-index: 0;
  }
  section > * { position: relative; z-index: 2; }
  header {
    background: var(--ppt-mn); color: #fff;
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
  h1 .accent, h1 strong { color: var(--ppt-am); }
  h2 {
    font-size: 28px; font-weight: 800; letter-spacing: -0.6px;
    color: var(--ppt-mn); margin-bottom: 16px;
  }
  h3 { font-size: 18px; font-weight: 700; color: var(--ppt-tx2); margin-bottom: 8px; }
  p, li { font-size: 16px; line-height: 1.6; color: var(--ppt-tx); }
  small, .meta { font-size: 12px; color: var(--ppt-dm); }
  strong { color: var(--ppt-am); font-weight: 800; }
  em { color: var(--ppt-tx2); font-style: normal; }
  blockquote {
    background: var(--ppt-bg2);
    border-left: 4px solid var(--ppt-mn);
    padding: 18px 22px; margin: 12px 0;
    font-size: 16px; line-height: 1.7;
    border-radius: 0 8px 8px 0;
    color: var(--ppt-tx);
  }
  table {
    width: 100%; border-collapse: collapse; font-size: 13px;
    background: var(--ppt-bg); border: 1px solid var(--ppt-bd); border-radius: 10px;
    overflow: hidden;
  }
  th {
    background: var(--ppt-mn); color: #FFFFFF;
    padding: 8px 12px; text-align: left; font-weight: 800;
    font-size: 12px; letter-spacing: 0.5px;
    border-bottom: 1px solid var(--ppt-bd);
  }
  td {
    padding: 8px 12px; border-bottom: 1px solid var(--ppt-bd);
    color: var(--ppt-tx); font-size: 13px; line-height: 1.5;
  }
  tr:nth-child(even) td { background: var(--ppt-bg2); }
  tr:last-child td { border-bottom: none; }
  code {
    background: var(--ppt-bg2); color: var(--ppt-am);
    padding: 2px 6px; border-radius: 4px; font-size: 13px;
    font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace;
  }
  /* === Phase Label (강의 단계 칩) === */
  .phase-label {
    display: inline-block;
    padding: 4px 12px;
    background: var(--ppt-mn);
    border-radius: 999px;
    font-size: 14px; font-weight: 800;
    color: #FFFFFF;
    letter-spacing: 1px;
    margin-bottom: 14px;
  }
  /* === 양면 분석 박스 (STRAT-002 §3.2 — 라벨 갱신) === */
  .twoside {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 14px 0;
  }
  .twoside .adversary {
    background: var(--ppt-am-soft);
    border-left: 4px solid var(--ppt-am);
    padding: 14px 16px; border-radius: 0 8px 8px 0;
    font-size: 14px; line-height: 1.55;
  }
  .twoside .defense {
    background: var(--ppt-mn-soft);
    border-left: 4px solid var(--ppt-mn);
    padding: 14px 16px; border-radius: 0 8px 8px 0;
    font-size: 14px; line-height: 1.55;
  }
  .twoside .label {
    font-size: 11px; font-weight: 800; letter-spacing: 1.5px;
    text-transform: uppercase; margin-bottom: 6px; display: block;
  }
  .twoside .adversary .label { color: var(--ppt-am); }
  .twoside .defense .label { color: var(--ppt-mn); }
  .principle-line {
    background: var(--ppt-id-soft);
    border-left: 4px solid var(--ppt-id);
    padding: 12px 16px; border-radius: 0 8px 8px 0;
    font-size: 14px; line-height: 1.55;
    margin: 8px 0 12px;
    color: var(--ppt-tx);
  }
  .principle-line .label {
    font-size: 11px; font-weight: 800; letter-spacing: 1.5px;
    text-transform: uppercase; color: var(--ppt-id); margin-bottom: 4px; display: block;
  }
  /* === 핵심 수치 카드 === */
  .num-row {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0;
  }
  .num-card {
    background: var(--ppt-bg);
    border: 1px solid var(--ppt-bd);
    border-left: 3px solid var(--ppt-mn);
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
  /* === 매트릭스 (heatmap, A안 적색 그라데이션) === */
  .matrix-cell-strong { background: var(--ppt-am) !important; color: #FFFFFF; font-weight: 800; }
  .matrix-cell-medium { background: var(--ppt-am-soft) !important; color: var(--ppt-am); font-weight: 700; }
  .matrix-cell-weak   { color: var(--ppt-dm); }
  /* === 100M1S 워드마크 === */
  .brand {
    position: absolute; right: 32px; top: 32px;
    font-size: 11px; font-weight: 900; letter-spacing: 2px;
    color: var(--ppt-id); text-transform: uppercase;
  }
  /* === SVG 인라인 컨테이너 === */
  .svg-figure {
    margin: 12px 0; text-align: center;
  }
  .svg-figure svg {
    max-width: 100%; height: auto;
    border: 1px solid var(--ppt-bd);
    border-radius: 8px;
    background: var(--ppt-bg);
  }
  .svg-figure .caption {
    font-size: 11px; color: var(--ppt-dm);
    margin-top: 4px; font-style: italic;
  }
---

<!-- _class: lead -->
<!-- _paginate: false -->

<div class="brand">● 100M1S</div>

# 작전주의 본질
## 한국 코스닥 작전주 12 사례 × 시간선 9패턴 — 매매자 자기방어 강의

<br>

<div class="phase-label">[강의 자료 · 매매자 보호용]</div>

> "세력 행태를 인지하는 만큼 매매자는 함정을 회피하고, 세력 수익 구간을 역으로 추출할 수 있다."
> — STRAT-002 §0.1 (2026-05-04 22:54 KST)

**12 사례 × 9 패턴 = 108 변칙 사례 매트릭스**
**12건 양면 분석 박스 · 가상 사례 기록 · D-180 ~ D+90 시간선**

<div class="svg-figure">
<svg width="800" height="180" viewBox="0 0 800 180" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="180" fill="#FFFFFF"/>
  <!-- 돋보기 -->
  <circle cx="120" cy="90" r="50" fill="none" stroke="#1864AB" stroke-width="6"/>
  <line x1="158" y1="128" x2="195" y2="165" stroke="#1864AB" stroke-width="8" stroke-linecap="round"/>
  <text x="120" y="98" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="22" font-weight="800" fill="#1864AB">분석</text>
  <!-- 체크리스트 -->
  <rect x="280" y="40" width="180" height="100" fill="#F1F3F5" stroke="#DEE2E6" stroke-width="2" rx="6"/>
  <line x1="295" y1="60" x2="305" y2="68" stroke="#2F9E44" stroke-width="3"/>
  <line x1="305" y1="68" x2="320" y2="50" stroke="#2F9E44" stroke-width="3"/>
  <line x1="335" y1="55" x2="445" y2="55" stroke="#212529" stroke-width="2"/>
  <line x1="295" y1="85" x2="305" y2="93" stroke="#2F9E44" stroke-width="3"/>
  <line x1="305" y1="93" x2="320" y2="75" stroke="#2F9E44" stroke-width="3"/>
  <line x1="335" y1="80" x2="445" y2="80" stroke="#212529" stroke-width="2"/>
  <line x1="295" y1="110" x2="305" y2="118" stroke="#2F9E44" stroke-width="3"/>
  <line x1="305" y1="118" x2="320" y2="100" stroke="#2F9E44" stroke-width="3"/>
  <line x1="335" y1="105" x2="445" y2="105" stroke="#212529" stroke-width="2"/>
  <text x="370" y="158" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="13" font-weight="700" fill="#495057">자가체크 12항</text>
  <!-- 방패 -->
  <path d="M 600 35 L 680 35 L 680 95 Q 680 130 640 155 Q 600 130 600 95 Z" fill="#1864AB" stroke="#1864AB" stroke-width="2"/>
  <text x="640" y="88" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="20" font-weight="800" fill="#FFFFFF">자기</text>
  <text x="640" y="112" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="20" font-weight="800" fill="#FFFFFF">방어</text>
  <text x="780" y="172" text-anchor="end" font-family="Pretendard, sans-serif" font-size="11" fill="#868E96">가상 사례 (강의 일러스트)</text>
</svg>
</div>

<div class="num-row">
<div class="num-card"><div class="nb-label">EDU-002 v0.2.1-bis</div><div class="nb-value"><span class="am">1,904줄</span></div></div>
<div class="num-card"><div class="nb-label">변칙 사례</div><div class="nb-value"><span class="am">132건+</span></div></div>
<div class="num-card"><div class="nb-label">시간선 패턴</div><div class="nb-value"><span class="am">9패턴</span></div></div>
</div>

<small class="meta">교육 자료 · 100M1S 비공개 PoC · 2026-05-05 · 매매자 자기방어 강의 톤 · 매매자 vs 세력 양면 분석 · STRAT-001 §6.8 트리거 데이터 정합</small>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">SLIDE 1 · INTRO</div>

# 부록 G 매트릭스 — **12 사례 × 9 패턴**

> EDU-002 §부록 G 인용. 각 셀 = 해당 사례의 변칙이 본 패턴에 위치하는 빈도. ✓✓ = 다수 / ✓ = 1~2건 / 빈칸 = 미매핑.

<div class="svg-figure">
<svg width="1100" height="280" viewBox="0 0 1100 280" xmlns="http://www.w3.org/2000/svg">
  <rect width="1100" height="280" fill="#FFFFFF"/>
  <!-- 헤더 행 (9 패턴) -->
  <text x="120" y="30" font-family="Pretendard, sans-serif" font-size="11" font-weight="700" fill="#495057">사례 \ 패턴</text>
  <g font-family="Pretendard, sans-serif" font-size="11" font-weight="700" fill="#FFFFFF" text-anchor="middle">
    <rect x="220" y="14" width="90" height="22" fill="#1864AB"/><text x="265" y="29">P1 매집</text>
    <rect x="312" y="14" width="90" height="22" fill="#1864AB"/><text x="357" y="29">P2 매집후털기</text>
    <rect x="404" y="14" width="90" height="22" fill="#1864AB"/><text x="449" y="29">P3 띄움</text>
    <rect x="496" y="14" width="90" height="22" fill="#1864AB"/><text x="541" y="29">P4 띄움후털기</text>
    <rect x="588" y="14" width="90" height="22" fill="#1864AB"/><text x="633" y="29">P5 분배</text>
    <rect x="680" y="14" width="90" height="22" fill="#1864AB"/><text x="725" y="29">P6 재매집</text>
    <rect x="772" y="14" width="90" height="22" fill="#1864AB"/><text x="817" y="29">P7 다시분배</text>
    <rect x="864" y="14" width="90" height="22" fill="#1864AB"/><text x="909" y="29">P8 난입</text>
    <rect x="956" y="14" width="90" height="22" fill="#1864AB"/><text x="1001" y="29">P9 이탈경합</text>
  </g>
  <!-- 12 사례 행 라벨 + heatmap cells -->
  <g font-family="Pretendard, sans-serif" font-size="11" fill="#212529">
    <text x="20" y="55">1 통정매매</text><text x="20" y="74">2 가장매매</text><text x="20" y="93">3 풍문유포</text><text x="20" y="112">4 허위공시</text>
    <text x="20" y="131">5 CB/BW헐값</text><text x="20" y="150">5.X CB고급</text><text x="20" y="169">6 무자본M&amp;A</text><text x="20" y="188">7 CFD</text>
    <text x="20" y="207">8 라임사모</text><text x="20" y="226">9 바이오임상</text><text x="20" y="245">10 테마그룹</text><text x="20" y="264">11 의견거절</text>
  </g>
  <!-- heatmap 셀: ✓✓ = #C92A2A (강), ✓ = #FFF5F5 (약), 빈칸 = #F1F3F5 -->
  <g font-family="Pretendard, sans-serif" font-size="11" font-weight="800">
    <!-- row 1: 통정매매 ✓✓✓✓✓✓✓ pattern: P1✓✓ P2✓ P3✓✓ P4✓ P5✓✓ P6✓ P7- P8✓ P9✓ -->
    <rect x="220" y="42" width="90" height="18" fill="#C92A2A"/><text x="265" y="55" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="312" y="42" width="90" height="18" fill="#FFF5F5"/><text x="357" y="55" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="404" y="42" width="90" height="18" fill="#C92A2A"/><text x="449" y="55" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="496" y="42" width="90" height="18" fill="#FFF5F5"/><text x="541" y="55" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="588" y="42" width="90" height="18" fill="#C92A2A"/><text x="633" y="55" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="680" y="42" width="90" height="18" fill="#FFF5F5"/><text x="725" y="55" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="772" y="42" width="90" height="18" fill="#F1F3F5"/>
    <rect x="864" y="42" width="90" height="18" fill="#FFF5F5"/><text x="909" y="55" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="956" y="42" width="90" height="18" fill="#FFF5F5"/><text x="1001" y="55" fill="#C92A2A" text-anchor="middle">✓</text>
    <!-- row 2: 가장매매 P1✓✓ P3✓✓ P5✓✓ P8✓ P9✓ 나머지 빈칸 -->
    <rect x="220" y="61" width="90" height="18" fill="#C92A2A"/><text x="265" y="74" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="312" y="61" width="90" height="18" fill="#F1F3F5"/>
    <rect x="404" y="61" width="90" height="18" fill="#C92A2A"/><text x="449" y="74" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="496" y="61" width="90" height="18" fill="#F1F3F5"/>
    <rect x="588" y="61" width="90" height="18" fill="#C92A2A"/><text x="633" y="74" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="680" y="61" width="90" height="18" fill="#F1F3F5"/>
    <rect x="772" y="61" width="90" height="18" fill="#F1F3F5"/>
    <rect x="864" y="61" width="90" height="18" fill="#FFF5F5"/><text x="909" y="74" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="956" y="61" width="90" height="18" fill="#FFF5F5"/><text x="1001" y="74" fill="#C92A2A" text-anchor="middle">✓</text>
    <!-- row 3: 풍문유포 P1✓ P3✓✓ P5✓✓ P6✓ P8✓ P9✓ -->
    <rect x="220" y="80" width="90" height="18" fill="#FFF5F5"/><text x="265" y="93" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="312" y="80" width="90" height="18" fill="#F1F3F5"/>
    <rect x="404" y="80" width="90" height="18" fill="#C92A2A"/><text x="449" y="93" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="496" y="80" width="90" height="18" fill="#F1F3F5"/>
    <rect x="588" y="80" width="90" height="18" fill="#C92A2A"/><text x="633" y="93" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="680" y="80" width="90" height="18" fill="#FFF5F5"/><text x="725" y="93" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="772" y="80" width="90" height="18" fill="#F1F3F5"/>
    <rect x="864" y="80" width="90" height="18" fill="#FFF5F5"/><text x="909" y="93" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="956" y="80" width="90" height="18" fill="#FFF5F5"/><text x="1001" y="93" fill="#C92A2A" text-anchor="middle">✓</text>
    <!-- row 4: 허위공시 P1✓ P3✓✓ P5✓✓ P9✓ -->
    <rect x="220" y="99" width="90" height="18" fill="#FFF5F5"/><text x="265" y="112" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="312" y="99" width="90" height="18" fill="#F1F3F5"/>
    <rect x="404" y="99" width="90" height="18" fill="#C92A2A"/><text x="449" y="112" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="496" y="99" width="90" height="18" fill="#F1F3F5"/>
    <rect x="588" y="99" width="90" height="18" fill="#C92A2A"/><text x="633" y="112" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="680" y="99" width="90" height="18" fill="#F1F3F5"/>
    <rect x="772" y="99" width="90" height="18" fill="#F1F3F5"/>
    <rect x="864" y="99" width="90" height="18" fill="#F1F3F5"/>
    <rect x="956" y="99" width="90" height="18" fill="#FFF5F5"/><text x="1001" y="112" fill="#C92A2A" text-anchor="middle">✓</text>
    <!-- row 5: CB/BW헐값 P1✓✓ P3✓ P4✓ P5✓✓ P9✓ -->
    <rect x="220" y="118" width="90" height="18" fill="#C92A2A"/><text x="265" y="131" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="312" y="118" width="90" height="18" fill="#F1F3F5"/>
    <rect x="404" y="118" width="90" height="18" fill="#FFF5F5"/><text x="449" y="131" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="496" y="118" width="90" height="18" fill="#FFF5F5"/><text x="541" y="131" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="588" y="118" width="90" height="18" fill="#C92A2A"/><text x="633" y="131" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="680" y="118" width="90" height="18" fill="#F1F3F5"/>
    <rect x="772" y="118" width="90" height="18" fill="#F1F3F5"/>
    <rect x="864" y="118" width="90" height="18" fill="#F1F3F5"/>
    <rect x="956" y="118" width="90" height="18" fill="#FFF5F5"/><text x="1001" y="131" fill="#C92A2A" text-anchor="middle">✓</text>
    <!-- row 6: CB고급 P1✓ P2✓ P5✓ P6✓ P7✓ P9✓ -->
    <rect x="220" y="137" width="90" height="18" fill="#FFF5F5"/><text x="265" y="150" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="312" y="137" width="90" height="18" fill="#FFF5F5"/><text x="357" y="150" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="404" y="137" width="90" height="18" fill="#F1F3F5"/>
    <rect x="496" y="137" width="90" height="18" fill="#F1F3F5"/>
    <rect x="588" y="137" width="90" height="18" fill="#FFF5F5"/><text x="633" y="150" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="680" y="137" width="90" height="18" fill="#FFF5F5"/><text x="725" y="150" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="772" y="137" width="90" height="18" fill="#FFF5F5"/><text x="817" y="150" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="864" y="137" width="90" height="18" fill="#F1F3F5"/>
    <rect x="956" y="137" width="90" height="18" fill="#FFF5F5"/><text x="1001" y="150" fill="#C92A2A" text-anchor="middle">✓</text>
    <!-- row 7: 무자본M&A P1✓✓ P3✓ P5✓✓ P9✓ -->
    <rect x="220" y="156" width="90" height="18" fill="#C92A2A"/><text x="265" y="169" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="312" y="156" width="90" height="18" fill="#F1F3F5"/>
    <rect x="404" y="156" width="90" height="18" fill="#FFF5F5"/><text x="449" y="169" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="496" y="156" width="90" height="18" fill="#F1F3F5"/>
    <rect x="588" y="156" width="90" height="18" fill="#C92A2A"/><text x="633" y="169" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="680" y="156" width="90" height="18" fill="#F1F3F5"/>
    <rect x="772" y="156" width="90" height="18" fill="#F1F3F5"/>
    <rect x="864" y="156" width="90" height="18" fill="#F1F3F5"/>
    <rect x="956" y="156" width="90" height="18" fill="#FFF5F5"/><text x="1001" y="169" fill="#C92A2A" text-anchor="middle">✓</text>
    <!-- row 8: CFD P1✓✓ P3✓✓ P5✓✓ P9✓ -->
    <rect x="220" y="175" width="90" height="18" fill="#C92A2A"/><text x="265" y="188" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="312" y="175" width="90" height="18" fill="#F1F3F5"/>
    <rect x="404" y="175" width="90" height="18" fill="#C92A2A"/><text x="449" y="188" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="496" y="175" width="90" height="18" fill="#F1F3F5"/>
    <rect x="588" y="175" width="90" height="18" fill="#C92A2A"/><text x="633" y="188" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="680" y="175" width="90" height="18" fill="#F1F3F5"/>
    <rect x="772" y="175" width="90" height="18" fill="#F1F3F5"/>
    <rect x="864" y="175" width="90" height="18" fill="#F1F3F5"/>
    <rect x="956" y="175" width="90" height="18" fill="#FFF5F5"/><text x="1001" y="188" fill="#C92A2A" text-anchor="middle">✓</text>
    <!-- row 9: 라임사모 P1✓✓ P3✓ P5✓✓ P9✓ -->
    <rect x="220" y="194" width="90" height="18" fill="#C92A2A"/><text x="265" y="207" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="312" y="194" width="90" height="18" fill="#F1F3F5"/>
    <rect x="404" y="194" width="90" height="18" fill="#FFF5F5"/><text x="449" y="207" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="496" y="194" width="90" height="18" fill="#F1F3F5"/>
    <rect x="588" y="194" width="90" height="18" fill="#C92A2A"/><text x="633" y="207" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="680" y="194" width="90" height="18" fill="#F1F3F5"/>
    <rect x="772" y="194" width="90" height="18" fill="#F1F3F5"/>
    <rect x="864" y="194" width="90" height="18" fill="#F1F3F5"/>
    <rect x="956" y="194" width="90" height="18" fill="#FFF5F5"/><text x="1001" y="207" fill="#C92A2A" text-anchor="middle">✓</text>
    <!-- row 10: 바이오임상 P1✓✓ P3✓✓ P5✓✓ P9✓ -->
    <rect x="220" y="213" width="90" height="18" fill="#C92A2A"/><text x="265" y="226" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="312" y="213" width="90" height="18" fill="#F1F3F5"/>
    <rect x="404" y="213" width="90" height="18" fill="#C92A2A"/><text x="449" y="226" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="496" y="213" width="90" height="18" fill="#F1F3F5"/>
    <rect x="588" y="213" width="90" height="18" fill="#C92A2A"/><text x="633" y="226" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="680" y="213" width="90" height="18" fill="#F1F3F5"/>
    <rect x="772" y="213" width="90" height="18" fill="#F1F3F5"/>
    <rect x="864" y="213" width="90" height="18" fill="#F1F3F5"/>
    <rect x="956" y="213" width="90" height="18" fill="#FFF5F5"/><text x="1001" y="226" fill="#C92A2A" text-anchor="middle">✓</text>
    <!-- row 11: 테마그룹 P1✓ P3✓✓ P4✓ P5✓✓ P8✓ P9✓ -->
    <rect x="220" y="232" width="90" height="18" fill="#FFF5F5"/><text x="265" y="245" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="312" y="232" width="90" height="18" fill="#F1F3F5"/>
    <rect x="404" y="232" width="90" height="18" fill="#C92A2A"/><text x="449" y="245" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="496" y="232" width="90" height="18" fill="#FFF5F5"/><text x="541" y="245" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="588" y="232" width="90" height="18" fill="#C92A2A"/><text x="633" y="245" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="680" y="232" width="90" height="18" fill="#F1F3F5"/>
    <rect x="772" y="232" width="90" height="18" fill="#F1F3F5"/>
    <rect x="864" y="232" width="90" height="18" fill="#FFF5F5"/><text x="909" y="245" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="956" y="232" width="90" height="18" fill="#FFF5F5"/><text x="1001" y="245" fill="#C92A2A" text-anchor="middle">✓</text>
    <!-- row 12: 의견거절 P1✓✓ P3✓ P5✓✓ P9✓ -->
    <rect x="220" y="251" width="90" height="18" fill="#C92A2A"/><text x="265" y="264" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="312" y="251" width="90" height="18" fill="#F1F3F5"/>
    <rect x="404" y="251" width="90" height="18" fill="#FFF5F5"/><text x="449" y="264" fill="#C92A2A" text-anchor="middle">✓</text>
    <rect x="496" y="251" width="90" height="18" fill="#F1F3F5"/>
    <rect x="588" y="251" width="90" height="18" fill="#C92A2A"/><text x="633" y="264" fill="#FFFFFF" text-anchor="middle">✓✓</text>
    <rect x="680" y="251" width="90" height="18" fill="#F1F3F5"/>
    <rect x="772" y="251" width="90" height="18" fill="#F1F3F5"/>
    <rect x="864" y="251" width="90" height="18" fill="#F1F3F5"/>
    <rect x="956" y="251" width="90" height="18" fill="#FFF5F5"/><text x="1001" y="264" fill="#C92A2A" text-anchor="middle">✓</text>
  </g>
  <!-- 범례 -->
  <text x="1095" y="278" text-anchor="end" font-family="Pretendard, sans-serif" font-size="11" fill="#868E96">가상 사례 매트릭스 / ■ ✓✓ 다수 ■ ✓ 1~2건 □ 미매핑</text>
</svg>
</div>

| 사례 | P1 매집 | P2 매집후털기 | P3 띄움 | P4 띄움후털기 | P5 분배 | P6 재매집 | P7 다시분배 | P8 세력난입 | P9 이탈경합 |
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

<div class="phase-label">SLIDE 2 · CASE 1 · 통정매매 (Wash Trade)</div>

# **사례 1** — 보이지 않는 핑퐁

> **가상 사례 (㈜A 모델)** — 통정매매 행태 관찰
> D-90 K급 주포가 차명 5계좌(평균 3,000만원/계좌)로 ㈜A 시총 600억 코스닥 종목을 1.5억으로 분할 매집하는 행태가 관찰된다.
> D-30. 5분봉 거래량 평소 ×8, 거래대금 50억 → 380억. 통정매매 ×3회/일 식별.
> D-7 16:30 호재 공시 + 익일 +28% 갭상승 + D+1 분할매도 시작.

<div class="svg-figure">
<svg width="1100" height="200" viewBox="0 0 1100 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="1100" height="200" fill="#FFFFFF"/>
  <!-- 가로 timeline 축 -->
  <line x1="60" y1="100" x2="1040" y2="100" stroke="#DEE2E6" stroke-width="2"/>
  <!-- 4 단계 박스 (매집/띄움/분배/이탈) -->
  <g font-family="Pretendard, sans-serif" font-size="12" font-weight="800" text-anchor="middle">
    <rect x="80" y="60" width="200" height="80" fill="#FFF5F5" stroke="#C92A2A" stroke-width="2" rx="8"/>
    <text x="180" y="88" fill="#C92A2A" font-size="13">단계 1 · 매집</text>
    <text x="180" y="108" fill="#212529" font-size="11" font-weight="600">D-90 ~ D-30</text>
    <text x="180" y="125" fill="#495057" font-size="11" font-weight="500">차명 5계좌 분할 매집</text>
    <rect x="300" y="60" width="200" height="80" fill="#FFF5F5" stroke="#C92A2A" stroke-width="2" rx="8"/>
    <text x="400" y="88" fill="#C92A2A" font-size="13">단계 2 · 띄움</text>
    <text x="400" y="108" fill="#212529" font-size="11" font-weight="600">D-30 ~ D-7</text>
    <text x="400" y="125" fill="#495057" font-size="11" font-weight="500">통정매매 ×3회/일</text>
    <rect x="520" y="60" width="200" height="80" fill="#C92A2A" stroke="#C92A2A" stroke-width="2" rx="8"/>
    <text x="620" y="88" fill="#FFFFFF" font-size="13">단계 3 · 분배</text>
    <text x="620" y="108" fill="#FFFFFF" font-size="11" font-weight="600">D-7 ~ D+5</text>
    <text x="620" y="125" fill="#FFFFFF" font-size="11" font-weight="500">호재 공시 + 갭상승</text>
    <rect x="740" y="60" width="200" height="80" fill="#F1F3F5" stroke="#868E96" stroke-width="2" rx="8"/>
    <text x="840" y="88" fill="#495057" font-size="13">단계 4 · 이탈</text>
    <text x="840" y="108" fill="#212529" font-size="11" font-weight="600">D+5 ~ D+30</text>
    <text x="840" y="125" fill="#495057" font-size="11" font-weight="500">매매자 -44% 손실</text>
  </g>
  <!-- 화살표 (단계 간) -->
  <g stroke="#C92A2A" stroke-width="2" fill="none">
    <path d="M 280 100 L 295 100" marker-end="url(#arrow1)"/>
    <path d="M 500 100 L 515 100" marker-end="url(#arrow1)"/>
    <path d="M 720 100 L 735 100" marker-end="url(#arrow1)"/>
  </g>
  <defs><marker id="arrow1" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M 0 0 L 6 4 L 0 8 z" fill="#C92A2A"/></marker></defs>
  <!-- 시간 눈금 -->
  <g font-family="Pretendard, sans-serif" font-size="11" fill="#868E96" text-anchor="middle">
    <text x="180" y="160">D-90</text><text x="400" y="160">D-30</text><text x="620" y="160">D-7 / D+0</text><text x="840" y="160">D+30</text>
  </g>
  <text x="1080" y="190" text-anchor="end" font-family="Pretendard, sans-serif" font-size="11" fill="#868E96">가상 사례 (㈜A 모델)</text>
</svg>
</div>

<div class="num-row">
<div class="num-card"><div class="nb-label">시총·평균매집가</div><div class="nb-value">600억 / <span class="am">3,000원</span></div></div>
<div class="num-card"><div class="nb-label">D-7 종가</div><div class="nb-value">8,400원 <span class="pos">+180%</span></div></div>
<div class="num-card"><div class="nb-label">K 차익</div><div class="nb-value"><span class="am">+45억</span></div></div>
</div>

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
"거래대금 ×7 폭증 = 큰 호재" 추격매수 → D+1 갭상승 매수가 11,000원 → D+5 종가 6,200원 → <strong>-44% 손실</strong></div>
<div class="defense"><span class="label">매매자 인지·대응</span>
2막 후반 첫 윗꼬리 → 1분봉 RSI 30 → MA20 터치 → <strong>대표 동행 진입</strong> (분봉 스캘핑, 손절 -3%)</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
패턴 3 (띄움) 첫 윗꼬리 직후 = <strong>눌림매매 진입 후보</strong> (STRAT-001 §6.5 변칙 2-2 신뢰도 5/5). 통정매매 ×3회/일 + 거래원 분포 변화 식별 시 패턴 5 분배 임박 = 즉시 청산.</div>

<div class="timeline">
<span>D-90 매집</span><span>D-30</span><span class="here">D-7 띄움</span><span>D+0 분배</span><span>D+30</span><span>D+90 이탈</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">SLIDE 3 · CASE 2 · 가장매매 (Pre-arranged Trade)</div>

# **사례 2** — 혼자 치는 핑퐁

> **가상 사례 (㈜B 모델)** — 가장매매 단독 행위주체 관찰
> J(38, 단독 작전수)가 HTS 8대 + 8 차명계좌 운영. ㈜B 시총 200억 저시총 코스닥에서 5분봉 1회 자기매매로 거래량 ×8 폭발을 위장하는 행태가 관찰된다.
> D-20 호가 페인팅: 매수 잔량 30초 내 70% 취소 ×40회. 매매자가 호가창 두께를 보고 추격하는 시점.
> D-2 09:30 텔레그램방 "오늘 마감 직전 상한가 갑니다" 풍문 → 11:00 매매자 추격매수 절정 → 11:30 분배 시작.

<div class="svg-figure">
<svg width="1000" height="220" viewBox="0 0 1000 220" xmlns="http://www.w3.org/2000/svg">
  <rect width="1000" height="220" fill="#FFFFFF"/>
  <!-- 좌: 1 작전수 + 8 HTS -->
  <g font-family="Pretendard, sans-serif">
    <circle cx="80" cy="110" r="28" fill="#C92A2A"/>
    <text x="80" y="115" text-anchor="middle" font-size="12" font-weight="800" fill="#FFFFFF">작전수 J</text>
    <!-- 8 HTS 모니터 -->
    <g fill="#F1F3F5" stroke="#1864AB" stroke-width="1.5">
      <rect x="180" y="30" width="60" height="40" rx="4"/><rect x="180" y="80" width="60" height="40" rx="4"/>
      <rect x="180" y="130" width="60" height="40" rx="4"/><rect x="180" y="180" width="60" height="40" rx="4"/>
      <rect x="260" y="30" width="60" height="40" rx="4"/><rect x="260" y="80" width="60" height="40" rx="4"/>
      <rect x="260" y="130" width="60" height="40" rx="4"/><rect x="260" y="180" width="60" height="40" rx="4"/>
    </g>
    <text x="250" y="14" text-anchor="middle" font-size="11" font-weight="700" fill="#1864AB">HTS 8대 / 차명 8계좌</text>
    <!-- 화살표: 작전수 → HTS -->
    <line x1="110" y1="110" x2="175" y2="100" stroke="#C92A2A" stroke-width="2" marker-end="url(#arrow2)"/>
    <defs><marker id="arrow2" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M 0 0 L 6 4 L 0 8 z" fill="#C92A2A"/></marker></defs>
  </g>
  <!-- 우: 호가창 mockup -->
  <g font-family="SF Mono, monospace" font-size="11">
    <rect x="400" y="20" width="280" height="180" fill="#F1F3F5" stroke="#DEE2E6" stroke-width="1" rx="4"/>
    <text x="540" y="38" text-anchor="middle" font-size="11" font-weight="800" fill="#212529" font-family="Pretendard, sans-serif">호가창 (페인팅)</text>
    <!-- 매도 5호가 -->
    <text x="420" y="58" fill="#1864AB">10,300  150</text>
    <text x="420" y="74" fill="#1864AB">10,200  280</text>
    <text x="420" y="90" fill="#1864AB">10,100  420</text>
    <text x="420" y="106" fill="#1864AB">10,050  600</text>
    <text x="420" y="122" fill="#1864AB">10,000  840</text>
    <line x1="410" y1="130" x2="670" y2="130" stroke="#212529" stroke-width="1"/>
    <!-- 매수 5호가 (X 표시 = 페이크 잔량) -->
    <text x="420" y="146" fill="#C92A2A">9,950  4,200</text>
    <text x="540" y="146" fill="#C92A2A" font-weight="800">×</text>
    <text x="420" y="162" fill="#C92A2A">9,900  3,800</text>
    <text x="540" y="162" fill="#C92A2A" font-weight="800">×</text>
    <text x="420" y="178" fill="#C92A2A">9,850  3,500</text>
    <text x="540" y="178" fill="#C92A2A" font-weight="800">×</text>
    <text x="420" y="194" fill="#C92A2A">9,800  3,200</text>
    <text x="540" y="194" fill="#C92A2A" font-weight="800">×</text>
    <text x="600" y="170" font-family="Pretendard, sans-serif" font-size="11" fill="#C92A2A" font-weight="700">30초 내</text>
    <text x="600" y="184" font-family="Pretendard, sans-serif" font-size="11" fill="#C92A2A" font-weight="700">70% 취소</text>
  </g>
  <!-- 결과 라벨 -->
  <g font-family="Pretendard, sans-serif">
    <rect x="720" y="60" width="240" height="100" fill="#FFF5F5" stroke="#C92A2A" stroke-width="2" rx="8"/>
    <text x="840" y="85" text-anchor="middle" font-size="13" font-weight="800" fill="#C92A2A">결과 (관찰)</text>
    <text x="840" y="108" text-anchor="middle" font-size="11" fill="#212529">5분봉 거래량 ×8</text>
    <text x="840" y="126" text-anchor="middle" font-size="11" fill="#212529">호가 잔량 70% 취소 ×40회</text>
    <text x="840" y="144" text-anchor="middle" font-size="11" font-weight="800" fill="#C92A2A">매매자 -26% 손실</text>
  </g>
  <text x="990" y="212" text-anchor="end" font-family="Pretendard, sans-serif" font-size="11" fill="#868E96">가상 사례 (㈜B 모델)</text>
</svg>
</div>

<div class="num-row">
<div class="num-card"><div class="nb-label">HTS·차명</div><div class="nb-value"><span class="am">8대 / 8계좌</span></div></div>
<div class="num-card"><div class="nb-label">5분봉 거래량</div><div class="nb-value">평소 <span class="am">×8</span></div></div>
<div class="num-card"><div class="nb-label">텔레그램 외주</div><div class="nb-value"><span class="am">월 200만원</span></div></div>
</div>

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
호가 두께 + 5분봉 거래량 ×8 = "거래량 폭발 호재" 추격 → 11:30 분배 시작 시점 매수가 평균 9,800원 → 종가 7,200원 <strong>-26%</strong></div>
<div class="defense"><span class="label">매매자 인지·대응</span>
호가 잔량 30초 70% 취소 ×5회 = <strong>-15 페널티</strong> + 진입 차단. 5분봉 ×8 단독 = -10 + 게이트 차단 (PM320)</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
사례 2는 매집 단계 식별 = <strong>HTS 8대 동일 IP 클러스터 적발</strong>로만 활용 (사후). 진입 영역 0. 텔레그램 유료방 신규 가입 폭증 + 종목 노출 = 풍문 작전 의심 → 패턴 3 (띄움) 직격 회피.</div>

<div class="timeline">
<span>D-60 매집</span><span class="here">D-20 띄움</span><span>D-2 풍문</span><span>D+0 분배</span><span>D+30</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">SLIDE 4 · CASE 3 · 풍문 유포형 (디지털 군중 동원)</div>

# **사례 3** — 텔레그램 리딩방 + 카페 알바 12명

> **가상 사례 (㈜Q 모델)** — 풍문 유포 인프라 관찰
> 풍문책 N(41, 전직 증권사 RA)이 텔레그램 유료방 3개 + 무료방 12개 운영. 월 99만원 ×800명 = 매출 8억 규모의 행태가 관찰된다.
> N의 카페 알바 12명, 시간당 1만원, 1인 일 30~50건 게시·댓글. 동일 IP 회피 위해 카페별 1~2명 분담.
> D-1 12:00:00 N의 유료방 3개 동시: "㈜Q 주목. 다음 작전 대장. 종목코드 XXXX." + 12:01 카페 알바 12명 동시 게시: "AI 자회사 설립 임박, 친구가 IR쪽이라 들었음." (동조성 게시 패턴)

<div class="svg-figure">
<svg width="1000" height="220" viewBox="0 0 1000 220" xmlns="http://www.w3.org/2000/svg">
  <rect width="1000" height="220" fill="#FFFFFF"/>
  <!-- 중심: 풍문책 N -->
  <circle cx="500" cy="110" r="36" fill="#C92A2A"/>
  <text x="500" y="106" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="11" font-weight="800" fill="#FFFFFF">풍문책 N</text>
  <text x="500" y="121" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="11" fill="#FFFFFF">(전직 RA)</text>
  <!-- 좌측: 텔레그램 3 유료방 -->
  <g font-family="Pretendard, sans-serif">
    <rect x="60" y="30" width="120" height="36" fill="#1864AB" rx="4"/><text x="120" y="53" text-anchor="middle" font-size="11" font-weight="700" fill="#FFFFFF">텔레그램 유료방 1</text>
    <rect x="60" y="92" width="120" height="36" fill="#1864AB" rx="4"/><text x="120" y="115" text-anchor="middle" font-size="11" font-weight="700" fill="#FFFFFF">텔레그램 유료방 2</text>
    <rect x="60" y="154" width="120" height="36" fill="#1864AB" rx="4"/><text x="120" y="177" text-anchor="middle" font-size="11" font-weight="700" fill="#FFFFFF">텔레그램 유료방 3</text>
    <line x1="180" y1="48" x2="465" y2="100" stroke="#C92A2A" stroke-width="1.5"/>
    <line x1="180" y1="110" x2="465" y2="110" stroke="#C92A2A" stroke-width="1.5"/>
    <line x1="180" y1="172" x2="465" y2="120" stroke="#C92A2A" stroke-width="1.5"/>
  </g>
  <!-- 우측: 카페 알바 12명 (3 row × 4 col) -->
  <g font-family="Pretendard, sans-serif" font-size="11" font-weight="700" fill="#FFFFFF">
    <g fill="#C49930" stroke="#C49930">
      <circle cx="640" cy="40" r="14"/><circle cx="700" cy="40" r="14"/><circle cx="760" cy="40" r="14"/><circle cx="820" cy="40" r="14"/>
      <circle cx="640" cy="110" r="14"/><circle cx="700" cy="110" r="14"/><circle cx="760" cy="110" r="14"/><circle cx="820" cy="110" r="14"/>
      <circle cx="640" cy="180" r="14"/><circle cx="700" cy="180" r="14"/><circle cx="760" cy="180" r="14"/><circle cx="820" cy="180" r="14"/>
    </g>
    <text x="640" y="44" text-anchor="middle">A1</text><text x="700" y="44" text-anchor="middle">A2</text><text x="760" y="44" text-anchor="middle">A3</text><text x="820" y="44" text-anchor="middle">A4</text>
    <text x="640" y="114" text-anchor="middle">A5</text><text x="700" y="114" text-anchor="middle">A6</text><text x="760" y="114" text-anchor="middle">A7</text><text x="820" y="114" text-anchor="middle">A8</text>
    <text x="640" y="184" text-anchor="middle">A9</text><text x="700" y="184" text-anchor="middle">A10</text><text x="760" y="184" text-anchor="middle">A11</text><text x="820" y="184" text-anchor="middle">A12</text>
  </g>
  <text x="730" y="20" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="11" font-weight="700" fill="#C49930">카페 알바 12명 (동조성 게시)</text>
  <line x1="535" y1="100" x2="625" y2="50" stroke="#C49930" stroke-width="1.5"/>
  <line x1="535" y1="110" x2="625" y2="110" stroke="#C49930" stroke-width="1.5"/>
  <line x1="535" y1="120" x2="625" y2="170" stroke="#C49930" stroke-width="1.5"/>
  <text x="990" y="212" text-anchor="end" font-family="Pretendard, sans-serif" font-size="11" fill="#868E96">가상 사례 (㈜Q 모델)</text>
</svg>
</div>

<div class="num-row">
<div class="num-card"><div class="nb-label">유료방 회원</div><div class="nb-value">800 → <span class="am">2,400명</span></div></div>
<div class="num-card"><div class="nb-label">알바 게시량</div><div class="nb-value">일 <span class="am">47건</span> (동조성 80%+)</div></div>
<div class="num-card"><div class="nb-label">작성자 다양성</div><div class="nb-value"><span class="neg">≤ 5명</span></div></div>
</div>

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
"카페에서 다들 추천하는 종목" 인식 → 후기 위장글 ("어제 +30%") 보고 추격매수 → D+1 09:30 N 컷오프 + 알바 키워드 중지 → 종가 -18%</div>
<div class="defense"><span class="label">매매자 인지·대응</span>
<strong>카페 작성자 다양성 ≤ 5명 + 거래대금 폭증 = 풍문 작전 = 진입 금지</strong>. 텔레그램 유료방 신규 가입 1주 ×3 = 풍문 채널 본진 의심 → -20 페널티</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
이시카와 영역 직격: 풍문 채널 다양성 메트릭 + 동일 시점 거래대금 동조 식별 → PM320 게이트 차단. 매매자는 <strong>차트만 본다</strong> (카페·텔레그램 후기 0% 신뢰). 패턴 3 (띄움)·패턴 5 (분배 직전) 모두 회피.</div>

<div class="timeline">
<span>D-60 인프라</span><span>D-30 풍문</span><span class="here">D-1 절정</span><span>D+0 분배</span><span>D+1 컷오프</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">SLIDE 5 · CASE 4 vs CASE 9 · 차별 분석</div>

# **사례 4 (허위공시)** vs **사례 9 (바이오 임상)**

> 표면 동일 시퀀스 ("장 마감 후 16:30 공시 + 익일 시초가 +30% + 분할매도") = Jaccard 0.40 → **차별 12축**으로 해소.

<div class="svg-figure">
<svg width="1100" height="160" viewBox="0 0 1100 160" xmlns="http://www.w3.org/2000/svg">
  <rect width="1100" height="160" fill="#FFFFFF"/>
  <!-- 좌: 사례 4 (허위공시) -->
  <rect x="40" y="20" width="500" height="120" fill="#FFF5F5" stroke="#C92A2A" stroke-width="2" rx="8"/>
  <text x="290" y="44" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="14" font-weight="800" fill="#C92A2A">사례 4 · 허위공시 (§178)</text>
  <g font-family="Pretendard, sans-serif" font-size="11" fill="#212529">
    <text x="60" y="68">공시 진위: <tspan font-weight="700" fill="#C92A2A">거짓 (사후 정정)</tspan></text>
    <text x="60" y="86">사전 인지자: CEO + IR + 변호사</text>
    <text x="60" y="104">매집 윈도우: D-60 ~ D-20 (60일)</text>
    <text x="60" y="122">키워드: "MOU·구속력 약함"</text>
  </g>
  <!-- 우: 사례 9 (바이오 임상) -->
  <rect x="560" y="20" width="500" height="120" fill="#E7F5FF" stroke="#1864AB" stroke-width="2" rx="8"/>
  <text x="810" y="44" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="14" font-weight="800" fill="#1864AB">사례 9 · 바이오 임상 (§174)</text>
  <g font-family="Pretendard, sans-serif" font-size="11" fill="#212529">
    <text x="580" y="68">공시 진위: <tspan font-weight="700" fill="#1864AB">진실 (임상 결과)</tspan></text>
    <text x="580" y="86">사전 인지자: CTO + 친인척 5명</text>
    <text x="580" y="104">매집 윈도우: D-30 ~ D-7 (30일)</text>
    <text x="580" y="122">키워드: "임상 성공·중간 데이터"</text>
  </g>
  <text x="1090" y="155" text-anchor="end" font-family="Pretendard, sans-serif" font-size="11" fill="#868E96">가상 사례 (㈜N4·㈜N9 모델)</text>
</svg>
</div>

| 차별 축 | 사례 4 (허위공시) | 사례 9 (바이오 임상) |
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
<div class="adversary"><span class="label">세력 행태 (양 사례 공통)</span>
"분기 매출 +52% YoY" 또는 "임상 성공 임박" 풍문으로 매매자 추격 유인 → 익일 갭상승 +30% → D+5 분할매도 절정 → 종가 -45% 손실 분배</div>
<div class="defense"><span class="label">매매자 인지·대응 (각 사례별)</span>
사례 4: 공시 본문 "구속력 없음" 키워드 = 진입 차단<br>
사례 9: 임상 종료~공시 윈도우 거래대금 ×5 = -15 페널티</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
양 사례 모두 <strong>16:00~17:30 공시 + 익일 갭상승 ≥ +20% = 진입 금지</strong>. 사례 9 친인척 분석 = 공정공시 §174 윈도우 직격. 사례 4 = §178 가담 위험.</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">SLIDE 6 · CASE 5 · CB/BW 헐값 발행 (Q-046b PoC C 매칭)</div>

# **사례 5** — 사채로 짓는 작전 (D-180 매집 시작)

> **가상 사례 (㈜D 모델)** — 사모 CB 인수 행위주체 관찰
> D-180 ㈜D 이사회 결의: 운영자금 100억 조달을 위한 사모 CB 발행. 인수자 ㈜S캐피탈로 식별된다.
> S가 100억으로 CB 200만주 분 인수 = 전환 시 시총 12% 확보. 전환가 5,000원, 현재가 6,200원 = 미실현 차익 즉시 +24% 구조.

<div class="svg-figure">
<svg width="1100" height="200" viewBox="0 0 1100 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="1100" height="200" fill="#FFFFFF"/>
  <!-- 가로 timeline 축 (D-180~D+30) -->
  <line x1="60" y1="120" x2="1040" y2="120" stroke="#DEE2E6" stroke-width="2"/>
  <!-- 단계 박스 -->
  <g font-family="Pretendard, sans-serif" font-size="11" font-weight="800" text-anchor="middle">
    <rect x="80" y="70" width="180" height="100" fill="#FFF5F5" stroke="#C92A2A" stroke-width="2" rx="8"/>
    <text x="170" y="92" fill="#C92A2A" font-size="12">CB 발행</text>
    <text x="170" y="112" fill="#212529" font-size="11" font-weight="600">D-180 (이사회 결의)</text>
    <!-- 채권 아이콘 -->
    <rect x="140" y="125" width="60" height="32" fill="#C49930" stroke="#C49930" rx="3"/>
    <text x="170" y="146" fill="#FFFFFF" font-size="12">CB 100억</text>
    <rect x="280" y="70" width="180" height="100" fill="#FFF5F5" stroke="#C92A2A" stroke-width="2" rx="8"/>
    <text x="370" y="92" fill="#C92A2A" font-size="12">매집 (본주식)</text>
    <text x="370" y="112" fill="#212529" font-size="11" font-weight="600">D-90 ~ D-30</text>
    <text x="370" y="146" fill="#495057" font-size="11" font-weight="500">차명 분할 매집</text>
    <rect x="480" y="70" width="180" height="100" fill="#C92A2A" stroke="#C92A2A" stroke-width="2" rx="8"/>
    <text x="570" y="92" fill="#FFFFFF" font-size="12">띄움 (풍문 부양)</text>
    <text x="570" y="112" fill="#FFFFFF" font-size="11" font-weight="600">D-30 ~ D-7</text>
    <!-- 번개 아이콘 -->
    <path d="M 555 130 L 575 130 L 565 145 L 580 145 L 555 165 L 565 150 L 555 150 Z" fill="#C49930"/>
    <text x="600" y="146" fill="#FFFFFF" font-size="11" font-weight="500">거래대금 ×3</text>
    <rect x="680" y="70" width="180" height="100" fill="#FFF5F5" stroke="#C92A2A" stroke-width="2" rx="8"/>
    <text x="770" y="92" fill="#C92A2A" font-size="12">전환청구 + 분배</text>
    <text x="770" y="112" fill="#212529" font-size="11" font-weight="600">D-7 ~ D+30</text>
    <!-- 분배 화살표 -->
    <g stroke="#C92A2A" stroke-width="1.5" fill="none">
      <path d="M 720 130 L 740 145"/><path d="M 740 130 L 760 145"/><path d="M 760 130 L 780 145"/>
      <path d="M 780 130 L 800 145"/><path d="M 800 130 L 820 145"/>
    </g>
    <text x="770" y="160" fill="#495057" font-size="11" font-weight="500">매매자 -40%</text>
    <rect x="880" y="70" width="160" height="100" fill="#F1F3F5" stroke="#868E96" stroke-width="2" rx="8"/>
    <text x="960" y="92" fill="#495057" font-size="12">이탈 / 신규 CB</text>
    <text x="960" y="112" fill="#212529" font-size="11" font-weight="600">D+30 ~</text>
    <text x="960" y="140" fill="#868E96" font-size="11" font-weight="500">사이클 재시작</text>
  </g>
  <!-- 시간 눈금 -->
  <g font-family="Pretendard, sans-serif" font-size="11" fill="#868E96" text-anchor="middle">
    <text x="170" y="190">D-180</text><text x="370" y="190">D-90</text><text x="570" y="190">D-30</text><text x="770" y="190">D-7 / D+0</text><text x="960" y="190">D+30</text>
  </g>
  <text x="1090" y="195" text-anchor="end" font-family="Pretendard, sans-serif" font-size="11" fill="#868E96">가상 사례 (㈜D 모델)</text>
</svg>
</div>

<div class="num-row">
<div class="num-card"><div class="nb-label">회사 시총</div><div class="nb-value">400억 <span class="neg">코스닥</span></div></div>
<div class="num-card"><div class="nb-label">CB 발행</div><div class="nb-value"><span class="am">100억</span></div></div>
<div class="num-card"><div class="nb-label">전환가/현재가</div><div class="nb-value">5,000 / 6,200원 <span class="am">+24%</span></div></div>
</div>

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
"운영자금 100억 = 정상 회사 활동" 오인 → DART CB 공시 미열람 → D-7 전환청구 후 D+30 분배 절정 매수 → -40%</div>
<div class="defense"><span class="label">매매자 인지·대응</span>
<strong>CB 발행 공시 30일 윈도우 = 진입 차단 (-15 페널티)</strong>. 본주식 매집 + 풍문 부양은 별개 (D-90 ~ D-30 거래대금 ×2 + RSI ≤ 30 + CB 공시 30일 외 = 진입 후보)</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
사례 5 = 11원칙 §7 "CB 종목 회피" 직격. <strong>전건 회피 (사용 0건)</strong>. 단, 본주식 매집 단계 (CB 공시 30일 외) + 거래대금 ×2 + 1분봉 RSI 30 + MA20 터치 = 분단위 스캘핑 진입 후보.</div>

<div class="timeline">
<span class="here">D-180 매집</span><span>D-90 띄움</span><span>D-7 전환청구</span><span>D+30 분배</span><span>D+60 이탈</span>
</div>

**📍 본 슬라이드 HTML mockup**: `lab/poc-design-sample.html` (Q-046b PoC C 사례 5 단계 1)

---

<div class="brand">● 100M1S</div>

<div class="phase-label">SLIDE 7 · CASE 6 · 무자본 M&A</div>

# **사례 6** — 회사 돈으로 회사 사기

> **가상 사례 (㈜M 모델)** — 무자본 M&A 인수 행위주체 관찰
> D-90 인수자 ㈜H (자기자본 0, 사채 200억)가 ㈜M (시총 600억, 자산 250억) 경영권 인수 + 50% 프리미엄으로 진입.
> 인수 후 30일 자산 매각 → 사채 200억 상환 → 자기자본 0 무자본 M&A 확정 패턴.
> D-30 "신사업 진출" 공시 + 풍문 부양 → D-3 16:30 제3자배정 신주 공시 → D+0 분배 시점.

<div class="svg-figure">
<svg width="1000" height="200" viewBox="0 0 1000 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="1000" height="200" fill="#FFFFFF"/>
  <!-- 3 단계 bar chart: 인수 → 자산매각 → 공시 -->
  <g font-family="Pretendard, sans-serif">
    <text x="500" y="22" text-anchor="middle" font-size="13" font-weight="800" fill="#212529">㈜M 자산 변화 (시총 600억 / 인수 후 30일)</text>
    <!-- 축 -->
    <line x1="80" y1="160" x2="940" y2="160" stroke="#212529" stroke-width="1.5"/>
    <line x1="80" y1="50" x2="80" y2="160" stroke="#212529" stroke-width="1.5"/>
    <!-- 3 bar -->
    <g>
      <rect x="160" y="60" width="180" height="100" fill="#1864AB"/>
      <text x="250" y="178" text-anchor="middle" font-size="11" font-weight="700" fill="#212529">D-90 인수 직전</text>
      <text x="250" y="55" text-anchor="middle" font-size="11" font-weight="800" fill="#1864AB">자산 250억</text>
    </g>
    <g>
      <rect x="410" y="100" width="180" height="60" fill="#C49930"/>
      <text x="500" y="178" text-anchor="middle" font-size="11" font-weight="700" fill="#212529">D+0 인수 직후</text>
      <text x="500" y="95" text-anchor="middle" font-size="11" font-weight="800" fill="#C49930">자산 150억 (-40%)</text>
    </g>
    <g>
      <rect x="660" y="140" width="180" height="20" fill="#C92A2A"/>
      <text x="750" y="178" text-anchor="middle" font-size="11" font-weight="700" fill="#212529">D+60 자산 매각 후</text>
      <text x="750" y="135" text-anchor="middle" font-size="11" font-weight="800" fill="#C92A2A">자산 50억 (-80%)</text>
    </g>
    <!-- 화살표 (감소) -->
    <line x1="340" y1="80" x2="410" y2="115" stroke="#C49930" stroke-width="2" marker-end="url(#arrowM)"/>
    <line x1="590" y1="125" x2="660" y2="148" stroke="#C92A2A" stroke-width="2" marker-end="url(#arrowM2)"/>
    <defs>
      <marker id="arrowM" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M 0 0 L 6 4 L 0 8 z" fill="#C49930"/></marker>
      <marker id="arrowM2" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M 0 0 L 6 4 L 0 8 z" fill="#C92A2A"/></marker>
    </defs>
  </g>
  <text x="990" y="195" text-anchor="end" font-family="Pretendard, sans-serif" font-size="11" fill="#868E96">가상 사례 (㈜M 모델)</text>
</svg>
</div>

<div class="num-row">
<div class="num-card"><div class="nb-label">인수자 자기자본</div><div class="nb-value"><span class="neg">0원</span> (사채 200억)</div></div>
<div class="num-card"><div class="nb-label">인수 프리미엄</div><div class="nb-value"><span class="am">+50%</span></div></div>
<div class="num-card"><div class="nb-label">D+60 자산</div><div class="nb-value">50억 <span class="neg">-80%</span></div></div>
</div>

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
"경영권 변경 = 신성장 호재" 매수 → "신사업 진출" 공시 + 거래대금 ×3 추격 → 제3자배정 신주 분배 → D+60 자산 -80% = <strong>폭락</strong></div>
<div class="defense"><span class="label">매매자 인지·대응</span>
<strong>인수자 설립 1년 미만 = 게이트 차단</strong>. DART 자산 처분 공시 30일 = 즉시 청산. 분기 자산 -50% = 즉시 시장가 청산</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
사례 6 = "자기자본 0 인수" 검증 게이트 (G2+). DART 인수 공시 + 인수자 설립일 + 자기자본 SoT 매핑 의무. 패턴 3 (띄움) "신사업 + 거래대금 ×3" = 분단위 스캘핑 진입은 <strong>눌림 시에만 + 손절 -3%</strong>.</div>

<div class="timeline">
<span>D-90 인수</span><span class="here">D-30 신사업</span><span>D-3 제3자배정</span><span>D+0 분배</span><span>D+60 자산노출</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">SLIDE 8 · CASES 7~10 · 합본</div>

# **사례 7~10** — 핵심 변칙만

<div class="svg-figure">
<svg width="1000" height="140" viewBox="0 0 1000 140" xmlns="http://www.w3.org/2000/svg">
  <rect width="1000" height="140" fill="#FFFFFF"/>
  <!-- 4 사례 핵심 매커니즘 아이콘 row -->
  <g font-family="Pretendard, sans-serif">
    <!-- 사례 7 CFD: 5배 레버리지 -->
    <rect x="40" y="30" width="200" height="80" fill="#FFF5F5" stroke="#C92A2A" stroke-width="2" rx="8"/>
    <text x="140" y="52" text-anchor="middle" font-size="11" font-weight="800" fill="#C92A2A">사례 7 · CFD</text>
    <text x="140" y="74" text-anchor="middle" font-size="13" font-weight="800" fill="#212529">레버리지 ×5</text>
    <text x="140" y="94" text-anchor="middle" font-size="11" fill="#495057">외국계 익명성 + 마진콜</text>
    <!-- 사례 8 라임: 1조원 사모 -->
    <rect x="270" y="30" width="200" height="80" fill="#FFF5F5" stroke="#C92A2A" stroke-width="2" rx="8"/>
    <text x="370" y="52" text-anchor="middle" font-size="11" font-weight="800" fill="#C92A2A">사례 8 · 라임 사모</text>
    <text x="370" y="74" text-anchor="middle" font-size="13" font-weight="800" fill="#212529">1조원 환매중단</text>
    <text x="370" y="94" text-anchor="middle" font-size="11" fill="#495057">NAV 부풀리기 + 청산</text>
    <!-- 사례 9 임상: 거래대금 ×7 -->
    <rect x="500" y="30" width="200" height="80" fill="#FFF5F5" stroke="#C92A2A" stroke-width="2" rx="8"/>
    <text x="600" y="52" text-anchor="middle" font-size="11" font-weight="800" fill="#C92A2A">사례 9 · 바이오 임상</text>
    <text x="600" y="74" text-anchor="middle" font-size="13" font-weight="800" fill="#212529">거래대금 ×7 (D-7)</text>
    <text x="600" y="94" text-anchor="middle" font-size="11" fill="#495057">친인척 5명 사전 매집</text>
    <!-- 사례 10 테마: 5종목 동시 -->
    <rect x="730" y="30" width="200" height="80" fill="#FFF5F5" stroke="#C92A2A" stroke-width="2" rx="8"/>
    <text x="830" y="52" text-anchor="middle" font-size="11" font-weight="800" fill="#C92A2A">사례 10 · 테마 그룹</text>
    <text x="830" y="74" text-anchor="middle" font-size="13" font-weight="800" fill="#212529">5종목 동시 -10%</text>
    <text x="830" y="94" text-anchor="middle" font-size="11" fill="#495057">대장 분배 → 잔여 매물</text>
  </g>
  <text x="990" y="135" text-anchor="end" font-family="Pretendard, sans-serif" font-size="11" fill="#868E96">가상 사례 (4 모델 통합)</text>
</svg>
</div>

| 사례 | 핵심 메커니즘 | 대표 결정 (회피·진입) |
|---|---|---|
| **7 CFD SG증권** | CFD 익명성 + 5배 레버리지 매집 (2~3년 잠복) → 마진콜 = 8종목 동시 하한가 (2023.04.24~27 SG증권 사태 패턴) | **외국계 창구 ≥ 30% = 진입 금지**. 8종목 동시 -10% = 즉시 청산. G3 미만 절대 진입 X |
| **8 라임 사모펀드** | "사모 = 안전" 마케팅 1조원 모집 → 부실자산 +200% 매입 NAV 부풀리기 → 환매 중단 = 청산 시퀀스 | **사모펀드 시총 5%+ 보유 = 진입 금지**. DART 환매 중단 = 즉시 청산 + 영구 차단 |
| **9 바이오 임상** | CTO 사전 인지 + 친인척 5명 D-30 매집 → D-7 풍문 거래대금 ×7 → D-day 16:30 임상 결과 공시 → D+1 09~11 분배 | **임상 종료~공시 거래대금 ×5 = -15**. 임상 결과 공시 16:00~17:30 = 익일 진입 금지 |
| **10 테마 그룹** | 테마 5종목+ 매집 + 통합 마케팅 동시 부양 → 대장 분배 → 2~3등 매물 → 동시 -10% 사망 | **거래대금 1등 (대장)만 진입** (11원칙 §1). 테마 5종목 동시 -10% = 즉시 청산. 다음 테마 Rotation 추적 (검색기 우선순위) |

<div class="principle-line"><span class="label">매매 원칙 (4 사례 통합)</span>
사례 10 = <strong>대표 사용 비율 가장 높음</strong> (11원칙 §1 직격, STRAT-001). 사례 7·8·9 = 전건 회피 (G2~G3 시뮬레이션 한정). 공통 회피 = <strong>"외국계 창구 비중 + 사모펀드 보유 + 임상 윈도우" 3축 검증</strong>.</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">SLIDE 9 · CASE 11 · 회계감사 의견거절</div>

# **사례 11** — 재무제표 신뢰 붕괴

<div class="svg-figure">
<svg width="1100" height="160" viewBox="0 0 1100 160" xmlns="http://www.w3.org/2000/svg">
  <rect width="1100" height="160" fill="#FFFFFF"/>
  <!-- 가로 timeline + 적색 escalation -->
  <line x1="60" y1="100" x2="1040" y2="100" stroke="#DEE2E6" stroke-width="2"/>
  <!-- 5 단계 박스 (적색 강도 escalation) -->
  <g font-family="Pretendard, sans-serif" font-size="11" font-weight="800" text-anchor="middle">
    <rect x="80" y="60" width="160" height="80" fill="#FFF5F5" stroke="#FFA8A8" stroke-width="2" rx="8"/>
    <text x="160" y="82" fill="#C92A2A" font-size="11">D-180 · 위장</text>
    <text x="160" y="105" fill="#212529" font-size="11" font-weight="500">매출 +52% YoY 부풀림</text>
    <text x="160" y="120" fill="#212529" font-size="11" font-weight="500">관계회사 거짓 매출</text>
    <rect x="260" y="55" width="160" height="85" fill="#FFE3E3" stroke="#FF8787" stroke-width="2" rx="8"/>
    <text x="340" y="78" fill="#C92A2A" font-size="11">D-90 · 풍문</text>
    <text x="340" y="100" fill="#212529" font-size="11" font-weight="500">신용잔고 18→92억</text>
    <text x="340" y="118" fill="#212529" font-size="11" font-weight="500">카페 +52% 호재</text>
    <rect x="440" y="50" width="160" height="90" fill="#FFA8A8" stroke="#FA5252" stroke-width="2" rx="8"/>
    <text x="520" y="76" fill="#FFFFFF" font-size="11">D-15 · 사전 분배</text>
    <text x="520" y="100" fill="#FFFFFF" font-size="11" font-weight="500">감사 의견거절 통보</text>
    <text x="520" y="118" fill="#FFFFFF" font-size="11" font-weight="500">차명 12계좌 분할매도</text>
    <rect x="620" y="45" width="160" height="95" fill="#FA5252" stroke="#C92A2A" stroke-width="2" rx="8"/>
    <text x="700" y="74" fill="#FFFFFF" font-size="11">D+0 · 의견거절</text>
    <text x="700" y="98" fill="#FFFFFF" font-size="11" font-weight="600">DART 감사보고서 공시</text>
    <text x="700" y="116" fill="#FFFFFF" font-size="11" font-weight="600">"매출 인식 부적정"</text>
    <rect x="800" y="40" width="220" height="100" fill="#C92A2A" stroke="#A01528" stroke-width="2" rx="8"/>
    <text x="910" y="70" fill="#FFFFFF" font-size="11">D+1 · 거래정지</text>
    <text x="910" y="92" fill="#FFFFFF" font-size="11" font-weight="700">CEO 징역 7년 (1심)</text>
    <text x="910" y="112" fill="#FFFFFF" font-size="11" font-weight="700">매매자 영구 손실</text>
  </g>
  <!-- 시간 눈금 -->
  <g font-family="Pretendard, sans-serif" font-size="11" fill="#868E96" text-anchor="middle">
    <text x="160" y="155">D-180</text><text x="340" y="155">D-90</text><text x="520" y="155">D-15</text><text x="700" y="155">D+0</text><text x="910" y="155">D+1</text>
  </g>
  <text x="1090" y="158" text-anchor="end" font-family="Pretendard, sans-serif" font-size="11" fill="#868E96">가상 사례 (㈜U 모델)</text>
</svg>
</div>

> **가상 사례 (㈜U 모델)** — 회계 부정 + 사전인지 분배 행태 관찰
> 현장 대화 기록 (가상): "D-180 CEO U + CFO 합의 — 다음 분기 매출 +50% 부풀려서 표시. 관계회사 ㈜W2와 거짓 매출 거래 100억. 외부 감사 통과 가능 수준."
> 차명 12계좌로 D-180 ~ D-90 매집 60만주, 평균 13,000원 패턴.
> D-15 외부 감사인 의견거절 검토 통보 → CEO 사전 인지 → 차명 12계좌 분할매도 시작 = **사전 통보 분배 절정** 행태.
> D+0 16:30 DART 감사보고서 공시: "관계회사 매출 인식 부적정 = **의견거절**". D+1 09:00 거래정지.

<div class="num-row">
<div class="num-card"><div class="nb-label">매출 위장</div><div class="nb-value">+52% YoY <span class="neg">(실제 +0%)</span></div></div>
<div class="num-card"><div class="nb-label">신용잔고</div><div class="nb-value">18억 → 92억 <span class="neg">+411%</span></div></div>
<div class="num-card"><div class="nb-label">사후 1심</div><div class="nb-value">CEO <span class="neg">징역 7년</span></div></div>
</div>

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
"분기 매출 ×1.5 호재" 카페 폭증 + 사모펀드 신규 진입 보고 추격 → D-15 거래대금 폭증을 "조정 매수 기회" 인식 → D+1 거래정지 = <strong>영구 손실</strong></div>
<div class="defense"><span class="label">매매자 인지·대응 (회피만)</span>
<strong>관계회사 매출 비중 ≥ 30% = -15 / 재고회전율 ×2 악화 = -10 / 감사인 변경 1년 + 매출 +50% YoY = -20 / 감사 의견 한정·의견거절·부적정 = 진입 차단 게이트 + 영구 차단</strong></div>
</div>

<div class="principle-line"><span class="label">매매 원칙 + 법무 검증 권고 (Q-016)</span>
사례 11 = <strong>회피만 (시드 0%, G2 기준에서도 진입 권한 0)</strong>. 재무제표 신뢰 붕괴 = 펀더멘털 자체 위험 = 영구 회피. <strong>법무팀 LEGAL-001 §3.1 인용: 모든 의견거절이 작전은 아님 — 매매자 회피 가이드로만 활용 (Q-016 v2 외부 변호사 자문 후 결정)</strong>.</div>

<div class="timeline">
<span>D-180 위장</span><span>D-90 풍문</span><span>D-30 감사</span><span class="here">D-15 사전분배</span><span>D+0 의견거절</span><span>D+1 거래정지</span>
</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">SLIDE 10 · CB §5.X · 고급 패턴</div>

# **CB 고급 §5.X** — 리픽싱 + 풋옵션 무한 사이클

> **개념 정의** — CB 고급 메커니즘
> 리픽싱(Refixing): 주가 하락 시 전환가 자동 하향 조정. 한도 70% (공격적) = 발행가의 30%까지 전환가 인하 가능.
> 풋옵션(Put Option): CB 보유자가 만기 전 원금+이자 청구권. 세력 행태 = 본주식 분배 + 풋옵션 차익 + 신규 CB 인수 = **무한 사이클** 구조.

<div class="svg-figure">
<svg width="700" height="280" viewBox="0 0 700 280" xmlns="http://www.w3.org/2000/svg">
  <rect width="700" height="280" fill="#FFFFFF"/>
  <!-- 7 패턴 원형 배치 -->
  <g font-family="Pretendard, sans-serif" font-size="11" font-weight="800" fill="#FFFFFF" text-anchor="middle">
    <!-- center label -->
    <text x="350" y="135" text-anchor="middle" font-size="13" font-weight="800" fill="#C92A2A">CB 무한 사이클</text>
    <text x="350" y="152" text-anchor="middle" font-size="11" font-weight="500" fill="#495057">P1→P2→P6→P7→P5→P9→P1</text>
    <!-- 7 nodes (원형) -->
    <circle cx="350" cy="40" r="24" fill="#C92A2A"/><text x="350" y="44">P1</text><text x="350" y="22" font-size="11" fill="#212529" font-weight="700">매집</text>
    <circle cx="490" cy="90" r="24" fill="#C92A2A"/><text x="490" y="94">P2</text><text x="540" y="92" font-size="11" fill="#212529" font-weight="700" text-anchor="start">매집후털기</text>
    <circle cx="540" cy="200" r="24" fill="#C92A2A"/><text x="540" y="204">P6</text><text x="580" y="202" font-size="11" fill="#212529" font-weight="700" text-anchor="start">재매집</text>
    <circle cx="430" cy="250" r="24" fill="#C92A2A"/><text x="430" y="254">P7</text><text x="430" y="278" font-size="11" fill="#212529" font-weight="700">다시분배</text>
    <circle cx="270" cy="250" r="24" fill="#C92A2A"/><text x="270" y="254">P5</text><text x="270" y="278" font-size="11" fill="#212529" font-weight="700">분배</text>
    <circle cx="160" cy="200" r="24" fill="#C92A2A"/><text x="160" y="204">P9</text><text x="120" y="202" font-size="11" fill="#212529" font-weight="700" text-anchor="end">이탈경합</text>
    <circle cx="210" cy="90" r="24" fill="#C92A2A"/><text x="210" y="94">P3</text><text x="160" y="92" font-size="11" fill="#212529" font-weight="700" text-anchor="end">띄움</text>
  </g>
  <!-- 화살표 (원형 사이클) -->
  <g stroke="#C49930" stroke-width="2" fill="none">
    <path d="M 374 50 Q 440 50 470 78" marker-end="url(#arrowC)"/>
    <path d="M 510 110 Q 560 150 540 178" marker-end="url(#arrowC)"/>
    <path d="M 530 222 Q 490 250 454 250" marker-end="url(#arrowC)"/>
    <path d="M 406 250 Q 350 268 294 250" marker-end="url(#arrowC)"/>
    <path d="M 246 250 Q 200 230 175 220" marker-end="url(#arrowC)"/>
    <path d="M 145 180 Q 130 130 188 100" marker-end="url(#arrowC)"/>
    <path d="M 232 78 Q 290 50 326 48" marker-end="url(#arrowC)"/>
  </g>
  <defs><marker id="arrowC" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M 0 0 L 6 4 L 0 8 z" fill="#C49930"/></marker></defs>
  <text x="690" y="272" text-anchor="end" font-family="Pretendard, sans-serif" font-size="11" fill="#868E96">가상 사례 (CB 고급 §5.X 구조)</text>
</svg>
</div>

| 변칙 (6건) | 메커니즘 | 식별 신호 | 패턴 매핑 |
|---|---|---|---|
| 리픽싱 한도 70% (공격적) | 발행 시점 하락 비대칭 차익 사전 확보 | DART CB 조건 70% 한도 | P1 (매집) |
| 1회차 리픽싱 발동 | 주가 -30% → 전환가 자동 인하 | 1회차 리픽싱 공시 | P2 (매집후털기) |
| 1회차 후 부양 | 인하된 전환가 기준 추가 차익 확보 | 거래대금 ×3 + 풍문 재가속 | P6 (재매집/재띄움) |
| 2회차 리픽싱 | 추가 하락 → 전환가 추가 인하 | 2회차 리픽싱 공시 | P7 (다시 분배) |
| 풋옵션 행사 1주 전 풍문 | "사채 상환 호재" 추격매수 유인 | 카페 "사채 상환" + 풋옵션 D-7 | P5 (분배) |
| **풋옵션 + 신규 CB 인수** | 무한 사이클 시작 | 신규 CB 발행 공시 + 30일 회피 | P9 → P1 (재매집) |

<div class="twoside">
<div class="adversary"><span class="label">세력 행태 (관찰)</span>
"1회 사이클 분석 = 다음 사이클 진입 가능" 오인 → 리픽싱 후 부양에 추격 → 풋옵션 행사 시점 분배 폭격 → 신규 CB 발행 시 다시 매집 단계 진입 = <strong>무한 손실</strong></div>
<div class="defense"><span class="label">매매자 인지·대응</span>
<strong>신규 CB 발행 공시 = 새 사이클 매집 시작 = 다시 30일 회피</strong>. 풋옵션 D-7 카페 풍문 = 진입 금지. 리픽싱 한도 70% = -10 페널티 + 30일 회피</div>
</div>

<div class="principle-line"><span class="label">매매 원칙</span>
사례 5.X = 11원칙 §7 직격 + 무한 사이클 함정. <strong>CB 종목 = 매집·재매집 모든 시점 회피</strong>. 다음 사이클 진입 0%. 리픽싱·풋옵션 메커니즘 = 식별 + 영구 차단 게이트.</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">SLIDE 11 · 부록 G 매트릭스 · 패턴별 우선순위</div>

# **9패턴 우선순위** — 매매 직결 SoT

| 패턴 | 사례 수 | 대표 매매 정수 매핑 (STRAT-001 §6.5/6.8) | 우선순위 |
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

<div class="principle-line"><span class="label">강력 강조: 패턴 1·3·5·9</span>
<strong>P1 (매집) = 식별 / P3 (띄움) = 진입 본질 / P5 (분배) = 회피 본질 / P9 (이탈경합) = 진입 보류</strong>. 12 사례 전체 ✓✓ = 4 패턴 = <strong>매매 의사결정 90% 차지</strong>.<br>
<strong>본인 파동 × 세력 파동 = 교집합 = 수익구간</strong> (STRAT-002 §0.2). 세력에게 놀아나는 매매자의 반대 = 세력의 관점 = 대표의 진입.</div>

---

<div class="brand">● 100M1S</div>

<div class="phase-label">SLIDE 12 · 매매자 자가체크리스트 + 결론</div>

# **자가체크리스트** — 매매 진입 직전 5분

<div class="svg-figure">
<svg width="1100" height="200" viewBox="0 0 1100 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="1100" height="200" fill="#FFFFFF"/>
  <!-- 좌: 3×4 체크박스 grid -->
  <g font-family="Pretendard, sans-serif" font-size="11" fill="#212529">
    <!-- row 1 -->
    <rect x="40" y="20" width="180" height="36" fill="#E7F5FF" stroke="#1864AB" stroke-width="1.5" rx="4"/>
    <rect x="50" y="30" width="16" height="16" fill="#1864AB" rx="2"/><path d="M 53 38 L 58 43 L 64 33" stroke="#FFFFFF" stroke-width="2" fill="none"/>
    <text x="76" y="42" font-weight="700">1. CB·M&amp;A 30일 윈도우</text>
    <rect x="240" y="20" width="180" height="36" fill="#E7F5FF" stroke="#1864AB" stroke-width="1.5" rx="4"/>
    <rect x="250" y="30" width="16" height="16" fill="#1864AB" rx="2"/><path d="M 253 38 L 258 43 L 264 33" stroke="#FFFFFF" stroke-width="2" fill="none"/>
    <text x="276" y="42" font-weight="700">2. 거래대금 1등 (대장)</text>
    <rect x="440" y="20" width="180" height="36" fill="#E7F5FF" stroke="#1864AB" stroke-width="1.5" rx="4"/>
    <rect x="450" y="30" width="16" height="16" fill="#1864AB" rx="2"/><path d="M 453 38 L 458 43 L 464 33" stroke="#FFFFFF" stroke-width="2" fill="none"/>
    <text x="476" y="42" font-weight="700">3. 카페 작성자 ≥ 6명</text>
    <!-- row 2 -->
    <rect x="40" y="68" width="180" height="36" fill="#E7F5FF" stroke="#1864AB" stroke-width="1.5" rx="4"/>
    <rect x="50" y="78" width="16" height="16" fill="#1864AB" rx="2"/><path d="M 53 86 L 58 91 L 64 81" stroke="#FFFFFF" stroke-width="2" fill="none"/>
    <text x="76" y="90" font-weight="700">4. 신용잔고 -10% 이내</text>
    <rect x="240" y="68" width="180" height="36" fill="#E7F5FF" stroke="#1864AB" stroke-width="1.5" rx="4"/>
    <rect x="250" y="78" width="16" height="16" fill="#1864AB" rx="2"/><path d="M 253 86 L 258 91 L 264 81" stroke="#FFFFFF" stroke-width="2" fill="none"/>
    <text x="276" y="90" font-weight="700">5. 호가 30초 취소 ≤ 4회</text>
    <rect x="440" y="68" width="180" height="36" fill="#E7F5FF" stroke="#1864AB" stroke-width="1.5" rx="4"/>
    <rect x="450" y="78" width="16" height="16" fill="#1864AB" rx="2"/><path d="M 453 86 L 458 91 L 464 81" stroke="#FFFFFF" stroke-width="2" fill="none"/>
    <text x="476" y="90" font-weight="700">6. 외국계 창구 &lt; 30%</text>
    <!-- row 3 -->
    <rect x="40" y="116" width="180" height="36" fill="#E7F5FF" stroke="#1864AB" stroke-width="1.5" rx="4"/>
    <rect x="50" y="126" width="16" height="16" fill="#1864AB" rx="2"/><path d="M 53 134 L 58 139 L 64 129" stroke="#FFFFFF" stroke-width="2" fill="none"/>
    <text x="76" y="138" font-weight="700">7. 사모펀드 &lt; 5%</text>
    <rect x="240" y="116" width="180" height="36" fill="#E7F5FF" stroke="#1864AB" stroke-width="1.5" rx="4"/>
    <rect x="250" y="126" width="16" height="16" fill="#1864AB" rx="2"/><path d="M 253 134 L 258 139 L 264 129" stroke="#FFFFFF" stroke-width="2" fill="none"/>
    <text x="276" y="138" font-weight="700">8. RSI≤30 + MA20 + ×2</text>
    <rect x="440" y="116" width="180" height="36" fill="#E7F5FF" stroke="#1864AB" stroke-width="1.5" rx="4"/>
    <rect x="450" y="126" width="16" height="16" fill="#1864AB" rx="2"/><path d="M 453 134 L 458 139 L 464 129" stroke="#FFFFFF" stroke-width="2" fill="none"/>
    <text x="476" y="138" font-weight="700">9. 윗꼬리 ≥+5% NO</text>
    <!-- row 4 -->
    <rect x="40" y="164" width="180" height="32" fill="#E7F5FF" stroke="#1864AB" stroke-width="1.5" rx="4"/>
    <rect x="50" y="172" width="16" height="16" fill="#1864AB" rx="2"/><path d="M 53 180 L 58 185 L 64 175" stroke="#FFFFFF" stroke-width="2" fill="none"/>
    <text x="76" y="184" font-weight="700">10. 5호가 ×2 NO</text>
    <rect x="240" y="164" width="180" height="32" fill="#E7F5FF" stroke="#1864AB" stroke-width="1.5" rx="4"/>
    <rect x="250" y="172" width="16" height="16" fill="#1864AB" rx="2"/><path d="M 253 180 L 258 185 L 264 175" stroke="#FFFFFF" stroke-width="2" fill="none"/>
    <text x="276" y="184" font-weight="700">11. 분당 매도 폭증 NO</text>
    <rect x="440" y="164" width="180" height="32" fill="#E7F5FF" stroke="#1864AB" stroke-width="1.5" rx="4"/>
    <rect x="450" y="172" width="16" height="16" fill="#1864AB" rx="2"/><path d="M 453 180 L 458 185 L 464 175" stroke="#FFFFFF" stroke-width="2" fill="none"/>
    <text x="476" y="184" font-weight="700">12. 정정·중단 16:00~ NO</text>
  </g>
  <!-- 우: 신뢰 방패 -->
  <g>
    <path d="M 780 30 L 1020 30 L 1020 130 Q 1020 165 900 195 Q 780 165 780 130 Z" fill="#1864AB" stroke="#1864AB" stroke-width="2"/>
    <text x="900" y="80" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="20" font-weight="800" fill="#FFFFFF">매매자</text>
    <text x="900" y="108" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="20" font-weight="800" fill="#FFFFFF">자기방어</text>
    <text x="900" y="138" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="13" font-weight="600" fill="#FFFFFF">12 체크 PASS</text>
    <text x="900" y="160" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="13" font-weight="600" fill="#FFFFFF">→ 진입 후보</text>
  </g>
  <text x="1090" y="195" text-anchor="end" font-family="Pretendard, sans-serif" font-size="11" fill="#868E96">강의 자료 SoT</text>
</svg>
</div>

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
<div class="adversary"><span class="label">세력 vs 매매자 양면 박스 12건 요약 (STRAT-002 §3.2)</span>
사례 1·2·3·4·5·5.X·6·7·8·9·10·11 = <strong>세력 행태 12건 + 매매자 인지·대응 12건 + 매매 원칙 12건</strong>. EDU-002 §부록 G 매트릭스 정합.</div>
<div class="defense"><span class="label">회피 78건 재분류 (STRAT-002 §2.3)</span>
"사용 13건 / 회피 78건 / 미경험 26건" → <strong>"세력 동행 진입 / 매매자 함정 / 관찰"</strong> 4축 신규 분류로 v2 격상 의무 (대표 본인 확인 대기, Q-045 휴지 신규 spawn).</div>
</div>

<div class="principle-line"><span class="label">결론 — 매매자의 자기방어 체크리스트</span>
세력은 매집 → 띄움 → 분배 → 이탈을 반복하는 행태가 관찰된다. 매매자가 함정에 빠지는 이유는 이 4단계 흐름을 인지하지 못하기 때문이다. <strong>본인 파동 × 세력 파동 = 교집합 = 수익구간</strong>. P3 (띄움) 진입 + P5 (분배) 청산만 한다. 패턴 1·5·9는 12/12 사례 전체 = 매매 의사결정 90% 차지.<br>
<strong>"세력 행태를 인지하는 만큼 매매자는 함정을 회피하고, 세력 수익 구간을 역으로 추출할 수 있다."</strong> — STRAT-002 §0.1</div>

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

<small class="meta">
DOC-20260504-LEGAL-001 §3.5 5조항 12줄 인용 정합 / EDU-002 v0.2.1-bis LEGAL P0-4 marker 9쌍 본문 포함 (PPT는 lab/ 라우트 별도, 5중 차단 + 워터마크 + 슬라이드 12 LEGAL로 외부 노출 위험 차단) / DSN-003 §4 슬라이드 12 wireframe 정합 / 빌드 시 LEGAL P0-4 marker 사이 콘텐츠 sed 사전 제거 의무 (DSN-003 §13.4)
</small>

<!-- ================================================================================ -->
<!-- LEGAL P0-4 EXCLUDE BLOCK — source-only mirror (slide 본문 인용 0건)              -->
<!-- EDU-002 v0.2.1-bis 9쌍 marker 본문 source 보존 (DSN-003 §12.4 + §13.4 정합).      -->
<!-- 빌드 시 marker 사이 콘텐츠 sed 사전 제거 (Marp .pptx/.pdf/.html 모두 인용 0건).   -->
<!-- 명령: sed -e '/LEGAL_P0_4_EXCL_START/,/LEGAL_P0_4_EXCL_END/d' (실제 패턴은 hyphen) -->
<!-- ================================================================================ -->

[case 3 — 텔레그램·카페 알바 풍문 작전]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 자율 매매 매뉴얼 (토구사 본인용 — 학습·시뮬레이션 가설)
> [법무팀 LEGAL-001 §3.1·§3.3 인용] 본 매뉴얼은 토구사 자체 학습·백테스트 시뮬레이션 가설이며, 실거래 적용 매매 가이드 아님. 풍문 단계 = §178 부정거래 의심 윈도우이므로 본 매뉴얼 적용은 풍문 출처 적법성 검증 후 한정. dev-lead 후속 P0-4 빌드 제외 대상.

- **회피·관찰 우선**: 풍문 단계 (D-15 ~ D-7) 카페 게시 ≥ 평소 ×15 + 작성자 다양성 5명 미만 = **풍문 작전 의심 윈도우 → 진입 금지 (게이트 차단)**
- 학습 시뮬레이션 가설 (실거래 미적용): 풍문 채널 적법성 검증(작성자 다양성 ≥ 10명 + IP 분산 ≥ 5국가 + 후속 검증 가능 IR 출처) + 거래대금 ≥ 200억 + 1분봉 RSI ≤ 30 동시 충족 시에만 백테스트 검증 가설로 사용. 실거래 적용 시점 = 외부 변호사 자문 후 v2 결정.
- 강제 청산: "MOU/양해각서/추후 협의/구속력 없음" 키워드 공시 발견 즉시
- 비중: 시드 3% (G2 기준, 풍문 작전 의심 종목 보수적) — **단, G1 단계 토구사는 본 케이스 진입 권한 0**
<!-- LEGAL-P0-4-EXCLUDE-END -->

[case 4 — 허위공시 작전]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 자율 매매 매뉴얼 (토구사 본인용 — 학습·시뮬레이션 가설)
> [법무팀 LEGAL-001 §3.1·§3.3 인용] 본 매뉴얼은 토구사 자체 학습·백테스트 시뮬레이션 가설이며, 실거래 적용 매매 가이드 아님. 풍문 단계 = 작전 의심 윈도우이므로 본 매뉴얼 적용은 미공개정보 의심도 검증 후 한정. dev-lead 후속 P0-4 빌드 제외 대상.

- **회피·관찰 우선**: 풍문 단계 (D-15 ~ D-7) 거래대금 ≥ 200억 + 본 계약 키워드 공시 0건 = **작전 의심 윈도우 → 진입 금지 (게이트 차단)**
- 학습 시뮬레이션 가설 (실거래 미적용): 거래대금 ≥ 200억 + 1분봉 RSI ≤ 30 + MA10 터치 + 미공개정보 누출 신호 부재 (친인척 매수 공시 0건 + 공시 직전 거래량 평소 ×3 미만) 동시 충족 시에만 백테스트 검증 시드 가설로 사용. 실거래 적용 시점 = 외부 변호사 자문 후 v2 결정.
- 강제 청산: "MOU/양해각서/검토중" 키워드 공시 발견 즉시
- 비중: 시드 5% (G2 기준, 허위공시 위험) — **단, G1 단계 토구사는 본 케이스 진입 권한 0**
<!-- LEGAL-P0-4-EXCLUDE-END -->

[case 5 — CB/BW 헐값 발행]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 자율 매매 매뉴얼 (토구사 본인용)
- 진입 조건: 거래대금 ≥ 평소 ×2 + 1분봉 RSI ≤ 30 + 종가 = MA20 ±1% + CB 공시 30일 외
- 청산 조건: 익절 = 직전 5일 고점 / 손절 = 진입가 -3% / 강제 청산 = 전환청구 공시 즉시
- 비중: 시드 10% (G2 기준)
<!-- LEGAL-P0-4-EXCLUDE-END -->

[case 6 — 무자본 M&A]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 자율 매매 매뉴얼 (토구사 본인용)
- 진입 조건: 거래대금 ≥ 평소 ×3 + 1분봉 RSI ≤ 30 + 인수자 자금 출처 명확 + 인수 후 30일 경과
- 청산 조건: 익절 = +5% / 손절 = -3% / 강제 청산 = 자산 처분 공시 즉시
- 비중: 시드 5% (G2 기준, 무자본 M&A 의심 종목 보수적)
<!-- LEGAL-P0-4-EXCLUDE-END -->

[case 7 — CFD SG증권형]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 자율 매매 매뉴얼 (토구사 본인용)
- 진입 조건: CFD 비중 < 10% + 그룹 동조성 < 5% + 거래대금 ≥ 200억 + 1분봉 RSI ≤ 30 (눌림목)
- 청산 조건: 익절 = +5% / 손절 = -3% / 강제 청산 = 동일 그룹 5종목+ 동시 -10% 시 즉시
- 비중: 시드 3% (G3 기준, CFD 청산 트리거 위험)
<!-- LEGAL-P0-4-EXCLUDE-END -->

[case 8 — 사모펀드 라임형]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 자율 매매 매뉴얼 (토구사 본인용)
- 진입 조건: 사모펀드 보유 < 5% + 환매 이슈 0건 + 거래대금 ≥ 200억
- 청산 조건: 익절 = +5% / 손절 = -3% / 강제 청산 = 펀드 환매 중단 공시 즉시
- 비중: 시드 5% (G2 기준)
<!-- LEGAL-P0-4-EXCLUDE-END -->

[case 9 — 바이오 임상 미공개정보]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 자율 매매 매뉴얼 (토구사 본인용 — 학습·시뮬레이션 가설)
> [법무팀 LEGAL-001 §3.1·§3.3 인용] 본 매뉴얼은 토구사 자체 학습·백테스트 시뮬레이션 가설이며, 실거래 적용 매매 가이드 아님. 임상 미공개정보 윈도우(D-30~D-day) 진입은 §174 위반 위험이므로 **윈도우 외(공시 후 D+30 이후)** 한정. dev-lead 후속 P0-4 빌드 제외 대상.

- **회피·관찰 우선**: 임상 종료~공시 사이 D-30~D-day 윈도우 = **진입 금지 (게이트 차단)**. 본 윈도우 거래대금 폭증 = §174 의심 신호 → 매매 가담 위험
- 학습 시뮬레이션 가설 (실거래 미적용, 임상 미공개정보 윈도우 외 한정): 임상 결과 공시 후 D+30 이후 + 거래대금 ≥ 200억 + 1분봉 RSI ≤ 30 + 친인척 매수 공시 0건 + 후속 임상 실패 신호 부재 동시 충족 시에만 백테스트 검증 가설로 사용. 실거래 적용 시점 = 외부 변호사 자문 후 v2 결정.
- 강제 청산: 임상 결과 공시 직전 일봉 윗꼬리 시 + 친인척 매수 공시 발견 즉시
- 비중: 시드 3% (G2 기준, 바이오 변동성 위험) — **단, G1 단계 토구사는 본 케이스 진입 권한 0**
<!-- LEGAL-P0-4-EXCLUDE-END -->

[case 10 — 테마 그룹 동시 작전]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 자율 매매 매뉴얼 (토구사 본인용)
- 진입 조건: 테마 대장(거래대금 1등) + 거래대금 ≥ 300억 + 1분봉 RSI ≤ 30 + 테마 5종목 동시 폭증 단계 아님
- 청산 조건: 익절 = +5% / 손절 = -3% / 강제 청산 = 테마 5종목 동시 -10% 시 즉시 (테마 사망)
- 비중: 시드 10% (G2 기준, 대장만 진입 시 가장 안정적)
<!-- LEGAL-P0-4-EXCLUDE-END -->

[case 11 — 회계감사 의견거절·한정·강조사항]
<!-- LEGAL-P0-4-EXCLUDE-START -->
### 자율 매매 매뉴얼 (토구사 본인용 — 학습·시뮬레이션 가설)
> [법무팀 LEGAL-001 §3.1·§3.3 인용] 본 매뉴얼은 토구사 자체 학습·백테스트 시뮬레이션 가설이며, 실거래 적용 매매 가이드 아님. 감사 의견거절 윈도우(감사 보고서 작성 D-15~D-day) 사전 통보 분배 의심 = §174 미공개정보 가담 위험. dev-lead 후속 P0-4 빌드 제외 대상.

- **회피·관찰 우선**: 감사 보고서 작성 단계 (D-15 ~ D-7) 거래대금 폭증 + 신용잔고 감소 = **사전 통보 분배 의심 윈도우 → 진입 금지 (게이트 차단)**
- 학습 시뮬레이션 가설 (실거래 미적용): 감사 보고서 발표 후 **거래정지 해제 + 적정 의견 + 관계회사 매출 비중 < 20% + 재고회전율 정상화** 동시 충족 시에만 백테스트 검증 가설로 사용. 실거래 적용 시점 = 외부 변호사 자문 후 v2 결정.
- 강제 청산: DART 감사 의견 "한정/의견거절/부적정/계속기업 불확실" 공시 발견 즉시
- 비중: 시드 0% (G2 기준에서도 본 케이스 진입 권한 0) — **재무제표 신뢰 붕괴 = 펀더멘털 자체 위험 = 영구 회피**
<!-- LEGAL-P0-4-EXCLUDE-END -->

<!-- ================================================================================ -->
<!-- END LEGAL P0-4 EXCLUDE BLOCK                                                     -->
<!-- ================================================================================ -->
