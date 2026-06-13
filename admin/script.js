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
  const SANITIZE_RULES = [
    [/ishikawa/gi, "뉴스분석"],   // 이시카와(뉴스분석팀) 역할 라벨 — 의미 보존
    [/togusa/gi, "투자분석"],     // 토구사(주식투자팀)
    [/tachikoma/gi, "AI 시스템"], // 타치코마(오케스트레이터)
    [/hugepark/gi, "운영자"],
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
      <div class="glance-card">
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

    const draw = () => {
      const q = el("conv-req-search").value.trim().toLowerCase();
      const rf = sel.value;
      const filtered = reqs.filter((r) => {
        if (rf && r.repo !== rf) return false;
        if (!q) return true;
        return [r.req_id, r.summary, r.state, r.repo, r.close_evidence].join(" ").toLowerCase().includes(q);
      });
      el("conv-req-count").textContent = `${filtered.length} / ${reqs.length}`;

      // repo로 그룹화 (정렬: HOME, PM320, 그외, 미분류)
      const groups = new Map();
      for (const r of filtered) {
        const key = r.repo || "—";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      }
      const order = (k) => ({ HOME: 0, PM320: 1 }[k] ?? (k === "—" ? 9 : 5));
      const sortedKeys = [...groups.keys()].sort((a, b) => order(a) - order(b) || a.localeCompare(b));

      if (!sortedKeys.length) {
        el("conv-req-cards").innerHTML = '<p class="hint">조건에 맞는 요청이 없습니다.</p>';
        return;
      }

      el("conv-req-cards").innerHTML = sortedKeys.map((key) => {
        const items = groups.get(key);
        const openN = items.filter((r) => isOpenState(r.state)).length;
        const cards = items.map((r) => convReqCard(r, rounds)).join("");
        return `<div class="conv-repo-group">
          <div class="conv-repo-head">${escape(repoLabel(key))}
            <span class="conv-repo-meta">${items.length}건 · 열림 ${openN}</span></div>
          <div class="conv-repo-cards">${cards}</div>
        </div>`;
      }).join("");
    };

    el("conv-req-search").addEventListener("input", draw);
    sel.addEventListener("change", draw);
    draw();
  }

  // 개별 요청 카드 — 제목 + 상태 배지 + 진행률 + 펼침 시 종결근거/관련 라운드
  function convReqCard(r, allRounds) {
    const m = stateMeta(r.state);
    const closed = !isOpenState(r.state);
    const evidMissing = (r.state === "종결" || r.state === "수렴") && !(r.close_evidence || "").trim();
    // 진행률 바 — pct 미상이면 바 숨김(거짓 진행률 금지)
    const bar = m.pct == null
      ? `<div class="rq-bar-na" title="상태별 진행률 매핑 없음">진행률 미상</div>`
      : `<div class="rq-bar" role="progressbar" aria-valuenow="${m.pct}" aria-valuemin="0" aria-valuemax="100">
           <span class="rq-bar-fill rq-${m.cls}" style="width:${m.pct}%"></span></div>`;
    // 관련 라운드 — req_id가 request_refs에 포함된 것
    const rid = r.req_id || "";
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

    return `<details class="rq-card${closed ? " rq-closed" : ""}">
      <summary class="rq-summary">
        <div class="rq-head">
          <span class="badge ${m.cls}">${escape(m.label)}</span>
          <span class="rq-id"><code>${escape(rid)}</code></span>
        </div>
        <div class="rq-title">${safe(r.summary || "(요약 없음)")}</div>
        ${bar}
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

  function renderConvVerdicts(conv) {
    const verdicts = conv.verdicts || [];
    el("conv-verdict-n").textContent = verdicts.length;
    el("conv-verdict-tbody").innerHTML = verdicts.map((v) => `
      <tr>
        <td><code>${safe(v.file)}</code></td>
        <td>${escape(v.round_id || "")}</td>
        <td>${safe(v.panel || "")}</td>
        <td><span class="badge ${verdictClass(v.verdict)}">${escape(v.verdict)}</span></td>
        <td>${numOrUnknown(v.p0_count)}</td>
        <td>${numOrUnknown(v.new_p1_count)}</td>
      </tr>`).join("");
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
    el("generated-at").textContent =
      "생성: " + (state.data.generated_at || "").slice(0, 19).replace("T", " ");
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
