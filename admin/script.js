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
  const STATE_META = {
    "종결":   { label: "종결",     pct: 100, cls: "conv-ok" },
    "수렴":   { label: "수렴 완료", pct: 100, cls: "conv-ok" },
    "배포":   { label: "배포됨",    pct: 90,  cls: "conv-ok" },
    "판정완료": { label: "판정 완료", pct: 70,  cls: "conv-cand" },
    "판정중":  { label: "판정 중",   pct: 60,  cls: "conv-cand" },
    "진행중":  { label: "진행 중",   pct: 55,  cls: "conv-prog" },
    "구현중":  { label: "구현 중",   pct: 50,  cls: "conv-prog" },
    "미수렴":  { label: "미수렴",    pct: 40,  cls: "conv-no" },
    "보류":   { label: "보류",     pct: 25,  cls: "conv-prog" },
  };
  function stateMeta(s) {
    return STATE_META[s] || { label: s || "미상", pct: null, cls: convStateClass(s) };
  }
  // 닫힌(완료) 요청 = 종결/수렴/배포. 그 외(판정중·구현중·진행중·미수렴·보류 등)는 모두 "열림".
  const CLOSED_STATES = ["종결", "수렴", "배포"];
  function isOpenState(s) { return !CLOSED_STATES.includes(s); }
  // 진행·심사 중 라운드 state (지금 활동/카운트용)
  const ACTIVE_ROUND_STATES = ["진행중", "판정중", "구현중", "판정완료", "미수렴"];

  // 서비스(repo) 표시 라벨 + 정렬 순서. 내부 repo 코드 → 평이한 서비스명.
  // '공통' = repo 미지정(전사 룰·메타). '—' = 구 JSON 잔재(미분류) 호환.
  const SERVICE_LABEL = { PM320: "PM320", HOME: "홈페이지", BYBIAS: "ByVias",
    INFRA: "인프라", "공통": "공통", "—": "미분류" };
  const serviceLabel = (k) => SERVICE_LABEL[k] || k || "미분류";
  const serviceOrder = (k) =>
    ({ PM320: 0, HOME: 1, BYBIAS: 2, INFRA: 3, "공통": 4 }[k] ?? (k === "—" ? 9 : 5));

  // 요청 state → 진척 3분류 (백엔드 _classify_request_progress 와 동일 규칙).
  // 구 JSON(summary에 req_closed 등 없음) 폴백 계산용. 종결="종결"만(배포 제외·
  // 거짓 종결 금지 FLR-AGT-002)·미착수=포착/unknown·그 외=진행.
  function classifyReqProgress(stateStr) {
    if (stateStr === "종결") return "closed";
    if (stateStr === "포착" || stateStr === "unknown" || !stateStr) return "not_started";
    return "in_progress";
  }

  // summary 행에 req_closed/in_progress/not_started 가 있으면(신 스키마) 그대로,
  // 없으면(구 스키마) requests 에서 폴백 집계. 거짓 충실성 X — 실측만.
  function repoProgress(repo, summaryRow, reqs) {
    if (summaryRow && summaryRow.req_closed != null) {
      return {
        total: summaryRow.total_requests || 0,
        closed: summaryRow.req_closed || 0,
        in_progress: summaryRow.req_in_progress || 0,
        not_started: summaryRow.req_not_started || 0,
        label: summaryRow.status_label || "",
      };
    }
    const rows = reqs.filter((r) => (r.repo || "공통") === repo);
    let c = 0, p = 0, n = 0;
    for (const r of rows) {
      const k = classifyReqProgress(r.state);
      if (k === "closed") c++; else if (k === "not_started") n++; else p++;
    }
    return { total: rows.length, closed: c, in_progress: p, not_started: n,
      label: (summaryRow && summaryRow.status_label) || "" };
  }

  // 진행바 — 종결 비율(%). 거짓 진행률 금지: total 0 이면 바 숨김.
  function progressBar(closed, total) {
    if (!total) return `<div class="svc-bar-na">요청 없음</div>`;
    const pct = Math.round((closed / total) * 100);
    return `<div class="svc-bar" role="progressbar" aria-valuenow="${pct}"
      aria-valuemin="0" aria-valuemax="100" aria-label="종결 ${pct}%">
      <span class="svc-bar-fill" style="width:${pct}%"></span></div>
      <span class="svc-bar-pct">${pct}%</span>`;
  }

  // ① 한눈에 — 전사 1줄 + 서비스별 진척 카드 (대표 직답: "몇 중 얼마 진행됐는지").
  function renderConvGlance(conv) {
    const reqs = conv.requests || [];
    const rounds = conv.rounds || [];
    const summary = conv.summary || {};

    // 전사 합계 — totals(신 스키마) 우선, 없으면 summary/requests 폴백.
    let tot = conv.totals;
    if (!tot || tot.total_requests == null) {
      const keys = Object.keys(summary).length
        ? Object.keys(summary)
        : [...new Set(reqs.map((r) => r.repo || "공통"))];
      let T = 0, C = 0, P = 0, N = 0;
      for (const k of keys) {
        const pr = repoProgress(k, summary[k], reqs);
        T += pr.total; C += pr.closed; P += pr.in_progress; N += pr.not_started;
      }
      tot = { total_requests: T, req_closed: C, req_in_progress: P,
        req_not_started: N, closed_pct: T ? Math.round((C / T) * 100) : 0 };
    }

    const activeRounds = rounds.filter((r) => ACTIVE_ROUND_STATES.includes(r.state)).length;
    const openIssues = reqs.filter((r) => isOpenState(r.state)).length;
    // 🔴 미수렴(진짜 열린) 라운드 — 라운드 state 직접 카운트(실측·정직). request_refs
    // 자유텍스트 매칭은 약식 표기로 불완전 → "막힘"을 요청 단위로 단정하면 거짓 정밀
    // (FLR-AGT-002). 라운드 state는 정확하므로 "미수렴 라운드 N"으로 정직 노출.
    const unconvergedRounds = rounds.filter((r) => r.state === "미수렴").length;
    const lastRound = rounds.slice().sort((a, b) => roundNum(b.round_id) - roundNum(a.round_id))[0];
    const lastTxt = lastRound
      ? `${escape(lastRound.alias || lastRound.round_id)} · ${escape(serviceLabel(lastRound.repo))} · ${escape(stateMeta(lastRound.state).label)}`
      : "기록 없음";

    // 서비스 키 = summary 키 ∪ requests repo. 정렬: PM320·홈·ByVias·인프라·공통.
    const svcKeys = [...new Set([
      ...Object.keys(summary),
      ...reqs.map((r) => r.repo || "공통"),
    ])].filter(Boolean).sort((a, b) => serviceOrder(a) - serviceOrder(b) || a.localeCompare(b));

    // 도넛 게이지 — 종결률 원형 시각화 (반지름 34, stroke 7). 절제된 임팩트.
    const pct = tot.closed_pct;
    const R = 34, C = 2 * Math.PI * R;
    const dash = (pct / 100) * C;
    const donut = `
      <svg class="cb-donut" viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
        <circle cx="40" cy="40" r="${R}" class="cb-donut-track"></circle>
        <circle cx="40" cy="40" r="${R}" class="cb-donut-fill"
          stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}"
          transform="rotate(-90 40 40)"></circle>
        <text x="40" y="40" class="cb-donut-pct" text-anchor="middle" dominant-baseline="central">${pct}%</text>
      </svg>`;

    // 보조 메트릭 4종 — 종결/진행/미착수/미수렴 라운드. 의미색 + tabular 숫자.
    const metrics = [
      { v: tot.req_closed, k: "종결", cls: "m-ok", icon: "✓" },
      { v: tot.req_in_progress, k: "진행 중", cls: "m-prog", icon: "↻" },
      { v: tot.req_not_started, k: "미착수", cls: "m-wait", icon: "○" },
      { v: unconvergedRounds, k: "미수렴 라운드", cls: unconvergedRounds ? "m-no" : "m-ok", icon: unconvergedRounds ? "!" : "✓" },
    ].map((m) => `
      <div class="cb-metric ${m.cls}">
        <span class="cbm-icon" aria-hidden="true">${m.icon}</span>
        <span class="cbm-v">${m.v}</span>
        <span class="cbm-k">${escape(m.k)}</span>
      </div>`).join("");

    const banner = `
      <div class="conv-banner">
        <div class="cb-gauge">${donut}
          <div class="cb-gauge-cap">
            <div class="cb-total"><b>${tot.total_requests}</b> 이슈</div>
            <div class="cb-closed-frac">종결 ${tot.req_closed} / ${tot.total_requests}</div>
          </div>
        </div>
        <div class="cb-metrics">${metrics}</div>
        <div class="cb-foot">
          🟠 열린 이슈 <b>${openIssues}</b>건 · 🔍 진행·판정 라운드 <b>${activeRounds}</b>건 · 최근 활동 ${lastTxt}
        </div>
      </div>`;

    // status code(active/converged/superseded/idle) → 카드 좌측 레일 색.
    const statusCls = (k) => "svc-" + ((summary[k] && summary[k].status) || "idle");
    const cards = svcKeys.map((k, i) => {
      const pr = repoProgress(k, summary[k], reqs);
      const labelLine = pr.label
        ? `<div class="svc-status">${safe(pr.label)}</div>` : "";
      return `<div class="svc-card ${statusCls(k)}" style="--svc-i:${i}">
        <div class="svc-head">
          <span class="svc-name">${escape(serviceLabel(k))}</span>
          <span class="svc-total">총 ${pr.total}건</span>
        </div>
        <div class="svc-counts">
          <span class="svc-c svc-c-ok">🟢 종결 ${pr.closed}</span>
          <span class="svc-c svc-c-prog">🔄 진행 ${pr.in_progress}</span>
          <span class="svc-c svc-c-wait">⏳ 미착수 ${pr.not_started}</span>
        </div>
        <div class="svc-bar-row">${progressBar(pr.closed, pr.total)}</div>
        ${labelLine}
      </div>`;
    }).join("");

    el("conv-glance").innerHTML =
      banner + `<div class="svc-grid">${cards}</div>`;
  }

  function roundNum(id) {
    const m = String(id || "").match(/(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : -1;
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

  // 이슈(요청) → 관련 라운드 list (req_id가 round.request_refs에 포함). 최신순.
  function relatedRounds(reqId, allRounds) {
    if (!reqId) return [];
    return allRounds
      .filter((rd) => (rd.request_refs || "").includes(reqId))
      .sort((a, b) => roundNum(b.round_id) - roundNum(a.round_id));
  }

  // 이슈의 라운드 진척 1줄 요약 — "최신 R56 · 수렴(2/2)" 식. 라운드 없으면 "".
  // Jira의 'sprint/progress' 칸 대응. 거짓 충실성: 실 라운드 데이터만(없으면 빈 값).
  function roundProgressSummary(reqId, allRounds) {
    const rels = relatedRounds(reqId, allRounds);
    if (!rels.length) return null;
    const latest = rels[0];
    const lm = stateMeta(latest.state);
    const conv = rels.filter((r) => r.state === "수렴").length;
    const tail = conv >= 2 ? ` · 수렴 ${conv}회` : (rels.length > 1 ? ` · ${rels.length}R` : "");
    return { label: latest.alias || latest.round_id, state: lm.label, cls: lm.cls, tail };
  }

  // ④ 이슈 트래킹 보드 — 요청 1건 = 이슈 1건. 상태/서비스 필터 + 상태칩 + 서비스 그룹.
  function renderConvRequests(conv) {
    const reqs = conv.requests || [];
    const rounds = conv.rounds || [];
    const repos = [...new Set(reqs.map((r) => r.repo).filter(Boolean))]
      .sort((a, b) => serviceOrder(a) - serviceOrder(b) || a.localeCompare(b));
    const sel = el("conv-repo");
    sel.innerHTML = '<option value="">전체 서비스</option>' +
      repos.map((r) => `<option value="${escape(r)}">${escape(serviceLabel(r))}</option>`).join("");
    const stateSel = el("conv-state");
    const sortSel = el("conv-sort");
    const viewSel = el("conv-view");

    // 이슈 정렬 비교자 — 정직: 우선순위 데이터 부재로 우선순위 정렬 미제공.
    //   status: 열린 것 먼저, 그 안에서 갱신(captured) 최신순.
    //   updated: captured 문자열 역순(최신 발화 위). progress: 진척% 내림/오름.
    function issueComparator(mode) {
      const pctOf = (r) => { const m = stateMeta(r.state); return m.pct == null ? -1 : m.pct; };
      const upd = (r) => (r.captured || "") + " " + (r.req_id || "");
      if (mode === "updated") return (a, b) => upd(b).localeCompare(upd(a));
      if (mode === "progress") return (a, b) => pctOf(b) - pctOf(a) || upd(b).localeCompare(upd(a));
      if (mode === "progress-asc") return (a, b) => pctOf(a) - pctOf(b) || upd(b).localeCompare(upd(a));
      // status (기본): 열림 먼저 → captured 최신
      return (a, b) => {
        const ao = isOpenState(a.state) ? 0 : 1, bo = isOpenState(b.state) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return upd(b).localeCompare(upd(a));
      };
    }

    const draw = () => {
      const q = el("conv-req-search").value.trim().toLowerCase();
      const rf = sel.value;
      const sf = stateSel.value; // "" | "open" | "closed" | 특정 state 토큰(칩)
      const cmp = issueComparator(sortSel.value);
      const flat = viewSel.value === "flat";
      const filtered = reqs.filter((r) => {
        if (rf && r.repo !== rf) return false;
        if (sf === "open" && !isOpenState(r.state)) return false;
        if (sf === "closed" && isOpenState(r.state)) return false;
        if (sf && sf !== "open" && sf !== "closed" && r.state !== sf) return false;
        if (!q) return true;
        return [r.req_id, r.summary, r.state, r.repo, r.owner, r.close_evidence]
          .join(" ").toLowerCase().includes(q);
      });
      const openTotal = filtered.filter((r) => isOpenState(r.state)).length;
      el("conv-req-count").textContent =
        `${filtered.length} / ${reqs.length} 이슈 · 열림 ${openTotal}`;

      // 상태칩 — 상태별 카운트(전체 reqs 기준·필터 무관 항상 노출). 클릭 시 그 상태 필터.
      renderStateChips(reqs, sf, stateSel, draw);

      if (!filtered.length) {
        el("conv-req-cards").innerHTML = '<p class="hint">조건에 맞는 이슈가 없습니다.</p>';
        return;
      }

      // 평면 뷰 — 서비스 무관 단일 리스트(정렬만 적용). 대표가 "갱신순 전체" 보고 싶을 때.
      if (flat) {
        el("conv-req-cards").innerHTML =
          `<div class="conv-flat-list">${
            filtered.slice().sort(cmp).map((r) => convReqCard(r, rounds, true)).join("")
          }</div>`;
        return;
      }

      // 그룹 뷰 — 서비스별. 그룹 키 = 데이터에서 동적 발견(하드코딩 0·새 서비스 자동 등장).
      const groups = new Map();
      for (const r of filtered) {
        const key = r.repo || "—";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      }
      // 그룹 순서: 알려진 서비스 힌트(serviceOrder) → 미지 서비스는 알파벳(자동 편입).
      const sortedKeys = [...groups.keys()]
        .sort((a, b) => serviceOrder(a) - serviceOrder(b) || a.localeCompare(b));

      el("conv-req-cards").innerHTML = sortedKeys.map((key) => {
        const items = groups.get(key).slice().sort(cmp);
        const openN = items.filter((r) => isOpenState(r.state)).length;
        const closedN = items.length - openN;
        const gpct = items.length ? Math.round((closedN / items.length) * 100) : 0;
        const cards = items.map((r) => convReqCard(r, rounds)).join("");
        return `<div class="conv-repo-group">
          <div class="conv-repo-head">
            <span class="crh-name">${escape(serviceLabel(key))}</span>
            <span class="conv-repo-meta">${items.length}건 · 열림 ${openN} · 종결 ${gpct}%</span>
            <span class="crh-bar"><span class="crh-bar-fill" style="width:${gpct}%"></span></span>
          </div>
          <div class="conv-repo-cards">${cards}</div>
        </div>`;
      }).join("");
    };

    [el("conv-req-search")].forEach((e) => e.addEventListener("input", draw));
    [sel, stateSel, sortSel, viewSel].forEach((e) => e.addEventListener("change", draw));
    draw();
  }

  // 상태별 카운트 칩 (칸반 헤더 역할). 클릭 = 해당 상태로 필터 토글.
  function renderStateChips(reqs, activeSf, stateSel, draw) {
    // 상태 순서 = 상태머신 흐름(포착→판정중→구현중→배포→종결, 보류는 끝).
    const ORDER = ["포착", "판정중", "구현중", "배포", "종결", "보류", "unknown"];
    const counts = new Map();
    for (const r of reqs) counts.set(r.state, (counts.get(r.state) || 0) + 1);
    const keys = [...counts.keys()].sort(
      (a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
    el("conv-state-chips").innerHTML = keys.map((st) => {
      const m = stateMeta(st);
      const on = activeSf === st;
      return `<button type="button" class="state-chip ${m.cls}${on ? " on" : ""}"
        data-state="${escape(st)}" aria-pressed="${on}">
        ${escape(m.label)} <span class="sc-n">${counts.get(st)}</span></button>`;
    }).join("");
    el("conv-state-chips").querySelectorAll(".state-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const st = btn.dataset.state;
        stateSel.value = (stateSel.value === st) ? "" : st; // 토글
        draw();
      });
    });
  }

  // 개별 이슈 카드 — 상태 배지 + 서비스 + 진행률 + 라운드 진척 1줄 + 갱신일.
  //   펼침 시: 담당 · 종결근거 · 관련 라운드 히스토리(verdict state).
  //   showService=true(평면 뷰)면 서비스 태그 노출(그룹 헤더 없으므로).
  function convReqCard(r, allRounds, showService) {
    const m = stateMeta(r.state);
    const closed = !isOpenState(r.state);
    const evidMissing = (r.state === "종결" || r.state === "수렴") && !(r.close_evidence || "").trim();
    const rid = r.req_id || "";
    const svcTag = showService
      ? `<span class="rq-svc">${escape(serviceLabel(r.repo))}</span>` : "";
    const bar = m.pct == null
      ? `<div class="rq-bar-na" title="상태별 진행률 매핑 없음">진행률 미상</div>`
      : `<div class="rq-bar" role="progressbar" aria-valuenow="${m.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="진행률 ${m.pct}%">
           <span class="rq-bar-fill rq-${m.cls}" style="width:${m.pct}%"></span></div>
         <span class="rq-bar-pct">${m.pct}%</span>`;
    // 라운드 진척 1줄 (요약줄에 노출 — 펼치지 않아도 보임)
    const rp = roundProgressSummary(rid, allRounds);
    const rpHtml = rp
      ? `<span class="rq-round badge ${rp.cls}" title="최신 관련 라운드">${escape(rp.label)} · ${escape(rp.state)}${escape(rp.tail)}</span>`
      : "";
    // 갱신일 = captured (대표 발화 시각). 마지막 갱신 칸 역할.
    const upd = (r.captured || "").trim()
      ? `<span class="rq-upd" title="포착·갱신">${safe(r.captured)}</span>` : "";
    // 관련 라운드 히스토리 (펼침)
    const related = relatedRounds(rid, allRounds);
    const relatedHtml = related.length
      ? `<div class="rq-related"><div class="rq-related-h">라운드 히스토리 ${related.length}건</div>${
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

    return `<details class="rq-card rq-rail-${m.cls}${closed ? " rq-closed" : ""}">
      <summary class="rq-summary">
        <div class="rq-head">
          <span class="badge ${m.cls}">${escape(m.label)}</span>
          ${svcTag}
          <span class="rq-id"><code>${escape(rid)}</code></span>
          ${rpHtml}
          ${upd}
        </div>
        <div class="rq-title">${safe(r.summary || "(요약 없음)")}</div>
        <div class="rq-bar-row">${bar}</div>
      </summary>
      <div class="rq-body">
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
