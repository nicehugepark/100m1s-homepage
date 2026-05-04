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
  }

  document.addEventListener("DOMContentLoaded", load);
})();
