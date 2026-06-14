(() => {
  const state = { data: null };

  const el = (id) => document.getElementById(id);
  const escape = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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
    [/\bjony\b/gi, "총괄 심사 패널"],
    [/\bpixel\b/gi, "디자인 심사 패널"],
    [/\bguestpool\b/gi, "손님 패널"],
    [/\bhonesty\b/gi, "정직성 심사"],
    [/\bcritic\b/gi, "비평 패널"],
    [/\b(?:FLR|DOC)-(?:\d{8}-[A-Z]+|[A-Z]+)-\d+\b/g, "내부코드"], // doc_id 패턴
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
    return true;
  }

  function setupTabs() {
    document.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        activateTab(t.dataset.tab);
        // 해시 동기화 — 새로고침·공유 시 같은 탭 복원 (#convergence 등)
        if (history.replaceState) history.replaceState(null, "", "#" + t.dataset.tab);
        else location.hash = t.dataset.tab;
      });
    });
    // 초기 탭: URL 해시(#convergence 등) 우선, 없으면 디폴트(HTML active=수렴) 유지.
    // 조니 P1-B — 여는 즉시 수렴 뷰가 첫 화면. 해시 딥링크도 지원.
    const hash = (location.hash || "").replace(/^#/, "");
    if (hash) activateTab(hash);
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

  function renderAudit() {
    const audit = state.data.audit || { rows: [], counts: {}, thresholds: {} };
    const cards = Object.entries(audit.counts || {})
      .map(([k, v]) =>
        `<div class="card"><div class="k">${escape(k)}</div><div class="v">${v}</div></div>`
      ).join("");
    const th = audit.thresholds || {};
    const thHint = `임계값: idle ≥${th.idle_h ?? "?"}h · zombie ≥${th.zombie_h ?? "?"}h`;
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
        ? `idle ${r.idle_h}h · last ${last || "-"}`
        : "records 미흔적";
      return `
        <div class="audit-card" role="group" aria-label="${escape(r.name)} ${escape(r.state)}">
          <span class="dot ${escape(r.state)}" aria-hidden="true"></span>
          <div class="info">
            <span class="name">${escape(r.name)}</span>
            <span class="sub">${badge(r.state, r.state)} · ${escape(idleTxt)}</span>
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
  };
  function stateMeta(s) {
    return STATE_META[s] || { label: s || "미상", pct: null, cls: convStateClass(s) };
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
  // 닫힌(완료) 요청 = 종결/수렴/배포. 그 외(판정중·구현중·진행중·미수렴·보류 등)는 모두 "열림".
  const CLOSED_STATES = ["종결", "수렴", "배포"];
  function isOpenState(s) { return !CLOSED_STATES.includes(s); }
  // 진행·심사 중 라운드 state (지금 활동/카운트용)
  const ACTIVE_ROUND_STATES = ["진행중", "판정중", "구현중", "판정완료", "미수렴"];

  // ⓪-a2 상태 스냅샷 스택바 — 서비스(repo)별 요청이 '지금 어느 상태에 몇 건'.
  //   누적 라인(위)=활동 속도 추세 / 본 스택바=현재 상태 분포 → 둘은 다른 축(서사 분리, §정보위계).
  //   진행 파이프라인 순서(포착→판정중→구현중→배포→종결)로 세그먼트 정렬 + 보류는 끝(정지).
  //   색=STATE_META.cls 재사용(거짓 채움 0). 100% 가로 스택 → repo 간 '상태 구성' 직관 비교.
  //   데이터=requests[].state 프론트 집계(백엔드 보강 불요). 모바일=세로 적층(CSS).
  const STATE_ORDER = ["포착", "판정중", "구현중", "배포", "종결", "수렴", "보류"];
  function stateRank(s) { const i = STATE_ORDER.indexOf(s); return i < 0 ? STATE_ORDER.length : i; }
  function renderConvStatebar(conv) {
    const host = el("conv-statebar");
    if (!host) return;
    const reqs = conv.requests || [];
    if (!reqs.length) {
      host.innerHTML = `<div class="tl-head">상태 스냅샷</div>`
        + `<p class="hint">표시할 요청이 없습니다.</p>`;
      return;
    }
    // repo → { state → count }, repo 합계. repo 정렬은 svc-strip과 동일(진행 많은 순 근사 = 합계 큰 순).
    const byRepo = {};
    const stateSet = new Set();
    reqs.forEach((r) => {
      const repo = (r.repo && String(r.repo).trim()) || "미상";
      const st = (r.state && String(r.state).trim()) || "미상";
      (byRepo[repo] = byRepo[repo] || {})[st] = (byRepo[repo][st] || 0) + 1;
      stateSet.add(st);
    });
    const repos = Object.keys(byRepo).sort((a, b) => {
      const ta = Object.values(byRepo[a]).reduce((x, y) => x + y, 0);
      const tb = Object.values(byRepo[b]).reduce((x, y) => x + y, 0);
      return tb - ta || a.localeCompare(b);
    });
    // 등장한 상태를 파이프라인 순서로 — 범례 + 세그먼트 정렬 공통.
    const states = [...stateSet].sort((a, b) => stateRank(a) - stateRank(b) || a.localeCompare(b));
    // 범례 — 색(stateMeta.cls) + 라벨 병기(다크모드 제1원칙: 색만으로 의미 전달 금지).
    const legend = states.map((s) => {
      const m = stateMeta(s);
      return `<span class="sb-leg"><i class="sb-leg-sw ${escape(m.cls)}"></i>`
        + `<span class="sb-leg-k">${escape(m.label)}</span></span>`;
    }).join("");
    // repo별 1행 = 라벨 + 100% 스택바. 세그먼트 = 상태(width=비율), 호버 title=상태·건수.
    const rows = repos.map((repo) => {
      const counts = byRepo[repo];
      const total = Object.values(counts).reduce((x, y) => x + y, 0) || 1;
      const segs = states.filter((s) => counts[s]).map((s) => {
        const n = counts[s];
        const m = stateMeta(s);
        const pct = (n / total) * 100;
        // 좁은 칸(<12%)은 라벨 어중간 잘림이 오히려 인지 방해(힉의 법칙) → 숫자만, 라벨은 CSS로 숨김.
        // 전체 정보는 호버 title + aria-label 로 보존(정보 손실 0).
        const narrow = pct < 12 ? " sb-seg-narrow" : "";
        return `<span class="sb-seg ${escape(m.cls)}${narrow}" style="width:${pct.toFixed(2)}%"`
          + ` title="${escape(repo)} · ${escape(m.label)} ${n}건 (${pct.toFixed(0)}%)"`
          + ` aria-label="${escape(m.label)} ${n}건">`
          + `<b class="sb-seg-n">${n}</b><span class="sb-seg-k">${escape(m.label)}</span></span>`;
      }).join("");
      return `<div class="sb-row" role="group" aria-label="${escape(repo)} 상태 분포 (총 ${total}건)">
        <div class="sb-row-head"><span class="sb-repo">${escape(repo)}</span><span class="sb-total">${total}</span></div>
        <div class="sb-track">${segs}</div>
      </div>`;
    }).join("");
    host.innerHTML =
      `<div class="tl-head">상태 스냅샷
        <span class="tl-sub">서비스별 요청이 지금 어느 상태에 몇 건인지 — 막대 = 100% 상태 구성 (위 라인차트는 활동 '속도' 추세, 본 막대는 현재 '상태')</span>
      </div>
      <div class="sb-legend" role="group" aria-label="상태 범례">${legend}</div>
      <div class="sb-rows">${rows}</div>`;
  }

  // ① 서비스(repo) 요약 스트립 — summary 키에서 동적 렌더(하드코딩 0·미션 4축).
  // HOME·ADMIN·INFRA 등 N개로 늘어도 레이아웃 안 깨짐. status: active/converged/idle.
  const SVC_STATUS = {
    active:    { cls: "svc-active",    label: "진행 중" },
    converged: { cls: "svc-converged", label: "수렴" },
    idle:      { cls: "svc-idle",      label: "대기" },
  };
  function renderConvServices(conv) {
    const summary = conv.summary || {};
    // 동적 정렬: 진행 중 → 수렴 → 대기, 그 안에서 열린 요청 많은 순.
    const statusRank = (s) => ({ active: 0, converged: 1, idle: 2 }[s] ?? 3);
    const entries = Object.entries(summary).sort((a, b) =>
      statusRank(a[1].status) - statusRank(b[1].status)
      || (b[1].open_requests || 0) - (a[1].open_requests || 0)
      || a[0].localeCompare(b[0]));
    if (!entries.length) { el("conv-svc-strip").innerHTML = ""; return; }
    el("conv-svc-strip").innerHTML = entries.map(([repo, s]) => {
      const st = SVC_STATUS[s.status] || { cls: "svc-idle", label: s.status || "미상" };
      const openR = s.open_requests ?? 0;
      const totalR = s.total_requests ?? 0;
      const openRounds = s.open_rounds ?? 0;
      // 라벨: status_label(서버 산출) 그대로 — 거짓 채움 0. 길면 CSS가 줄임.
      return `<div class="svc-card ${st.cls}" role="group" aria-label="${escape(repo)} ${escape(st.label)}">
        <div class="svc-head">
          <span class="svc-name">${escape(repo)}</span>
          <span class="svc-status-dot" title="${escape(st.label)}"></span>
        </div>
        <div class="svc-label">${safe(s.status_label || st.label)}</div>
        <div class="svc-metrics">
          <div class="svc-metric m-open"><span class="m-v">${openR}</span><span class="m-k">열린 요청</span></div>
          <div class="svc-metric"><span class="m-v">${totalR}</span><span class="m-k">전체</span></div>
          <div class="svc-metric"><span class="m-v">${openRounds}</span><span class="m-k">열린 라운드</span></div>
        </div>
      </div>`;
    }).join("");
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
      ? `${escape(lastRound.alias || lastRound.round_id)} · ${escape(lastRound.repo || "")} · ${escape(stateMeta(lastRound.state).label)}`
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
        <div class="g-v">${settled}</div><div class="g-k">수렴·종결</div>
        <div class="g-sub">전체 ${total}건 중</div>
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
  // 색 + 텍스트 병기(다크모드 제1원칙). 동작중 <30분 / 느려짐 <180 / 정체 그 외 / 미상.
  function freshMeta(m) {
    if (m == null) return { cls: "fresh-unknown", label: "활동 미상" };
    if (m < 30)  return { cls: "fresh-live",  label: "동작 중" };
    if (m < 180) return { cls: "fresh-warm",  label: "느려짐" };
    return { cls: "fresh-stale", label: "정체" };
  }
  function renderConvFreshness(conv) {
    const f = conv.freshness || {};
    const actMin = minsAgo(f.last_activity_ts);
    const genMin = minsAgo(f.generated_at || conv.generated_at);
    const fm = freshMeta(actMin);
    el("conv-freshness").innerHTML =
      `<div class="fresh-badge ${fm.cls}">
        <span class="fresh-dot"></span>
        <span class="fresh-main">${escape(fm.label)}</span>
        <span class="fresh-detail">마지막 활동 <b>${escape(agoText(actMin))}</b></span>
        <span class="fresh-gen">데이터 갱신 ${escape(agoText(genMin))}</span>
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
    const modeLabel = tlState.mode === "repo" ? "서비스" : "유형";

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

      <!-- C: 서비스별(유형별) 활동 — 전체 기간 small multiples. 어느 서비스가 언제 활발/변하나. -->
      <div class="tl-card tl-card-svc">
        <div class="tl-card-head">
          <span class="tl-card-title">③ ${escape(modeLabel)}별 활동</span>
          <span class="tl-card-desc">어느 ${escape(modeLabel)}가 언제 활발했나 — 전체 기간, 시간대별 건수</span>
          <div class="tl-seg" role="group" aria-label="분류 기준">
            <button type="button" class="tl-seg-btn${tlState.mode === "repo" ? " is-on" : ""}" data-mode="repo" aria-pressed="${tlState.mode === "repo"}">서비스별</button>
            <button type="button" class="tl-seg-btn${tlState.mode === "type" ? " is-on" : ""}" data-mode="type" aria-pressed="${tlState.mode === "type"}">유형별</button>
          </div>
        </div>
        <div class="tl-svc-grid" aria-label="${escape(modeLabel)}별 시간대 활동"></div>
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
    // 보이는 시간폭을 약 30칸으로 — 1/2/3/6h 스냅(전체 보기서도 시간당 변동이 촘촘).
    const barHrs = viewHrs <= 1.5 ? 1
      : viewHrs <= 60 ? 1 : viewHrs <= 96 ? 2 : viewHrs <= 200 ? 3 : 6;
    const barStepMs = barHrs * 3600000;
    const buckets = {}; // bucketStartMs → count(전 시리즈 합 = 그 시간대 '실제' 밀도)
    tl.forEach((e) => { const b = Math.floor(e.t / barStepMs) * barStepMs; buckets[b] = (buckets[b] || 0) + 1; });
    let max = 0; for (const b in buckets) max = Math.max(max, buckets[b]);
    return { buckets, barStepMs, barStepH: barHrs, max };
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

    const { buckets, barStepMs, barStepH, max } = tlBarBuckets(tl, v0, v1);
    const barMax = max || 1;
    const yOf = (c) => baseY - (c / barMax) * plotH;

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
      barsSvg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" class="tlb-bar" data-bucket="${b}" data-count="${c}"><title>${tlFmt(b)}~ ${barStepH}시간 · ${c}건</title></rect>`;
    }

    host.querySelector(".tlb-grid").innerHTML = gridSvg;
    host.querySelector(".tlb-bars").innerHTML = barsSvg;

    // Y축 라벨 overlay.
    const yax = host.querySelector(".tlb-yaxis");
    if (yax) yax.innerHTML = yTicks.filter((v) => v > 0).map((v) =>
      `<span style="top:${((yOf(v)) / VBH * 100).toFixed(1)}%">${v}</span>`).join("");

    // crosshair용 박제.
    tlState._drawBars = { buckets, barStepMs, barStepH, barMax, yOf, xOf, baseY, PADT, VBW, VBH };

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

  // ── C: 서비스(유형)별 활동 — small multiples. 전체 기간 고정, repo별 mini 막대 1줄씩. ──
  //   "어느 서비스가 언제 활발/변하나"가 한 메시지. 동적 repo(하드코딩 0). 모바일=CSS grid 1열 적층.
  //   각 미니차트는 같은 시간 버킷·같은 시간폭(정렬). Y는 각 행 자기 최댓값(상대 비교는 행 라벨의 총건수로).
  //   거짓 채움 0: 빈 시간대는 막대 없음.
  function drawSvcChart(host) {
    const grid = host.querySelector(".tl-svc-grid");
    if (!grid) return;
    const tl = tlState.events;
    const [f0, f1] = tlState.full;
    const span = (f1 - f0) || 1;
    const keys = tlState.keys, colorOf = tlState.colorOf;

    // 전체 기간 기준 단위시간 버킷(시간폭 따라 1/2/3/6h) — 전 행 공통 축.
    const { barStepMs, barStepH } = tlBarBuckets(tl, f0, f1);
    // bucket 시작값들(축 정렬용).
    const bStart = Math.floor(f0 / barStepMs) * barStepMs, bEnd = Math.floor(f1 / barStepMs) * barStepMs;

    // key별 버킷 집계 + 전 key 통틀어 한 버킷 최댓값(행 간 높이 비교 가능하도록 공통 스케일).
    const perKey = {}; keys.forEach((k) => { perKey[k] = {}; });
    tl.forEach((e) => {
      const k = tlKeyOf(e); if (perKey[k] == null) perKey[k] = {};
      const b = Math.floor(e.t / barStepMs) * barStepMs;
      perKey[k][b] = (perKey[k][b] || 0) + 1;
    });
    let globalMax = 0;
    keys.forEach((k) => { for (const b in perKey[k]) globalMax = Math.max(globalMax, perKey[k][b]); });
    globalMax = globalMax || 1;

    const total = {}; tl.forEach((e) => { const k = tlKeyOf(e); total[k] = (total[k] || 0) + 1; });

    const MVBW = 1000, MVBH = 40, MPB = 0, mBaseY = MVBH - MPB, mPlotH = mBaseY - 2;
    const mxOf = (t) => ((t - f0) / span) * MVBW;
    const mBarW = (barStepMs / span) * MVBW;
    const mPad = Math.min(mBarW * 0.16, 2);

    grid.innerHTML = keys.map((k) => {
      const bkts = perKey[k] || {};
      // 이 행 피크 시간대(라벨용).
      let pHk = null, pN = 0; for (const b in bkts) if (bkts[b] > pN) { pN = bkts[b]; pHk = +b; }
      const peakTxt = pHk != null ? `${String(new Date(pHk).getHours()).padStart(2, "0")}시 피크` : "—";
      let bars = "";
      for (let b = bStart; b <= bEnd; b += barStepMs) {
        const c = bkts[b]; if (!c) continue; // 거짓 채움 0
        const x = mxOf(b) + mPad, w = Math.max(mBarW - mPad * 2, 1);
        const h = (c / globalMax) * mPlotH, y = mBaseY - h;
        bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1" class="tls-bar"><title>${tlFmt(b)}~ ${barStepH}시간 · ${c}건</title></rect>`;
      }
      return `<div class="tl-svc-row">
        <div class="tl-svc-meta">
          <span class="tl-svc-name"><i class="tl-sw" style="background:${colorOf[k]}"></i>${escape(tlSeriesLabel(k))}</span>
          <span class="tl-svc-cnt"><b>${total[k] || 0}</b><i>${escape(peakTxt)}</i></span>
        </div>
        <svg class="tl-svc-svg" viewBox="0 0 ${MVBW} ${MVBH}" preserveAspectRatio="none"
             style="--svc-color:${colorOf[k]}" role="img" aria-label="${escape(tlSeriesLabel(k))} 시간대별 활동 ${total[k] || 0}건">${bars}</svg>
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

    // 세그먼트 토글(서비스별↔유형별) — svg 유무와 무관하게 항상 바인딩(C 차트 분류 전환).
    host.querySelectorAll(".tl-seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = btn.getAttribute("data-mode");
        if (m === tlState.mode) return;
        tlState.mode = m;
        tlState.hidden = new Set(); tlState.solo = null;
        // view 줌 상태는 보존하고 전체 재렌더(C 차트가 mode 따라 재구성).
        renderConvTimeline({ activity_timeline: tlState.events }, { preserveToggle: true });
      });
    });

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
      // 툴팁 — 시각 + 구간 건수(주) + 누적(보조).
      tip.innerHTML =
        `<div class="tl-tip-time">${tlFmt(bk)}~ ${db.barStepH}시간</div>`
        + `<div class="tl-tip-row tl-tip-main"><i class="tl-tip-sw-bar"></i><span>이 구간 활동</span><b>${bc}건</b></div>`
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
        <div class="conv-trend-title">${escape(repo)} ${note}</div>
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
          <span class="ac-repo">${escape(r.repo || "")}</span>
        </div>
        <div class="ac-req">${safe(r.request_refs || "대상 요청 미지정")}</div>
        <div class="ac-meta">패널: ${safe(r.panel || "-")}${r.tier ? " · " + safe(r.tier) : ""}</div>
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
      repos.map((r) => `<option value="${escape(r)}">${escape(r)}</option>`).join("");

    // repo 라벨 평이화: '—' = 미분류
    const repoLabel = (r) => (!r || r === "—") ? "미분류" : r;

    // 정렬 비교자 (최신/진척/우선순위). 정렬 셀렉터는 선택사항(없으면 기본=우선순위).
    // 우선순위 정렬: blocked 먼저(교착 가시) → P0>P1>P2>P3>무 → 열림 먼저.
    const sortEl = el("conv-req-sort");
    const prioRank = (p) => ({ P0: 0, P1: 1, P2: 2, P3: 3 }[p] ?? 4);
    function cmp(by) {
      if (by === "recent") {
        // 최신: latest_round_id 회차 큰 순 → req_id 역순(근사 최신)
        return (a, b) => roundNum(b.latest_round_id) - roundNum(a.latest_round_id)
          || String(b.req_id || "").localeCompare(String(a.req_id || ""));
      }
      if (by === "progress") {
        // 진척: progress_pct 높은 순 (null은 뒤로)
        return (a, b) => (b.progress_pct ?? -1) - (a.progress_pct ?? -1);
      }
      // priority(기본): blocked → priority → 열림 → progress
      return (a, b) =>
        (b.blocked === true) - (a.blocked === true)
        || prioRank(a.priority) - prioRank(b.priority)
        || (isOpenState(b.state) - isOpenState(a.state))
        || (b.progress_pct ?? -1) - (a.progress_pct ?? -1);
    }

    const draw = () => {
      const q = el("conv-req-search").value.trim().toLowerCase();
      const rf = sel.value;
      const by = sortEl ? sortEl.value : "priority";
      const filtered = reqs.filter((r) => {
        if (rf && r.repo !== rf) return false;
        if (!q) return true;
        // 검색 대상에 narrative·priority·push_status·owner 추가(통합 검색)
        // 라운드2 P1-3: owner(담당자)는 33셀 표시되나 검색 미인덱스였음 → 담당자 검색 가능화.
        return [r.req_id, r.summary, r.narrative, r.state, r.repo,
                r.priority, r.owner, r.close_evidence, r.blocked_reason]
          .join(" ").toLowerCase().includes(q);
      });
      el("conv-req-count").textContent = `${filtered.length} / ${reqs.length}`;

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
        // repo 그룹 헤더 — repo 라벨(텍스트 1회) + 건수/열림/교착(있을 때).
        // P1-3: 시각 배지(repo-tag)와 텍스트 라벨이 같은 repo명을 2회 출력 → 'HOMEHOME' 중복.
        //       텍스트 라벨 1회만 유지(스크린리더 중복도 해소). 색상 위계는 .conv-repo-head 자체로.
        const blockedMeta = blockedN ? ` · <span style="color:var(--ru);font-weight:600">교착 ${blockedN}</span>` : "";
        return `<div class="conv-repo-group">
          <div class="conv-repo-head">${escape(repoLabel(key))}
            <span class="conv-repo-meta">${items.length}건 · 열림 ${openN}${blockedMeta}</span></div>
          <div class="conv-repo-cards">${cards}</div>
        </div>`;
      }).join("");
    };

    el("conv-req-search").addEventListener("input", draw);
    sel.addEventListener("change", draw);
    if (sortEl) sortEl.addEventListener("change", draw);
    draw();
  }

  // 개별 이슈 카드 (1요청1이슈 통합 뷰) — 백엔드 신규 11종 필드 와이어.
  // 거짓 충실성 회피(FLR-AGT-002): 필드 부재 시 가짜 채우기 금지 → 표시 생략 또는 '미상'.
  // 헤더 행 = 상태배지 + priority + 🆕미편입(mq_only) + push_status 점등 + req_id.
  // 본문(펼침) = narrative 전문 + 담당 + 종결근거 + latest_verdict 미니패널 + 관련 라운드.
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

    // ── 계측 진행 트랙 — 백엔드 progress_pct 우선(요청별 실측). null이면 '미상'(거짓 0 금지). ──
    // track = inner(트랙바 + % 또는 '미상'). 호출부에서 .rq-track-wrap 로 감싸 round 칩과 정렬.
    const pct = (typeof r.progress_pct === "number") ? r.progress_pct : null;
    const track = pct == null
      ? `<div class="rq-track-na" title="진행률 미측정(추정 금지)">진행률 미상</div>`
      : `<div class="rq-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
              aria-label="진행률 ${pct}%">
           <span class="rq-track-fill rq-${m.cls}" style="width:${pct}%"></span>
         </div>
         <span class="rq-track-pct">${pct}%</span>`;
    // round_count 칩 (몇 라운드 돌았나) — 0이면 '미착수'로 명시(거짓 채움 아님).
    // 라운드가 돌았으면 latest_round_state(최근 라운드 상태)를 칩에 병기(실데이터·null이면 생략).
    const rc = (typeof r.round_count === "number") ? r.round_count : null;
    const lrs = (r.latest_round_state || "").trim();
    let rcHtml = "";
    if (rc != null) {
      if (rc > 0) {
        const lrsTxt = lrs ? ` · ${escape(stateMeta(lrs).label)}` : "";
        rcHtml = `<span class="rq-rounds-chip" title="이 요청이 거친 판정 라운드 수 / 최근 라운드 상태 (${escape(r.latest_round_id || "-")})">라운드 ${rc}회${lrsTxt}</span>`;
      } else {
        rcHtml = `<span class="rq-rounds-chip" title="아직 판정 라운드 미착수">라운드 미착수</span>`;
      }
    }

    // ── narrative 맥락 (있을 때만 — 부수 정보·작은 글씨 muted) ──
    const narrHtml = (r.narrative || "").trim()
      ? `<div class="rq-narrative">${safe(r.narrative)}</div>` : "";

    // ── blocked 경고 본문 (P0·교착·보류) ──
    const blockedHtml = blocked
      ? `<div class="rq-blocked-note">⚠ ${safe(r.blocked_reason || "교착·대기 상태")}</div>` : "";

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
        <span class="badge ${vCls}">${escape(lv.verdict || "미상")}</span>
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
            <span class="sub">${safe(rd.note || rd.request_refs || "")}</span></div>`).join("")
        }</div>`
      : `<div class="rq-related sub">연결된 라운드 기록 없음</div>`;
    const evidHtml = (r.close_evidence || "").trim()
      ? `<div class="rq-evid"><span class="rq-evid-k">종결 근거</span> ${safe(r.close_evidence)}</div>`
      : (evidMissing
          ? `<div class="rq-evid conv-evid-missing">⚠️ 종결 처리됐으나 근거 공란 — 유실 의심</div>`
          : "");

    // 카드 상태 클래스 (좌측 액센트 스트립 색) — blocked 우선
    const stCls = blocked ? "rq-blocked" : "rq-st-" + m.cls.replace("conv-", "");

    return `<details class="rq-card ${stCls}${closed ? " rq-closed" : ""}">
      <summary class="rq-summary">
        <div class="rq-head">
          <span class="badge ${m.cls}">${escape(m.label)}</span>
          ${prioHtml}${mqHtml}${pushHtml}
          <span class="rq-id"><code>${escape(rid)}</code></span>
        </div>
        <div class="rq-title">${safe(r.summary || "(요약 없음)")}</div>
        ${narrHtml}
        <div class="rq-track-wrap">${track}${rcHtml ? `<span style="flex:none">${rcHtml}</span>` : ""}</div>
      </summary>
      <div class="rq-body">
        ${blockedHtml}
        ${lvHtml}
        ${r.owner ? `<div class="rq-owner"><span class="rq-evid-k">담당</span> ${safe(r.owner)}</div>` : ""}
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
        <td>${escape(r.repo)}</td>
        <td>${safe(r.request_refs || "")}</td>
        <td>${safe(r.panel || "")}</td>
        <td>${safe(r.tier || "")}</td>
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
    const parts = [];
    if (v.headline) {
      parts.push(`<p class="vd-headline">${safe(v.headline)}</p>`);
    }
    if (p0.length) {
      parts.push(`<div class="vd-block vd-p0"><span class="vd-label">P0</span><ul>${
        p0.map((s) => `<li>${safe(s)}</li>`).join("")
      }</ul></div>`);
    }
    if (p1.length) {
      parts.push(`<div class="vd-block vd-p1"><span class="vd-label">신규 P1</span><ul>${
        p1.map((s) => `<li>${safe(s)}</li>`).join("")
      }</ul></div>`);
    }
    if (imp.length) {
      parts.push(`<div class="vd-block vd-imp"><span class="vd-label">개선사항</span><ul>${
        imp.map((it) => {
          const st = it && it.state ? it.state : "미상";
          const done = st === "해소";
          return `<li class="vd-imp-item ${done ? "vd-done" : "vd-open"}">${
            safe(it && it.text)
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
        <td>${safe(v.panel || "")}</td>
        <td><span class="badge ${verdictClass(v.verdict)}">${escape(v.verdict)}</span></td>
        <td>${numOrUnknown(v.p0_count)}</td>
        <td>${numOrUnknown(v.new_p1_count)}</td>
      </tr>${reasoning}`;
    }).join("");
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
    // N2: 헤더 시각을 수렴 데이터(convergence.json) 빌드 시각으로 갱신.
    // 디폴트 랜딩이 수렴 탭이므로 헤더는 convergence.json 기준이 정합 (레거시 data.json 시각 오인 방지).
    if (conv.generated_at) {
      el("generated-at").textContent =
        "데이터 생성: " + String(conv.generated_at).slice(0, 19).replace("T", " ");
    }
    renderConvServices(conv);
    renderConvFreshness(conv);
    renderConvTimeline(conv);
    renderConvStatebar(conv);
    renderConvGlance(conv);
    renderConvTrend(conv);
    renderConvActive(conv);
    renderConvRequests(conv);
    renderConvIntegrity(conv);
    renderConvRounds(conv);
    renderConvVerdicts(conv);
    setupConvSql();
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
    // 헤더 시각 = 디폴트 랜딩(수렴 탭)의 데이터 기준. 실제 값은 renderConvergence()가
    // convergence.json generated_at 으로 덮어씀 (N2: data.json=레거시 May 4 표기 오인 방지).
    // data.json 은 fallback (convergence.json 로드 실패 시).
    el("generated-at").textContent =
      "데이터 생성: " + (state.data.generated_at || "").slice(0, 19).replace("T", " ");
    el("build-version").textContent =
      "data.json schema v" + (state.data.schema_version || "?");

    setupTabs();
    renderRequests();
    renderTimeline();
    renderAgents();
    renderReleases();
    renderFlr();
    renderPeople();
    renderAudit();
    renderConvergence();
  }

  document.addEventListener("DOMContentLoaded", load);
})();
