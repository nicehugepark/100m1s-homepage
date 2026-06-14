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
    const cards = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `<div class="card"><div class="k">${escape(k)}</div><div class="v">${v}</div></div>`)
      .join("");
    el("timeline-summary").innerHTML = `<div class="summary-cards">${cards}</div>`;
  }

  function renderAgents() {
    const rows = state.data.agents || [];
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
    "배포":   { label: "배포됨",     pct: 90,  cls: "conv-ok" },
    "판정완료": { label: "판정 완료", pct: 70,  cls: "conv-cand" },
    "판정중":  { label: "판정 중",    pct: 60,  cls: "conv-cand" },
    "진행중":  { label: "진행 중",    pct: 55,  cls: "conv-prog" },
    "구현중":  { label: "구현 중",    pct: 50,  cls: "conv-prog" },
    "미수렴":  { label: "미수렴",     pct: 40,  cls: "conv-no" },
    "보류":   { label: "보류",      pct: 25,  cls: "conv-prog" },
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

  // ⓪-c 활동 시계열 — activity_timeline 이벤트를 시간축에 배치. 오른쪽 밀집 = 지금 활발.
  const TL_TYPE = {
    verdict: { cls: "tl-verdict", label: "판정" },
    round:   { cls: "tl-round",   label: "라운드" },
    request: { cls: "tl-request", label: "요청" },
  };
  function tlFmt(ms) {
    const d = new Date(ms);
    return (d.getMonth() + 1) + "/" + d.getDate() + " " +
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function renderConvTimeline(conv) {
    const tl = (conv.activity_timeline || []).filter((e) => e && e.ts && !isNaN(new Date(e.ts).getTime()));
    if (!tl.length) { el("conv-timeline").innerHTML = ""; return; }
    const tarr = tl.map((e) => new Date(e.ts).getTime());
    const min = Math.min(...tarr), max = Math.max(...tarr);
    const span = (max - min) || 1;
    const dots = tl.map((e) => {
      const t = new Date(e.ts).getTime();
      const x = ((t - min) / span) * 100;
      const ty = TL_TYPE[e.type] || { cls: "tl-other", label: e.type || "활동" };
      const tip = ty.label + " · " + (e.repo || "") + " · " + tlFmt(t) + " — " + (e.label || "");
      return `<span class="tl-dot ${ty.cls}" style="left:${x.toFixed(2)}%" title="${escape(tip)}"></span>`;
    }).join("");
    el("conv-timeline").innerHTML =
      `<div class="tl-head">활동 시계열 <span class="tl-sub">최근 ${tl.length}건 · 점이 오른쪽에 몰릴수록 "지금 도는 중" · ${escape(tlFmt(min))} → ${escape(tlFmt(max))}</span></div>
      <div class="tl-track" role="img" aria-label="활동 시계열 최근 ${tl.length}건">${dots}<span class="tl-edge"></span></div>
      <div class="tl-axis"><span>${escape(tlFmt(min))}</span><span>지금 →</span></div>
      <div class="tl-legend">
        <span class="tl-leg"><i class="tl-dot tl-verdict"></i>판정</span>
        <span class="tl-leg"><i class="tl-dot tl-round"></i>라운드</span>
        <span class="tl-leg"><i class="tl-dot tl-request"></i>요청</span>
      </div>`;
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
        // 검색 대상에 narrative·priority·push_status 추가(통합 검색)
        return [r.req_id, r.summary, r.narrative, r.state, r.repo,
                r.priority, r.close_evidence, r.blocked_reason]
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
    const prioHtml = r.priority
      ? `<span class="rq-prio ${prioClass(r.priority)}">${escape(r.priority)}</span>` : "";
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
