(() => {
  const state = { data: null };

  const el = (id) => document.getElementById(id);
  const escape = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function badge(text, cls) {
    return `<span class="badge ${cls || ""}">${escape(text)}</span>`;
  }

  function setupTabs() {
    document.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((x) => {
          x.classList.remove("active");
          x.setAttribute("aria-selected", "false");
        });
        document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        t.setAttribute("aria-selected", "true");
        el("tab-" + t.dataset.tab).classList.add("active");
      });
    });
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

  function renderConvTrend(conv) {
    const trend = conv.trend || {};
    const repos = Object.keys(trend).sort();
    if (!repos.length) { el("conv-trend").innerHTML = '<p class="hint">라운드 데이터 없음</p>'; return; }
    el("conv-trend").innerHTML = repos.map((repo) => {
      const pts = trend[repo] || [];
      // defect_sum null(미측정)은 막대 미표시(거짓 0 막대 금지) — '미측정' 라벨.
      const maxV = Math.max(1, ...pts.map((p) => p.defect_sum == null ? 0 : p.defect_sum));
      const bars = pts.map((p) => {
        const known = p.defect_sum != null;
        const h = known ? Math.round((p.defect_sum / maxV) * 100) : 0;
        const label = p.alias || p.round_id;
        const valTxt = known ? p.defect_sum : "미측정";
        const cls = convStateClass(p.state);
        return `<div class="conv-bar-col" title="${escape(label)} · ${escape(p.state)} · 결함합 ${escape(String(valTxt))} · 판정 ${p.verdict_count}건">
          <div class="conv-bar-val">${escape(String(valTxt))}</div>
          <div class="conv-bar ${cls} ${known ? "" : "conv-bar-unknown"}" style="height:${known ? Math.max(h, 4) : 4}px"></div>
          <div class="conv-bar-x">${escape(label)}</div>
        </div>`;
      }).join("");
      return `<div class="conv-trend-repo"><div class="conv-trend-title">${escape(repo)}</div>
        <div class="conv-bars">${bars}</div></div>`;
    }).join("");
  }

  function renderConvSummary(conv) {
    const summary = conv.summary || {};
    const warns = conv.integrity_warnings || [];
    const cards = Object.entries(summary).map(([repo, s]) =>
      `<div class="card"><div class="k">${escape(repo)}</div>
        <div class="v">${s.open_requests}/${s.total_requests}</div>
        <div class="sub">열린/전체 요청 · 활성 라운드 ${s.active_rounds} · 최신 ${escape(s.latest_round || "-")} (${escape(s.latest_state || "-")})</div>
      </div>`).join("");
    const warnHtml = warns.length
      ? `<div class="hint conv-warn">무결성 WARN ${warns.length}건: ${warns.map(escape).join(" · ")}</div>`
      : `<div class="hint">무결성 WARN 0건</div>`;
    el("conv-summary").innerHTML = `<div class="summary-cards">${cards}</div>${warnHtml}`;
  }

  function renderConvRequests(conv) {
    const reqs = conv.requests || [];
    const repos = [...new Set(reqs.map((r) => r.repo).filter(Boolean))].sort();
    const sel = el("conv-repo");
    sel.innerHTML = '<option value="">전체 repo</option>' +
      repos.map((r) => `<option value="${escape(r)}">${escape(r)}</option>`).join("");
    const draw = () => {
      const q = el("conv-req-search").value.trim().toLowerCase();
      const rf = sel.value;
      const filtered = reqs.filter((r) => {
        if (rf && r.repo !== rf) return false;
        if (!q) return true;
        return [r.req_id, r.summary, r.state, r.repo].join(" ").toLowerCase().includes(q);
      });
      el("conv-req-count").textContent = `${filtered.length} / ${reqs.length}`;
      el("conv-req-tbody").innerHTML = filtered.map((r) => {
        // 열린 요청인데 종결 근거 공란 = 정상. 종결(✅)인데 공란이면 빨강(유실 가시·DSN §7.3).
        const closed = r.state === "종결";
        const evidMissing = closed && !(r.close_evidence || "").trim();
        return `<tr>
          <td><code>${escape(r.req_id)}</code></td>
          <td>${escape(r.repo)}</td>
          <td><span class="badge ${convStateClass(r.state)}">${escape(r.state)}</span></td>
          <td>${escape(r.summary || "")}</td>
          <td>${escape(r.provenance || "")}</td>
          <td class="${evidMissing ? "conv-evid-missing" : ""}">${escape(r.close_evidence || "")}${evidMissing ? " ⚠️근거공란" : ""}</td>
        </tr>`;
      }).join("");
    };
    el("conv-req-search").addEventListener("input", draw);
    sel.addEventListener("change", draw);
    draw();
  }

  function renderConvRounds(conv) {
    const rounds = conv.rounds || [];
    el("conv-round-tbody").innerHTML = rounds.map((r) => `
      <tr>
        <td><code>${escape(r.round_id)}</code>${r.alias ? ` <span class="sub">(${escape(r.alias)})</span>` : ""}</td>
        <td>${escape(r.repo)}</td>
        <td>${escape(r.request_refs || "")}</td>
        <td>${escape(r.panel || "")}</td>
        <td>${escape(r.tier || "")}</td>
        <td><span class="badge ${convStateClass(r.state)}">${escape(r.state)}</span></td>
      </tr>`).join("");
  }

  function renderConvVerdicts(conv) {
    const verdicts = conv.verdicts || [];
    el("conv-verdict-tbody").innerHTML = verdicts.map((v) => `
      <tr>
        <td><code>${escape(v.file)}</code></td>
        <td>${escape(v.round_id || "")}</td>
        <td>${escape(v.panel || "")}</td>
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
      el("conv-summary").innerHTML =
        `<p class="hint">convergence.json 로드 실패: ${escape(e.message)}. 'python3 scripts/admin/build_convergence.py' 로 생성하세요.</p>`;
      return;
    }
    renderConvSummary(conv);
    renderConvTrend(conv);
    renderConvRequests(conv);
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
