(() => {
  const state = { data: null };

  const el = (id) => document.getElementById(id);
  const escape = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // repo 표시명 매핑 — 데이터 코드(summary 키·RND/REQ-BYBIAS·필터 value)는 수렴태그·이력
  // 보존 위해 BYBIAS 유지, 사용자에게 보이는 표시 텍스트만 ByVias로(ByBias→ByVias 리브랜딩,
  // DOC-20260614-REQ-001). 나머지 repo는 그대로 — 동적 서비스 발견과 정합(하드코딩 트랙 0).
  const repoDisplay = (repo) => (repo === "BYBIAS" ? "ByVias" : repo);

  // ── 디스플레이-바운더리 sanitize (rules/security.md 9종 · 방어선 이중화) ──
  // 빌드 단계 sanitize 게이트(scripts/admin/build_convergence.py)가 1차이나,
  // romanized 에이전트명(ishikawa/togusa 등)이 owner 셀에서 누락된 사례 발견 →
  // 표시 직전 한 번 더 일반화하여 내부 코드네임이 DOM 에 절대 닿지 않게 함(FLR-20260406-TEC-001
  // 동형 = 한쪽 코드만 fix·romanized 변종 누락 재발 방지). 의미 보존 위해 일반화(삭제 X).
  // 디스플레이 게이트(클라이언트 백스톱) — build_convergence.py mask_text/generalize_persona
  // 와 양 layer 동기화 의무(FLR-20260406-TEC-001 동형 = 한쪽만 fix·변종 누락 재발 회피).
  // 서버가 true-0 생성하나, JSON 변조·캐시 stale 대비 동일 역할 라벨로 2차 봉쇄.
  // 순서: 내부 메모리 wiki-link 통째 제거 → 페르소나 일반화(긴 한글 키 먼저) → 로마자
  // 슬러그(\b 단어경계, vc 등 정상 단어 보호) → doc_id → 이메일 → 경로.
  const SANITIZE_RULES = [
    [/\[\[[^\]]*\]\]/g, ""],        // 내부 메모리 wiki-link([[slug]]) 제거
    [/조니종합/g, "총괄종합"],      // 복합어 우선(부분문자열 "조니"보다 먼저)
    [/타치코마/g, "AI 시스템"],
    [/이시카와/g, "뉴스분석"],
    [/토구사/g, "투자분석"],
    [/픽셀 퍼펙셔니스트/g, "픽셀 정렬 패널"],
    [/디터 람스/g, "재료 정직성 패널"],
    [/조니/g, "총괄 심사 패널"],
    [/휴지|박성진/g, "운영자"],
    [/ishikawa/gi, "뉴스분석"],   // 이시카와(뉴스분석팀) 역할 라벨 — 의미 보존
    [/togusa/gi, "투자분석"],     // 토구사(주식투자팀)
    [/tachikoma/gi, "AI 시스템"], // 타치코마(오케스트레이터)
    [/hugepark/gi, "운영자"],
    [/(?<![A-Za-z0-9])jony(?![A-Za-z0-9])/gi, "총괄 심사 패널"],
    [/(?<![A-Za-z0-9])pixel(?![A-Za-z0-9])/gi, "디자인 심사 패널"],
    [/(?<![A-Za-z0-9])guestpool(?![A-Za-z0-9])/gi, "손님 패널"],
    [/(?<![A-Za-z0-9])honesty(?![A-Za-z0-9])/gi, "정직성 심사"],
    [/(?<![A-Za-z0-9])critic(?![A-Za-z0-9])/gi, "비평 패널"],
    // 🔴 백엔드 build_convergence.py PERSONA_GENERALIZE/SANITIZE_PERSONA_RE 와 양 layer 동기
    //   (REQ-ADMIN-20260615-018·FLR-20260406-TEC-001 동형 = 한쪽만 등재·변종 누락 봉쇄).
    //   신축 CADENCE(데이터 계측)·MERIDIAN(시스템 심사) 패널 슬러그가 프론트 백스톱에 누락 →
    //   라이브 DOM cadence 31건·meridian 4건 누출(R6 honesty·meridian P1). 앞 경계
    //   (?<![A-Za-z0-9])는 '_'·구두점·한글을 경계 인정(MEASUREMENT_honesty·_jury_·meridian의
    //   회피 봉쇄), 끝 경계 (?![A-Za-z0-9])는 staffing/service 오손상 0. romanized + 한글 표기.
    [/(?<![A-Za-z0-9])staff-engineer(?![A-Za-z0-9])/gi, "시스템 심사 패널"],
    [/(?<![A-Za-z0-9])meridian(?![A-Za-z0-9])/gi, "시스템 심사 패널"],
    [/(?<![A-Za-z0-9])staff(?![A-Za-z0-9])/gi, "시스템 심사 패널"],
    [/(?<![A-Za-z0-9])cadence(?![A-Za-z0-9])/gi, "데이터 계측 패널"],
    // REQ-ADMIN-20260615-022 (P1-B·meridian/조니 2심 적발): 패널 슬러그 'legal'이 3 layer
    //   (PERSONA_GENERALIZE·SANITIZE_PERSONA_RE·프론트 SANITIZE_RULES) 어디에도 미등재 →
    //   BYBIAS r53/r54 패널 라벨 '패널: legal(critical)' 라이브 DOM 13건 누출. 백엔드 dev가
    //   PERSONA_GENERALIZE+SANITIZE_PERSONA_RE 등재(roster-derived 게이트로 자동 강제), 본 프론트
    //   백스톱은 양 layer 동기(FLR-20260406-TEC-001 동형·한쪽만 fix 봉쇄). 🔴 case-sensitive(소문자
    //   only·/i 제거): doc_id 'LEGAL-…'·'-LEGAL-'(대문자 토큰)을 자연 배제해야 doc_id 룰이 '내부코드'로
    //   처리(시뮬레이션 확인: /gi 면 'LEGAL-20260614-001'→'법무 패널-…' 오손상). 끝 경계 (?![A-Za-z0-9-])
    //   에 하이픈 포함 → 소문자 'legal-001' 형 식별자도 배제, 'legalize'/'illegal' 오손상 0. 앞 경계
    //   (?<![A-Za-z0-9])로 '_legal'·콜론/공백 경계 인정. 패널 슬러그는 항상 소문자 'legal(critical)' 형.
    [/(?<![A-Za-z0-9])legal(?![A-Za-z0-9-])/g, "법무 패널"],
    // RND-ADMIN-007 R8 (roster 게이트 적발·legal 동형): PM320 판정 패널 슬러그
    //   'marketreliability'(RND-PM320-063)·'pickresult'(RND-PM320-064)가 3 layer 미등재 →
    //   백엔드 build_convergence.py PERSONA_GENERALIZE+SANITIZE_PERSONA_RE 등재(roster-derived
    //   게이트로 자동 강제), 본 프론트 백스톱 양 layer 동기(FLR-20260406-TEC-001 동형·한쪽만
    //   fix 봉쇄). coined slug 단독 토큰(소문자, 정상 산문 부분문자열 부재 → 과치환 0)이라
    //   /gi 표준 분기(cadence 동형) — legal 의 case-sensitive 특례(LEGAL- doc_id 충돌)는 불요.
    [/(?<![A-Za-z0-9])marketreliability(?![A-Za-z0-9])/gi, "시장 신뢰성 패널"],
    [/(?<![A-Za-z0-9])pickresult(?![A-Za-z0-9])/gi, "픽 결과 패널"],
    [/(?<![A-Za-z0-9])translator(?![A-Za-z0-9])/gi, "번역 심사"],
    [/(?<![A-Za-z0-9])jury(?![A-Za-z0-9])/gi, "심사단"],
    [/(?<![A-Za-z0-9])vc(?![A-Za-z0-9])/gi, "투자 심사"],
    [/메리디언/g, "시스템 심사 패널"],
    [/케이던스/g, "데이터 계측 패널"],
    // ByBias → ByVias 리브랜딩 (REQ-ADMIN-20260615-020·REQ-003 흡수·백엔드 mask_text 동기).
    //   free-text mixed-case 'ByBias'만 (라이브 83건) — 대문자 식별자 'BYBIAS'(summary 키·
    //   필터 value·req_id)는 case-sensitive 불일치로 자연 배제(repoDisplay 가 표시단 변환).
    [/ByBias/g, "ByVias"],
    // doc_id 패턴 — build_convergence.py SANITIZE_DOC_CODE_RE 와 매칭 범위 1:1 포팅(양 layer
    // 동기화 의무, FLR-20260406-TEC-001 동형 = 한쪽만 fix·변종 누락 봉쇄). 기존 협소 패턴
    // (FLR|DOC 접두 + 날짜형/[A-Z]+ tail만)이 무-날짜 단형(JDG-001/REQ-031/DSN-001/FLR-005)·
    // 32종 TYPE·카테고리형(FLR-AGT-002)을 누락 → 백엔드 확장과 발산(판정단 적발). repo-scope
    // 식별자(REQ-BYBIAS-…/RND-HOME-…/PM320)는 화이트리스트 접두 불일치 또는 둘째 토큰 비숫자로
    // 자연 배제(과마스킹 0). 끝 경계 = (?!\d) (백엔드 주석: \b는 한글 조사 경계 미성립 + 숫자
    // 연장 FLR-AGT-0021 오인 방지). _DOC_CODE_TYPES = repo-scope 슬롯(HOME/BYBIAS/PM320/INFRA/
    // SWEEP/VRD/RND/Q) 제외, REQ는 REQ-\d 숫자 직후만(REQ-BYBIAS는 자연 배제).
    [/\b(?:DOC|FLR|DSN|REQ|JDG|MIN|RPT|DEC|LEGAL|SPEC|AGT|AUDIT|QA|BRS|EDU|TEC|PRC|DAT|STRAT|RULE|REPORT|OPT|PLAN|DES|BEN|PLN|HANDOFF|REVIEW|GUIDE|EXP|ADR|MTG)-(?:\d{8}(?:-[A-Za-z]+)*-(?:\d+|[A-Za-z][\w-]*)|(?:AGT|DAT|TEC|CRON|PRC)-\d{1,4}|\d{1,4})(?!\d)/g, "내부코드"], // doc_id 패턴 (백엔드 SANITIZE_DOC_CODE_RE 1:1)
    [/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, "(이메일)"],
    [/(\/Users\/|~\/company\/)\S*/g, "(내부경로)"],
  ];
  function sanitizeText(s) {
    let t = String(s == null ? "" : s);
    for (const [re, repl] of SANITIZE_RULES) t = t.replace(re, repl);
    return t;
  }
  // escape + sanitize 동시 적용(자유 텍스트 전용). code/id 등 구조 필드엔 escape 만.
  const safe = (s) => escape(sanitizeText(s));

  // ── REQ-ADMIN-20260615-011 (P1·마크다운 렌더) ──
  //   요청 narrative·blocked_reason·verdict headline/improvements 등 자유 텍스트에 raw 마크다운
  //   (**bold** 155쌍·`백틱코드` 124건)이 그대로 덤프되어 펼침 시 가장 안 편한 화면(guestpool P1-2).
  //   경량 인라인 렌더: 이미 escape+sanitize 된 안전 문자열에 한해 **굵게**→<strong>, `코드`→<code>
  //   로 변환(XSS 안전 — escape 후 마크업만 삽입·태그 신규 생성 0). 블록 요소(헤더·리스트)는 카드
  //   구조가 이미 담당하므로 인라인만. 내부 경로/doc_id 는 sanitizeText 가 선마스킹(보안 유지).
  //   커밋해시(백틱 안 7~40 hex)는 9종 보안 카테고리 외(admin=noindex 내부용)이나 raw 백틱 제거 +
  //   8자 단축 표기로 가독 정리. 이모지 배지(🟢🔴⚖️ 등)는 의미 신호라 보존(strip 안 함).
  function mdInline(escaped) {
    let t = String(escaped == null ? "" : escaped);
    // `코드` — 백틱 쌍. 내부가 순수 hex(커밋해시)면 8자 단축(전체는 title 로 보존).
    t = t.replace(/`([^`]+)`/g, (_, code) => {
      const isHash = /^[0-9a-f]{7,40}$/i.test(code);
      const shown = isHash ? code.slice(0, 8) : code;
      const titleAttr = isHash && code.length > 8 ? ` title="${code}"` : "";
      return `<code class="md-code"${titleAttr}>${shown}</code>`;
    });
    // **굵게** — escape 후 '*' 는 보존되므로 안전. 비탐욕·줄바꿈 불허(한 토큰).
    //   먼저 줄바꿈 없는 짝 → 다음 줄바꿈 포함 짝(원본 데이터가 긴 문장 가로지름).
    t = t.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // 짝 안 맞는 잔여 ** (원본이 'P1-1**' 처럼 비정형 절단) 제거 — raw 마크업 노출 방지.
    //   ***·**** 등 연쇄도 흡수. 정상 텍스트에 ** 의도 사용은 거의 없음(요청 본문=메타 로그).
    t = t.replace(/\*\*+/g, "");
    return t;
  }
  // 자유 텍스트 + 마크다운 렌더 동시 적용 (safe 의 마크다운-aware 버전).
  const mdSafe = (s) => mdInline(safe(s));

  function badge(text, cls) {
    return `<span class="badge ${cls || ""}">${escape(text)}</span>`;
  }

  // 빈 상태(empty-state) — 데이터 0건일 때 백지 대신 한 줄 안내(사용자 인지 부하↓·"고장?" 오인 방지).
  // table tbody 용: colspan 행. 본 어드민은 data.json 이 빈 스텁(convergence.json 만 채워짐)일 때
  // 요청·에이전트·릴리스·FLR·참여자·audit 탭이 백지가 되던 문제 해소.
  function emptyRow(cols, msg) {
    return `<tr class="empty-row"><td colspan="${cols}">${escape(msg)}</td></tr>`;
  }
  function emptyHint(msg) {
    return `<p class="hint empty-hint">${escape(msg)}</p>`;
  }

  // REQ-ADMIN-20260615-006 (P0·freshness 정직): 전역 헤더 '데이터 생성' 시각이 전 탭 공통
  //   단일값(convergence.json 6/15)을 표시 → data.json 기반 레거시 7탭(요청·사이클·에이전트·
  //   릴리스·FLR·참여자·audit)이 빈 스텁/stale 인데도 '오늘 데이터' 위장(honesty P0-2 적발).
  //   탭마다 그 탭이 읽는 데이터 소스의 실제 생성 시각을 표시(소스별 freshness 정직 고지).
  //   - 수렴 탭 = convergence.json generated_at (라이브 6/15).
  //   - 레거시 탭(data.json 기반) = data.json generated_at. 빈 스텁("")이면 '레거시 데이터 미생성'
  //     명시(거짓 신선도 0·FLR-AGT-002). convergence.json 로드 실패 fallback 시도 data.json 동일.
  const CONV_TAB = "convergence";
  function updateHeaderFreshness(name) {
    const elGen = el("generated-at");
    if (!elGen) return;
    if (name === CONV_TAB) {
      const iso = state.convGeneratedAt || "";
      elGen.textContent = iso
        ? "데이터 생성: " + String(iso).slice(0, 19).replace("T", " ")
        : "데이터 생성: 미상";
      elGen.title = "수렴 데이터(convergence.json) 빌드 시각";
    } else {
      const iso = (state.data && state.data.generated_at) || "";
      elGen.textContent = iso
        ? "데이터 생성: " + String(iso).slice(0, 19).replace("T", " ")
        : "이 탭 데이터: 미생성 (레거시 집계 data.json 비어 있음)";
      elGen.title = "이 탭이 읽는 데이터(data.json)의 빌드 시각 — 수렴 탭과 별개 소스";
    }
  }

  function activateTab(name) {
    const tab = document.querySelector(`.tab[data-tab="${name}"]`);
    const panel = el("tab-" + name);
    if (!tab || !panel) return false;
    document.querySelectorAll(".tab").forEach((x) => {
      x.classList.remove("active");
      x.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    panel.classList.add("active");
    updateHeaderFreshness(name);   // REQ-006: 탭별 데이터 소스 freshness 정직 표기
    return true;
  }

  // REQ-ADMIN-20260615-010 (P1·드릴다운): 결단보드 행 클릭 → 해당 요청 카드로 점프.
  //   요청별 진행 상태 섹션(#conv-req-cards)은 수렴 탭 내부 → 탭 전환 불요. 카드 id=rqcard-<rid>.
  //   카드를 펼치고(scrollIntoView) 잠시 하이라이트(시각 피드백). 없으면 무동작(정직·거짓 점프 0).
  function jumpToReqCard(rid) {
    if (!rid) return;
    const card = document.getElementById("rqcard-" + rid);
    if (!card) return;
    if (card.tagName === "DETAILS") card.open = true;
    try { card.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_) { card.scrollIntoView(); }
    card.classList.remove("rq-jump-hl");
    // reflow 후 클래스 재부여 → 애니메이션 재시작 (연속 클릭 시에도 깜빡임 보장).
    void card.offsetWidth;
    card.classList.add("rq-jump-hl");
    setTimeout(() => card.classList.remove("rq-jump-hl"), 1800);
  }

  // REQ-010: stat 타일 클릭 → 요청 섹션을 해당 분류(막힘/결정대기)로 필터 + 스크롤.
  //   상태 필터(window.__convReqStateFilter)를 세팅하고 검색 draw 재실행(요청 카드 렌더가 참조).
  //   blocked = classifyBlocked==='blocked', wait = 'wait'. 검색창은 건드리지 않음(별 축).
  function applyReqFilter(kind) {
    state.reqStateFilter = kind;        // 'blocked' | 'wait'
    if (typeof state.redrawReqCards === "function") state.redrawReqCards();
    const sec = el("conv-req-cards");
    if (sec) {
      try { sec.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (_) { sec.scrollIntoView(); }
    }
  }

  // RND-ADMIN-008 P0-B (조니·design·guestpool): data.json 빈 스텁이면 그 소스를 읽는
  //   7탭(요청·사이클·에이전트·릴리스·FLR·참여자·audit)이 백지 dead-end (8탭 중 1탭만 동작 =
  //   "라벨은 잔뜩, 콘텐츠는 1탭" 거짓 풍요). 미연결 탭을 nav에서 비활성('준비 중') 처리해
  //   거짓 풍요 제거 + 클릭 dead-end 0. data.json 채워지면(Phase 2) 자동 재활성(데이터 구동·하드코딩 0).
  const DATA_JSON_TABS = ["requests", "timeline", "agents", "releases", "flr", "people", "audit"];
  // data.json 이 실데이터를 담았는지 — records/agents/releases/audit.rows 중 하나라도 비어있지 않으면 '채워짐'.
  function dataJsonHasContent() {
    const d = state.data || {};
    const audit = d.audit || {};
    return (
      (Array.isArray(d.records) && d.records.length > 0) ||
      (Array.isArray(d.agents) && d.agents.length > 0) ||
      (Array.isArray(d.releases) && d.releases.length > 0) ||
      (Array.isArray(audit.rows) && audit.rows.length > 0)
    );
  }
  // 미연결 탭 비활성화 — 버튼 자체를 disabled + aria-disabled + '준비 중' 배지. 활성 탭이
  //   비활성 대상이면 수렴 탭으로 강제 이동(빈 화면 랜딩 0). 채워진 상태면 무동작(전 탭 정상).
  function applyTabAvailability() {
    if (dataJsonHasContent()) return;  // 데이터 있으면 8탭 전부 정상
    let activeWasDisabled = false;
    for (const name of DATA_JSON_TABS) {
      const tab = document.querySelector(`.tab[data-tab="${name}"]`);
      if (!tab) continue;
      tab.classList.add("tab-soon");
      tab.setAttribute("aria-disabled", "true");
      tab.setAttribute("tabindex", "-1");
      tab.setAttribute("title", "Phase 2 예정 — 이 탭의 데이터(data.json)는 아직 연결되지 않았습니다");
      if (!tab.querySelector(".tab-soon-badge")) {
        const badge = document.createElement("span");
        badge.className = "tab-soon-badge";
        badge.setAttribute("aria-hidden", "true");
        badge.textContent = "준비 중";
        tab.appendChild(badge);
      }
      if (tab.classList.contains("active")) activeWasDisabled = true;
    }
    if (activeWasDisabled) activateTab(CONV_TAB);  // 빈 탭 랜딩 방지 — 수렴 탭으로
  }

  function setupTabs() {
    document.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        // 미연결(준비 중) 탭은 활성화 차단 — dead-end 진입 0.
        if (t.getAttribute("aria-disabled") === "true") return;
        activateTab(t.dataset.tab);
        // 해시 동기화 — 새로고침·공유 시 같은 탭 복원 (#convergence 등)
        if (history.replaceState) history.replaceState(null, "", "#" + t.dataset.tab);
        else location.hash = t.dataset.tab;
      });
    });
    // 미연결 탭 비활성화 (data.json 빈 스텁 시) — 초기 탭 결정 전에 적용.
    applyTabAvailability();
    // 초기 탭: URL 해시(#convergence 등) 우선, 없으면 디폴트(HTML active=수렴) 유지.
    // 조니 P1-B — 여는 즉시 수렴 뷰가 첫 화면. 해시 딥링크도 지원.
    //   단 해시가 비활성(준비 중) 탭을 가리키면 무시(빈 화면 딥링크 0).
    const hash = (location.hash || "").replace(/^#/, "");
    if (hash) {
      const hashTab = document.querySelector(`.tab[data-tab="${hash}"]`);
      if (hashTab && hashTab.getAttribute("aria-disabled") !== "true") activateTab(hash);
    }

    // [2단계] 탭 nav 가로 오버플로우 끝 페이드 — 좌/우 잔량 있을 때만 해당 끝 페이드(audit 잘림 해소).
    //   끝까지 스크롤 시 마지막 탭 완전 노출(상시 페이드가 audit 가리는 문제 회피). 1px 여유 = 라운딩 가드.
    const nav = document.querySelector(".tabs");
    if (nav) {
      const updateFade = () => {
        const maxScroll = nav.scrollWidth - nav.clientWidth;
        nav.classList.toggle("tabs-fade-l", nav.scrollLeft > 1);
        nav.classList.toggle("tabs-fade-r", nav.scrollLeft < maxScroll - 1);
      };
      nav.addEventListener("scroll", updateFade, { passive: true });
      window.addEventListener("resize", updateFade);
      // 활성 탭이 화면 밖이면 보이게 스크롤(딥링크로 audit 진입 시 등).
      const active = nav.querySelector(".tab.active");
      if (active && active.scrollIntoView) {
        try { active.scrollIntoView({ inline: "nearest", block: "nearest" }); } catch (_) {}
      }
      updateFade();
    }
  }

  function renderRequests() {
    const records = state.data.records || [];
    const reqs = records.filter((r) =>
      r.type === "REQ" || /REQ-/.test(r.doc_id)
    );

    const statuses = [...new Set(reqs.map((r) => r.status).filter(Boolean))].sort();
    const sel = el("req-status");
    sel.innerHTML = '<option value="">전체 status</option>' +
      statuses.map((s) => `<option value="${escape(s)}">${escape(s)}</option>`).join("");

    const draw = () => {
      const q = el("req-search").value.trim().toLowerCase();
      const stf = sel.value;
      const filtered = reqs.filter((r) => {
        if (stf && r.status !== stf) return false;
        if (!q) return true;
        const hay = [
          r.doc_id, r.title, r.project, r.trigger,
          (r.tags || []).join(" "),
          (r.participants || []).join(" "),
          r.author,
        ].join(" ").toLowerCase();
        return hay.includes(q);
      });
      filtered.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      el("req-count").textContent = `${filtered.length} / ${reqs.length}`;
      if (!filtered.length) {
        el("req-tbody").innerHTML = emptyRow(6,
          reqs.length ? "검색·필터 조건에 맞는 요청이 없습니다." : "표시할 요청 데이터가 없습니다 (data.json 미생성).");
        return;
      }
      el("req-tbody").innerHTML = filtered.map((r) => {
        const trig = r.trigger
          ? `<span class="trigger">트리거: ${escape(r.trigger)}</span>`
          : "";
        const prio = r.priority
          ? badge(r.priority, String(r.priority).toLowerCase())
          : "";
        return `
        <tr class="req-row">
          <td><code>${escape(r.doc_id)}</code></td>
          <td>${escape(r.type)}</td>
          <td>${escape(r.date)}</td>
          <td>${escape(r.status || "-")}</td>
          <td>${prio}</td>
          <td>${escape(r.title || "")}${trig}</td>
        </tr>`;
      }).join("");
    };

    el("req-search").addEventListener("input", draw);
    sel.addEventListener("change", draw);
    draw();
  }

  function renderTimeline() {
    const counts = (state.data.req_status && state.data.req_status.by_status) || {};
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
      el("timeline-summary").innerHTML = emptyHint("표시할 status 집계가 없습니다 (data.json 미생성). 수렴 탭의 ‘활동 추세’·‘상태 스냅샷’을 참고하세요.");
      return;
    }
    const cards = entries
      .map(([k, v]) => `<div class="card"><div class="k">${escape(k)}</div><div class="v">${v}</div></div>`)
      .join("");
    el("timeline-summary").innerHTML = `<div class="summary-cards">${cards}</div>`;
  }

  function renderAgents() {
    const rows = state.data.agents || [];
    if (!rows.length) { el("agents-tbody").innerHTML = emptyRow(4, "에이전트 카탈로그 데이터가 없습니다 (data.json 미생성)."); return; }
    el("agents-tbody").innerHTML = rows.map((a) => `
      <tr>
        <td><code>${escape(a.name)}</code></td>
        <td>${a.has_agent_md ? "O" : "-"}</td>
        <td>${a.agent_md_bytes || 0}</td>
        <td>${escape(a.summary || "")}</td>
      </tr>`).join("");
  }

  function renderReleases() {
    const rows = state.data.releases || [];
    if (!rows.length) { el("releases-tbody").innerHTML = emptyRow(4, "릴리스(commit log) 데이터가 없습니다 (data.json 미생성)."); return; }
    el("releases-tbody").innerHTML = rows.map((c) => `
      <tr>
        <td>${escape((c.date || "").slice(0, 19).replace("T", " "))}</td>
        <td><code>${escape(c.hash.slice(0, 8))}</code></td>
        <td>${escape(c.author)}</td>
        <td>${escape(c.subject)}</td>
      </tr>`).join("");
  }

  function renderFlr() {
    const stats = state.data.flr_stats || {};
    const records = state.data.records || [];
    const flrs = records.filter((r) =>
      (r.doc_id || "").startsWith("FLR-") || r.type === "FLR"
    );
    flrs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const total = stats.total || 0;
    const byStatus = stats.by_status || {};
    const byMonth = stats.by_month || {};
    const cards = `
      <div class="card"><div class="k">total</div><div class="v">${total}</div></div>
      ${Object.entries(byStatus).map(([k, v]) =>
        `<div class="card"><div class="k">${escape(k)}</div><div class="v">${v}</div></div>`
      ).join("")}
    `;
    const monthList = Object.entries(byMonth).map(([m, v]) =>
      `<span class="badge">${escape(m)}: ${v}</span>`
    ).join(" ");
    el("flr-summary").innerHTML = `
      <div class="summary-cards">${cards}</div>
      <div class="hint">월별: ${monthList}</div>
    `;

    if (!flrs.length) { el("flr-tbody").innerHTML = emptyRow(4, "FLR 레코드가 없습니다 (data.json 미생성)."); return; }
    el("flr-tbody").innerHTML = flrs.map((r) => `
      <tr>
        <td><code>${escape(r.doc_id)}</code></td>
        <td>${escape(r.date)}</td>
        <td>${escape(r.status || "-")}</td>
        <td>${escape(r.title || "")}</td>
      </tr>`).join("");
  }

  function renderPeople() {
    const records = state.data.records || [];
    const counts = new Map();
    for (const r of records) {
      for (const p of (r.participants || [])) {
        if (typeof p !== "string") continue;
        counts.set(p, (counts.get(p) || 0) + 1);
      }
    }
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (!rows.length) { el("people-tbody").innerHTML = emptyRow(2, "참여자 집계 데이터가 없습니다 (data.json 미생성)."); return; }
    el("people-tbody").innerHTML = rows.map(([p, c]) =>
      `<tr><td>${escape(p)}</td><td>${c}</td></tr>`
    ).join("");
  }

  // audit state 토큰(active/idle/zombie/unknown) → 표시 라벨(한국어 고정).
  // CSS 클래스(.dot.zombie 등)는 영문 토큰을 그대로 쓰므로 클래스 인자엔 미적용 —
  // 표시 텍스트만 한글화(회사 전 화면 한국어 룰). 미정의 토큰은 stateMeta 경유 '미상'.
  const AUDIT_STATE_LABEL = { active: "활동", idle: "유휴", zombie: "좀비", unknown: "미상" };
  function auditStateLabel(s) { return AUDIT_STATE_LABEL[s] || stateMeta(s).label; }

  function renderAudit() {
    const audit = state.data.audit || { rows: [], counts: {}, thresholds: {} };
    const cards = Object.entries(audit.counts || {})
      .map(([k, v]) =>
        `<div class="card"><div class="k">${escape(auditStateLabel(k))}</div><div class="v">${v}</div></div>`
      ).join("");
    const th = audit.thresholds || {};
    const thHint = `임계값: 유휴 ≥${th.idle_h ?? "?"}h · 좀비 ≥${th.zombie_h ?? "?"}h`;
    el("audit-summary").innerHTML = `
      <div class="summary-cards">${cards}</div>
      <p class="hint">${thHint}</p>
    `;

    const rows = (audit.rows || []).slice().sort((a, b) => {
      const order = { zombie: 0, idle: 1, unknown: 2, active: 3 };
      const ao = order[a.state] ?? 9, bo = order[b.state] ?? 9;
      if (ao !== bo) return ao - bo;
      return (b.idle_h || 0) - (a.idle_h || 0);
    });

    if (!rows.length) { el("audit-grid").innerHTML = emptyHint("에이전트 활동 audit 데이터가 없습니다 (data.json 미생성)."); return; }
    el("audit-grid").innerHTML = rows.map((r) => {
      const last = (r.last_seen || r.last_record_date || "").slice(0, 10);
      const idleTxt = r.idle_h != null
        ? `유휴 ${r.idle_h}h · 최근 ${last || "-"}`
        : "records 미흔적";
      return `
        <div class="audit-card" role="group" aria-label="${escape(r.name)} ${escape(auditStateLabel(r.state))}">
          <span class="dot ${escape(r.state)}" aria-hidden="true"></span>
          <div class="info">
            <span class="name">${escape(r.name)}</span>
            <span class="sub">${badge(auditStateLabel(r.state), r.state)} · ${escape(idleTxt)}</span>
          </div>
        </div>`;
    }).join("");
  }

  // ── 수렴 탭 (convergence.json 파생물 — read-only) ──────────────────────────
  // 거짓 충실성 회피(FLR-AGT-002): count/state가 null/unknown이면 그대로 노출(0 색칠 금지).

  function convStateClass(s) {
    return ({ "수렴": "conv-ok", "판정완료": "conv-cand", "미수렴": "conv-no",
      "진행중": "conv-prog" })[s] || "";
  }

  function verdictClass(v) {
    return ({ YES: "conv-ok", NO: "conv-no", "조건부": "conv-cand" })[v] || "";
  }
  // verdict 토큰 → 표시 라벨(한국어 고정). REQ-ADMIN-20260615-013 (P1·R5 재적발):
  //   종전 YES/NO 영문 잔존(상태 배지는 한글화됐으나 verdict 토큰만 영문) → 전 화면 한국어 룰
  //   (2026-06-14 대표 직접 지시) 정합 한글화. 표시만 한글, CSS 클래스(verdictClass)·데이터
  //   토큰(YES/NO/조건부)은 이력·정합 위해 영문 유지(라벨↔토큰 분리). 조건부=YES도 NO도 아닌
  //   미수렴 사유 동반(부분 충족). 매핑 밖(영문 'unknown'·공백·미정의)은 stateMeta 경유 '미상'.
  function verdictLabel(v) {
    return ({ YES: "통과", NO: "미통과", "조건부": "조건부" })[v] || stateMeta(v).label;
  }

  // null = unknown(파싱 불가). 거짓 0 금지 — '?' 로 명시.
  function numOrUnknown(n) {
    return n == null ? '<span class="conv-unknown" title="파싱 불가(추정 금지)">?</span>' : String(n);
  }

  // 상태 → 평이한 한국어 + 진행률(%) 매핑. 코드/이모지 노출 X.
  // 진행률은 "요청이 어디까지 갔나"를 직관화 — 종결/배포=100, 진행계열 중간, 보류=정체.
  // pct는 백엔드 progress_pct(요청별 실측)가 우선. 본 fallback은 요청 카드에서 직접
  // 안 쓰고(아래 convReqCard 는 r.progress_pct 우선), 라운드/배지 라벨·색 매핑에만 사용.
  // "대체됨" = 📦 상태마커 보존(보존 의무 c) — 옛 라운드가 후속 수렴 체인에 흡수된 이력.
  const STATE_META = {
    "종결":   { label: "종결",      pct: 100, cls: "conv-ok" },
    "수렴":   { label: "수렴 완료",  pct: 100, cls: "conv-ok" },
    // "배포" = 라이브 반영(90%)·아직 종결 아님 → 종결/수렴(진녹 conv-ok)과 색 겹침 회피
    // 전용 토큰 conv-deploy(청록 teal). 라운드2 P1-1: 배포≡종결 거짓 동일시 해소(정보 손실 0).
    "배포":   { label: "배포됨",     pct: 90,  cls: "conv-deploy" },
    "판정완료": { label: "판정 완료", pct: 70,  cls: "conv-cand" },
    "판정중":  { label: "판정 중",    pct: 60,  cls: "conv-cand" },
    "진행중":  { label: "진행 중",    pct: 55,  cls: "conv-prog" },
    // "포착" = 파이프라인 맨 앞(요청 잡힘·아직 라운드 미진입). 구현중과 색 겹침 회피 위해
    // 전용 토큰 conv-seed(연한 중립). 정보 손실 0(다크모드 제1원칙) — 상태마다 고유 색.
    "포착":   { label: "포착됨",     pct: 10,  cls: "conv-seed" },
    "구현중":  { label: "구현 중",    pct: 50,  cls: "conv-prog" },
    "미수렴":  { label: "미수렴",     pct: 40,  cls: "conv-no" },
    // "보류" = 정체/정지(25%) → 진행중·구현중(평면 회 conv-prog)과 색 겹침 회피 전용 토큰
    // conv-hold(회색 베이스 + 대각 스트라이프 = 정지 신호). 라운드2 P1-1: 구현중≡보류 거짓 동일시
    // 해소. 색 단독 의존 금지(다크모드 제1원칙) → 패턴(스트라이프)·테두리 보조로 4모드 변별.
    "보류":   { label: "보류",      pct: 25,  cls: "conv-hold" },
    // 📦 대체됨 — 옛 라운드가 후속 수렴 체인이 해소(이력 보존·stuck 아님). 보존 의무 (c).
    "대체됨":  { label: "📦 대체됨",  pct: null, cls: "conv-superseded" },
    // 승계 — 🔄/✔️ 후속 요청에 승계·편입된 닫힘(RND-ADMIN-009 P1-①). 라운드 '대체됨'의
    //   요청판(이력 보존·열림 아님). 같은 conv-superseded 색 토큰 재사용(닫힘 계열 일관).
    "승계":   { label: "↪ 승계됨",   pct: 100, cls: "conv-superseded" },
  };
  function stateMeta(s) {
    if (STATE_META[s]) return STATE_META[s];
    // 한국어 룰: 영문 'unknown'·공백 fallback을 '미상'으로(라운드3 1심 손님풀 P1, 모바일 잘림).
    // truthy 'unknown'도 포함 — 백엔드 미상 표기 누출 차단. 거짓 채움 아님(상태 자체가 미상).
    const t = (s || "").trim();
    const label = (!t || t.toLowerCase() === "unknown") ? "미상" : t;
    return { label, pct: null, cls: convStateClass(s) };
  }
  // priority 토큰 → 표시 클래스 (P0~P3). 백엔드는 본문 명시 P0~P3만 채택(추정 0·FLR-AGT-002).
  function prioClass(p) {
    return ({ P0: "prio-p0", P1: "prio-p1", P2: "prio-p2", P3: "prio-p3" })[p] || "";
  }
  // push_status → 라이브 반영 라벨 + 점등 클래스 (추정 0 — 백엔드 'live'|'local_only'|'unknown')
  const PUSH_META = {
    live:       { label: "라이브 반영", cls: "push-live" },
    local_only: { label: "로컬 미push", cls: "push-local" },
    unknown:    { label: "반영 미상",   cls: "push-unknown" },
  };
  function pushMeta(s) { return PUSH_META[s] || PUSH_META.unknown; }
  // REQ-ADMIN-20260615-007 (P0·open/closed SSOT 통일): 종전 프론트 정의 ["종결","수렴","배포"]가
  //   백엔드 build_convergence.py compute_summary 의 open 정의(배포·수렴·종결=closed)와 정합.
  //   REQ-ADMIN-20260615-021 (P1-A·cadence/조니 2심 적발): 종전 CLOSED_STATES=["종결"]이 백엔드
  //   summary.open_requests(배포·수렴·종결 closed)와 발산 → glance(L988)·카드그룹헤더(L1892)가
  //   isOpenState 로 독립 재집계 시 PM320 open=8 vs repoSummary/번다운(백엔드 SSOT)=3 동시 노출.
  //   라이브 cross-check(2026-06-15): summary.open_requests PM320=3·BYBIAS=5 = 3종 closed 계산값
  //   확정 → 본 상수를 백엔드 실 동작에 1:1 동기(["배포","종결","수렴"])하여 같은 화면 모든
  //   컴포넌트(glance·카드헤더·정렬·repoSummary·번다운) open 단일값 보장. R6 REQ-007 fix가
  //   repoSummary↔번다운↔결단보드 3컴포넌트만 summary.open_requests 통일하고 glance·카드헤더
  //   2곳을 미마이그레이션한 half-applied 의 완전판(전 컴포넌트 단일 출처·부분 통일 금지).
  //   ⚠️ 백엔드 closed 정의 변경 시 본 상수 동기 의무(양 layer 발산 봉쇄·FLR-20260406-TEC-001 동형).
  //   RND-ADMIN-009 P1-①: 백엔드가 '승계'(🔄 승계·✔️ 편입 = 후속요청 흡수 닫힘) 를
  //   CLOSED_REQUEST_STATES 에 추가 → 본 상수도 동기('승계' 누락 시 glance/카드헤더 open 재집계가
  //   백엔드 summary.open_requests 와 발산: 라이브 glance open=32 vs 백엔드 27 동시 노출 = 재발).
  const CLOSED_STATES = ["배포", "종결", "수렴", "승계"];
  function isOpenState(s) { return !CLOSED_STATES.includes(s); }
  // 진행·심사 중 라운드 state (지금 활동/카운트용)
  const ACTIVE_ROUND_STATES = ["진행중", "판정중", "구현중", "판정완료", "미수렴"];

  const STATE_ORDER = ["포착", "판정중", "구현중", "배포", "종결", "수렴", "승계", "보류"];
  function stateRank(s) { const i = STATE_ORDER.indexOf(s); return i < 0 ? STATE_ORDER.length : i; }

  // ⓪-a2 [2단계 통합] repo 1행 요약 테이블 — 진단: 같은 6개 서비스를 4번(상태 스냅바·라운드 수렴
  //   스택바·전이 타임라인·svc 스트립) 그려 쌍둥이 중복. → repo당 1줄(repo명·열린 수·막힘 수·수렴 수
  //   ·미니 스택바 1개)로 통합. 4개 차트를 repo당 1줄로 압축(§정보위계 평탄화 해소·above-fold 절약).
  //   데이터 출처(거짓 채움 0·FLR-AGT-002):
  //     - 열린 수 = requests[].state 가 열림(!CLOSED_STATES) 카운트.
  //     - 막힘 수 = requests[].blocked === true 카운트(P0·교착·보류 대기).
  //     - 수렴 수 = rounds[].state === "수렴" 카운트(요청 상태엔 수렴 라벨 없음 → 라운드에서·기존 roundbar 출처 동일).
  //     - 미니 스택바 = requests[].state 100% 구성(색+패턴 이중 인코딩 = 기존 sb-seg 재사용·색맹 안전 유지).
  //   summary 키(동적 발견)와 requests/rounds 양쪽 repo 합집합으로 행 생성(하드코딩 0·N개 확장 안전).
  function renderConvRepoSummary(conv) {
    const host = el("conv-repo-summary");
    if (!host) return;
    const reqs = conv.requests || [];
    const rounds = conv.rounds || [];
    const summary = conv.summary || {};
    if (!reqs.length && !rounds.length && !Object.keys(summary).length) {
      host.innerHTML = `<div class="tl-head">서비스별 요약</div>`
        + `<p class="hint">표시할 서비스가 없습니다.</p>`;
      return;
    }
    // repo → 집계 누산기. 요청 상태 분포(stateCounts·미니바용) + 열림/막힘 + 수렴 라운드.
    const acc = {};
    const ensure = (repo) => (acc[repo] = acc[repo] || {
      stateCounts: {}, open: 0, blocked: 0, converged: 0, totalReq: 0, totalRounds: 0,
    });
    const stateSet = new Set();
    reqs.forEach((r) => {
      const repo = (r.repo && String(r.repo).trim()) || "미상";
      const st = (r.state && String(r.state).trim()) || "미상";
      const a = ensure(repo);
      a.stateCounts[st] = (a.stateCounts[st] || 0) + 1;
      a.totalReq += 1;
      // REQ-ADMIN-20260615-007 (P0·open SSOT 통일): 종전 프론트 isOpenState 독립 재집계가
      //   백엔드 summary.open_requests(closed 정의)와 발산 → PM320 summary.open=8 vs
      //   프론트 재집계=3 동시 노출 사고. open 카운트는 프론트가 정의하지 않고 백엔드 SSOT만
      //   신뢰(아래 백엔드 주입). 여기선 분포(stateCounts)·막힘만 집계, open은 미집계.
      if (r.blocked === true) a.blocked += 1;
      stateSet.add(st);
    });
    rounds.forEach((r) => {
      const repo = (r.repo && String(r.repo).trim()) || "미상";
      const a = ensure(repo);
      a.totalRounds += 1;
      if ((r.state && String(r.state).trim()) === "수렴") a.converged += 1;
    });
    // summary 에만 있고 requests/rounds 엔 없는 repo도 행 보존(동적 발견 정합).
    Object.keys(summary).forEach((repo) => ensure(repo));
    // ── open = 백엔드 summary[repo].open_requests 단일 출처 주입 (REQ-007) ──
    //   프론트는 open 정의(어떤 state가 열림/닫힘인가)를 갖지 않는다. 백엔드 build_convergence.py
    //   compute_summary 가 산출한 open_requests 를 그대로 표시 → 양 layer 동일 값 보장.
    //   summary 미수록 repo(요청/라운드에만 등장·드묾)는 open 미상 → null 표기(거짓 0 금지·정직).
    Object.keys(acc).forEach((repo) => {
      const s = summary[repo];
      acc[repo].open = (s && typeof s.open_requests === "number") ? s.open_requests : null;
    });

    // 정렬: 막힘 많은 순(대표 관심사 = "어디가 막혔나") → 열림 많은 순 → 이름순.
    //   open=null(미상)은 정렬 시 0으로 취급(맨 뒤). 백엔드 SSOT 주입 후라 acc[].open 사용.
    const openOf = (repo) => (typeof acc[repo].open === "number" ? acc[repo].open : 0);
    const repos = Object.keys(acc).sort((a, b) =>
      acc[b].blocked - acc[a].blocked || openOf(b) - openOf(a) || a.localeCompare(b));
    // 미니 스택바 세그먼트 = 등장 상태를 파이프라인 순서로(범례 공통).
    const states = [...stateSet].sort((a, b) => stateRank(a) - stateRank(b) || a.localeCompare(b));
    // 범례 — 색(stateMeta.cls) + 라벨 병기(다크모드 제1원칙: 색만으로 의미 전달 금지).
    const legend = states.map((s) => {
      const m = stateMeta(s);
      return `<span class="sb-leg"><i class="sb-leg-sw ${escape(m.cls)}"></i>`
        + `<span class="sb-leg-k">${escape(m.label)}</span></span>`;
    }).join("");

    // 전체 합계(헤더 요약 — 한눈 총량). open은 백엔드 SSOT 합(null=미상 repo는 제외·정직).
    const tot = repos.reduce((o, repo) => {
      const a = acc[repo];
      if (typeof a.open === "number") o.open += a.open;
      o.blocked += a.blocked; o.converged += a.converged;
      return o;
    }, { open: 0, blocked: 0, converged: 0 });

    const miniBar = (a) => {
      const total = a.totalReq || 1;
      if (!a.totalReq) return `<span class="rs-mini rs-mini-empty" title="요청 없음"></span>`;
      const segs = states.filter((s) => a.stateCounts[s]).map((s) => {
        const n = a.stateCounts[s];
        const m = stateMeta(s);
        const pct = (n / total) * 100;
        return `<span class="sb-seg ${escape(m.cls)} sb-seg-mini" style="width:${pct.toFixed(2)}%"`
          + ` title="${escape(m.label)} ${n}건 (${pct.toFixed(0)}%)" aria-label="${escape(m.label)} ${n}건"></span>`;
      }).join("");
      return `<span class="sb-track rs-mini">${segs}</span>`;
    };

    const rows = repos.map((repo) => {
      const a = acc[repo];
      const blockedCell = a.blocked
        ? `<span class="rs-blocked rs-has">${a.blocked}</span>`
        : `<span class="rs-blocked rs-zero">0</span>`;
      const convCell = a.converged
        ? `<span class="rs-conv rs-has">${a.converged}</span>`
        : `<span class="rs-conv rs-zero">0</span>`;
      const openTxt = typeof a.open === "number" ? a.open : "?";
      return `<div class="rs-row" role="row" aria-label="${escape(repoDisplay(repo))} — 열린 요청 ${openTxt}·막힘(보류 포함) ${a.blocked}·수렴 라운드 ${a.converged}">
        <span class="rs-repo" role="cell">${escape(repoDisplay(repo))}</span>
        <span class="rs-num rs-open" role="cell" title="열린(미종결) 요청 — 백엔드 집계값">${openTxt}</span>
        <span class="rs-num" role="cell" title="막힌 요청 — 보류·결정대기 포함(blocked union)">${blockedCell}</span>
        <span class="rs-num" role="cell" title="수렴한 판정 라운드(요청 아님)">${convCell}</span>
        <span class="rs-bar" role="cell" aria-label="${escape(repoDisplay(repo))} 요청 상태 구성">${miniBar(a)}</span>
      </div>`;
    }).join("");

    host.innerHTML =
      `<div class="tl-head">서비스별 요약
        <span class="tl-sub">repo당 1줄 — 열린 요청·막힘(보류 포함)·수렴 라운드 한눈 + 미니 막대(요청 상태 100% 구성). 합계: 열린 요청 ${tot.open} · 막힘 ${tot.blocked} · 수렴 라운드 ${tot.converged}. 시간별 전이는 아래 ‘상태 추이 펼치기’.</span>
      </div>
      <div class="sb-legend" role="group" aria-label="상태 범례">${legend}</div>
      <div class="rs-table" role="table" aria-label="서비스별 1행 요약">
        <div class="rs-row rs-head-row" role="row">
          <span class="rs-repo" role="columnheader">서비스</span>
          <span class="rs-num" role="columnheader" title="열린(미종결) 요청 수">열린 요청</span>
          <span class="rs-num" role="columnheader" title="막힌 요청 — 보류·결정대기 포함(blocked union). 결단보드 '처리 필요'는 그중 진짜 장애물 subset">막힘<span class="rs-col-note">(보류 포함)</span></span>
          <span class="rs-num" role="columnheader" title="수렴한 판정 라운드 수(요청 아님)">수렴 라운드</span>
          <span class="rs-bar" role="columnheader">상태 분포</span>
        </div>
        ${rows}
      </div>`;
  }

  // ⓪-a4 상태 추이 — state_transitions(실측 ts 보유 사건만)를 시간축 위 repo별 행으로.
  //   위 막대 둘(상태 스냅샷·라운드 수렴)은 '지금' 분포(현재 단면), 본 섹션은 '시간에 따라
  //   상태가 어떻게 바뀌었나'(전이 이력) → 다른 축이라 형제 섹션 분리(§정보위계: 화면=한 메시지).
  //   거짓 충실성 0(FLR-AGT-002): coverage(실측/전체)를 헤더에 그대로 노출. ts 없는 사건은
  //   백엔드가 애초 emit 안 함(소급 미생성) → 빈 시간대는 마커 없음(보간·가짜 점 0).
  //   색·패턴 = stateMeta(s).cls 재사용(적록색맹 패턴 자동 상속). kind = 마커 모양으로 변별,
  //   is_approx = 흐림(opacity)으로 "근사 시각" 정직 표기. is_snapshot = 테두리(전이 아님).
  const TR_KIND_META = {
    verdict_emitted:  { sym: "●", label: "판정" },   // 원: 판정 전이(실측 mtime)
    round_snapshot:   { sym: "◆", label: "라운드" }, // 마름모: 라운드 현재상태 스냅샷
    request_captured: { sym: "▸", label: "요청" },   // 삼각: 요청 발화(근사 시각)
  };
  function trKindMeta(k) { return TR_KIND_META[k] || { sym: "•", label: k || "기타" }; }
  function renderConvTransitions(conv) {
    const host = el("conv-transitions");
    if (!host) return;
    const trs = (conv.state_transitions || [])
      .filter((e) => e && e.ts && !isNaN(Date.parse(e.ts)))
      .map((e) => ({ ...e, t: Date.parse(e.ts) }))
      .sort((a, b) => a.t - b.t);
    const cov = conv.state_timeline_coverage || null;
    if (!trs.length) {
      host.innerHTML = `<div class="tl-head">상태 추이</div>`
        + `<p class="hint">실측 시각을 가진 상태 전이 기록이 없습니다 (거짓 시각 미생성).</p>`;
      return;
    }
    const t0 = trs[0].t, t1 = trs[trs.length - 1].t, span = (t1 - t0) || 1;
    // repo → 전이들. 행 정렬: 전이 많은 repo 먼저(활동 큰 곳), 동률은 이름순.
    const byRepo = {};
    const stateSet = new Set(), kindSet = new Set();
    trs.forEach((e) => {
      const repo = (e.repo && String(e.repo).trim()) || "미상";
      (byRepo[repo] = byRepo[repo] || []).push(e);
      stateSet.add((e.state && String(e.state).trim()) || "미상");
      kindSet.add(e.kind);
    });
    const repos = Object.keys(byRepo).sort((a, b) =>
      byRepo[b].length - byRepo[a].length || a.localeCompare(b));
    // 범례 1: 상태 색(stateMeta.cls 재사용 — 색+라벨 병기, 색 단독 의존 0).
    const states = [...stateSet].sort((a, b) => stateRank(a) - stateRank(b) || a.localeCompare(b));
    const stateLeg = states.map((s) => {
      const m = stateMeta(s);
      return `<span class="sb-leg"><i class="tr-leg-sw ${escape(m.cls)}"></i>`
        + `<span class="sb-leg-k">${escape(m.label)}</span></span>`;
    }).join("");
    // 범례 2: kind 마커 모양(색맹 안전 — 모양으로 종류 변별).
    const kinds = [...kindSet].sort();
    const kindLeg = kinds.map((k) => {
      const km = trKindMeta(k);
      return `<span class="sb-leg"><span class="tr-leg-sym" aria-hidden="true">${km.sym}</span>`
        + `<span class="sb-leg-k">${escape(km.label)}</span></span>`;
    }).join("")
      + `<span class="sb-leg tr-leg-approx"><span class="tr-leg-sym tr-approx" aria-hidden="true">${trKindMeta("request_captured").sym}</span>`
      + `<span class="sb-leg-k">흐림 = 근사 시각</span></span>`;
    // repo별 1행 = 라벨 + 시간 트랙(전이 마커를 시간 비율 위치에 절대배치).
    const rows = repos.map((repo) => {
      const evs = byRepo[repo];
      const marks = evs.map((e) => {
        const m = stateMeta(e.state);
        const km = trKindMeta(e.kind);
        const leftPct = ((e.t - t0) / span) * 100;
        const cls = ["tr-mark", escape(m.cls)];
        if (e.is_approx) cls.push("tr-approx");       // 흐림 = 근사 시각(정직)
        if (e.is_snapshot) cls.push("tr-snapshot");   // 테두리 = 전이 아닌 스냅샷
        const apx = e.is_approx ? " · 근사 시각" : "";
        const snp = e.is_snapshot ? " · 스냅샷(전이 아님)" : "";
        return `<span class="${cls.join(" ")}" style="left:${leftPct.toFixed(2)}%"`
          + ` title="${escape(tlFmt(e.t))} · ${escape(repoDisplay(repo))} · ${escape(m.label)} · ${escape(km.label)}${apx}${snp}"`
          + ` aria-label="${escape(tlFmt(e.t))} ${escape(m.label)} ${escape(km.label)}${apx}">${km.sym}</span>`;
      }).join("");
      return `<div class="tr-row" role="group" aria-label="${escape(repoDisplay(repo))} 상태 전이 ${evs.length}건">
        <div class="tr-row-head"><span class="sb-repo">${escape(repoDisplay(repo))}</span><span class="sb-total">${evs.length}</span></div>
        <div class="tr-track">${marks}</div>
      </div>`;
    }).join("");
    // coverage 정직 노출 — 유형별 실측/전체 + 근사 여부(FLR-AGT-002 가짜 채움 0).
    const TR_COV_LABEL = { verdict: "판정", round: "라운드", request: "요청" };
    let covLine = "";
    if (cov) {
      // 유형별 {available,total} 객체만 — note(설명 문자열) 등 비-카운트 키는 제외(노이즈 0).
      const parts = Object.keys(cov)
        .filter((k) => cov[k] && typeof cov[k] === "object" && "total" in cov[k])
        .map((k) => {
          const c = cov[k] || {};
          const apx = c.approx ? ' <span class="tr-cov-approx">(근사)</span>' : "";
          return `${escape(TR_COV_LABEL[k] || k)} ${c.available ?? "?"}/${c.total ?? "?"}${apx}`;
        });
      covLine = `<div class="tr-cov" role="note">실측 시각 보유: ${parts.join(" · ")} — ts 없는 사건은 미생성(소급 추정 0)</div>`;
    }
    host.innerHTML =
      `<div class="tl-head">상태 추이
        <span class="tl-sub">서비스별 상태가 <b>시간에 따라</b> 어떻게 바뀌었나 — 위 ‘서비스별 요약’은 ‘지금’ 분포, 본 추이는 전이 이력. ${escape(tlFmt(t0))} ~ ${escape(tlFmt(t1))} · 총 ${trs.length}건.</span>
      </div>
      <div class="sb-legend tr-legend" role="group" aria-label="상태·종류 범례">${stateLeg}<span class="tr-leg-div" aria-hidden="true"></span>${kindLeg}</div>
      <div class="tr-rows">${rows}</div>
      ${covLine}`;
  }

  // [2단계] 구 renderConvServices(svc-strip)·renderConvStatebar·renderConvRoundbar 3종은
  //   renderConvRepoSummary(repo 1행 요약 테이블)로 통합 — 같은 6개 서비스 4중 중복 제거.
  //   svc 카드의 status/status_label(서버 산출 active/converged/idle)은 1행 요약의
  //   열림·막힘·수렴 실측 카운트로 대체(거짓 채움 0). 전이 타임라인은 details 접기로 이동.

  // ⓪-DECISION 결단 보드 — 어드민이 '상태(무엇이 막혔나·내가 뭘 결정해야 하나)'를 답하는 단 하나의 요소.
  //   대표 catch: 화면에 활동만 잔뜩이고 막힘을 답하는 요소가 0개. → 화면에서 가장 크고 가장 위.
  //   집계(실측·color 0): requests[].blocked + blocked_reason 로 막힘 vs 대기 분리.
  //     - 내 결정 대기 = blocked & (사유에 '대표'/'결정 대기' 포함 또는 state=보류) → 대표가 풀어야 진행.
  //     - 막힘 = blocked & (대기 아님) → 열린 P0 등 진짜 장애물 (대표 결정으로 안 풀림).
  //     - 최근 수렴 = rounds[].state=수렴 (summary.converged_rounds 합과 정합 — 실측). 신호 없으면 0.
  //   가짜 숫자·폴백 색칠 금지: 해당 신호 없으면 0/없음 표시 (FLR-AGT-002).
  const DECISION_WAIT_RE = /대표|결정\s*대기|승인\s*대기|보류/;
  function classifyBlocked(r) {
    // 반환: "wait"(내 결정 대기) | "blocked"(진짜 막힘) | null(안 막힘)
    if (!r.blocked) return null;
    const reason = String(r.blocked_reason || "");
    if (r.state === "보류" || DECISION_WAIT_RE.test(reason)) return "wait";
    return "blocked";
  }
  function renderConvDecisionBoard(conv) {
    const host = el("conv-decision-board");
    if (!host) return;
    const reqs = conv.requests || [];
    const rounds = conv.rounds || [];
    const summary = conv.summary || {};

    const blockedItems = [];
    const waitItems = [];
    reqs.forEach((r) => {
      const cls = classifyBlocked(r);
      if (cls === "blocked") blockedItems.push(r);
      else if (cls === "wait") waitItems.push(r);
    });
    // REQ-ADMIN-20260615-008 (P0·허영지표 교체): 종전 "수렴 (누적)"=수렴 라운드 단조 증가
    //   카운트는 대표 verbatim "누적 추세 봐서 뭐해, 일은 늘어날 건데" 정면 위반(허영지표).
    //   → actionable "수렴까지 남은 것" 으로 교체. 실측 SSOT(summary[repo].status)만 사용:
    //   아직 수렴 못 한 active repo 수 = "수렴까지 남은 서비스"(0이면 전부 수렴=목표 달성).
    //   phantom repo(공통/—/repo) 배제(burndown-design §1 부수발견2 정합). 거짓 채움 0·소급 0.
    const activeRepos = Object.entries(summary)
      .filter(([repo]) => isRealRepo(repo))
      .filter(([, s]) => s.status === "active");
    const remainingN = activeRepos.length;

    // 막힘 우선(P0·진짜 장애물) → 대기 순으로, 우선순위 높은 것부터 최대 5줄.
    const prRank = (p) => ({ P0: 0, P1: 1, P2: 2, P3: 3 }[p] ?? 4);
    const listItems = blockedItems.concat(waitItems)
      .sort((a, b) => prRank(a.priority) - prRank(b.priority))
      .slice(0, 5);

    // REQ-ADMIN-20260615-010 (P1·드릴다운): stat 타일 클릭 → 요청 탭 필터 적용(콕핏화).
    //   filter 인자 있으면 role=button·tabindex·data-db-filter 부여(클릭/Enter 위임 핸들러).
    //   값이 0이면 비활성(클릭 무의미) — 정직(막힌 것 없는데 필터 적용 무의미).
    const big = (v, k, cls, sub, filter) => {
      const interactive = filter && v > 0;
      // RND-ADMIN-009 P1-②(c·guestpool P1-B): 종전 툴팁 "요청 탭에서 …만 보기"는 거짓 안내
      //   — 실제 동작은 disabled '요청 탭' 이동이 아니라 아래 요청 목록(#conv-req-cards)을
      //   인라인 필터+스크롤(applyReqFilter). 실동작과 일치하게 정정.
      const attrs = interactive
        ? ` role="button" tabindex="0" data-db-filter="${escape(filter)}" title="클릭 — 아래 요청 목록을 '${escape(k)}'만 필터"`
        : "";
      return `<div class="db-stat ${cls}${interactive ? " db-stat-link" : ""}"${attrs}>
         <div class="db-v">${v}</div>
         <div class="db-k">${escape(k)}</div>
         <div class="db-sub">${escape(sub)}</div>
       </div>`;
    };

    // RND-ADMIN-009 P1-②(a·만장일치): 결단보드 "막힌 요청"=진짜 장애물 subset(classifyBlocked
    //   ==='blocked', 보류·결정대기 제외)인데 서비스별요약 "막힘 수"=blocked union(보류 포함).
    //   같은 '막힘' 단어가 다른 값(2 vs 6) → 운영자 핵심 스캔("막힌 거 몇이야?")에 상반된 답.
    //   라벨 변별: 보드='처리 필요(진짜 막힘)' / 요약='막힘(보류 포함)'(L689) — 같은 단어 두 정의 제거.
    const stats =
      big(blockedItems.length, "처리 필요", "db-blocked",
          blockedItems.length ? "진짜 장애물 — 지금 처리" : "막힌 것 없음", "blocked") +
      big(waitItems.length, "내 결정 대기", "db-wait",
          waitItems.length ? "대표 결정해야 진행" : "대기 없음", "wait") +
      // 허영지표(누적 수렴) 추방 → actionable: 아직 수렴 못 한 서비스 수(0=목표 달성).
      big(remainingN, "수렴까지 남은 서비스", remainingN ? "db-blocked" : "db-ok",
          remainingN
            ? activeRepos.map(([repo]) => repoDisplay(repo)).join(" · ") + " 진행 중"
            : "전 서비스 수렴 — 남은 것 없음");

    let listHtml;
    if (!listItems.length) {
      listHtml = `<div class="db-empty">막히거나 결정 대기 중인 요청이 없습니다 — 전부 도는 중.</div>`;
    } else {
      const rows = listItems.map((r) => {
        const wait = classifyBlocked(r) === "wait";
        // RND-ADMIN-010 P1-1(조니 2심 채택): 행 배지 bare "막힘"이 subset(이 행은 blockedItems
        //   =classifyBlocked==='blocked')인데 요약 헤더 "막힘(보류 포함)"은 union(6) → 같은 단어 두 값.
        //   subset 라벨을 결단보드 타일 "처리 필요"와 단일화(L874). union="막힘(보류 포함)"만 잔존.
        const tag = wait
          ? `<span class="db-tag db-tag-wait">결정 대기</span>`
          : `<span class="db-tag db-tag-blocked" title="진짜 장애물 — 결단보드 '처리 필요' 집계와 동일 subset(보류·결정대기 제외)">처리 필요</span>`;
        // 막힌 이유 = blocked_reason(실측) 우선, 없으면 현재 state 라벨 근사(정직 표기).
        const reason = r.blocked_reason
          ? mdSafe(r.blocked_reason)   // REQ-011: 마크다운 렌더
          : `<span class="db-reason-approx">${escape(stateMeta(r.state).label)} 상태</span>`;
        // REQ-010 드릴다운: 행 클릭 → 해당 요청 카드로 점프(scrollIntoView+펼침). req_id 있을 때만.
        const rid = r.req_id || "";
        const navAttr = rid
          ? ` role="button" tabindex="0" data-jump-req="${escape(rid)}" title="클릭 — 이 요청 카드로 이동"`
          : "";
        return `<div class="db-row ${wait ? "db-row-wait" : "db-row-blocked"}${rid ? " db-row-link" : ""}"${navAttr}>
          ${tag}
          <span class="db-row-repo">${escape(repoDisplay(r.repo || "미상"))}</span>
          <span class="db-row-title" title="${safe(r.summary || "")}">${mdSafe(r.summary || r.req_id || "")}</span>
          <span class="db-row-reason">${reason}</span>
        </div>`;
      }).join("");
      const more = (blockedItems.length + waitItems.length) - listItems.length;
      // RND-ADMIN-009 P1-②(c): disabled '요청 탭'이 아니라 아래 요청 목록에서 전체 표시(실동작 일치).
      const moreHtml = more > 0
        ? `<div class="db-more">+ ${more}건 더 (아래 요청 목록에서 전체 보기)</div>` : "";
      listHtml = `<div class="db-list" role="list">${rows}</div>${moreHtml}`;
    }

    host.innerHTML =
      `<div class="db-head">
         <h2 class="db-title">결단 보드</h2>
         <span class="db-hint">지금 무엇이 막혔고 내가 뭘 결정해야 하나</span>
       </div>
       <div class="db-stats">${stats}</div>
       ${listHtml}`;

    // REQ-010 드릴다운 — 클릭/Enter 위임(결단보드 1회 바인딩). 행→카드 점프, stat→필터 적용.
    if (!host.dataset.drillBound) {
      host.dataset.drillBound = "1";
      const handle = (target) => {
        const rowEl = target.closest("[data-jump-req]");
        if (rowEl) { jumpToReqCard(rowEl.getAttribute("data-jump-req")); return; }
        const statEl = target.closest("[data-db-filter]");
        if (statEl) { applyReqFilter(statEl.getAttribute("data-db-filter")); return; }
      };
      host.addEventListener("click", (e) => handle(e.target));
      host.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (e.target.closest("[data-jump-req],[data-db-filter]")) { e.preventDefault(); handle(e.target); }
        }
      });
    }
  }

  // ⓪-BURNDOWN 번다운 — burndown-design.md(CADENCE) Phase A. 대표 catch: "진척 빨라서 밑으로 꺾이는 차트, 서비스별로."
  //   Phase A 제약(설계 §1): 요청 전이 시각(opened_at/closed_at) SSOT 부재 → 과거 R(t) 잔량 시계열 실측 불가.
  //   소급 합성 금지(FLR-AGT-002). 정직하게 2종:
  //     ① 서비스별 현재 잔량(open) 막대 — summary[repo].open_requests 스냅샷 (시계열 아님 명시).
  //     ② 처리 박자 라인 — state_transitions 의 verdict_emitted(실측 mtime·is_approx=false)를 일별 close 이벤트 근사.
  //        우상향 = 판정 활발(처리 빠름). 잔량 시계열은 위 '누적 추이' 곡선 참조(이미 잔량 번다운 그림).
  //   phantom repo(—/repo/UNKNOWN/null) 분모 배제 (설계 §1 부수발견2).
  //   ⚠️ '공통'은 phantom 아님 — 백엔드 compute_summary(_PHANTOM_REPO_TOKENS)가 정상 버킷으로 보존(open 2).
  //   프론트가 '공통'을 추가 배제하면 번다운 분모(26)가 glance/표/헤더(28)와 발산(RND-ADMIN-008 P1-ii).
  //   백엔드 SSOT와 1:1 정합 위해 '공통'·'미상' 제외(미상은 backend 'UNKNOWN'과 별 토큰이라 무영향).
  const PHANTOM_REPO_TOKENS = new Set(["—", "-", "repo", "UNKNOWN", "unknown", ""]);
  function isRealRepo(repo) {
    return !PHANTOM_REPO_TOKENS.has(String(repo == null ? "" : repo).trim());
  }
  // 일자(KST) 키 — verdict ts(ISO+09:00) 의 날짜만. 달력일(설계 §3: 메타 트래커라 주말도 작업).
  function dayKey(iso) {
    if (!iso) return null;
    const s = String(iso);
    // ISO 문자열의 앞 10자(YYYY-MM-DD)가 이미 +09:00 로컬 날짜 — Date 재파싱 시 TZ 흔들림 회피.
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[1] + "-" + m[2] + "-" + m[3] : null;
  }
  // 시간단위 라벨 — ISO(+09:00) → "06-15 14시" (날짜+정시). TZ 재파싱 없이 문자열 절단
  //   (ISO 앞부분이 이미 KST 로컬). 번다운 곡선 축·점 툴팁용.
  function tsLabel(iso) {
    if (!iso) return "";
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/);
    return m ? `${m[2]}-${m[3]} ${m[4]}시` : String(iso).slice(0, 16);
  }
  function renderConvBurndown(conv) {
    const host = el("conv-burndown");
    if (!host) return;
    const summary = conv.summary || {};
    const trans = conv.state_transitions || [];

    // ── ① 현재 잔량 스냅샷 (서비스별 open_requests, phantom 제외) ──
    const snap = Object.entries(summary)
      .filter(([repo]) => isRealRepo(repo))
      .map(([repo, s]) => ({ repo, open: s.open_requests ?? 0, total: s.total_requests ?? 0 }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.open - a.open || a.repo.localeCompare(b.repo));
    const maxOpen = Math.max(1, ...snap.map((x) => x.open));

    const snapBars = snap.length
      ? snap.map((x) => {
          const pct = (x.open / maxOpen) * 100;
          const zero = x.open === 0;
          return `<div class="bd-snap-row" role="group" aria-label="${escape(repoDisplay(x.repo))} 미해결 ${x.open}건 / 전체 ${x.total}">
            <span class="bd-snap-repo">${escape(repoDisplay(x.repo))}</span>
            <span class="bd-snap-track">
              <span class="bd-snap-fill ${zero ? "bd-snap-zero" : ""}" style="width:${zero ? 0 : Math.max(6, pct)}%"></span>
            </span>
            <span class="bd-snap-v">${x.open}<span class="bd-snap-tot">/${x.total}</span></span>
          </div>`;
        }).join("")
      : `<div class="db-empty">집계할 서비스 잔량이 없습니다.</div>`;

    // ── ② 처리 박자 라인 — verdict_emitted(실측 ts) 일별 카운트 = "며칠에 몇 건 판정났나" ──
    //    is_approx=true(요청 captured 근사)는 분자 제외 — 거짓 속도 가드(설계 §2.2).
    const verdictEvents = trans.filter(
      (e) => e.kind === "verdict_emitted" && e.is_approx === false && e.ts);
    const byDay = {};
    verdictEvents.forEach((e) => {
      const d = dayKey(e.ts);
      if (d) byDay[d] = (byDay[d] || 0) + 1;
    });
    const days = Object.keys(byDay).sort();

    let paceHtml;
    if (days.length < 2) {
      // 단일 일자·무데이터면 라인 못 그림 — 정직하게 스냅샷만 (가짜 추세선 금지).
      paceHtml = `<div class="bd-pace-empty">처리 박자 추이는 2일 이상 데이터부터 표시 (현재 ${days.length}일치 실측).</div>`;
    } else {
      const counts = days.map((d) => byDay[d]);
      const maxC = Math.max(1, ...counts);
      const W = 100, H = 40; // viewBox 단위(%·반응형)
      const stepX = days.length > 1 ? W / (days.length - 1) : 0;
      const pts = counts.map((c, i) => {
        const x = i * stepX;
        const y = H - (c / maxC) * (H - 4) - 2;
        return [x, y];
      });
      const linePath = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
      const dots = pts.map((p, i) =>
        `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.1" fill="var(--am)">
           <title>${escape(days[i])} · 판정 ${counts[i]}건</title></circle>`).join("");
      const total = counts.reduce((a, b) => a + b, 0);
      const lastN = counts[counts.length - 1];
      paceHtml =
        `<div class="bd-pace">
           <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="bd-pace-svg" role="img"
                aria-label="일별 판정 처리 박자 — ${days.length}일간 총 ${total}건">
             <polyline points="${pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")}"
                       fill="none" stroke="var(--am)" stroke-width="0.8"
                       stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
             ${dots}
           </svg>
           <div class="bd-pace-axis">
             <span>${escape(days[0])}</span>
             <span class="bd-pace-stat">총 ${total}건 · 최근일 ${lastN}건</span>
             <span>${escape(days[days.length - 1])}</span>
           </div>
         </div>`;
    }

    // ── ③ 🔴 누적 번다운 곡선 — 대표 요구 "누적 요청 N · 해결 M · 잔량 N−M" ──
    //    각 시간단위 시점의 누적요청·누적해결·잔량 3선. 잔량선이 핵심(우하향=해결 추월).
    //    근사(git_approx·묶음 commit)는 곡선 하단 신뢰도 바 + 흐림 영역으로 정직 표기.
    //    못 내는 건(opened/close 시각 미상)은 곡선 밖 주석 — 거짓 위치로 안 찍음(FLR-AGT-002).
    const series = conv.burndown_series || {};
    const sp = Array.isArray(series.points) ? series.points : [];
    let curveHtml;
    if (sp.length < 2) {
      curveHtml = `<div class="bd-curve-empty">누적 추이는 시각 추적 가능한 전이 2개 이상부터 표시 (현재 ${sp.length}개 시점).</div>`;
    } else {
      const W = 100, H = 46, padTop = 3, padBot = 4;
      const maxY = Math.max(1, ...sp.map((p) => p.cumulative_opened));
      const n = sp.length;
      const xAt = (i) => (n > 1 ? (i / (n - 1)) * W : 0);
      const yAt = (v) => H - padBot - (v / maxY) * (H - padTop - padBot);
      const lineFor = (key) =>
        sp.map((p, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)} ${yAt(p[key]).toFixed(1)}`).join(" ");
      const ptsFor = (key) =>
        sp.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p[key]).toFixed(1)}`).join(" ");
      // 잔량 영역(0~remaining) — 채움으로 '쌓인 일감' 부피감. 0 baseline 까지.
      const remArea =
        `M${xAt(0).toFixed(1)} ${yAt(0).toFixed(1)} ` +
        sp.map((p, i) => `L${xAt(i).toFixed(1)} ${yAt(p.remaining).toFixed(1)}`).join(" ") +
        ` L${xAt(n - 1).toFixed(1)} ${yAt(0).toFixed(1)} Z`;
      const dotTitle = (p) =>
        `${tsLabel(p.ts)} · 요청 ${p.cumulative_opened} · 해결 ${p.cumulative_closed} · 잔량 ${p.remaining}` +
        (p.approx_closed_cum ? ` (해결 중 근사 ${p.approx_closed_cum})` : "");
      const dots = sp.map((p, i) =>
        `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(p.remaining).toFixed(1)}" r="1.0" fill="var(--am)"><title>${escape(dotTitle(p))}</title></circle>`).join("");
      const first = sp[0], last = sp[sp.length - 1];
      // 잔량 방향(우하향=해결이 요청 추월 = 대표가 보고싶은 "꺾임"). 정직 라벨.
      const remDelta = last.remaining - first.remaining;
      const dirLabel = remDelta < 0
        ? `잔량 ${first.remaining}→${last.remaining} (↓ ${-remDelta} 감소 — 해결이 요청을 추월)`
        : remDelta > 0
          ? `잔량 ${first.remaining}→${last.remaining} (↑ ${remDelta} 증가 — 요청 유입이 더 빠름)`
          : `잔량 ${first.remaining} (변동 없음)`;
      // 근사 신뢰도 — close 중 measured(실측 verdict mtime) vs git_approx 비율.
      const totC = series.total_closed || 0;
      const measured = series.measured_close_n || 0;
      const approx = series.approx_close_n || 0;
      const measuredPct = totC ? Math.round((measured / totC) * 100) : 0;
      curveHtml =
        `<div class="bd-curve">
           <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="bd-curve-svg" role="img"
                aria-label="누적 번다운 — 시점별 누적 요청/해결/잔량 ${n}개 시점">
             <path d="${remArea}" fill="var(--am)" fill-opacity="0.10" stroke="none"/>
             <polyline points="${ptsFor("cumulative_opened")}" fill="none" stroke="var(--dm)"
                       stroke-width="0.7" stroke-dasharray="2 1.4" vector-effect="non-scaling-stroke"/>
             <polyline points="${ptsFor("cumulative_closed")}" fill="none" stroke="var(--pos)"
                       stroke-width="0.9" vector-effect="non-scaling-stroke"/>
             <polyline points="${ptsFor("remaining")}" fill="none" stroke="var(--am)"
                       stroke-width="1.1" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
             ${dots}
           </svg>
           <div class="bd-curve-legend">
             <span class="bd-lg bd-lg-open">⋯ 누적 요청</span>
             <span class="bd-lg bd-lg-closed">— 누적 해결</span>
             <span class="bd-lg bd-lg-rem">▬ 잔량(요청−해결)</span>
           </div>
           <div class="bd-curve-axis">
             <span>${escape(tsLabel(first.ts))}</span>
             <span class="bd-curve-dir">${escape(dirLabel)}</span>
             <span>${escape(tsLabel(last.ts))}</span>
           </div>
           <div class="bd-curve-trust">
             시각 출처: 실측(verdict) ${measured}건 · 근사(git 등재 시점) ${approx}건${totC ? ` (실측 ${measuredPct}%)` : ""}
             ${approx ? `<span class="bd-curve-approx-note" title="LEDGER 묶음 commit으로 여러 요청이 한 시점에 동시 닫힘 — close 시각은 '기록 시점' 근사">· 근사는 묶음 배포로 같은 시점에 몰릴 수 있음</span>` : ""}
           </div>
           ${(series.unknown_close_n || series.opened_unknown_n)
             ? `<div class="bd-curve-omitted">곡선 밖(시각 미상, 거짓 위치로 안 찍음): ${
                 [series.unknown_close_n ? `해결됐으나 close 시각 미상 +${series.unknown_close_n}건` : "",
                  series.opened_unknown_n ? `요청 시각 미상 +${series.opened_unknown_n}건` : ""]
                   .filter(Boolean).join(" · ")
               }</div>`
             : ""}
         </div>`;
    }

    host.innerHTML =
      `<div class="bd-head">
         <h2 class="bd-title">번다운 — 미해결 잔량</h2>
         <span class="bd-hint">서비스별 미해결(open) 요청 · 진척 빠르면 잔량이 줄어든다</span>
       </div>
       <div class="bd-curve-wrap">
         <div class="bd-curve-h">누적 추이 <span class="bd-curve-sub">시간단위 · 누적 요청·해결·잔량 (잔량 우하향 = 해결이 요청을 추월)</span></div>
         ${curveHtml}
       </div>
       <div class="bd-snap">${snapBars}</div>
       <div class="bd-pace-wrap">
         <div class="bd-pace-h">처리 박자 <span class="bd-pace-sub">일별 판정 건수(실측 mtime) · 우상향 = 판정 활발 · 잔량 시계열은 위 '누적 추이' 곡선 참조</span></div>
         ${paceHtml}
         <!-- REQ-016 파트2: 번다운 처리박자는 일별 추세(데이터 성격상 줌 무의미·burndown-design Phase A).
              시간 단위(1/2/3/6h) 확대·드래그 탐색은 '활동 추이' 차트에 일관 제공 → 명시 cross-link(발견성). -->
         <button type="button" class="bd-zoom-link" data-open-timeline aria-label="활동 추이 시간 줌 차트 열기">
           시간 단위로 확대해 보기 → 활동 추이 펼치기 🔍
         </button>
       </div>`;

    // REQ-016: '시간 단위로 확대' → conv-timeline-fold(시간 줌 차트) 열고 스크롤(발견성 동선).
    const zoomLink = host.querySelector("[data-open-timeline]");
    if (zoomLink) {
      zoomLink.addEventListener("click", () => {
        const fold = el("conv-timeline-fold");
        if (fold) {
          fold.open = true;
          try { fold.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (_) { fold.scrollIntoView(); }
        }
      });
    }
  }

  // ① 한눈에 — 열린/진행/수렴/최근 활동
  function renderConvGlance(conv) {
    const reqs = conv.requests || [];
    const rounds = conv.rounds || [];
    const summary = conv.summary || {};

    const total = reqs.length;
    const open = reqs.filter((r) => isOpenState(r.state)).length;
    const settled = reqs.filter((r) => !isOpenState(r.state)).length;
    const activeRounds = rounds.filter((r) => ACTIVE_ROUND_STATES.includes(r.state)).length;

    // 최근 활동 = 최신 라운드(가장 큰 번호). round_id 끝자리 수치로 정렬.
    const lastRound = rounds.slice().sort((a, b) => roundNum(b.round_id) - roundNum(a.round_id))[0];
    const lastTxt = lastRound
      ? `${escape(lastRound.alias || lastRound.round_id)} · ${escape(repoDisplay(lastRound.repo || ""))} · ${escape(stateMeta(lastRound.state).label)}`
      : "기록 없음";

    el("conv-glance").innerHTML = `
      <div class="glance-card glance-open">
        <div class="g-v">${open}</div><div class="g-k">열린 요청</div>
        <div class="g-sub">아직 도는 중</div>
      </div>
      <div class="glance-card glance-active">
        <div class="g-v">${activeRounds}</div><div class="g-k">진행·판정 라운드</div>
        <div class="g-sub">심사 중</div>
      </div>
      <div class="glance-card glance-ok">
        <div class="g-v">${settled}</div><div class="g-k">수렴·종결 요청</div>
        <div class="g-sub">전체 ${total} 요청 중</div>
      </div>
      <div class="glance-card glance-wide">
        <div class="g-k">최근 활동</div>
        <div class="g-recent">${lastTxt}</div>
      </div>
    `;
  }

  function roundNum(id) {
    const m = String(id || "").match(/(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : -1;
  }

  // ⓪-b 활동 신선도 — "지금 동작 중인지"(대표 직접). 클라 현재 시각 기준 마지막 활동 경과.
  function minsAgo(iso) {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (isNaN(t)) return null;
    return Math.max(0, Math.round((Date.now() - t) / 60000));
  }
  function agoText(m) {
    if (m == null) return "미상";
    if (m < 1) return "방금";
    if (m < 60) return m + "분 전";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "시간 " + (m % 60) + "분 전";
    return Math.floor(h / 24) + "일 전";
  }
  // 색 + 텍스트 병기(다크모드 제1원칙). 데이터 신선 <30분 / 느려짐 <180 / 정체 그 외 / 미상.
  function freshMeta(m) {
    if (m == null) return { cls: "fresh-unknown", label: "데이터 미상" };
    if (m < 30)  return { cls: "fresh-live",  label: "데이터 최신" };
    if (m < 180) return { cls: "fresh-warm",  label: "데이터 지연" };
    return { cls: "fresh-stale", label: "데이터 정체" };
  }
  // 두 시각 간 경과(분) — to - from, 음수 가능(활동이 빌드 이후일 때).
  function minsBetween(fromIso, toIso) {
    if (!fromIso || !toIso) return null;
    const a = new Date(fromIso).getTime(), b = new Date(toIso).getTime();
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round((b - a) / 60000);
  }
  // [2단계] freshness 모순 해소 — 기존엔 배지 본문이 last_activity_ts(라이브 시계 기준) 로 '동작 중 방금',
  //   같은 줄 데이터 갱신은 generated_at 기준 'N시간 전' → 동시 표기가 모순(활동 ts 가 빌드보다 미래라
  //   minsAgo 가 0 클램프 → 항상 '방금'). 정합화: 배지 본문(liveness)은 *데이터 스냅샷 자체*의 신선도
  //   (generated_at 경과)로 단일 기준화 — 우리가 보는 게 라이브 데이터인지를 답함. last_activity_ts 는
  //   스냅샷 *내부* 기록이므로 '빌드 시점 기준' 상대로 정직 표기(빌드 이후면 '빌드 시점' 명시·라이브 시계 0클램프 안 함).
  function renderConvFreshness(conv) {
    const f = conv.freshness || {};
    const genIso = f.generated_at || conv.generated_at;
    const genMin = minsAgo(genIso);          // 데이터 스냅샷 경과(라이브 시계 기준) = 단일 liveness 기준
    const fm = freshMeta(genMin);
    // 마지막 활동을 '빌드 시점 기준'으로 — 모순 제거. delta = generated_at - last_activity_ts.
    const actIso = f.last_activity_ts;
    const deltaToBuild = minsBetween(actIso, genIso); // 양수 = 빌드가 활동보다 나중(정상)
    let actDetail;
    if (!actIso) {
      actDetail = "마지막 활동 <b>미상</b>";
    } else if (deltaToBuild == null) {
      actDetail = "마지막 활동 <b>미상</b>";
    } else if (deltaToBuild < 0) {
      // 활동 ts 가 빌드보다 미래 — 라이브 시계로 '방금' 우기지 않고 정직하게 표기(거짓 신선 0·FLR-AGT-002).
      actDetail = `마지막 활동 <b>빌드 이후 예약/미래 기록</b>`;
    } else {
      actDetail = `마지막 활동 <b>빌드 ${escape(agoText(deltaToBuild))}</b>`;
    }
    // [3단계] stale 경고 배너 — 데이터 생성 후 30분 초과 시 최상단(결단보드 위) 명시 고지
    //   (거짓 신선 0·FLR-AGT-002). 배지(작은 점·텍스트)만으론 '오래된 데이터를 라이브로 착각'을
    //   못 막는다(대표: 어드민이 자기 신선도를 거짓말하지 않게 — 신뢰의 첫 조건). genMin 은
    //   minsAgo(라이브 시계 − generated_at) = 매 렌더/폴링 재계산되는 실시간 경과(빌드 박제
    //   stale_minutes 정적값 미사용). 30~180분=주황 '지연', 180분+=빨강 '정체'(freshMeta 임계와
    //   정합). 색 + 텍스트 병기(다크모드 제1원칙). 평상시(신선)엔 배너 슬롯 비움(레이아웃 영향 0).
    const bannerEl = el("conv-stale-banner");
    if (bannerEl) {
      if (genMin != null && genMin >= 30) {
        const danger = genMin >= 180; // stale = 빨강, warm = 주황
        bannerEl.innerHTML =
          `<div class="fresh-alert ${danger ? "fresh-alert-danger" : "fresh-alert-warn"}" role="alert">
            <span class="fresh-alert-icon" aria-hidden="true">${danger ? "■" : "▲"}</span>
            <span class="fresh-alert-msg">데이터가 <b>${escape(agoText(genMin))}</b> 생성됐습니다 — ${danger ? "정체(180분 초과)" : "갱신 지연(30분 초과)"}. 표시 값은 마지막 빌드 스냅샷이며 라이브가 아닙니다.</span>
          </div>`;
      } else {
        bannerEl.innerHTML = "";
      }
    }
    el("conv-freshness").innerHTML =
      `<div class="fresh-badge ${fm.cls}" title="배지 = 보고 있는 데이터(convergence.json)의 신선도. 마지막 활동은 그 빌드 시점 기준 상대.">
        <span class="fresh-dot"></span>
        <span class="fresh-main">${escape(fm.label)}</span>
        <span class="fresh-gen">데이터 갱신 <b>${escape(agoText(genMin))}</b></span>
        <span class="fresh-detail">${actDetail}</span>
      </div>`;
  }

  // ⓪-c 활동 시계열 — activity_timeline(ts·repo·type)을 시간축 위 *누적 라인*으로.
  //   서비스별 라인 = 각 repo의 누적 활동 수가 시간 따라 우상향 → "어떤 서비스가 언제 활발했나/어떻게 변하나".
  //   총합 라인(굵게) = 전체 누적 추이. 기울기가 곧 활동 밀도(평평=쉼, 가파름=활발).
  //   세그먼트 토글(서비스별↔유형별)로 한 축 전환. 범례 클릭=라인 고립/숨김. 드래그=팬, 휠/더블탭/핀치=줌.
  const TL_TYPE = {
    verdict: { label: "판정", color: "var(--pos)" },
    round:   { label: "라운드", color: "var(--am)" },
    request: { label: "요청", color: "var(--ru)" },
  };
  // 서비스(repo)별 색 — 동적 발견 순서대로 팔레트 순환 배정(잉크다크/황동·루비 정합 톤).
  // 고정 의미 없는 카테고리라 정체성 톤 안에서 구분 가능한 7색(다크/라이트 양쪽 AA 검증된 토큰).
  const TL_REPO_PALETTE = [
    "var(--am)",   // 황동 — 회사 정체성 1순위
    "var(--pos)",  // 녹
    "var(--ru)",   // 루비
    "var(--neu)",  // 청회
    "var(--am2)",  // 밝은 황동
    "var(--pos-bd)", // 연녹
    "var(--neu-bd)", // 연청회
  ];
  const TL_TOTAL_COLOR = "var(--tx2)"; // 총합 = 본문 보조색(굵은 라인, 채도 낮춰 위계 위)
  function tlFmt(ms) {
    const d = new Date(ms);
    return (d.getMonth() + 1) + "/" + d.getDate() + " " +
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function tlFmtRange(a, b) { // 보이는 범위 라벨 — 같은 날이면 날짜 1회만
    const da = new Date(a), db = new Date(b);
    const hm = (d) => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    const md = (d) => (d.getMonth() + 1) + "/" + d.getDate();
    return md(da) === md(db)
      ? `${md(da)} ${hm(da)} – ${hm(db)}`
      : `${md(da)} ${hm(da)} – ${md(db)} ${hm(db)}`;
  }
  // 활동 시계열 상태(줌/팬). full=전체 [min,max], view=현재 보이는 [v0,v1].
  //   mode: "repo"(서비스별) | "type"(유형별). keys=현재 모드 시리즈 키 목록.
  //   hidden=숨긴 시리즈 키 Set, solo=고립 시리즈 키(null이면 전부) — 범례 클릭으로 토글.
  const tlState = {
    full: null, view: null, events: null, vbw: 1000,
    mode: "repo", keys: [], colorOf: {}, hidden: new Set(), solo: null,
    showBars: true, // 단위시간당 변동 막대 오버레이(대표 지시: 누적 라인만으론 시간당 증감폭 안 보임)
  };
  // 시리즈가 현재 보이는지(solo 우선, 아니면 hidden 제외).
  function tlVisible(k) {
    if (tlState.solo) return k === tlState.solo;
    return !tlState.hidden.has(k);
  }
  // 현재 모드에서 한 이벤트의 시리즈 키(repo 또는 type). 빈 값은 '미상'으로.
  function tlKeyOf(e) {
    if (tlState.mode === "type") return TL_TYPE[e.type] ? e.type : "기타";
    return (e.repo && String(e.repo).trim()) || "미상";
  }
  function tlSeriesLabel(k) {
    return tlState.mode === "type" ? (TL_TYPE[k] ? TL_TYPE[k].label : "기타") : k;
  }

  function renderConvTimeline(conv, opts) {
    const host = el("conv-timeline");
    if (!host) return;
    // 렌더버그 fix: 표시 토글(hidden/solo)은 *일시 탐색 상태*. 탭 진입/데이터 갱신 시엔
    // 무조건 전체 라인 표시로 초기화(이전 solo/hidden 잔존 → 라인 1개만 그려지던 버그).
    // mode 전환 재호출만 preserveToggle=true (그 핸들러가 이미 직접 리셋함). 줌(view)은 항상 보존.
    if (!(opts && opts.preserveToggle)) { tlState.hidden = new Set(); tlState.solo = null; }
    const tl = (conv.activity_timeline || [])
      .filter((e) => e && e.ts && !isNaN(new Date(e.ts).getTime()))
      .map((e) => ({ ...e, t: new Date(e.ts).getTime() }))
      .sort((a, b) => a.t - b.t);
    if (!tl.length) {
      host.innerHTML = `<div class="tl-head">활동 추세 <small class="tl-head-tag">속도</small></div><p class="hint">표시할 활동 기록이 없습니다 (activity_timeline 미상).</p>`;
      return;
    }
    const min = tl[0].t, max = tl[tl.length - 1].t;
    const fullSpan = (max - min) || 1;
    // 줌 상태 유지 — 데이터 재생성 후에도 보던 범위가 [min,max] 안이면 보존, 아니면 전체로.
    let view;
    if (tlState.view && tlState.view[0] >= min && tlState.view[1] <= max && tlState.view[1] > tlState.view[0]) {
      view = tlState.view.slice();
    } else {
      view = [min, max];
    }
    tlState.full = [min, max];
    tlState.view = view;
    tlState.events = tl;

    // 시리즈 키 = 현재 모드(repo|type)별 등장 키. 발견 순서 보존(첫 등장 시각 순).
    const seen = [];
    tl.forEach((e) => { const k = tlKeyOf(e); if (!seen.includes(k)) seen.push(k); });
    // 유형은 의미 순(판정·라운드·요청·기타) 고정, 서비스는 총량 내림차순(굵직한 라인이 앞 범례).
    let keys;
    if (tlState.mode === "type") {
      const order = ["verdict", "round", "request", "기타"];
      keys = seen.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
    } else {
      const cnt = {}; tl.forEach((e) => { const k = tlKeyOf(e); cnt[k] = (cnt[k] || 0) + 1; });
      keys = seen.slice().sort((a, b) => cnt[b] - cnt[a]);
    }
    tlState.keys = keys;
    // 색 배정 — 유형은 의미색 고정, 서비스는 팔레트 순환.
    const colorOf = {};
    if (tlState.mode === "type") {
      keys.forEach((k) => { colorOf[k] = TL_TYPE[k] ? TL_TYPE[k].color : "var(--neu)"; });
    } else {
      keys.forEach((k, i) => { colorOf[k] = TL_REPO_PALETTE[i % TL_REPO_PALETTE.length]; });
    }
    tlState.colorOf = colorOf;
    // 사라진 키는 hidden/solo에서 정리(데이터 재생성 후 잔존 방지).
    tlState.hidden.forEach((k) => { if (!keys.includes(k)) tlState.hidden.delete(k); });
    if (tlState.solo && !keys.includes(tlState.solo)) tlState.solo = null;

    // 통계 헤더 — 총 N · 시간당 평균 · 피크 1시간 구간 · 최근 활동.
    const total = tl.length;
    const spanHrs = fullSpan / 3600000;
    const perHr = spanHrs > 0 ? (total / spanHrs) : total;
    const hourBuckets = {};
    tl.forEach((e) => { const hk = Math.floor(e.t / 3600000); hourBuckets[hk] = (hourBuckets[hk] || 0) + 1; });
    let peakHk = null, peakN = 0;
    for (const k in hourBuckets) if (hourBuckets[k] > peakN) { peakN = hourBuckets[k]; peakHk = +k; }
    const peakStart = peakHk != null ? peakHk * 3600000 : null;
    const peakLabel = peakStart != null
      ? `${String(new Date(peakStart).getHours()).padStart(2, "0")}시대 (${peakN}건)`
      : "—";
    const lastMin = minsAgo(tl[tl.length - 1].ts);

    // 시리즈별 총건수(범례 카운트 — 모드 무관 전체 기간 기준).
    const seriesTotal = {}; tl.forEach((e) => { const k = tlKeyOf(e); seriesTotal[k] = (seriesTotal[k] || 0) + 1; });

    // ── 목적별 복수 차트 마크업 ──
    //   A(단위시간 변동, 막대) + B(누적 추세, 총합 라인) = 시간축 공유 한 쌍(.tl-pair). 줌/팬 인터랙션은 A에만.
    //   C(서비스별 활동) = 전체 기간 고정 small multiples(repo별 mini 막대). 모바일=세로 적층(CSS grid).
    //   유형별↔서비스별 토글은 C 차트(어느 *서비스/유형*이 언제 활발한가)에 귀속.
    tlState.mode = "repo"; // C는 서비스 1차 고정(유형 단독 토글 폐지). keys=서비스 키.
    const modeLabel = "서비스";

    host.innerHTML =
      `<div class="tl-head">활동 시계열 <small class="tl-head-tag">목적별 분리</small>
        <span class="tl-sub">단위시간 변동 · 누적 추세 · ${escape(modeLabel)}별 활동을 따로 — 각 차트가 한 가지만 말합니다. 상태 분포는 아래 ‘상태 스냅샷’.</span>
      </div>
      <div class="tl-stats" aria-label="활동 통계">
        <span class="tl-stat"><b>${total}</b><i>총 활동</i></span>
        <span class="tl-stat"><b>${perHr.toFixed(1)}</b><i>시간당 평균</i></span>
        <span class="tl-stat"><b>${escape(peakLabel)}</b><i>피크 구간</i></span>
        <span class="tl-stat"><b>${escape(agoText(lastMin))}</b><i>최근 활동</i></span>
      </div>

      <!-- A+B 한 쌍: 같은 시간축, 위=변동 막대(A), 아래=누적 라인(B). 줌/드래그는 A에. -->
      <div class="tl-pair">
        <div class="tl-card tl-card-bars">
          <div class="tl-card-head">
            <span class="tl-card-title">① 단위시간당 변동</span>
            <span class="tl-card-desc">이 시간대 몇 건 — 막대 높을수록 활발 · 빈칸=활동 0</span>
            <button type="button" class="tl-reset" hidden aria-label="전체 기간으로 초기화">전체 보기</button>
          </div>
          <div class="tl-chart-wrap tl-wrap-bars">
            <svg class="tl-svg tl-svg-bars" viewBox="0 0 ${tlState.vbw} 132" preserveAspectRatio="none"
                 role="img" aria-label="단위시간당 활동 막대 차트 — 총 ${total}건, 드래그로 이동·휠로 확대 가능" tabindex="0">
              <g class="tlb-grid"></g>
              <g class="tlb-bars"></g>
              <g class="tlb-cursor"></g>
            </svg>
            <div class="tlb-yaxis" aria-hidden="true"></div>
            <div class="tl-tip tlb-tip" hidden></div>
          </div>
        </div>

        <div class="tl-card tl-card-cum">
          <div class="tl-card-head">
            <span class="tl-card-title">② 누적 추세</span>
            <span class="tl-card-desc">총 활동이 시간 따라 쌓인 총량 — 기울기가 가파를수록 그때 활발</span>
          </div>
          <div class="tl-chart-wrap tl-wrap-cum">
            <svg class="tl-svg tl-svg-cum" viewBox="0 0 ${tlState.vbw} 96" preserveAspectRatio="none"
                 role="img" aria-label="누적 활동 추세 라인 차트 — 총 ${total}건">
              <g class="tlc-grid"></g>
              <g class="tlc-line"></g>
              <g class="tlc-cursor"></g>
            </svg>
            <div class="tlc-yaxis" aria-hidden="true"></div>
          </div>
        </div>

        <div class="tl-axis">
          <span class="tl-axis-from"></span>
          <span class="tl-range-label" aria-live="polite"></span>
          <span class="tl-axis-to"></span>
        </div>
      </div>

      <!-- C: 서비스 > 유형 계층 활동 — 전체 기간 small multiples. 서비스별 막대를 유형 3색으로 스택. -->
      <div class="tl-card tl-card-svc">
        <div class="tl-card-head">
          <span class="tl-card-title">③ 서비스별 활동 <small class="tl-card-sub2">유형 세분</small></span>
          <span class="tl-card-desc">어느 서비스가 어떤 유형 활동을 했나 — 막대 = 유형 스택</span>
          <div class="tl-svc-legend" role="list" aria-label="유형 범례">
            <span class="tl-svc-leg" role="listitem"><i class="tl-svc-tdot" style="background:${TL_TYPE.verdict.color}"></i>판정</span>
            <span class="tl-svc-leg" role="listitem"><i class="tl-svc-tdot" style="background:${TL_TYPE.round.color}"></i>라운드</span>
            <span class="tl-svc-leg" role="listitem"><i class="tl-svc-tdot" style="background:${TL_TYPE.request.color}"></i>요청</span>
          </div>
        </div>
        <div class="tl-svc-grid" aria-label="서비스별 유형 세분 시간대 활동"></div>
      </div>`;

    drawBarsChart(host);     // A
    drawCumChart(host);      // B
    drawSvcChart(host);      // C
    bindTimelineInteractions(host);
  }

  // ── 공통: 현재 view에 맞는 시간 그리드(세로선+시각라벨) SVG 생성. A·B 차트 공용. ──
  function tlTimeGrid(v0, v1, VBW, padT, baseY, labelY) {
    const span = (v1 - v0) || 1, viewHrs = span / 3600000;
    const stepH = viewHrs <= 3 ? 1 : (viewHrs <= 9 ? 3 : 6);
    const stepMs = stepH * 3600000;
    const xOf = (t) => ((t - v0) / span) * VBW;
    let g = "", g0 = Math.ceil(v0 / stepMs) * stepMs;
    for (let t = g0; t <= v1; t += stepMs) {
      const x = xOf(t).toFixed(1);
      const hh = String(new Date(t).getHours()).padStart(2, "0");
      g += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${baseY}" class="tl-gridline"/>`;
      if (labelY != null) g += `<text x="${x}" y="${labelY}" class="tl-gridtxt">${hh}시</text>`;
    }
    return g;
  }

  // ── 공통: view 범위에 맞는 단위시간 막대 버킷 폭/집계. A 차트 + crosshair 공용. ──
  //   거짓 채움 0(FLR-AGT-002): 빈 구간은 막대 없음(높이 0=그리지 않음), 보간·최소높이 없음.
  function tlBarBuckets(tl, v0, v1) {
    const viewHrs = ((v1 - v0) || 1) / 3600000;
    // 보이는 시간폭을 약 30칸으로 — 0.5/1/2/3/6h 스냅(전체 보기서도 시간당 변동이 촘촘).
    // "자세한 시간대" 1단계: 깊게 줌인(≤12h)하면 30분(0.5h) 버킷으로 세밀화 — 1시간 안의
    // 변동까지 분해(거짓 채움 0: 빈 30분 칸은 막대 없음). 6h 같은 넓은 칸은 불변(전체보기 회귀 0).
    const barHrs = viewHrs <= 12 ? 0.5
      : viewHrs <= 60 ? 1 : viewHrs <= 96 ? 2 : viewHrs <= 200 ? 3 : 6;
    const barStepMs = barHrs * 3600000;
    const buckets = {}; // bucketStartMs → count(전 시리즈 합 = 그 시간대 '실제' 밀도)
    // 대표 catch(번다운 시간단위): "요청이 몇 개이고 그래서 몇 개 해결됐는지" 정보 부재.
    //   → 버킷 합과 함께 유형 분해(요청 발생 / 판정 처리)를 동시 집계. 데이터=activity_timeline e.type
    //   (verdict=판정 실측 mtime / request=요청 포착). 합성 0(FLR-AGT-002): 이미 그 버킷에 든 이벤트만 셈.
    //   ※ '해결수'를 직접 박지 않고 '판정(처리)'으로 정직 라벨 — 요청 close 전이 시각은 SSOT 부재
    //     (burndown-design §2.2). 판정 처리 = "그 시간대에 몇 건이 판정나 처리됐나"의 실측 근사.
    const typed = {}; // bucketStartMs → { request, verdict, round }
    tl.forEach((e) => {
      const b = Math.floor(e.t / barStepMs) * barStepMs;
      buckets[b] = (buckets[b] || 0) + 1;
      if (!typed[b]) typed[b] = { request: 0, verdict: 0, round: 0 };
      if (e.type === "request" || e.type === "verdict" || e.type === "round") typed[b][e.type] += 1;
    });
    let max = 0; for (const b in buckets) max = Math.max(max, buckets[b]);
    return { buckets, typed, barStepMs, barStepH: barHrs, max };
  }

  // ── A: 단위시간당 변동 (막대 단독, full 높이) ──
  //   대표 직답: 누적이라 단위시간 변동폭이 안 보임 → 막대만 단독으로 큼직하게, plot 전체 높이 사용.
  //   줌/팬은 이 차트에 귀속(시간축 탐색의 본질). 거짓 채움 0(빈 칸=막대 없음).
  function drawBarsChart(host) {
    const svg = host.querySelector(".tl-svg-bars");
    if (!svg) return;
    const tl = tlState.events;
    const [v0, v1] = tlState.view;
    const span = (v1 - v0) || 1;
    const VBW = tlState.vbw, VBH = 132, PADT = 8, PADB = 24, baseY = VBH - PADB;
    const plotH = baseY - PADT;
    const xOf = (t) => ((t - v0) / span) * VBW;

    const { buckets, typed, barStepMs, barStepH, max } = tlBarBuckets(tl, v0, v1);
    const barMax = max || 1;
    const yOf = (c) => baseY - (c / barMax) * plotH;
    // 막대 title/crosshair에 쓸 유형 분해 라벨 — "요청 R · 판정 V"(0이면 생략, 거짓 채움 0).
    const breakdownTxt = (b) => {
      const tb = typed[b]; if (!tb) return "";
      const parts = [];
      if (tb.request) parts.push("요청 " + tb.request);
      if (tb.verdict) parts.push("판정 " + tb.verdict);
      if (tb.round) parts.push("라운드 " + tb.round);
      return parts.length ? " (" + parts.join(" · ") + ")" : "";
    };

    // 그리드 — 시간 세로선 + 시각라벨 + Y 가로눈금(4단계).
    let gridSvg = tlTimeGrid(v0, v1, VBW, PADT, baseY, VBH - 7);
    const yTicks = niceYticks(barMax, 4);
    yTicks.forEach((v) => {
      const y = yOf(v).toFixed(1);
      gridSvg += `<line x1="0" y1="${y}" x2="${VBW}" y2="${y}" class="tl-ygrid${v === 0 ? " tl-baseline" : ""}"/>`;
    });

    // 막대 — view에 걸치는 버킷만(양 끝 1칸 여유). 빈 칸은 그리지 않음.
    const barW = (barStepMs / span) * VBW;
    const barPad = Math.min(barW * 0.16, 3);
    let barsSvg = "";
    const bStart = Math.floor(v0 / barStepMs) * barStepMs, bEnd = Math.ceil(v1 / barStepMs) * barStepMs;
    for (let b = bStart; b <= bEnd; b += barStepMs) {
      const c = buckets[b]; if (!c) continue; // 거짓 채움 0
      const x = xOf(b) + barPad, w = Math.max(barW - barPad * 2, 1);
      const y = yOf(c), h = baseY - y;
      barsSvg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" class="tlb-bar" data-bucket="${b}" data-count="${c}"><title>${tlFmt(b)}~ ${barStepH}시간 · ${c}건${breakdownTxt(b)}</title></rect>`;
    }

    host.querySelector(".tlb-grid").innerHTML = gridSvg;
    host.querySelector(".tlb-bars").innerHTML = barsSvg;

    // Y축 라벨 overlay.
    const yax = host.querySelector(".tlb-yaxis");
    if (yax) yax.innerHTML = yTicks.filter((v) => v > 0).map((v) =>
      `<span style="top:${((yOf(v)) / VBH * 100).toFixed(1)}%">${v}</span>`).join("");

    // crosshair용 박제. typed(유형 분해)도 보존 — 크로스헤어 툴팁이 요청/판정 건수 표시(대표 catch).
    tlState._drawBars = { buckets, typed, barStepMs, barStepH, barMax, yOf, xOf, baseY, PADT, VBW, VBH };

    // 축/범위 라벨 + 전체보기 버튼.
    const [f0, f1] = tlState.full;
    const isFull = v0 <= f0 + 1 && v1 >= f1 - 1;
    const fromEl = host.querySelector(".tl-axis-from"), toEl = host.querySelector(".tl-axis-to");
    if (fromEl) fromEl.textContent = tlFmt(v0);
    if (toEl) toEl.textContent = tlFmt(v1);
    const rl = host.querySelector(".tl-range-label");
    if (rl) rl.textContent = isFull ? "전체 기간" : "확대됨 · " + tlFmtRange(v0, v1);
    const rb = host.querySelector(".tl-reset");
    if (rb) rb.hidden = isFull;
  }

  // ── B: 누적 추세 (총합 라인 단독, 작게) ──
  //   한 메시지 = "전체가 우상향으로 쌓인다". A와 같은 view(줌/팬 연동), 인터랙션은 안 받음(A가 주도).
  //   거짓 0 채움 금지: 데이터 없으면 그냥 평평(실제 누적이 그대로 멈춤).
  function drawCumChart(host) {
    const svg = host.querySelector(".tl-svg-cum");
    if (!svg) return;
    const tl = tlState.events;
    const [v0, v1] = tlState.view;
    const span = (v1 - v0) || 1;
    const VBW = tlState.vbw, VBH = 96, PADT = 8, PADB = 16, baseY = VBH - PADB;
    const plotH = baseY - PADT;
    const xOf = (t) => ((t - v0) / span) * VBW;

    // 총합 누적 step — *전체 기간* 기준 계산, view만 잘라 그림(줌해도 절대 높이 일관).
    let totalCum = 0; const totalSteps = [[tl[0].t, 0]];
    tl.forEach((e) => { totalCum++; totalSteps.push([e.t, totalCum]); });
    totalSteps.push([tlState.full[1], totalCum]);
    const yMax = totalCum || 1;
    const yOf = (v) => baseY - (v / yMax) * plotH;

    // 그리드(시각라벨은 A가 하단에 이미 표시 → 여기선 세로선만, 라벨 생략) + Y 4단계.
    let gridSvg = tlTimeGrid(v0, v1, VBW, PADT, baseY, null);
    const yTicks = niceYticks(yMax, 3);
    yTicks.forEach((v) => {
      const y = yOf(v).toFixed(1);
      gridSvg += `<line x1="0" y1="${y}" x2="${VBW}" y2="${y}" class="tl-ygrid${v === 0 ? " tl-baseline" : ""}"/>`;
    });

    // step-after 라인 path + 면적(미세 fill로 '쌓임' 강조).
    let dd = "";
    for (let i = 0; i < totalSteps.length; i++) {
      const [t, v] = totalSteps[i];
      const x = xOf(t), y = yOf(v);
      dd += i === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : `H${x.toFixed(1)}V${y.toFixed(1)}`;
    }
    const lastX = xOf(totalSteps[totalSteps.length - 1][0]).toFixed(1);
    const firstX = xOf(totalSteps[0][0]).toFixed(1);
    const areaD = dd + `H${lastX}V${baseY.toFixed(1)}H${firstX}Z`;
    const lineSvg = `<path d="${areaD}" class="tlc-area"/><path d="${dd}" fill="none" class="tlc-stroke"/>`;

    host.querySelector(".tlc-grid").innerHTML = gridSvg;
    host.querySelector(".tlc-line").innerHTML = lineSvg;
    const yax = host.querySelector(".tlc-yaxis");
    if (yax) yax.innerHTML = yTicks.filter((v) => v > 0).map((v) =>
      `<span style="top:${((yOf(v)) / VBH * 100).toFixed(1)}%">${v}</span>`).join("");

    tlState._drawCum = { totalSteps, yOf, xOf, baseY, PADT, yMax, VBW, VBH };
  }

  // ── C: 서비스 > 유형 계층 활동 — small multiples. 전체 기간 고정, 서비스별 mini 막대 1줄씩. ──
  //   1차=서비스(행), 2차=유형(막대 스택 3색: 판정·라운드·요청). "어느 서비스가 어떤 유형 활동을 했나"가 한 메시지.
  //   동적 서비스(하드코딩 0). 모바일=CSS grid 1열 적층. 유형 색 의미는 상단 범례 1회.
  //   각 미니차트는 같은 시간 버킷·같은 시간폭(정렬). 한 버킷 = 유형별 스택(아래부터 판정→라운드→요청).
  //   Y는 전 서비스·전 버킷 공통 스케일(행 간 높이 비교 가능). 거짓 채움 0: 빈 시간대는 막대 없음.
  //   세그먼트 최소 높이 보장(1건도 1.2px↑ 보이게 — false-fidelity 방지). 툴팁=버킷 유형별 내역.
  const SVC_TYPE_ORDER = ["request", "round", "verdict"]; // 스택 하단→상단 (요청→라운드→판정)
  function drawSvcChart(host) {
    const grid = host.querySelector(".tl-svc-grid");
    if (!grid) return;
    const tl = tlState.events;
    const [f0, f1] = tlState.full;
    const span = (f1 - f0) || 1;
    const keys = tlState.keys; // 서비스(repo) 키 — mode 고정 'repo'

    // 전체 기간 기준 단위시간 버킷(시간폭 따라 1/2/3/6h) — 전 행 공통 축.
    const { barStepMs, barStepH } = tlBarBuckets(tl, f0, f1);
    const bStart = Math.floor(f0 / barStepMs) * barStepMs, bEnd = Math.floor(f1 / barStepMs) * barStepMs;

    // 서비스 × 버킷 × 유형 3중 집계. perKey[svc][bucket] = {verdict, round, request}.
    const perKey = {}; keys.forEach((k) => { perKey[k] = {}; });
    tl.forEach((e) => {
      const k = (e.repo && String(e.repo).trim()) || "미상";
      if (perKey[k] == null) perKey[k] = {};
      const b = Math.floor(e.t / barStepMs) * barStepMs;
      if (!perKey[k][b]) perKey[k][b] = { verdict: 0, round: 0, request: 0 };
      const ty = TL_TYPE[e.type] ? e.type : null;
      if (ty) perKey[k][b][ty] += 1; else perKey[k][b].request += 0; // 미상 유형은 스택서 제외(높이 0)
    });
    // 공통 스케일 = 전 서비스·전 버킷의 총합(스택 높이) 최댓값.
    let globalMax = 0;
    keys.forEach((k) => { for (const b in perKey[k]) { const s = perKey[k][b]; globalMax = Math.max(globalMax, s.verdict + s.round + s.request); } });
    globalMax = globalMax || 1;

    // 서비스별 총건수 + 유형별 내역(행 라벨용).
    const total = {}, byType = {};
    keys.forEach((k) => { total[k] = 0; byType[k] = { verdict: 0, round: 0, request: 0 }; });
    tl.forEach((e) => {
      const k = (e.repo && String(e.repo).trim()) || "미상";
      if (total[k] == null) { total[k] = 0; byType[k] = { verdict: 0, round: 0, request: 0 }; }
      total[k] += 1;
      if (TL_TYPE[e.type]) byType[k][e.type] += 1;
    });

    const MVBW = 1000, MVBH = 40, mBaseY = MVBH, mPlotH = mBaseY - 2, MIN_SEG = 1.2;
    const mxOf = (t) => ((t - f0) / span) * MVBW;
    const mBarW = (barStepMs / span) * MVBW;
    const mPad = Math.min(mBarW * 0.16, 2);

    grid.innerHTML = keys.map((k) => {
      const bkts = perKey[k] || {};
      let pHk = null, pN = 0; // 이 서비스 피크 시간대(스택 총합 기준).
      for (const b in bkts) { const s = bkts[b], sum = s.verdict + s.round + s.request; if (sum > pN) { pN = sum; pHk = +b; } }
      const peakTxt = pHk != null ? `${String(new Date(pHk).getHours()).padStart(2, "0")}시 피크` : "—";
      let bars = "";
      for (let b = bStart; b <= bEnd; b += barStepMs) {
        const s = bkts[b]; if (!s) continue;
        const sum = s.verdict + s.round + s.request; if (!sum) continue; // 거짓 채움 0
        const x = mxOf(b) + mPad, w = Math.max(mBarW - mPad * 2, 1);
        let yTop = mBaseY;
        // 아래부터 위로 스택(요청→라운드→판정). 0건 유형은 건너뜀, 1건도 MIN_SEG 보장.
        SVC_TYPE_ORDER.forEach((ty) => {
          const c = s[ty]; if (!c) return;
          const h = Math.max((c / globalMax) * mPlotH, MIN_SEG);
          yTop -= h;
          bars += `<rect x="${x.toFixed(1)}" y="${yTop.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="0.8" fill="${TL_TYPE[ty].color}" class="tls-bar"/>`;
        });
        // 한 버킷 통합 툴팁(유형별 내역).
        const parts = SVC_TYPE_ORDER.filter((ty) => s[ty]).map((ty) => `${TL_TYPE[ty].label} ${s[ty]}`).join(" · ");
        const hSum = Math.max((sum / globalMax) * mPlotH, MIN_SEG);
        bars += `<rect x="${x.toFixed(1)}" y="${(mBaseY - hSum).toFixed(1)}" width="${w.toFixed(1)}" height="${hSum.toFixed(1)}" fill="transparent"><title>${tlFmt(b)}~ ${barStepH}시간 · ${sum}건 (${parts})</title></rect>`;
      }
      // 행 라벨: 서비스명 + 총건수 + 유형 내역(0 아닌 것만, 색점).
      const typeChips = SVC_TYPE_ORDER.filter((ty) => byType[k][ty]).map((ty) =>
        `<i class="tl-svc-tchip"><i class="tl-svc-tdot" style="background:${TL_TYPE[ty].color}"></i>${byType[k][ty]}</i>`).join("");
      return `<div class="tl-svc-row">
        <div class="tl-svc-meta">
          <span class="tl-svc-name">${escape(repoDisplay(k))}</span>
          <span class="tl-svc-cnt"><b>${total[k] || 0}</b>${typeChips}</span>
        </div>
        <svg class="tl-svc-svg" viewBox="0 0 ${MVBW} ${MVBH}" preserveAspectRatio="none"
             role="img" aria-label="${escape(k)} 시간대별 활동 ${total[k] || 0}건 (판정 ${byType[k].verdict} 라운드 ${byType[k].round} 요청 ${byType[k].request})">${bars}</svg>
      </div>`;
    }).join("");
  }

  // Y축 "보기 좋은" 눈금값 배열(0 포함, n단계 근사). 정수 누적이므로 1/2/5×10ⁿ 스텝.
  function niceYticks(maxV, n) {
    if (maxV <= 0) return [0];
    const raw = maxV / n;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    const ticks = [];
    for (let v = 0; v <= maxV + 0.0001; v += step) ticks.push(Math.round(v));
    if (ticks[ticks.length - 1] < maxV) ticks.push(Math.round(Math.ceil(maxV / step) * step));
    return ticks;
  }

  // 특정 시각 t에서 한 시리즈의 누적값(step-after lookup) — crosshair 툴팁용.
  function tlCumAt(pts, t) {
    let v = 0;
    for (let i = 0; i < pts.length; i++) { if (pts[i][0] <= t) v = pts[i][1]; else break; }
    return v;
  }

  // A+B 동시 재그리기(같은 view 공유). 인터랙션은 A가 주도하지만 B도 늘 함께 갱신.
  function redraw(host) { drawBarsChart(host); drawCumChart(host); }

  // 드래그(팬) + 휠/더블탭(줌) + 호버/탭(툴팁) 바인딩. pointer 이벤트로 마우스·터치 통합.
  //   줌/팬은 ① 단위시간 변동 차트(A)에 귀속 — 시간축 탐색의 본질. ②(누적)는 같은 view로 연동 갱신.
  //   ③(서비스별 small multiples)는 전체 기간 고정(인터랙션 없음 — 인지부하 집중 회피).
  function bindTimelineInteractions(host) {
    const svg = host.querySelector(".tl-svg-bars"); // ← A 차트가 인터랙션 주체
    const tip = host.querySelector(".tlb-tip");
    const resetBtn = host.querySelector(".tl-reset");

    // (서비스별↔유형별 동급 토글 제거 — 유형 단독은 서비스 맥락이 없어 무의미.
    //  이제 C는 서비스 1차 · 유형 2차(스택) 고정. 분류 전환 핸들러 없음.)

    if (!svg) return;
    const VBW = tlState.vbw;
    const minSpan = 5 * 60000; // 최소 5분까지 확대

    const clampView = (v0, v1) => {
      const [f0, f1] = tlState.full;
      let span = v1 - v0;
      const fullSpan = (f1 - f0) || 1;
      if (span > fullSpan) span = fullSpan;
      if (span < minSpan) span = minSpan;
      if (v0 < f0) { v0 = f0; v1 = f0 + span; }
      if (v1 > f1) { v1 = f1; v0 = f1 - span; }
      if (v0 < f0) v0 = f0;
      return [v0, v1];
    };
    // 화면 px → viewBox X.
    const pxToVbX = (clientX) => {
      const r = svg.getBoundingClientRect();
      return ((clientX - r.left) / (r.width || 1)) * VBW;
    };
    const vbxToTime = (vbx) => {
      const [v0, v1] = tlState.view;
      return v0 + (vbx / VBW) * (v1 - v0);
    };

    // ── 드래그 팬 ──
    let dragging = false, moved = false, startX = 0, startView = null, pointerId = null;
    svg.style.touchAction = "none"; // 모바일: 가로 드래그가 페이지 스크롤로 새지 않게
    svg.addEventListener("pointerdown", (ev) => {
      dragging = true; moved = false; startX = ev.clientX; startView = tlState.view.slice();
      pointerId = ev.pointerId;
      try { svg.setPointerCapture(pointerId); } catch (e) {}
      svg.classList.add("tl-grabbing");
    });
    svg.addEventListener("pointermove", (ev) => {
      // 툴팁(드래그 중이 아닐 때).
      if (!dragging) { showTipAt(ev); return; }
      const dxPx = ev.clientX - startX;
      if (Math.abs(dxPx) > 2) moved = true;
      const r = svg.getBoundingClientRect();
      const span = startView[1] - startView[0];
      const dt = -(dxPx / (r.width || 1)) * span; // 오른쪽 드래그 → 과거로
      const nv = clampView(startView[0] + dt, startView[1] + dt);
      tlState.view = nv;
      redraw(host);
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      svg.classList.remove("tl-grabbing");
      try { if (pointerId != null) svg.releasePointerCapture(pointerId); } catch (e) {}
      tlState.view = tlState.view.slice(); // 보던 범위 박제
    };
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
    svg.addEventListener("pointerleave", () => { if (tip) tip.hidden = true; });

    // ── 휠 줌 (커서 지점 중심) ──
    svg.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      const [v0, v1] = tlState.view;
      const span = v1 - v0;
      const focusT = vbxToTime(pxToVbX(ev.clientX));
      const factor = ev.deltaY < 0 ? 0.8 : 1.25; // 위로=확대
      const nSpan = span * factor;
      const ratio = (focusT - v0) / span;
      let nv0 = focusT - ratio * nSpan, nv1 = nv0 + nSpan;
      tlState.view = clampView(nv0, nv1);
      redraw(host);
    }, { passive: false });

    // ── 더블탭/더블클릭 줌인 (모바일 핀치 대체 보조) ──
    svg.addEventListener("dblclick", (ev) => {
      const [v0, v1] = tlState.view;
      const span = v1 - v0;
      const focusT = vbxToTime(pxToVbX(ev.clientX));
      const nSpan = span * 0.5;
      const ratio = (focusT - v0) / span;
      tlState.view = clampView(focusT - ratio * nSpan, focusT - ratio * nSpan + nSpan);
      redraw(host);
    });
    // 터치 더블탭 (300ms 이내 두 번).
    let lastTap = 0;
    svg.addEventListener("pointerup", (ev) => {
      if (ev.pointerType !== "touch") return;
      const now = Date.now();
      if (now - lastTap < 300 && !moved) {
        const [v0, v1] = tlState.view;
        const span = v1 - v0;
        const focusT = vbxToTime(pxToVbX(ev.clientX));
        const nSpan = span * 0.5;
        const ratio = (focusT - v0) / span;
        tlState.view = clampView(focusT - ratio * nSpan, focusT - ratio * nSpan + nSpan);
        redraw(host);
      }
      lastTap = now;
    });

    // ── 핀치 줌 (두 손가락) ──
    const activePts = new Map();
    let pinchBase = null;
    svg.addEventListener("pointerdown", (ev) => { activePts.set(ev.pointerId, ev.clientX); });
    svg.addEventListener("pointermove", (ev) => {
      if (!activePts.has(ev.pointerId)) return;
      activePts.set(ev.pointerId, ev.clientX);
      if (activePts.size === 2) {
        dragging = false; svg.classList.remove("tl-grabbing");
        const xs = [...activePts.values()];
        const dist = Math.abs(xs[0] - xs[1]) || 1;
        const midPx = (xs[0] + xs[1]) / 2;
        if (!pinchBase) { pinchBase = { dist, view: tlState.view.slice(), midT: vbxToTime(pxToVbX(midPx)) }; return; }
        const scale = pinchBase.dist / dist; // 벌리면 dist↑ → scale<1 → 확대
        const baseSpan = pinchBase.view[1] - pinchBase.view[0];
        const nSpan = baseSpan * scale;
        const ratio = (pinchBase.midT - pinchBase.view[0]) / baseSpan;
        tlState.view = clampView(pinchBase.midT - ratio * nSpan, pinchBase.midT - ratio * nSpan + nSpan);
        redraw(host);
      }
    });
    const dropPt = (ev) => { activePts.delete(ev.pointerId); if (activePts.size < 2) pinchBase = null; };
    svg.addEventListener("pointerup", dropPt);
    svg.addEventListener("pointercancel", dropPt);

    // ── 키보드 접근성: ←/→ 팬, +/- 줌 ──
    svg.addEventListener("keydown", (ev) => {
      const [v0, v1] = tlState.view; const span = v1 - v0;
      if (ev.key === "ArrowLeft")  { tlState.view = clampView(v0 - span * 0.25, v1 - span * 0.25); redraw(host); ev.preventDefault(); }
      else if (ev.key === "ArrowRight") { tlState.view = clampView(v0 + span * 0.25, v1 + span * 0.25); redraw(host); ev.preventDefault(); }
      else if (ev.key === "+" || ev.key === "=") { const m = (v0 + v1) / 2, n = span * 0.6; tlState.view = clampView(m - n / 2, m + n / 2); redraw(host); ev.preventDefault(); }
      else if (ev.key === "-" || ev.key === "_") { const m = (v0 + v1) / 2, n = span * 1.6; tlState.view = clampView(m - n / 2, m + n / 2); redraw(host); ev.preventDefault(); }
    });

    // ── 전체보기 버튼 ──
    if (resetBtn) resetBtn.addEventListener("click", () => { tlState.view = tlState.full.slice(); redraw(host); });

    // ── crosshair 툴팁 — 호버/탭 지점의 시각 + 그 단위시간 구간 건수(A) + 그때까지 누적(B). ──
    //   crosshair 세로선은 A(막대)·B(누적) 양쪽에 동시에 떠서 두 차트가 같은 시각을 가리킴을 명시.
    const cursorB = host.querySelector(".tlb-cursor"); // A 차트 crosshair 레이어
    const cursorC = host.querySelector(".tlc-cursor"); // B 차트 crosshair 레이어
    function showTipAt(ev) {
      if (!tip) return;
      const db = tlState._drawBars, dc = tlState._drawCum;
      if (!db) return;
      const vbx = pxToVbX(ev.clientX);
      if (vbx < 0 || vbx > VBW) { tip.hidden = true; if (cursorB) cursorB.innerHTML = ""; if (cursorC) cursorC.innerHTML = ""; return; }
      const t = vbxToTime(vbx);
      // 이 단위시간 구간(A) 건수 + 그때까지 누적(B).
      const bk = Math.floor(t / db.barStepMs) * db.barStepMs;
      const bc = db.buckets[bk] || 0;
      const cumV = dc ? tlCumAt(dc.totalSteps, t) : null;
      // A crosshair — 세로선 + 해당 막대 상단 도트.
      const xb = db.xOf(t);
      let cb = `<line x1="${xb.toFixed(1)}" y1="${db.PADT}" x2="${xb.toFixed(1)}" y2="${db.baseY}" class="tl-crossline"/>`;
      if (bc > 0) cb += `<circle cx="${(db.xOf(bk) + (db.barStepMs / (tlState.view[1] - tlState.view[0])) * db.VBW / 2).toFixed(1)}" cy="${db.yOf(bc).toFixed(1)}" r="3" class="tl-crossdot tl-crossdot-bar"/>`;
      if (cursorB) cursorB.innerHTML = cb;
      // B crosshair — 같은 시각 세로선 + 누적 라인 교차 도트.
      if (cursorC && dc) {
        const xc = dc.xOf(t);
        let cc = `<line x1="${xc.toFixed(1)}" y1="${dc.PADT}" x2="${xc.toFixed(1)}" y2="${dc.baseY}" class="tl-crossline"/>`;
        if (cumV != null) cc += `<circle cx="${xc.toFixed(1)}" cy="${dc.yOf(cumV).toFixed(1)}" r="3" class="tl-crossdot tl-crossdot-cum"/>`;
        cursorC.innerHTML = cc;
      }
      // 툴팁 — 시각 + 구간 건수(주) + 유형 분해(요청/판정) + 누적(보조).
      //   대표 catch(번다운 시간단위): 시간단위에 "요청 몇 개·해결 몇 개" 정보 부재 → 이 구간의
      //   요청 발생 / 판정 처리를 분해 표기(실측·합성 0). '해결'은 판정(처리)로 정직 라벨
      //   (요청 close 전이 시각 SSOT 부재 — burndown-design §2.2). 0인 유형은 줄 생략(거짓 채움 0).
      const tb = (db.typed && db.typed[bk]) || null;
      let breakRows = "";
      if (tb) {
        if (tb.request) breakRows += `<div class="tl-tip-row"><i class="tl-tip-sw-req"></i><span>요청 발생</span><b>${tb.request}건</b></div>`;
        if (tb.verdict) breakRows += `<div class="tl-tip-row"><i class="tl-tip-sw-vrd"></i><span>판정 처리</span><b>${tb.verdict}건</b></div>`;
        if (tb.round) breakRows += `<div class="tl-tip-row"><i class="tl-tip-sw-rnd"></i><span>라운드</span><b>${tb.round}건</b></div>`;
      }
      tip.innerHTML =
        `<div class="tl-tip-time">${tlFmt(bk)}~ ${db.barStepH}시간</div>`
        + `<div class="tl-tip-row tl-tip-main"><i class="tl-tip-sw-bar"></i><span>이 구간 활동</span><b>${bc}건</b></div>`
        + breakRows
        + (cumV != null ? `<div class="tl-tip-row"><i class="tl-tip-sw-cum"></i><span>그때까지 누적</span><b>${cumV}건</b></div>` : "");
      tip.hidden = false;
      const wrap = host.querySelector(".tl-wrap-bars");
      const wr = wrap.getBoundingClientRect();
      const localX = ev.clientX - wr.left;
      let left = localX + 14;
      if (left + tip.offsetWidth > wr.width) left = localX - tip.offsetWidth - 14;
      if (left < 0) left = 2;
      tip.style.left = left + "px";
      tip.style.top = "6px";
    }
    svg.addEventListener("pointermove", showTipAt, { passive: true });
    svg.addEventListener("pointerleave", () => { if (cursorB) cursorB.innerHTML = ""; if (cursorC) cursorC.innerHTML = ""; });
  }

  // ② 품질 수렴 추이 — repo별 회차 × 품질점수(4축 평균, 높을수록 좋음).
  //    막대 높이 = quality_score(0~10 정규화). 결함합(P0+신규P1)은 보조 라벨/툴팁.
  //    둘 다 null이면 "미측정"(사선·4px). 거짓 0 색칠 금지(FLR-AGT-002).
  //    품질점수를 주 지표로 삼는 이유: 결함합은 대개 0(이미 수렴 근처)이라 평평 →
  //    "회차 돌며 개선됐나"의 실곡선은 4축 품질점수가 보여줌(조니 P1-A 직답).
  function renderConvTrend(conv) {
    const trend = conv.trend || {};
    const repos = Object.keys(trend).sort();
    if (!repos.length) { el("conv-trend").innerHTML = '<p class="hint">라운드 데이터 없음</p>'; return; }
    const QMAX = 10; // 4축 만점
    el("conv-trend").innerHTML = repos.map((repo) => {
      const pts = trend[repo] || [];
      // 측정 = 품질점수 OR 결함합 중 하나라도 실측된 회차
      const qMeasured = pts.filter((p) => p.quality_score != null).length;
      const anyMeasured = pts.filter(
        (p) => p.quality_score != null || p.defect_sum != null
      ).length;
      const bars = pts.map((p) => {
        const hasQ = p.quality_score != null;
        const hasD = p.defect_sum != null;
        const label = p.alias || p.round_id;
        const cls = stateMeta(p.state).cls;
        // 주 막대 높이 = 품질점수(0~10 → px). 품질 없으면 미측정 막대.
        const h = hasQ ? Math.max(Math.round((p.quality_score / QMAX) * 110), 6) : 4;
        const headline = hasQ ? p.quality_score.toFixed(1) : (hasD ? "—" : "미측정");
        // 결함합 보조 표기 (있을 때만): "결함 N"
        const defTxt = hasD ? `결함 ${p.defect_sum}` : "";
        const tip = `${label} · ${stateMeta(p.state).label}`
          + ` · 품질 ${hasQ ? p.quality_score.toFixed(1) + "/10 (4축평균)" : "미측정"}`
          + ` · 결함합 ${hasD ? p.defect_sum : "미측정"}`
          + ` · 판정 ${p.verdict_count}건`;
        return `<div class="conv-bar-col" title="${escape(tip)}">
          <div class="conv-bar-val">${escape(headline)}</div>
          <div class="conv-bar ${cls} ${hasQ ? "" : "conv-bar-unknown"}" style="height:${h}px"></div>
          ${defTxt ? `<div class="conv-bar-def">${escape(defTxt)}</div>` : ""}
          <div class="conv-bar-x">${escape(label)}</div>
        </div>`;
      }).join("");
      // 측정 안내 — 거짓 0 막대 아님을 명시(FLR-AGT-002).
      const note = anyMeasured === 0
        ? `<span class="conv-trend-note">품질·결함 수치 미측정 — 막대는 0이 아니라 "측정 안 됨"(사선)</span>`
        : `<span class="conv-trend-note">품질 측정 ${qMeasured}/${pts.length}회차</span>`;
      return `<div class="conv-trend-repo">
        <div class="conv-trend-title">${escape(repoDisplay(repo))} ${note}</div>
        <div class="conv-bars">${bars}</div></div>`;
    }).join("");
  }

  // ③ 지금 진행 중 — 진행/판정 대기 라운드만
  function renderConvActive(conv) {
    const rounds = (conv.rounds || []).filter((r) => ACTIVE_ROUND_STATES.includes(r.state));
    if (!rounds.length) {
      el("conv-active").innerHTML = '<p class="hint conv-idle">현재 진행 중인 라운드가 없습니다. 모든 라운드가 마무리되었거나 대기 상태입니다.</p>';
      return;
    }
    rounds.sort((a, b) => roundNum(b.round_id) - roundNum(a.round_id));
    el("conv-active").innerHTML = `<div class="conv-active-list">${rounds.map((r) => {
      const m = stateMeta(r.state);
      return `<div class="conv-active-card">
        <div class="ac-top">
          <span class="badge ${m.cls}">${escape(m.label)}</span>
          <code>${escape(r.alias || r.round_id)}</code>
          <span class="ac-repo">${escape(repoDisplay(r.repo || ""))}</span>
        </div>
        <div class="ac-req">${mdSafe(r.request_refs || "대상 요청 미지정")}</div>
        <div class="ac-meta">패널: ${mdSafe(r.panel || "-")}${r.tier ? " · " + mdSafe(r.tier) : ""}</div>
      </div>`;
    }).join("")}</div>`;
  }

  // ④ 요청별 진행 상태 — repo 그룹 카드 + 진행률 바 + 펼침(라운드/판정)
  function renderConvRequests(conv) {
    const reqs = conv.requests || [];
    const rounds = conv.rounds || [];
    const repos = [...new Set(reqs.map((r) => r.repo).filter(Boolean))].sort();
    const sel = el("conv-repo");
    sel.innerHTML = '<option value="">전체 repo</option>' +
      repos.map((r) => `<option value="${escape(r)}">${escape(repoDisplay(r))}</option>`).join("");

    // repo 라벨 평이화: '—' = 미분류
    const repoLabel = (r) => (!r || r === "—") ? "미분류" : r;

    // 정렬 비교자 (최신/진척/우선순위). 정렬 셀렉터는 선택사항(없으면 기본=우선순위).
    // [2단계] 막힘·보류 카드를 맨 위로 — 모든 정렬 모드 공통 최우선 키(stuckRank).
    //   대표 관심사 = "무엇이 막혔나" → 정렬 기준 무관 교착/보류가 항상 위. blocked 또는 state=보류.
    const sortEl = el("conv-req-sort");
    const prioRank = (p) => ({ P0: 0, P1: 1, P2: 2, P3: 3 }[p] ?? 4);
    const stuckRank = (r) => (r.blocked === true || r.state === "보류") ? 0 : 1; // 0 = 막힘/보류(위)
    function cmp(by) {
      let inner;
      if (by === "recent") {
        // 최신: latest_round_id 회차 큰 순 → req_id 역순(근사 최신)
        inner = (a, b) => roundNum(b.latest_round_id) - roundNum(a.latest_round_id)
          || String(b.req_id || "").localeCompare(String(a.req_id || ""));
      } else if (by === "progress") {
        // 진척: progress_pct 높은 순 (null은 뒤로)
        inner = (a, b) => (b.progress_pct ?? -1) - (a.progress_pct ?? -1);
      } else {
        // priority(기본): priority → 열림 → progress (막힘/보류는 stuckRank가 위로 이미 끌어올림)
        inner = (a, b) =>
          prioRank(a.priority) - prioRank(b.priority)
          || (isOpenState(b.state) - isOpenState(a.state))
          || (b.progress_pct ?? -1) - (a.progress_pct ?? -1);
      }
      // 막힘/보류 최우선(전 모드 공통) → 그 안에서 선택 정렬.
      return (a, b) => (stuckRank(a) - stuckRank(b)) || inner(a, b);
    }

    const draw = () => {
      const q = el("conv-req-search").value.trim().toLowerCase();
      const rf = sel.value;
      const by = sortEl ? sortEl.value : "priority";
      // REQ-010: 결단보드 stat 클릭이 세팅한 상태 필터(막힘/결정대기). 검색·repo 필터와 AND.
      const sf = state.reqStateFilter || "";
      const filtered = reqs.filter((r) => {
        if (rf && r.repo !== rf) return false;
        if (sf && classifyBlocked(r) !== sf) return false;
        if (!q) return true;
        // 검색 대상에 narrative·priority·push_status·owner 추가(통합 검색)
        // 라운드2 P1-3: owner(담당자)는 33셀 표시되나 검색 미인덱스였음 → 담당자 검색 가능화.
        return [r.req_id, r.summary, r.narrative, r.state, r.repo,
                r.priority, r.owner, r.close_evidence, r.blocked_reason]
          .join(" ").toLowerCase().includes(q);
      });
      el("conv-req-count").textContent = `${filtered.length} / ${reqs.length}`;
      // REQ-010: 활성 상태 필터 칩(해제 버튼) — 사용자가 필터 걸린 줄 인지 + 한 번에 해제.
      const fchip = el("conv-req-filterchip");
      if (fchip) {
        if (sf) {
          const lbl = sf === "blocked" ? "막힌 요청" : "내 결정 대기";
          fchip.innerHTML = `<span class="rq-fchip">${escape(lbl)}만 표시 <button type="button" class="rq-fchip-x" aria-label="필터 해제">✕ 전체</button></span>`;
          fchip.hidden = false;
        } else {
          fchip.innerHTML = "";
          fchip.hidden = true;
        }
      }

      // repo로 그룹화 (정렬: HOME, PM320, 그외, 미분류)
      const groups = new Map();
      for (const r of filtered) {
        const key = r.repo || "—";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      }
      // 그룹 내부 정렬 적용
      const comparator = cmp(by);
      for (const arr of groups.values()) arr.sort(comparator);
      const order = (k) => ({ HOME: 0, PM320: 1 }[k] ?? (k === "—" ? 9 : 5));
      const sortedKeys = [...groups.keys()].sort((a, b) => order(a) - order(b) || a.localeCompare(b));

      if (!sortedKeys.length) {
        el("conv-req-cards").innerHTML = '<p class="hint">조건에 맞는 요청이 없습니다.</p>';
        return;
      }

      el("conv-req-cards").innerHTML = sortedKeys.map((key) => {
        const items = groups.get(key);
        const openN = items.filter((r) => isOpenState(r.state)).length;
        const blockedN = items.filter((r) => r.blocked === true).length;
        const cards = items.map((r) => convReqCard(r, rounds)).join("");
        // repo 그룹 헤더 — repo 라벨(텍스트 1회) + 건수/열림/막힘(있을 때).
        // P1-3: 시각 배지(repo-tag)와 텍스트 라벨이 같은 repo명을 2회 출력 → 'HOMEHOME' 중복.
        //       텍스트 라벨 1회만 유지(스크린리더 중복도 해소). 색상 위계는 .conv-repo-head 자체로.
        // RND-ADMIN-010 P1-1(조니 2심 채택): "교착"=blockedN(r.blocked===true union)인데 같은 union을
        //   요약 헤더는 "막힘(보류 포함)"으로 부름 → 3번째 동의어 제거. 단어 통일 + 동치 툴팁 부여.
        const blockedMeta = blockedN ? ` · <span style="color:var(--ru);font-weight:600" title="막힘(보류 포함) — blocked union(보류·결정대기 포함). 결단보드 '처리 필요'는 그중 진짜 장애물 subset">막힘(보류 포함) ${blockedN}</span>` : "";
        return `<div class="conv-repo-group">
          <div class="conv-repo-head">${escape(repoDisplay(repoLabel(key)))}
            <span class="conv-repo-meta">${items.length}건 · 열림 ${openN}${blockedMeta}</span></div>
          <div class="conv-repo-cards">${cards}</div>
        </div>`;
      }).join("");
    };

    el("conv-req-search").addEventListener("input", draw);
    sel.addEventListener("change", draw);
    if (sortEl) sortEl.addEventListener("change", draw);
    // REQ-010: 결단보드 stat 클릭이 외부에서 draw 를 재실행할 수 있게 등록(상태필터 반영).
    state.redrawReqCards = draw;
    // REQ-010: 활성 상태필터 칩의 '✕ 전체' 클릭 → 필터 해제 후 재그림(위임 1회).
    const fchip = el("conv-req-filterchip");
    if (fchip && !fchip.dataset.bound) {
      fchip.dataset.bound = "1";
      fchip.addEventListener("click", (e) => {
        if (e.target.closest(".rq-fchip-x")) { state.reqStateFilter = ""; draw(); }
      });
    }
    draw();
  }

  // 개별 이슈 카드 (1요청1이슈 통합 뷰) — 백엔드 신규 11종 필드 와이어.
  // [2단계] 위계 재편: 53장 카드가 화면 63%를 먹던 문제 → 기본은 1줄 행(상태점·doc_id·제목·진척%·라운드N),
  //   인용블록(narrative)·라이브배지(push/mq)·타임스탬프(판정 시각)는 펼침(클릭) 후에만. 정보 제거가 아니라
  //   접기·위계화(FLR-AGT-002 거짓 채움 0·데이터 그대로). 막힘·보류 카드는 호출부에서 맨 위 정렬.
  // 거짓 충실성 회피(FLR-AGT-002): 필드 부재 시 가짜 채우기 금지 → 표시 생략 또는 '미상'.
  // 헤더 1줄 = 상태점 + priority(막힘/P0 가시) + req_id + 제목 + 진척% + 라운드N.
  // 본문(펼침) = narrative 인용 + 라이브배지(push/mq) + 판정 시각 + 담당 + 종결근거 + latest_verdict + 관련 라운드.
  function convReqCard(r, allRounds) {
    const m = stateMeta(r.state);
    const closed = !isOpenState(r.state);
    const blocked = r.blocked === true;
    const evidMissing = (r.state === "종결" || r.state === "수렴") && !(r.close_evidence || "").trim();
    const rid = r.req_id || "";

    // ── 헤더 메타 칩들 (priority / mq_only / push_status) ──
    // priority 미명시(추정 0·FLR-AGT-002) = "미분류" 중성 칩 — P0~P3 등급으로 거짓 구분 회피.
    const prioHtml = r.priority
      ? `<span class="rq-prio ${prioClass(r.priority)}">${escape(r.priority)}</span>`
      : `<span class="rq-prio prio-none" title="우선순위 미분류 (요청 본문 P0~P3 명시 없음)">미분류</span>`;
    const mqHtml = r.mq_only === true
      ? `<span class="rq-mqonly" title="MASTER-QUEUE에만 있고 요청 레지스터 미편입">🆕 미편입</span>` : "";
    // push_status — 'unknown'은 칩 표시(추정 금지 정합). 단 종결/수렴 등 닫힌 요청만 의미 있어 항상 표시.
    const pm = pushMeta(r.push_status);
    const pushHtml = r.push_status
      ? `<span class="rq-push ${pm.cls}" title="배포 반영 상태(추정 0·해시 검증)">${escape(pm.label)}</span>` : "";

    // ── 계측 진행 트랙 — progress_pct. null이면 '미상'(거짓 0 금지). ──
    // ⚠ progress_pct는 state 기반 ordinal(종결=100·배포=90·구현중=50…)이지 실측 측정값이 아님.
    // "55%" 단독 노출 = 측정값 오인(FLR-20260613-PRC-001 라벨 인플레). → 단계 라벨(m.label) 병기 +
    // tooltip·aria로 "단계 환산값" 명시. 거짓 채움 아님(상태→환산 규칙 노출).
    // track = inner(트랙바 + 단계 라벨 + %). 호출부에서 .rq-track-wrap 로 감싸 round 칩과 정렬.
    const pct = (typeof r.progress_pct === "number") ? r.progress_pct : null;
    const stageLbl = escape(m.label);  // 상태 단계명(구현 중·배포됨 등)
    // [2단계] 1줄 행용 컴팩트 진척 — 작은 트랙 + % 만(단계 라벨/막대 본문은 펼침에서 자세히).
    //   pct 는 state 기반 ordinal(측정값 아님) → tooltip/aria로 '단계 환산값' 명시 유지(FLR-20260613-PRC-001).
    const trackMini = pct == null
      ? `<span class="rq-pct-na" title="진행률 미측정(추정 금지)">진척 미상</span>`
      : `<span class="rq-pct-mini" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
              aria-label="진행 단계 ${stageLbl} (단계 환산 ${pct}%, 측정값 아님)"
              title="진행 단계 환산값(측정값 아님) — 상태 '${stageLbl}'">
           <span class="rq-pct-track"><span class="rq-pct-fill rq-${m.cls}" style="width:${pct}%"></span></span>
           <b class="rq-pct-n">${pct}%</b></span>`;
    // 펼침용 상세 진척 — 단계 라벨 병기 풀 트랙(기존 보존, 본문으로 이동).
    const track = pct == null
      ? `<div class="rq-track-na" title="진행률 미측정(추정 금지)">진행률 미상</div>`
      : `<div class="rq-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
              aria-label="진행 단계 ${stageLbl} (단계 환산 ${pct}%, 측정값 아님)"
              title="진행 단계 환산값(측정값 아님) — 상태 '${stageLbl}' 기준">
           <span class="rq-track-fill rq-${m.cls}" style="width:${pct}%"></span>
         </div>
         <span class="rq-track-stage">${stageLbl}</span>
         <span class="rq-track-pct" title="단계 환산값(측정값 아님)">${pct}%</span>`;
    // round_count 칩 (몇 라운드 돌았나) — 0이면 '미착수'로 명시(거짓 채움 아님).
    // 라운드가 돌았으면 latest_round_state(최근 라운드 상태)를 칩에 병기(실데이터·null이면 생략).
    const rc = (typeof r.round_count === "number") ? r.round_count : null;
    const lrs = (r.latest_round_state || "").trim();
    // 1줄 행용 컴팩트 라운드 칩 (라운드 N회) + 펼침용 상세(최근 상태 병기).
    let rcMini = "", rcHtml = "";
    if (rc != null) {
      if (rc > 0) {
        const lrsTxt = lrs ? ` · ${escape(stateMeta(lrs).label)}` : "";
        rcMini = `<span class="rq-rounds-mini" title="판정 라운드 ${rc}회 (최근 ${escape(r.latest_round_id || "-")}${lrsTxt})">라운드 ${rc}회</span>`;
        rcHtml = `<span class="rq-rounds-chip" title="이 요청이 거친 판정 라운드 수 / 최근 라운드 상태 (${escape(r.latest_round_id || "-")})">라운드 ${rc}회${lrsTxt}</span>`;
      } else {
        rcMini = `<span class="rq-rounds-mini rq-rounds-none" title="아직 판정 라운드 미착수">미착수</span>`;
        rcHtml = `<span class="rq-rounds-chip" title="아직 판정 라운드 미착수">라운드 미착수</span>`;
      }
    }

    // ── narrative 맥락 (있을 때만 — [2단계] 인용블록은 펼침 후에만. 부수 정보·작은 글씨 muted) ──
    //   REQ-011: mdSafe = raw **굵게**·`코드` 마크다운 렌더(narrative 가 마크다운 최다 필드).
    const narrHtml = (r.narrative || "").trim()
      ? `<div class="rq-narrative">${mdSafe(r.narrative)}</div>` : "";
    // ── [2단계] 라이브배지 묶음(push 반영 + mq 미편입) — 펼침 후에만 노출(1줄 행에서 제외). ──
    const liveBadges = (mqHtml || pushHtml)
      ? `<div class="rq-livebadges">${mqHtml}${pushHtml}</div>` : "";

    // ── blocked 경고 본문 (P0·교착·보류) ── REQ-011: 마크다운 렌더
    const blockedHtml = blocked
      ? `<div class="rq-blocked-note">⚠ ${mdSafe(r.blocked_reason || "교착·대기 상태")}</div>` : "";

    // ── latest_verdict 미니 패널 (있을 때만 — 6/45만 비-null) ──
    const lv = r.latest_verdict;
    let lvHtml = "";
    if (lv && typeof lv === "object") {
      const vCls = verdictClass(lv.verdict);
      const qs = (typeof lv.quality_score === "number") ? lv.quality_score.toFixed(1) + "/10" : "미측정";
      const p0bad = lv.p0_count > 0 ? " lv-bad" : "";
      const p1bad = lv.new_p1_count > 0 ? " lv-bad" : "";
      lvHtml = `<div class="rq-lv">
        <span class="rq-lv-k">최근 판정</span>
        <span class="badge ${vCls}">${escape(verdictLabel(lv.verdict))}</span>
        <span class="rq-lv-metric">품질 <b>${escape(qs)}</b></span>
        <span class="rq-lv-metric${p0bad}">P0 <b>${numOrUnknown(lv.p0_count)}</b></span>
        <span class="rq-lv-metric${p1bad}">신규P1 <b>${numOrUnknown(lv.new_p1_count)}</b></span>
      </div>`;
    }

    // ── 관련 라운드 — req_id가 request_refs에 포함된 것 ──
    const related = rid ? allRounds.filter((rd) => (rd.request_refs || "").includes(rid)) : [];
    const relatedHtml = related.length
      ? `<div class="rq-related"><div class="rq-related-h">관련 라운드 ${related.length}건</div>${
          related.map((rd) => `<div class="rq-related-row"><code>${escape(rd.alias || rd.round_id)}</code>
            <span class="badge ${stateMeta(rd.state).cls}">${escape(stateMeta(rd.state).label)}</span>
            <span class="sub">${mdSafe(rd.note || rd.request_refs || "")}</span></div>`).join("")
        }</div>`
      : `<div class="rq-related sub">연결된 라운드 기록 없음</div>`;
    const evidHtml = (r.close_evidence || "").trim()
      ? `<div class="rq-evid"><span class="rq-evid-k">종결 근거</span> ${mdSafe(r.close_evidence)}</div>`
      : (evidMissing
          ? `<div class="rq-evid conv-evid-missing">⚠️ 종결 처리됐으나 근거 공란 — 유실 의심</div>`
          : "");

    // 카드 상태 클래스 (좌측 액센트 스트립 색) — blocked 우선
    const stCls = blocked ? "rq-blocked" : "rq-st-" + m.cls.replace("conv-", "");

    // [2단계] 기본 = 1줄 행. 상태점(색 = stateMeta.cls·title로 라벨) + priority(막힘/P0 가시 — 작은 칩)
    //   + req_id + 제목(말줄임 1줄) + 진척% + 라운드N. 인용·라이브배지·상세는 펼침(.rq-body)에서.
    const stageDot = `<span class="rq-dot ${escape(m.cls)}" title="${stageLbl}" aria-label="상태 ${stageLbl}"></span>`;
    // REQ-010 드릴다운 타겟: 카드 id=rqcard-<req_id> (결단보드 행 클릭 점프 대상).
    const cardId = rid ? ` id="rqcard-${escape(rid)}"` : "";
    return `<details class="rq-card rq-card-row ${stCls}${closed ? " rq-closed" : ""}"${cardId}>
      <summary class="rq-summary">
        <span class="rq-line">
          ${stageDot}
          ${prioHtml}
          <span class="rq-id"><code>${escape(rid)}</code></span>
          <span class="rq-title" title="${safe(r.summary || "")}">${mdSafe(r.summary || "(요약 없음)")}</span>
          <span class="rq-line-meta">${trackMini}${rcMini}</span>
        </span>
      </summary>
      <div class="rq-body">
        <div class="rq-body-head">
          <span class="badge ${m.cls}">${escape(m.label)}</span>
          ${liveBadges}
        </div>
        ${narrHtml}
        ${blockedHtml}
        <div class="rq-track-wrap">${track}${rcHtml ? `<span style="flex:none">${rcHtml}</span>` : ""}</div>
        ${lvHtml}
        ${r.owner ? `<div class="rq-owner"><span class="rq-evid-k">담당</span> ${mdSafe(r.owner)}</div>` : ""}
        ${evidHtml}
        ${relatedHtml}
      </div>
    </details>`;
  }

  // ⑤ 무결성 경고 — 데이터 신뢰도 가시화(접힌 raw 섹션 상단)
  function renderConvIntegrity(conv) {
    const warns = conv.integrity_warnings || [];
    el("conv-integrity").innerHTML = warns.length
      ? `<div class="hint conv-warn">⚠️ 데이터 무결성 경고 ${warns.length}건: ${warns.map(escape).join(" · ")}</div>`
      : `<div class="hint">데이터 무결성 경고 0건</div>`;
  }

  function renderConvRounds(conv) {
    const rounds = conv.rounds || [];
    el("conv-round-n").textContent = rounds.length;
    el("conv-round-tbody").innerHTML = rounds.map((r) => `
      <tr>
        <td><code>${escape(r.round_id)}</code>${r.alias ? ` <span class="sub">(${escape(r.alias)})</span>` : ""}</td>
        <td>${escape(repoDisplay(r.repo))}</td>
        <td>${mdSafe(r.request_refs || "")}</td>
        <td>${mdSafe(r.panel || "")}</td>
        <td>${mdSafe(r.tier || "")}</td>
        <td><span class="badge ${stateMeta(r.state).cls}">${escape(stateMeta(r.state).label)}</span></td>
      </tr>`).join("");
  }

  // 패널 의견 본문(headline/improvements/p0_items/p1_items) — 대표 지시: YES/NO+숫자만으론
  // '왜 그렇게 판정했는지'가 안 보임. 데이터 있을 때만 펼침 detail 렌더(없으면 행 1줄 유지·
  // 거짓 충실성 회피: 추출 0 = 빈 값). 모든 자유 텍스트 safe()(escape+클라 sanitize 백스톱).
  function verdictReasoningHtml(v) {
    const imp = Array.isArray(v.improvements) ? v.improvements : [];
    const p0 = Array.isArray(v.p0_items) ? v.p0_items : [];
    const p1 = Array.isArray(v.p1_items) ? v.p1_items : [];
    if (!v.headline && !imp.length && !p0.length && !p1.length) return "";
    // REQ-011: 판정 본문(headline/P0/신규P1/개선사항)도 raw 마크다운(**굵게**·`코드`) 렌더.
    const parts = [];
    if (v.headline) {
      parts.push(`<p class="vd-headline">${mdSafe(v.headline)}</p>`);
    }
    if (p0.length) {
      parts.push(`<div class="vd-block vd-p0"><span class="vd-label">P0</span><ul>${
        p0.map((s) => `<li>${mdSafe(s)}</li>`).join("")
      }</ul></div>`);
    }
    if (p1.length) {
      parts.push(`<div class="vd-block vd-p1"><span class="vd-label">신규 P1</span><ul>${
        p1.map((s) => `<li>${mdSafe(s)}</li>`).join("")
      }</ul></div>`);
    }
    if (imp.length) {
      parts.push(`<div class="vd-block vd-imp"><span class="vd-label">개선사항</span><ul>${
        imp.map((it) => {
          const st = it && it.state ? it.state : "미상";
          const done = st === "해소";
          return `<li class="vd-imp-item ${done ? "vd-done" : "vd-open"}">${
            mdSafe(it && it.text)
          } <span class="vd-state">${escape(st)}</span></li>`;
        }).join("")
      }</ul></div>`);
    }
    const n = (v.headline ? 1 : 0) + p0.length + p1.length + imp.length;
    return `<tr class="conv-verdict-detail"><td colspan="6">
      <details class="vd-details">
        <summary>판정 의견 펼치기 <span class="vd-count">${n}</span></summary>
        <div class="vd-body">${parts.join("")}</div>
      </details></td></tr>`;
  }

  function renderConvVerdicts(conv) {
    const verdicts = conv.verdicts || [];
    el("conv-verdict-n").textContent = verdicts.length;
    el("conv-verdict-tbody").innerHTML = verdicts.map((v) => {
      const reasoning = verdictReasoningHtml(v);
      return `
      <tr class="conv-verdict-row${reasoning ? " has-reasoning" : ""}">
        <td><code>${safe(v.file)}</code></td>
        <td>${escape(v.round_id || "")}</td>
        <td>${mdSafe(v.panel || "")}</td>
        <td><span class="badge ${verdictClass(v.verdict)}">${escape(verdictLabel(v.verdict))}</span></td>
        <td>${numOrUnknown(v.p0_count)}</td>
        <td>${numOrUnknown(v.new_p1_count)}</td>
      </tr>${reasoning}`;
    }).join("");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ⑥ 루프뷰 (track_graph 파생 — read-only) — DOC-20260616-REQ-001 V2
  //   요청 1건의 인과 체인: 요청 노드 → 회차순 라운드 노드(node_status별 시각 구분) →
  //   각 라운드의 판정(verdicts[]). track_graph(백엔드 build_track_graph)가 SSOT —
  //   프론트는 추측/합성 0. 거짓 충실성(FLR-AGT-002):
  //     - track_graph 미보유 요청(단발 라운드)은 트랙 목록에서 '단발/루프 없음'으로 정직 안내.
  //     - link_inferred 가 null/false 인 노드 간엔 인과선을 그리지 않음(연결 불명 점선 마커만).
  //     - count/score 가 null 이면 '?'(numOrUnknown) — 0 색칠 금지.
  //     - '활동 중' 가짜 애니메이션·폴백 색칠 없음.
  // node_status → 라벨/클래스 (백엔드 _track_node_status: converged|open|superseded|milestone).
  const NODE_STATUS_META = {
    converged:  { label: "수렴",   cls: "tg-converged" },
    open:       { label: "열림",   cls: "tg-open" },
    superseded: { label: "대체됨", cls: "tg-superseded" },
    milestone:  { label: "경유",   cls: "tg-milestone" },
  };
  function nodeStatusMeta(s) {
    return NODE_STATUS_META[s] || { label: "미상", cls: "tg-unknown" };
  }
  // 현재 선택된 트랙 req_id (폴링 재렌더 시 선택 유지). null = 첫 트랙 자동 선택.
  let convLoopSelected = null;

  // 트랙 1개 → 세로 인과 체인 HTML.
  function renderTrackChain(track) {
    if (!track) {
      return `<p class="hint">표시할 트랙이 없습니다.</p>`;
    }
    const reqStateM = stateMeta(track.req_state);
    // 뿌리 요청 노드.
    const head = `
      <div class="tg-chain-head">
        <div class="tg-req-node">
          <span class="tg-req-tag">요청</span>
          <span class="badge ${escape(reqStateM.cls)}" title="요청 상태">${escape(reqStateM.label)}</span>
          <code class="tg-req-id">${safe(track.req_id || "(미상)")}</code>
          <span class="tg-req-repo">${escape(repoDisplay(track.repo))}</span>
        </div>
        <div class="tg-req-summary">${mdSafe(track.summary || "(요약 없음)")}</div>
        <div class="tg-req-meta">
          <span title="이 요청에 묶인 라운드 수">라운드 ${escape(track.round_count)}회</span>
          <span class="tg-sep">·</span>
          <span class="${track.open_rounds ? "tg-meta-open" : ""}" title="아직 열린(미수렴·진행중) 라운드">열림 ${escape(track.open_rounds)}</span>
          <span class="tg-sep">·</span>
          <span class="${track.converged ? "tg-meta-converged" : "tg-meta-notconverged"}" title="최신 라운드가 수렴이고 열린 라운드 0">${track.converged ? "수렴 완료" : "미수렴"}</span>
          ${track.owner ? `<span class="tg-sep">·</span><span title="담당">${safe(track.owner)}</span>` : ""}
        </div>
        ${track.close_evidence ? `<div class="tg-req-evidence" title="종결 근거">근거: ${mdSafe(track.close_evidence)}</div>` : ""}
      </div>`;

    // 라운드 노드들 (회차순).
    const nodes = (track.nodes || []).map((n, i) => {
      const sm = nodeStatusMeta(n.node_status);
      // 직전 노드와의 연결선: link_inferred === true 일 때만 실선 인과(↓). false/null 은 점선
      //   '연결 불명'(거짓 인과선 0·FLR-AGT-002). 첫 노드(i===0)는 연결선 없음(요청에서 내려옴).
      let connector = "";
      if (i > 0) {
        if (n.link_inferred === true) {
          connector = `<div class="tg-connector tg-conn-causal" title="이전 회차 미수렴 → 다음 회차 (인과 연결 실측)" aria-label="이전 회차에서 이어짐">↓</div>`;
        } else {
          connector = `<div class="tg-connector tg-conn-unknown" title="회차 점프 또는 직전 수렴 후 추가 — 인과 연결 불명(추정 안 함)" aria-label="연결 불명">⋮</div>`;
        }
      }
      // 판정 목록 (verdicts[]).
      const verdicts = (n.verdicts || []).map((v) => {
        const qs = v.quality_score == null
          ? "" : `<span class="tg-v-q" title="품질점수(4축 평균·0~10)">품질 ${escape(v.quality_score)}</span>`;
        const p0 = `<span class="tg-v-defect" title="P0 결함 수">P0 ${numOrUnknown(v.p0_count)}</span>`;
        const p1 = `<span class="tg-v-defect" title="신규 P1 결함 수">신규P1 ${numOrUnknown(v.new_p1_count)}</span>`;
        return `
          <div class="tg-verdict">
            <div class="tg-v-top">
              <span class="badge ${verdictClass(v.verdict)}">${escape(verdictLabel(v.verdict))}</span>
              <span class="tg-v-panel">${mdSafe(v.panel || "(패널 미상)")}</span>
            </div>
            <div class="tg-v-metrics">${qs}${p0}${p1}</div>
            ${v.headline ? `<div class="tg-v-headline">${mdSafe(v.headline)}</div>` : ""}
          </div>`;
      }).join("");
      const verdictsBlock = verdicts
        ? `<div class="tg-verdicts">${verdicts}</div>`
        : `<div class="tg-verdicts tg-verdicts-empty"><p class="hint">이 라운드에 기록된 판정이 없습니다.</p></div>`;

      return `
        ${connector}
        <div class="tg-node ${escape(sm.cls)}">
          <div class="tg-node-head">
            <span class="tg-node-status">${escape(sm.label)}</span>
            <code class="tg-node-id">${escape(n.round_id || "")}</code>
            ${n.alias ? `<span class="tg-node-alias">${safe(n.alias)}</span>` : ""}
            ${n.tier ? `<span class="tg-node-tier" title="심급/패널 tier">${mdSafe(n.tier)}</span>` : ""}
            ${n.ts ? `<span class="tg-node-ts" title="라운드 시각">${escape(n.ts)}</span>` : ""}
          </div>
          ${n.state_raw && stateMeta(n.state).label !== n.state_raw
            ? `<div class="tg-node-stateraw" title="원본 state 표기">${mdSafe(n.state_raw)}</div>` : ""}
          ${verdictsBlock}
        </div>`;
    }).join("");

    const nodesBlock = nodes
      ? `<div class="tg-chain-nodes">${nodes}</div>`
      : `<div class="tg-chain-nodes"><p class="hint">이 트랙에 라운드 노드가 없습니다.</p></div>`;

    return `<div class="tg-chain">${head}${nodesBlock}</div>`;
  }

  // 루프뷰 전체 — 트랙 목록(선택) + 선택 트랙 체인 + 단발 요청 정직 안내.
  function renderConvLoopView(conv) {
    const host = el("conv-loopview");
    if (!host) return;
    const tracks = conv.track_graph || [];
    const reqs = conv.requests || [];
    // 단발(루프 없음) = track_graph 미포함 요청 수. 거짓 충실성: 빈 화면 금지·정직 카운트.
    const singleN = Math.max(0, reqs.length - tracks.length);

    if (!tracks.length) {
      host.innerHTML = `
        <div class="tg-empty">
          <p class="hint">표시할 루프(2회 이상 라운드를 거친 요청)가 없습니다.</p>
          ${singleN ? `<p class="hint">요청 ${singleN}건은 단발 라운드(루프 없음)입니다. 회차가 누적되면 여기에 인과 체인으로 나타납니다.</p>` : ""}
        </div>`;
      return;
    }

    // 선택 트랙 결정 — 보관된 선택 유지, 없으면 첫 트랙(정렬상 가장 열린/미종결).
    let sel = tracks.find((t) => t.req_id === convLoopSelected);
    if (!sel) { sel = tracks[0]; convLoopSelected = sel.req_id; }

    // 트랙 목록 칩 — repo·요약 앞부분·회차·열림·수렴 상태.
    const list = tracks.map((t) => {
      const active = t.req_id === sel.req_id ? " active" : "";
      const statusCls = t.converged ? "tg-li-converged" : (t.open_rounds ? "tg-li-open" : "tg-li-milestone");
      const statusTxt = t.converged ? "수렴" : (t.open_rounds ? `열림 ${t.open_rounds}` : "진행");
      return `
        <button class="tg-li${active} ${statusCls}" type="button" role="tab"
                aria-selected="${t.req_id === sel.req_id}" data-reqid="${escape(t.req_id || "")}">
          <span class="tg-li-repo">${escape(repoDisplay(t.repo))}</span>
          <span class="tg-li-status">${escape(statusTxt)}</span>
          <span class="tg-li-summary">${safe(t.summary || t.req_id || "(요약 없음)")}</span>
          <span class="tg-li-rounds" title="라운드 회차 수">${escape(t.round_count)}회</span>
        </button>`;
    }).join("");

    host.innerHTML = `
      <div class="tg-layout">
        <aside class="tg-list" role="tablist" aria-label="요청 트랙 목록">
          <div class="tg-list-head">루프 트랙 <span class="tg-list-count">${tracks.length}건</span></div>
          ${list}
          ${singleN ? `<div class="tg-single-note" title="2회 미만 라운드라 인과 체인이 없는 요청">단발 라운드 ${singleN}건은 루프가 없어 목록에서 제외됩니다(전체추이 탭의 '요청별 진행 상태'에서 확인).</div>` : ""}
        </aside>
        <div class="tg-detail" id="conv-loop-detail" aria-live="polite">
          ${renderTrackChain(sel)}
        </div>
      </div>`;

    // 트랙 선택 핸들러 — 클릭 시 보관 선택 갱신 + 상세만 재렌더(목록 active 토글).
    host.querySelectorAll(".tg-li").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rid = btn.dataset.reqid;
        convLoopSelected = rid;
        const t = tracks.find((x) => x.req_id === rid);
        const detail = el("conv-loop-detail");
        if (detail) detail.innerHTML = renderTrackChain(t);
        host.querySelectorAll(".tg-li").forEach((b) => {
          const on = b.dataset.reqid === rid;
          b.classList.toggle("active", on);
          b.setAttribute("aria-selected", String(on));
        });
      });
    });
  }

  // 서브 토글 (전체추이 ↔ 루프뷰) — 한 번만 바인딩(setup), show/hide 만 전환.
  let convSubToggleBound = false;
  function setupConvSubToggle() {
    if (convSubToggleBound) return;
    convSubToggleBound = true;
    const btnOverview = el("conv-view-overview");
    const btnLoop = el("conv-view-loop");
    const paneOverview = el("conv-overview");
    const paneLoop = el("conv-loopview");
    if (!btnOverview || !btnLoop || !paneOverview || !paneLoop) return;
    function show(view) {
      const isLoop = view === "loop";
      paneOverview.hidden = isLoop;
      paneLoop.hidden = !isLoop;
      btnOverview.classList.toggle("active", !isLoop);
      btnLoop.classList.toggle("active", isLoop);
      btnOverview.setAttribute("aria-selected", String(!isLoop));
      btnLoop.setAttribute("aria-selected", String(isLoop));
    }
    btnOverview.addEventListener("click", () => show("overview"));
    btnLoop.addEventListener("click", () => show("loop"));
  }

  // sql.js 인-브라우저 SQLite — 사용자가 명시적으로 클릭할 때만 lazy 로드(WASM ~1.5MB).
  // 매 admin 진입 시 WASM 강제 로드는 과설계 → on-demand. 기본 렌더는 convergence.json.
  let sqlDbPromise = null;
  function loadSqlDb() {
    if (sqlDbPromise) return sqlDbPromise;
    el("conv-sql-status").textContent = "sql.js 로드 중…";
    sqlDbPromise = (async () => {
      const initSqlJs = window.initSqlJs || await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js";
        s.onload = () => resolve(window.initSqlJs);
        s.onerror = () => reject(new Error("sql.js 스크립트 로드 실패"));
        document.head.appendChild(s);
      });
      const SQL = await initSqlJs({
        locateFile: (f) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}`,
      });
      const buf = await (await fetch("./convergence.db", { cache: "no-store" })).arrayBuffer();
      return new SQL.Database(new Uint8Array(buf));
    })();
    return sqlDbPromise;
  }

  function setupConvSql() {
    el("conv-sql-toggle").addEventListener("click", () => {
      const box = el("conv-sql-box");
      box.hidden = !box.hidden;
    });
    el("conv-sql-run").addEventListener("click", async () => {
      const status = el("conv-sql-status");
      const out = el("conv-sql-result");
      try {
        const db = await loadSqlDb();
        const q = el("conv-sql-input").value.trim();
        status.textContent = "실행 중…";
        const res = db.exec(q);
        if (!res.length) { out.innerHTML = '<p class="hint">결과 0행</p>'; status.textContent = "0행"; return; }
        const { columns, values } = res[0];
        out.innerHTML = `<table class="grid"><thead><tr>${
          columns.map((c) => `<th>${escape(c)}</th>`).join("")
        }</tr></thead><tbody>${
          values.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join("")}</tr>`).join("")
        }</tbody></table>`;
        status.textContent = `${values.length}행`;
      } catch (e) {
        out.innerHTML = "";
        status.textContent = "오류: " + e.message;
      }
    });
  }

  // 마지막 렌더된 convergence.json 의 generated_at — 폴링 시 변경 감지(불필요 재렌더 회피).
  let convLastGeneratedAt = null;

  async function renderConvergence() {
    let conv;
    try {
      const res = await fetch("./convergence.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      conv = await res.json();
    } catch (e) {
      el("conv-glance").innerHTML =
        `<p class="hint">convergence.json 로드 실패: ${escape(e.message)}. 'python3 scripts/admin/build_convergence.py' 로 생성하세요.</p>`;
      return;
    }
    convLastGeneratedAt = conv.generated_at || "";
    // REQ-006: convergence.json 빌드 시각을 state 보관 → 수렴 탭 활성 시 헤더에 반영.
    //   탭별 freshness(updateHeaderFreshness)가 단일 출처로 헤더를 그림(직접 setText 제거).
    state.convGeneratedAt = conv.generated_at || "";
    const activeTab = document.querySelector(".tab.active");
    if (!activeTab || activeTab.dataset.tab === CONV_TAB) updateHeaderFreshness(CONV_TAB);
    renderConvDecisionBoard(conv);
    renderConvFreshness(conv);
    renderConvBurndown(conv);
    renderConvTimeline(conv);
    renderConvRepoSummary(conv);   // [2단계] svc-strip+statebar+roundbar 4중 통합
    renderConvTransitions(conv);   // [2단계] details 접기 안 (상태 추이)
    renderConvGlance(conv);
    renderConvTrend(conv);
    renderConvActive(conv);
    renderConvRequests(conv);
    renderConvIntegrity(conv);
    renderConvRounds(conv);
    renderConvVerdicts(conv);
    renderConvLoopView(conv);      // ⑥ 루프뷰(track_graph 인과 체인) — DOC-20260616-REQ-001 V2
    setupConvSubToggle();          // 전체추이 ↔ 루프뷰 토글(1회 바인딩)
    setupConvSql();
    return conv;
  }

  // ⑥ 폴링 — convergence.json 을 주기적으로 재fetch, generated_at 변경 시에만 재렌더
  //   (파이프라인/판정이 새 데이터를 쓰면 보고 있던 루프뷰·전체추이가 자동 갱신).
  //   거짓 충실성(FLR-AGT-002): 동일 빌드면 재렌더 안 함(가짜 '활동 중' 깜빡임 0).
  //   탭/문서가 숨김(background)이면 skip(불필요 fetch 절약), 보일 때 1회 즉시 동기화.
  const CONV_POLL_MS = 45000; // 30~60초 범위 — 어드민 내부 도구, 과도 폴링 불요.
  async function pollConvergence() {
    if (document.hidden) return;
    try {
      const res = await fetch("./convergence.json", { cache: "no-store" });
      if (!res.ok) return;
      const conv = await res.json();
      const gen = conv.generated_at || "";
      if (gen && gen === convLastGeneratedAt) return; // 변경 없음 → 재렌더 skip
      convLastGeneratedAt = gen;
      state.convGeneratedAt = gen;
      const activeTab = document.querySelector(".tab.active");
      if (!activeTab || activeTab.dataset.tab === CONV_TAB) updateHeaderFreshness(CONV_TAB);
      renderConvDecisionBoard(conv);
      renderConvFreshness(conv);
      renderConvBurndown(conv);
      renderConvTimeline(conv);
      renderConvRepoSummary(conv);
      renderConvTransitions(conv);
      renderConvGlance(conv);
      renderConvTrend(conv);
      renderConvActive(conv);
      renderConvRequests(conv);
      renderConvIntegrity(conv);
      renderConvRounds(conv);
      renderConvVerdicts(conv);
      renderConvLoopView(conv);   // 보고 있던 트랙(convLoopSelected) 유지하며 갱신
    } catch (_e) { /* 폴링 실패는 조용히 무시 — 다음 주기 재시도 */ }
  }
  function startConvPolling() {
    setInterval(pollConvergence, CONV_POLL_MS);
    // 탭이 다시 보일 때 즉시 1회 동기화(background 동안 놓친 갱신 반영).
    document.addEventListener("visibilitychange", () => { if (!document.hidden) pollConvergence(); });
  }

  async function load() {
    try {
      const res = await fetch("./data.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      state.data = await res.json();
    } catch (e) {
      el("req-tbody").innerHTML =
        `<tr><td colspan="6">data.json 로드 실패: ${escape(e.message)}. file:// 환경에서는 CORS 제한이 있습니다. 'python3 -m http.server' 로 띄우세요.</td></tr>`;
      return;
    }
    // REQ-006: 헤더 '데이터 생성' 시각은 탭별 소스 기준(updateHeaderFreshness)이 단일 출처로
    //   그림 — 여기서 직접 setText 하지 않음(전 탭 공통 단일값 위장 제거). build-version 은 유지.
    el("build-version").textContent =
      "data.json schema v" + (state.data.schema_version || "?");

    setupTabs();   // 내부 activateTab → updateHeaderFreshness 로 현재 탭 freshness 반영
    renderRequests();
    renderTimeline();
    renderAgents();
    renderReleases();
    renderFlr();
    renderPeople();
    renderAudit();
    renderConvergence();
    startConvPolling();   // ⑥ 45초 폴링 — convergence.json 변경 시 자동 갱신(DOC-20260616-REQ-001 V2)
  }

  document.addEventListener("DOMContentLoaded", load);
})();
