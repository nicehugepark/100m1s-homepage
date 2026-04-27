/* ───── renderer.js — 카드/차트/테마 렌더링 + 초기화 ───── */

// REQ-033 — 마지막 업데이트 시각 포맷 (SPEC-001 §I.4).
// build_daily.py의 generated_at은 naive ISO ("2026-04-27T22:59:43.768243") — timezone 미명시.
// new Date() 파싱 시 브라우저 timezone 의존성 회피하기 위해 substring 직접 추출 (KST 가정 명시).
// 형식 불일치 시 빈 문자열 반환 (FLR-AGT-002 정합 — 거짓 표시 차단).
function _formatGeneratedAt(generatedAt) {
  if (!generatedAt || typeof generatedAt !== 'string') return '';
  const m = generatedAt.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/);
  if (!m) return '';
  return `${m[1]}:${m[2]} KST`;
}

// 당일 분봉 sparkline SVG (open 기준선 + 라인 + 하단 그라데이션)
function buildSparkline(prices, base, dir) {
  if (!prices || prices.length < 2) return '';
  const W = 60, H = 32, PAD = 2;
  const min = Math.min(...prices, base);
  const max = Math.max(...prices, base);
  const span = max - min || 1;
  const x = i => PAD + (W - 2*PAD) * i / (prices.length - 1);
  const y = p => PAD + (H - 2*PAD) * (1 - (p - min) / span);
  const d = prices.map((p, i) => (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ' ' + y(p).toFixed(1)).join(' ');
  const color = dir === 'up' ? '#C53939' : dir === 'down' ? '#1958C7' : '#888';
  const gradId = 'g' + Math.random().toString(36).slice(2, 8);
  const fillD = d + ` L${x(prices.length-1).toFixed(1)} ${H-PAD} L${x(0).toFixed(1)} ${H-PAD} Z`;
  const baseY = y(base).toFixed(1);
  return `<svg viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${fillD}" fill="url(#${gradId})"/>
    <line x1="${PAD}" y1="${baseY}" x2="${W-PAD}" y2="${baseY}" stroke="#888" stroke-width="0.8" stroke-dasharray="2,2" opacity="0.5"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="1.3"/>
  </svg>`;
}

function deriveDate(post) {
  if (post.post_date) return post.post_date;
  if (post.fetched_at) return post.fetched_at.slice(0, 10);
  return '날짜 미상';
}

function renderNewsCard(card) {
  const j = card.judgment || '중립';
  // 강도 — % 숫자 대신 카테고리. 구버전 호환: confidence가 있으면 임계값으로 변환
  let strength = card.strength;
  if (!strength && card.confidence != null) {
    if (card.confidence >= 0.75) strength = '강';
    else if (card.confidence >= 0.5) strength = '중';
    else strength = '약';
  }
  const strengthHtml = strength ? `<span class="judgment-strength">·${strength}</span>` : '';
  return `
    <div class="news-card">
      <div class="news-judgment ${j}">${j}${strengthHtml}</div>
      <div class="news-content">
        <div class="news-summary">${escapeHtml(card.summary || '(요약 없음)')}</div>
        ${card.reasoning ? `<div class="news-reasoning">${escapeHtml(card.reasoning)}</div>` : ''}
      </div>
    </div>
  `;
}

// DSN-001 §16.1.4 (v7.2): rules_version 배너 — localStorage에 최종 확인 버전 저장, 불일치 시 1회 안내.
// data.rules_version이 없으면 배너 자체 미생성 (graceful degradation).
function _buildRulesVersionBanner(rulesVersion) {
  if (!rulesVersion || typeof rulesVersion !== 'string') return '';
  const LS_KEY = 'lastSeenRulesVersion';
  let lastSeen = '';
  try { lastSeen = localStorage.getItem(LS_KEY) || ''; } catch (e) { return ''; }
  if (lastSeen === rulesVersion) return ''; // 최신 확인 완료
  // 배너 1회 표시. 사용자 X 클릭 시 해당 버전을 최신으로 저장.
  const safeVer = String(rulesVersion).replace(/[^0-9a-zA-Z]/g, '').slice(0, 16);
  return `<div class="cal-rules-version-banner" role="status" aria-live="polite" data-version="${safeVer}">
    <span class="cal-rules-version-icon" aria-hidden="true">ℹ️</span>
    <span class="cal-rules-version-msg">규정 데이터가 갱신되었습니다. 최신 기준으로 보시려면 새로고침을 권장합니다.</span>
    <button type="button" class="cal-rules-version-close" aria-label="배너 닫기" data-rules-ver="${safeVer}">&times;</button>
  </div>`;
}
// 배너 X 클릭 핸들러 — event delegation (document-level)
if (typeof document !== 'undefined' && !window.__rulesVerBannerBound) {
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest('.cal-rules-version-close');
    if (!btn) return;
    const v = btn.getAttribute('data-rules-ver') || '';
    try { localStorage.setItem('lastSeenRulesVersion', v); } catch (err) {}
    const banner = btn.closest('.cal-rules-version-banner');
    if (banner) banner.remove();
  });
  window.__rulesVerBannerBound = true;
}

/* ───── DSN-20260425-DSN-004 v9.1 §J.1 — KOREA_HOLIDAYS 글로벌 주입 ─────
   utils.js getNextTradingDay()의 안전망 데이터 소스. build_daily.py 산출 next_trading_day_for_predicted 신뢰가 원칙.
   estimated 등급 시 console.warn (FLR-20260423-FLR-002 verified 절차).
*/
if (typeof window !== 'undefined' && !window.__koreaHolidaysLoading && !window.KOREA_HOLIDAYS) {
  window.__koreaHolidaysLoading = true;
  fetch('/data/holidays.json')
    .then(r => r.ok ? r.json() : null)
    .then(j => { if (j) window.KOREA_HOLIDAYS = j; })
    .catch(() => {})
    .finally(() => { window.__koreaHolidaysLoading = false; });
}

function renderCalExpandContent(date, data) {
  const inner = document.getElementById('cal-content');
  const kiwoomStocks = data.kiwoom ? (data.kiwoom.daily_top || data.kiwoom.latest_stocks || []) : [];
  const hasInterpretedStocks = data.interpretedByName && data.interpretedByName.size > 0;
  const hasAny = kiwoomStocks.length > 0 || hasInterpretedStocks;

  if (!hasAny) {
    const closed = isMarketClosed(date);
    let emptyMsg;
    if (closed) {
      const nextDate = getNextTradingDate(date);
      const nextLabel = nextDate ? formatKoDate(nextDate) : '';
      emptyMsg = `
        <div style="text-align:center;padding:32px 0;">
          <div style="font-size:15px;font-weight:700;color:var(--tx2);margin-bottom:6px;">오늘은 장이 쉽니다</div>
          <div style="font-size:12px;color:var(--dm);">${nextLabel ? '다음 거래일 ' + escapeHtml(nextLabel) : ''}</div>
        </div>`;
    } else {
      const now = new Date();
      const todayIso = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const isToday = (date === todayIso);
      const hour = now.getHours();
      const isMarketHours = isToday && (hour < 16);
      emptyMsg = `<div class="cal-empty">
            <div class="cal-empty-circle"></div>
            <div>수집된 데이터가 없습니다</div>
          </div>`;
    }
    // 휴장일이라도 매크로 이벤트가 있으면 표시
    const closedMacro = (data.macroEvents || []).filter(m => m.summary && m.summary.length >= 10).slice(0, 5);
    const closedMacroHtml = closedMacro.length > 0
      ? `<div class="cal-macro-strip">${closedMacro.map(m => `<span class="cal-macro-chip" title="${escapeHtml(sanitize(m.title || ''))}">${escapeHtml(sanitize(m.summary))}</span>`).join('')}</div>`
      : '';
    const _emptyVerBanner = _buildRulesVersionBanner(data && data.rules_version);
    inner.innerHTML = `
      ${_emptyVerBanner}
      <div class="cal-content-head">
        <div class="cal-content-date">${formatKoDate(date)}</div>
        <div class="cal-content-meta">${closed ? '휴장' : '데이터 없음'}</div>
      </div>
      ${closedMacroHtml}
      ${emptyMsg}
    `;
    return;
  }

  // 키움 name → {ticker, change_pct} 맵 (특징주 join용)
  const kiwoomByName = new Map();
  for (const s of kiwoomStocks) {
    if (s && s.name) kiwoomByName.set(s.name, s);
  }

  // interpretedByName을 특징주/종목 구성에서 사용하기 위해 먼저 참조
  const interpByName = data.interpretedByName || new Map();

  // 특징주 결정: 거래대금 TOP 또는 stock-*.json 기반
  let featureSource = 'primary';
  let featureItems = []; // { name, pct, themes, ticker, reason }
  if (kiwoomStocks.length > 0) {
    featureSource = 'fallback';
    featureItems = kiwoomStocks.slice(0, 6).map(s => {
      const interp = interpByName.get(s.name);
      const pct = interp?.change_pct ?? s.change_pct ?? s.max_change_pct ?? null;
      const themes = (interp?.themes || themesData?.stocks?.[s.ticker]?.themes || []).slice(0, 3);
      return { name: s.name, pct, themes, links: [], ticker: s.ticker, reason: '', interp };
    });
  } else if (interpByName.size > 0) {
    // kiwoom JSON 없음, 카페 없음 → stock-*.json 기반 특징주
    featureSource = 'fallback';
    featureItems = [];
    for (const [name, interp] of interpByName) {
      if (featureItems.length >= 6) break;
      const themes = (interp.themes || []).slice(0, 3).map(t => typeof t === 'string' ? { name: t } : t);
      featureItems.push({ name, pct: interp.change_pct ?? null, themes, links: [], code: interp.code || '', ticker: interp.code || '', reason: '', interp });
    }
  }

  // 오늘의 종목: 거래대금 TOP을 base로, 카페·해석 정보 join
  let todayStocks;
  if (kiwoomStocks.length > 0) {
    todayStocks = kiwoomStocks.map((s, i) => {
      const interp = interpByName.get(s.name);
      // 등락률: stock JSON의 종가 기준 우선 (키움 max_change_pct는 장중 최대라 부정확)
      const pct = interp?.change_pct ?? s.change_pct ?? s.max_change_pct ?? null;
      let themes;
      if (interp && Array.isArray(interp.themes) && interp.themes.length > 0) {
        themes = interp.themes.slice(0, 3).map(t => typeof t === 'string' ? { name: t } : t);
      } else {
        themes = (themesData?.stocks?.[s.ticker]?.themes || []).slice(0, 2);
      }
      return { rank: i + 1, name: s.name, ticker: s.ticker, code: s.ticker, pct, amount: s.max_trade_amount ?? s.trade_amount, themes, interp, links: [], open: s.open ?? interp?.open_price, high: s.high ?? interp?.high_price, low: s.low ?? interp?.low_price, price: s.last_price ?? s.price ?? interp?.close_price };
    });
  } else if (interpByName.size > 0) {
    // kiwoom JSON 없음 → stock-*.json (interpretedByName)에서 종목 구성
    todayStocks = [];
    let idx = 0;
    for (const [name, interp] of interpByName) {
      idx++;
      let themes = [];
      if (Array.isArray(interp.themes) && interp.themes.length > 0) {
        themes = interp.themes.slice(0, 3).map(t => typeof t === 'string' ? { name: t } : t);
      }
      todayStocks.push({
        rank: interp.rank || idx,
        name,
        code: interp.code || interp.ticker || '',
        ticker: interp.code || interp.ticker || '',
        pct: interp.change_pct ?? null,
        amount: interp.trade_amount ?? null,
        price: interp.close_price ?? null,
        open: interp.open_price ?? null,
        high: interp.high_price ?? null,
        low: interp.low_price ?? null,
        themes,
        interp,
        links
      });
    }
    // 거래대금 순 정렬
    todayStocks.sort((a, b) => (b.amount || 0) - (a.amount || 0));
    todayStocks.forEach((s, i) => { s.rank = i + 1; });
  } else {
    todayStocks = [];
  }

  // 메타
  const newsTotal = todayStocks.reduce((acc, i) => acc + (i.links ? i.links.length : 0), 0);
  const interpCount = todayStocks.filter(i => i.interp).length;
  const streakCount = todayStocks.filter(i => i.interp?.prev_pick).length;
  const streakSuffix = streakCount > 0 ? ` · 연속등장 ${streakCount}종` : '';
  const sourceSuffix = '';
  // REQ-033 — 마지막 업데이트 시각 (SPEC-001 §I.4). build_daily.py generated_at 표시.
  // 시간대 정합 (개발팀 비판): naive ISO("YYYY-MM-DDTHH:MM:SS.fff") 직접 substring 추출 — Date 파싱 시 브라우저 timezone 의존성 회피. KST 가정 명시.
  const generatedAt = data.generatedAt || '';
  const generatedSuffix = generatedAt
    ? ` · 마지막 업데이트 <span class="cal-day-meta__updated">${escapeHtml(_formatGeneratedAt(generatedAt))}</span>`
    : '';
  const metaText = todayStocks.length > 0
    ? `오늘의 종목 : ${todayStocks.length}개${streakSuffix}${sourceSuffix}${generatedSuffix}`
    : '—';

  // (1) 매크로 이벤트 (내러티브 폴백에도 사용)
  const macroEvents = (data.macroEvents || [])
    .filter(m => m.summary && m.summary.length >= 10)
    .slice(0, 5);
  const macroHtml = macroEvents.length > 0
    ? `<div class="cal-macro-strip">${macroEvents.map(m => `<span class="cal-macro-chip" title="${escapeHtml(sanitize(m.title || ''))}">${escapeHtml(sanitize(m.summary))}</span>`).join('')}</div>`
    : '';

  // 내러티브: 카페 제거로 빈 값 (하위 호환용 유지)
  const narrPillsHtml = '';

  const renderFactors = (st) => {
    const ff = st.five_factors || {};
    const ev = st.five_factors_evidence || {};
    const labels = { freshness: '신선', durability: '지속', magnitude: '크기', spreadability: '전파', liquidity: '환급' };
    const entries = Object.entries(ff)
      .map(([k, v]) => ({ k, v, label: labels[k] || k, ev: ev[k] || '' }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3);
    return entries.map(e => {
      const filled = Math.round(e.v * 5);
      const dots = Array.from({ length: 5 }, (_, i) => `<span class="cal-dot ${i < filled ? 'on' : ''}"></span>`).join('');
      return `<span class="cal-factor" title="${escapeHtml(e.ev)}"><span class="label">${e.label}</span><span class="cal-dots">${dots}</span></span>`;
    }).join('');
  };

  const renderTodayCard = (it) => {
    const pct = it.pct;
    const dir = (pct ?? 0) >= 0 ? 'up' : 'down';           // 등락률 텍스트 색상용 (전일 대비)
    const candleDir = (it.open && it.price) ? (it.price >= it.open ? 'up' : 'down') : dir;  // 캔들/sparkline용 (시가 대비)
    const sign = (pct ?? 0) >= 0 ? '+' : '';
    const pctText = pct != null ? `${sign}${pct.toFixed(2)}%` : '';
    const amountText = it.amount ? fmtTradeAmount(it.amount) : '';
    const candleHtml = miniCandle(it.open, it.high, it.low, it.price, it.pct);
    // 테마칩: 같은 루트 트리는 합쳐서 중복 노드 제거
    const tp = it.interp?.theme_paths || [];
    const themesHtml = (() => {
      if (tp.length === 0) return it.themes.slice(0, 3).map(t => `<span class="cal-ind-chip">${escapeHtml(t.name)}</span>`).join('');
      // 같은 루트끼리 그룹핑 → 노드 합집합 (순서 유지)
      const groups = {};
      const groupOrder = [];
      tp.forEach(p => {
        const root = p.path[0];
        if (!groups[root]) { groups[root] = []; groupOrder.push(root); }
        groups[root].push(p.path);
      });
      return groupOrder.map((root, gi) => {
        const paths = groups[root];
        // 모든 경로의 노드를 순서 유지하며 합집합
        const seen = new Set();
        const merged = [];
        paths.forEach(path => {
          path.forEach(node => {
            if (!seen.has(node)) { seen.add(node); merged.push(node); }
          });
        });
        const chips = merged.map(s => `<span class="cal-ind-chip">${escapeHtml(s)}</span>`).join('');
        return (gi > 0 ? '<span class="cal-theme-sep">│</span>' : '') + chips;
      }).join('');
    })();

    // 해석 있으면 full 카드 확장 (아래 if 블록), 없으면 같은 full 구조 + "뉴스 없음" placeholder (else 블록 하단)
    // 대표 지시 2026-04-22: compact 한 줄 분기 제거 — 카드 간 레이아웃 일관성 유지
    if (it.interp) {
      const st = it.interp;
      const causal = (st.causal_chain || []).slice(0, 3);
      const styledArrow = '<span class="arrow">→</span>';
      const causalHtml = causal.length > 0
        ? `<div class="cal-causal">${causal.map((c, i) => `${escapeHtml(sanitize(c)).replace(/→/g, styledArrow)}${i < causal.length - 1 ? styledArrow : ''}`).join('')}</div>`
        : '';
      // 뉴스 제목은 미표시 (대표 지시: 로봇 제목은 무가치. 인과사슬만 표시)
      const headlineHtml = '';
      // differentiator가 causal_chain과 동일하면 중복 제거
      const causalText = (causal[0] || '').trim();
      const diffRaw = (st.differentiator || st.outlook || '').trim();
      let ishikawaLine = (diffRaw && diffRaw !== causalText) ? diffRaw : '';
      // 뉴스 없는 종목: industry/sector로 fallback
      if (!ishikawaLine && !causalText) {
        const parts = [];
        if (st.industry) parts.push(st.industry);
        if (st.sector) parts.push(st.sector);
        ishikawaLine = parts.join(' · ');
      }
      const ishikawaHtml = ishikawaLine ? `<div class="cal-ishikawa-line">${escapeHtml(sanitize(ishikawaLine))}</div>` : '';
      // 공시 (DART) — 뱃지는 namecell, 목록은 카드 최하단
      // 2026-04-22 대표 정정: status_badges에 이미 표시되는 공시(투자경고 등)는 공시 리스트 itemsHtml에서 제외 (중복 방지)
      // REQ-030 §1 — 헤더 "공시" 배지는 모든 KRX 공시 포함 트리거 (SPEC-001 §III.4):
      //   - stock.disclosures.length > 0 OR status_badges.filter(source='disclosure').length > 0
      //   - 사용자가 헤더에서 공시 존재 인지 → 펼침 동기 제공
      // discListHtml(상세 영역)은 기존대로 STATUS_DISC_CATS 제외 (사유 박스에서 KRX 단계 공시 표시).
      const STATUS_DISC_CATS = ['투자주의', '투자경고', '투자위험', '단기과열', '단기과열예고', '관리종목', '매매거래정지', '상장폐지'];
      const allDiscs = st.disclosures || [];
      const discs = allDiscs.filter(d => !STATUS_DISC_CATS.includes(d.category));
      const krxDiscBadges = (st.status_badges || []).filter(b => b.source === 'disclosure');
      const totalDiscCount = allDiscs.length + (allDiscs.length === 0 ? krxDiscBadges.length : 0);
      let discBadgeHtml = '';
      let discListHtml = '';
      if (totalDiscCount > 0) {
        // REQ-039 표기 통일 — "공시+N" (1건도 +1).
        const discBadgeLabel = `공시+${totalDiscCount}`;
        const cbWarnEarly = allDiscs.some(d => d.is_cb) ? '<span class="cal-disc-cb-warn">CB</span>' : '';
        // REQ-030 §1 — 헤더 공시 배지 (SPEC-001 §III.4). 칩 디자인 (📋 아이콘 CSS ::before).
        discBadgeHtml = `<span class="cal-disclosure-badge" aria-label="공시 ${totalDiscCount}건">${escapeHtml(discBadgeLabel)}</span>${cbWarnEarly}`;
      }
      if (discs.length > 0) {
        const sentSum = discs.reduce((s, d) => s + (d.sentiment || 0), 0);
        const health = sentSum > 0 ? 'positive' : sentSum < 0 ? 'negative' : 'neutral';
        const hasCb = discs.some(d => d.is_cb);
        const cbWarn = hasCb ? '<span class="cal-disc-cb-warn">CB</span>' : '';
        const maxShow = 3;
        const shown = discs.slice(0, maxShow);
        const moreCount = discs.length - maxShow;
        const _DOW = ['일','월','화','수','목','금','토'];
        const formatDateWithDow = (s) => {
          if (!s) return '';
          const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (!m) return '';
          const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
          return `${m[1]}-${m[2]}-${m[3]}(${_DOW[dt.getUTCDay()]})`;
        };
        const formatPeriodText = (ps, pe) => {
          const a = formatDateWithDow(ps), b = formatDateWithDow(pe);
          if (a && b && a !== b) return `${a} ~ ${b}`;
          if (a && b) return a;
          if (a) return `${a} 부터`;
          if (b) return `~ ${b}`;
          return '';
        };
        const itemsHtml = shown.map(d => {
          const catCls = d.is_cb ? 'cal-disc-cat cb' : 'cal-disc-cat';
          const catLabel = d.category || '기타';
          const periodText = formatPeriodText(d.period_start, d.period_end);
          const periodHtml = periodText
            ? `<span class="cal-disc-period"><span class="cal-disc-period-label">기간</span>${escapeHtml(periodText)}</span>`
            : '';
          // v2.5: 조건 박스 제거 (대표 정정 16:57 KST) — 빨간 뱃지가 같은 정보. title 1줄 클램프.
          return `<a class="cal-disc-item" href="${escapeHtml(d.url || '#')}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(d.title)}"><span class="${catCls}">${escapeHtml(catLabel)}</span><span class="cal-disc-summary">${escapeHtml(d.title)}${periodHtml}</span><svg class="cal-disc-ext" width="10" height="10" viewBox="0 0 10 10"><path d="M3 1h6v6M9 1L4 6" stroke="currentColor" stroke-width="1.2" fill="none"/></svg></a>`;
        }).join('');
        const moreHtml = moreCount > 0 ? `<span class="cal-disc-more">+${moreCount}건 더보기</span>` : '';
        const codeId = it.code || it.name;
        const sectionId = `disc-${escapeHtml(codeId)}`;
        // REQ-030 §1 — discBadgeHtml은 위에서 이미 설정 (모든 KRX 공시 트리거).
        // 여기서는 discListHtml만 설정 (STATUS_DISC_CATS 제외 정합 유지).
        discListHtml = `<div class="cal-disc-section" id="${sectionId}">${itemsHtml}${moreHtml}</div>`;
      }
      // 뉴스 제목 + 링크 (제목 표시)
      const linkSeen = new Set();
      const sourceMap = {'hankyung.com':'한경','mk.co.kr':'매경','edaily.co.kr':'이데일리','biz.chosun.com':'조선비즈','etoday.co.kr':'이투데이','news.naver.com':'네이버','n.news.naver.com':'네이버'};
      const allLinks = [...(st.news_digest || []).map(n => ({ url: n.url, title: n.inferred_title, source: n.source })), ...(it.links || []).map(l => ({ url: l.url, title: '', source: '' }))];
      const uniqueLinks = allLinks.filter(l => { if (!l.url || linkSeen.has(l.url)) return false; linkSeen.add(l.url); return true; }).map(l => {
        const host = (() => { try { return new URL(l.url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } })();
        const src = l.source || sourceMap[host] || host;
        return { url: l.url, src };
      });
      // 소스명 중복 제거 — 같은 소스의 복수 기사는 첫 번째 URL로 대표
      const srcSeen = new Set();
      const dedupedLinks = uniqueLinks.filter(l => { if (srcSeen.has(l.src)) return false; srcSeen.add(l.src); return true; });
      const linksHtml = dedupedLinks.length > 0 ? `<div class="cal-feature-links">${dedupedLinks.map(l => {
        return `<a class="cal-feature-link" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sanitize(l.src))}</a>`;
      }).join('')}</div>` : '';
      // 연속 선정 메타 (부수적 정보 — 뉴스 요약과 분리)
      const pp = st.prev_pick;
      const pc = st.pick_count;
      // REQ-039 명명 정정 — "거래대금" (강세 연속과 모호성 해소). 표기 "거래대금+N".
      const pickMeta = (pp && pc >= 2)
        ? `<div class="cal-pick-meta"><div class="cal-disc-item"><span class="cal-disc-cat streak">거래대금+${pc}</span><span class="cal-disc-summary">전일 순위 #${pp.rank} · ${fmtTradeAmount(pp.trade_amount)} · ${(pp.change_pct||0)>=0?'+':''}${(pp.change_pct||0).toFixed(2)}%</span></div></div>`
        : '';
      // 종목명 우측 거래대금 연속 배지 (헤더): 2+ → "거래대금+N", 1이면 비표시
      const pickBadge = pc != null && pc >= 2
        ? `<span class="cal-streak-badge">거래대금+${pc}</span>`
        : '';
      // REQ-039 — 강세 배지 (헤더, 종목명 우측, pickBadge 옆).
      // REQ-048 정정: bullish 필드는 entry 루트(it)에 부착 (build_daily.py 정합). st = it.interp 잘못된 참조 정정.
      // streak >= 1 + bullish_today=true 일 때만 노출. streak=1이면 "강세", 2+면 "강세+N".
      const bullishStreak = it.bullish_streak || 0;
      const bullishToday = !!it.bullish_today;
      const bullishBadge = (bullishToday && bullishStreak >= 1)
        ? `<span class="cal-bullish-badge">${bullishStreak > 1 ? `강세+${bullishStreak}` : '강세'}</span>`
        : '';
      // REQ-020c — cal-credit-badge 폐기. KRX 무관 신용 사유(회사한도초과·ETF 등)는
      // utils.js collectEffectBadges에 creditRiskInfo로 전달 → "신용불가(오늘)" v95 형식 통일.
      // dedup으로 KRX disclosure credit-block과 중복 자연 차단.
      const creditBadgeHtml = '';
      // REQ-021 v9.6 §II + §IV — 신용 사유 박스는 renderCreditBlockReasonBox로 통합 (KRX 단계 + 증권사 사유).
      // 본 위치 별도 출력은 이중 노출 우려로 무력화. dead code 잔존 (회귀 안전성).
      // const creditReasonHtml = (st.credit_risk && st.credit_reason) ? (() => { ... })() : '';
      const creditReasonHtml = '';
      // 종목 상태 뱃지 (투자주의/경고/위험/단기과열)
      // REQ-020 v9.5 §II.3 — 헤더 = 효과 배지 (효과 + 시점). v9.3 통합 라벨(`dsn-v93-header-badge`) 대체.
      // SSOT: build_daily.py status_badges[].effect_badges[] (각 항목 = {effect, when, severity, source_label, source_kind}).
      // utils.js collectEffectBadges = 카드 단위 머지(A1) + 우선순위 정렬(A4) + dedup.
      // A4 우선순위: 거래정지 > 신용불가 > 단일가 / today > today_and_tomorrow > tomorrow (v9.8 — DSN-010 §I).
      // 최대 N=3 노출 + "+N" 표기.
      const _v92HeaderViewDate = date || '';
      const _v92AllBadges = st.status_badges || [];
      // REQ-020c — KRX 무관 신용 사유 합성 effect_badge 통합 (라벨 형식 통일).
      // st = it.interp (라인 296), data-loader.js:198 credit_risk = !!entry.credit_risk.
      const _v95CreditRiskInfo = (st && st.credit_risk)
        ? { credit_risk: true, credit_reason: st.credit_reason || '신용 제한' }
        : null;
      const _v95EffectBadges = (typeof collectEffectBadges === 'function')
        ? collectEffectBadges(_v92AllBadges, _v92HeaderViewDate, _v95CreditRiskInfo)
        : [];
      const _v95VisibleN = 3;  // A4 — 최대 3개 노출
      const _v95Overflow = Math.max(0, _v95EffectBadges.length - _v95VisibleN);
      const _v95Visible = _v95EffectBadges.slice(0, _v95VisibleN);
      const _v95EffectBadgesHtml = _v95Visible.map(eb => {
        const label = (typeof dsnV95FormatEffectBadge === 'function') ? dsnV95FormatEffectBadge(eb) : '';
        const title = (typeof dsnV95EffectBadgeTitle === 'function') ? dsnV95EffectBadgeTitle(eb) : label;
        const cls = `dsn-v95-effect-badge dsn-v95-effect-badge--${eb.effect} dsn-v95-effect-badge--when-${eb.when}`;
        const krxStage = eb.source_label || '';
        return `<span class="${cls}" data-krx-stage="${escapeHtml(krxStage)}" data-effect="${escapeHtml(eb.effect)}" data-when="${escapeHtml(eb.when)}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" role="button" tabindex="0">${escapeHtml(label)}</span>`;
      }).join('');
      // P2 함정 #4 — 가려진 효과 라벨 hover 텍스트 join (cropping bias 보강).
      const _v95MoreTitle = _v95Overflow > 0
        ? _v95EffectBadges.slice(_v95VisibleN)
            .map(eb => (typeof dsnV95FormatEffectBadge === 'function') ? dsnV95FormatEffectBadge(eb) : '')
            .filter(Boolean)
            .join(' / ')
        : '';
      const _v95MoreHtml = _v95Overflow > 0
        ? `<span class="dsn-v95-effect-badge dsn-v95-effect-badge--more" title="${escapeHtml(_v95MoreTitle || _v95Overflow + '건 추가')}" aria-label="${_v95Overflow}건 더 보기">+${_v95Overflow}</span>`
        : '';
      const _v95InnerHtml = _v95EffectBadgesHtml + _v95MoreHtml;
      const statusBadges = _v95InnerHtml
        ? `<span class="dsn-v95-effect-badges">${_v95InnerHtml}</span>`
        : '';
      // v9.2 §III: predicted only 카드 트리거 핀 (disclosure 0 + strict 미충족 predicted ≥1)
      const v92TriggerPinHtml = (typeof renderTriggerPin === 'function')
        ? renderTriggerPin(_v92AllBadges, _v92HeaderViewDate)
        : '';

      // 상태 뱃지 상세 v3 — 표 형태 + 기간 + 인사이트 (대표 정정 18:52 KST)
      // FLR-20260423-002 (P0-1, DSN-001 §15.5 / §17.4): 하드코딩 금지 원칙 단계 적용.
      // SSOT = rules/krx-stage-conditions.json → build_daily.py가 badge.auto_effects[]에 복제.
      // renderer는 badge.auto_effects[] 있으면 그것만 사용. 없으면 아래 _insightsFallback 사용.
      // 데이터 주입(data-dev) 완료 후 후속 PR에서 _insightsFallback 완전 삭제 예정.
      const _insightsFallback = {
        '투자주의': '이상 급등·거래량 급증 등 주의 신호가 포착된 종목입니다. 자동 규제는 없으며, 조건 지속 시 익일 투자경고 예고로 승급될 수 있습니다.',
        '투자경고': '신용거래 금지·위탁증거금 100% 현금·대용증권 불인정이 자동 적용됩니다. 지정 후 10거래일 경과 시 재심사로 해제 또는 투자위험 승급을 결정합니다.',
        '투자위험': '투자경고 효과(신용 금지·현금 증거금·대용 불인정)가 유지되며, 지정 직전 1거래일 매매거래정지가 적용됩니다. 승급 후 10거래일 경과 시 재심사.',
        '단기과열': '단기과열완화제도에 따라 D+2 1거래일 매매거래정지 후 D+3~D+5 3거래일간 30분 단위 단일가매매가 적용됩니다. D+5 자동 해제.',
        '단일가매매': '단기과열종목 지정에 따른 30분 단위 단일가매매 적용 기간입니다. 시장경보 3단계와 무관합니다.',
        '거래정지': '거래 정지 기간 — 정지 사유 해소 후 재개.',
        '관리종목': '관리종목 지정 — 신용거래·대용증권 불가, 미공시법인 추가 제재 가능.',
        '상장폐지': '상장폐지 절차 진행 — 정리매매 후 거래 종료.',
        '단기과열예고': '예고일부터 10거래일 이내 모든 조건 충족 시 단기과열 지정.',
      };
      // auto_effects 우선, 없으면 _insightsFallback 맵에서 label 기반 탐색.
      // auto_effects[]는 togusa JSON 직렬화 배열. 각 item: {id, label, quote, source_article}.
      const _resolveAutoEffects = (b) => {
        if (b && Array.isArray(b.auto_effects) && b.auto_effects.length > 0) {
          return b.auto_effects.map(e => (e && (e.quote || e.label)) || '').filter(Boolean);
        }
        return null; // null = 폴백 경로로 이동 신호
      };
      const _resolveInsightFallback = (label) => {
        for (const k in _insightsFallback) if (label.includes(k)) return _insightsFallback[k];
        return '';
      };
      // legacy API 유지 (v6 블록 호출부 호환). auto_effects 있으면 ul, 없으면 legacy 문구 폴백
      const _resolveInsight = (labelOrBadge) => {
        if (typeof labelOrBadge === 'object' && labelOrBadge !== null) {
          const ae = _resolveAutoEffects(labelOrBadge);
          if (ae) return ae.join(' · ');
          return _resolveInsightFallback(labelOrBadge.label || '');
        }
        return _resolveInsightFallback(labelOrBadge || '');
      };
      // v4: KRX 단계 진행 표 — "현재 X → 익일 Y 진입"
      // 라벨이 "X 예고"면 현재=X 직전 단계, 다음=X.
      // 라벨이 "X" (예고 없음)면 현재=X, 다음=X 다음 단계.
      const _stageNext = {
        '투자주의': '투자경고',
        '투자경고': '투자위험',
        '투자위험': '매매거래 정지',
        '단기과열': '단기과열 (1회 연장)',
      };
      const _stagePrev = {
        '투자경고': '투자주의',
        '투자위험': '투자경고',
        '단기과열': '단기과열 예고',
      };
      // 라벨에서 핵심 단계명 추출 (예: "투자경고 예고" → "투자경고", "[예고]" 제거 등)
      const _extractStage = (label) => {
        const cleaned = (label || '').replace(/[\[\]\(\)]/g, ' ').trim();
        const stages = ['투자주의', '투자경고', '투자위험', '단기과열', '관리종목', '상장폐지', '거래정지'];
        for (const s of stages) if (cleaned.includes(s)) return s;
        return '';
      };
      const _resolveProgress = (b) => {
        const label = b.label || '';
        const stage = _extractStage(label);
        if (!stage) return '';
        // v4: source='predicted'(자체 추정 라벨)는 "예상/근접" 텍스트 — 단계 진행 표시 생략
        // "예상/근접"은 가격 조건만 충족, 거래량 미검증 → 진짜 KRX 단계 진입 보장 X
        if ((b.source === 'predicted') || label.includes('예상') || label.includes('근접')) return '';
        const isNotice = label.includes('예고') || (b.view_date && b.start && b.view_date < b.start && !((b.source === 'predicted') || label.includes('예상') || label.includes('근접')));
        // FLR-011 v6: "현재" = view_date(t, 페이지 날짜). "익일" = t+1 거래일.
        // b.end/b.start는 공시 효력 기간 — "현재" 시점이 아님 (별도 기간 행에 표시).
        // view_date가 없고 b.start가 페이지 날짜보다 미래면 "현재"로 표기 금지 (예고 구간 오노출 차단).
        let curDate = b.view_date || '';
        if (!curDate) {
          if (b.start && (!date || b.start <= date)) {
            curDate = b.start;
          } else {
            // view_date 미주입 + start가 미래/없음 → "현재→다음" 표시 생략
            return '';
          }
        }
        let nextDate = b.next_trading_day || '';
        if (!nextDate) {
          try {
            const d = new Date(curDate + 'T00:00:00');
            d.setDate(d.getDate() + 1);
            nextDate = d.toISOString().slice(0, 10);
          } catch (e) {}
        }
        const dateText = nextDate ? `익일(${nextDate})` : '익일';
        if (isNotice) {
          // 예고 단계: 현재 = 직전 단계 (또는 "예고 상태"), 다음 = stage 본체
          const prev = _stagePrev[stage] || `${stage} 예고`;
          return `현재: ${prev} (${curDate}) → ${dateText} 조건 충족 시 ${stage} 진입`;
        }
        const next = _stageNext[stage];
        if (!next) return '';
        return `현재: ${stage} (${curDate}) → ${dateText} 조건 충족 시 ${next} 진입`;
      };
      // === v8 (DSN-20260425-DSN-002, REQ-010): 시제 분리 정보 위계 ===
      // §3·§4·§5.1·§6.1·§6.2 — 시제 칩 + 5줄 요약 + 🎯 thresholds + 통합 펼침.
      // 복수 배지는 시제 순서(현재 → 예측)로 배치 (§9 시나리오 A).
      const _v8FilteredBadges = (st.status_badges || []).filter(b =>
        b.thresholds || b.regulation || b.start || b.label || (b.single_price === true && (b.label || '').includes('단기과열'))
      );
      const _v8SortedBadges = dsnV8SortBadges(_v8FilteredBadges);
      const _v8AllDiscs = st.disclosures || [];
      const _v8DartByStage = (label) => {
        const stripped = dsnV8StripStageLabel(label || '');
        if (!stripped || _v8AllDiscs.length === 0) return '';
        const m = _v8AllDiscs.find(d => (d.category || '').includes(stripped));
        return (m && m.url) || '';
      };
      const _v8CtxFor = (b) => ({
        currentDate: date || b.view_date || '',
        stockCode: it.code || '',
        dartUrl: _v8DartByStage(b.label),
        stageDefinition: '',  // togusa krx-stage-rules.json 후속 주입
        regulationDetail: '', // togusa krx-stage-rules.json 후속 주입
        // v9.1 strict: getPredictedTenseVariant 인접 검증용 (4/24 027360 단계 도약 케이스 차단)
        allBadges: _v8SortedBadges,
      });
      // REQ-021 v9.6 §III.4 — 단계별 v6/v5 표 통째 무력화. 신용불가 사유 박스(§II)로 대체.
      // dsnV8RenderBlock·sections.push(v6SectionsHtml)·"준비 중" 폴백 등 모두 dead code 잔존 (회귀 1줄 부활 안전성).
      // const v8DetailHtml = _v8SortedBadges.map(b => dsnV8RenderBlock(b, _v8CtxFor(b))).join('');
      const v8DetailHtml = '';

      // === v6/v5.1 legacy 블록 (회귀 안전망, UX 워크스루 통과 후 제거 예정) ===
      const statusDetailLegacyHtml = (st.status_badges || []).filter(b => b.thresholds || b.regulation || b.start || (b.single_price === true && (b.label || '').includes('단기과열'))).map(b => {
        const label = b.label || '';
        const stage = _extractStage(label);
        const isPredicted = (b.source === 'predicted') || label.includes('예상') || label.includes('근접');
        const isNotice = label.includes('예고') || (b.view_date && b.start && b.view_date < b.start && !((b.source === 'predicted') || label.includes('예상') || label.includes('근접')));
        const labelHasPredictedText = label.includes('예상') || label.includes('근접');
        const labelExtra = (isPredicted && !labelHasPredictedText) ? ' <span class="cal-status-predicted-tag">[근접]</span>' : '';
        const hasThresholds = !!(b.thresholds && b.thresholds.length > 0);
        const nextStage = _stageNext[stage] || '';
        const isShortTermHot = stage === '단기과열';

        // 시제 판정 (view_date 대비 b.start/b.end)
        const vd = b.view_date || '';
        let tempo = 'unknown'; // 'upcoming' | 'active' | 'ended' | 'unknown'
        if (vd && b.start) {
          if (vd < b.start) tempo = 'upcoming';
          else if (b.end && vd > b.end) tempo = 'ended';
          else tempo = 'active';
        }

        // 현재 지정 여부: predicted 아니고 예고 아니면 "지정 중"으로 간주 (§1 렌더).
        // predicted/notice는 §1 생략(가이드 5.5, 5.6).
        const isCurrentlyDesignated = !isPredicted && !isNotice;

        // DART 공시 매칭 — §1 upcoming / §2 폴백 / §3 모두에서 공유
        const allDiscs = st.disclosures || [];
        const matchedDisc = (stage && allDiscs.length > 0)
          ? allDiscs.find(d => (d.category || '').includes(stage))
          : null;
        const dartUrl = matchedDisc && matchedDisc.url;
        const disclosureDate = (matchedDisc && matchedDisc.date) || vd || '';
        const dartLinkHtml = dartUrl
          ? `<a class="cal-status-dart-link" href="${escapeHtml(dartUrl)}" target="_blank" rel="noopener noreferrer">공시 원문 보기 (DART) <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1h6v6M9 1L4 6" stroke="currentColor" stroke-width="1.2" fill="none"/></svg></a>`
          : '';

        // === § 1. {stage} 예고란 (details 접힘, 제도 공통 설명) ==========
        // v6: §1은 제도 개론을 간단히 설명하는 details. 종목별 데이터 아님.
        // placeholder reason_text 판정 유틸 (재사용) — §2에서도 사용.
        const _isPlaceholderReason = (t) => {
          if (!t) return true;
          const s = String(t).trim();
          if (!s) return true;
          const placeholders = ['공시 원문 참조', '-', '–', '—', 'null', 'N/A', 'n/a', '없음'];
          return placeholders.includes(s);
        };
        const sectionCurrent = [];
        // v5.1: upcoming + (notice or predicted) — 3행 블록 (인지 공백 방지)
        // v6에서 §1은 제도 개론 details로 재구성하므로 이 블록은 §1 details 내부 종목 context가 아닌 §2로 이관.
        // 단 v6는 "투자경고/투자경고 예고 풀 구현, 타 배지 §1 제목만" 방침이라, 기타 배지는 기존 §1 유지.
        const isAdvisoryWarning = (stage === '투자경고');
        if (!isAdvisoryWarning && tempo === 'upcoming' && (isNotice || isPredicted)) {
          // 비-투자경고 배지는 v5.1 구조 유지 — §1 upcoming 3행 (단, v6 FLR: "현재 KRX 단계" 라인, "(→ §2 참조)" 제거)
          const discDateText = disclosureDate || (vd || '');
          sectionCurrent.push(`<div class="cal-status-current-item">● ${escapeHtml(stage || label)} 지정 예고${discDateText ? ` (예고일: ${escapeHtml(discDateText)})` : ''}</div>`);
          if (b.start) {
            sectionCurrent.push(`<div class="cal-status-current-item">● 예정 조치: ${escapeHtml(b.start)}부터 ${escapeHtml(stage || label)} 지정</div>`);
          }
        } else if (!isAdvisoryWarning && isCurrentlyDesignated) {
          // tempo 판정:
          // - ended: b.end 지남 → "해제 완료"
          // - upcoming: b.start가 view_date보다 미래 → §1 아님 (§2에서 다룸)
          // - active/unknown: 지정 중
          if (tempo === 'ended') {
            sectionCurrent.push(`<div class="cal-status-current-item ended">● ${escapeHtml(stage || label)} 해제 완료${b.end ? ` (해제일: ${escapeHtml(b.end)})` : ''}</div>`);
          } else if (tempo === 'upcoming') {
            // 지정 예정 — 아직 지정 전 → §1 생략 (§2 or 단독 "지정 예정" 행에서 다룸)
            // hasThresholds 유무와 무관
          } else {
            // 지정일 기준 — hasThresholds가 있으면 b.start는 "다음 단계 예정일"이므로 지정일로 사용 금지
            // hasThresholds 없으면 b.start가 현재 배지 자체의 지정일이지만, tempo=upcoming이면 미래이므로 view_date 선호
            let designatedDate = '';
            if (!hasThresholds && b.start && tempo !== 'upcoming') {
              designatedDate = b.start;
            } else if (b.view_date) {
              designatedDate = b.view_date;
            }
            const dateSuffix = designatedDate ? ` (지정일: ${escapeHtml(designatedDate)})` : '';
            sectionCurrent.push(`<div class="cal-status-current-item">● ${escapeHtml(stage || label)} 지정 중${dateSuffix}</div>`);
            // 단기과열 예외: §1에 지정 기간(b.start~b.end)을 기간으로 표시 (다음 단계 예정 기간 아님)
            if (isShortTermHot && b.start && b.end) {
              sectionCurrent.push(`<div class="cal-status-current-item">● 지정 기간: <span class="cal-badge-date-range">${escapeHtml(b.start)} ~ ${escapeHtml(b.end)}</span></div>`);
            }
            // FLR-20260423-002 대응: 단일가매매는 단기과열 고유 조치 (시장감시규정).
            // 투자경고/투자위험에 "단일가매매" 귀속하는 오염을 방지하기 위해 단기과열 한정 렌더.
            // 비단기과열 배지의 §1 단일가매매 행은 제거 (투자경고/위험의 증거금·신용 규제는 §3 insight에 이미 포함).
            if (b.single_price === true && isShortTermHot) {
              sectionCurrent.push(`<div class="cal-status-current-item">● 단일가매매 적용 중 — 3거래일간 30분 단위 체결 (시장감시규정)</div>`);
            }
          }
        }

        // === § 2. 다음 단계 ============================================
        // 단기과열은 조건 판정이 아닌 즉석 판정(종가 +20%↑)이므로 조건표 없음 → §2 생략.
        // predicted는 공시 전 추정 — §2를 "예고" 성격으로 단독 렌더.
        const sectionNext = [];
        let nextStageLabel = '';

        // DSN-001 §20.3 (v7.4 P2): confidence=low 배너 — predicted_stage2_notice 또는
        // regulation_source_confidence='low' 일 때 §2 최상단. pending은 축약 1줄.
        const _regSrcConf = b.regulation_source_confidence || '';
        if (_regSrcConf === 'low' || b.state === 'predicted_stage2_notice') {
          sectionNext.push(`<div class="cal-reg-source-banner">
            <span class="cal-reg-source-banner-title">규정 출처 확인 중</span>이 예측의 임계값은 키움·KB증권 2차 자료 기반 잠정 수치입니다. KRX 원문 재대조 후 수치가 달라질 수 있습니다.
          </div>`);
        } else if (_regSrcConf === 'pending') {
          sectionNext.push(`<div class="cal-reg-source-banner pending">규정 원문 1차 대조 진행 중 (2차 자료 기반 잠정 수치).</div>`);
        }

        // DSN-001 §16.1.1 (v7.2): §2 최상단 "기준 시각" 라인 (basis_time/basis_type 있을 때만).
        // basis_type: 'closing' | 'intraday' | 'previous_closing'. graceful degradation: 필드 없으면 생략.
        if (b.basis_time && typeof b.basis_time === 'string') {
          const bt = b.basis_type || '';
          let basisLabel;
          // basis_time은 ISO datetime으로 가정. "YYYY-MM-DD HH:MM KST" 형식 변환.
          let dispTime = b.basis_time;
          try {
            const d = new Date(b.basis_time);
            if (!isNaN(d.getTime())) {
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              const hh = String(d.getHours()).padStart(2, '0');
              const min = String(d.getMinutes()).padStart(2, '0');
              dispTime = `${yyyy}-${mm}-${dd} ${hh}:${min} KST`;
            }
          } catch (e) {}
          if (bt === 'intraday') basisLabel = `${dispTime} (장중 — 종가 시점에 재계산)`;
          else if (bt === 'previous_closing') basisLabel = `${dispTime} (직전 영업일 종가 기준)`;
          else basisLabel = `${dispTime} (종가 기준)`;
          sectionNext.push(`<div class="cal-status-next-header cal-next-basis">● 기준 시각: <span class="cal-next-basis-time">${escapeHtml(basisLabel)}</span></div>`);
        }

        // DSN-001 §16.1.3 + §19.6 (v7.3.1): predicted 배지 §2에 "예상 진입" + 면책 `↳` 서브텍스트.
        // b.predicted_entry 있으면 렌더. 내부: {date, stage, target_price_tick_rounded, target_price_limit_up, remaining_pct}.
        if (isPredicted && b.predicted_entry && typeof b.predicted_entry === 'object') {
          const pe = b.predicted_entry;
          const peDate = pe.date || '';
          const peStage = pe.stage || stage || '';
          const entryDateLabel = peDate ? `${escapeHtml(peDate)} (익영업일)` : '';
          const stageQuoted = peStage ? `'${escapeHtml(peStage)}' 단계` : '';
          const entryLine = [entryDateLabel, stageQuoted].filter(Boolean).join(', ');
          sectionNext.push(`<div class="cal-status-next-header cal-next-entry">
            <div>● 예상 진입   ${entryLine}</div>
            <div class="cal-predicted-disclaimer">↳ 예측은 공개 종가와 KRX 규정 임계값의 산술 결과 — 실제 지정 여부는 KRX 재량</div>
          </div>`);
          // 진입 시나리오 — target_price_tick_rounded + 상한가 경고 (§19.4)
          if (pe.target_price_tick_rounded != null) {
            const tpt = Number(pe.target_price_tick_rounded).toLocaleString();
            const curPrice = (b.current_price != null) ? Number(b.current_price).toLocaleString() : '';
            const remPct = (pe.remaining_pct != null) ? `+${(Number(pe.remaining_pct) * 100).toFixed(1)}% 필요` : '';
            const scenarioParts = [`주가 ${tpt}원 이상 마감 시`];
            if (curPrice || remPct) {
              const inner = [curPrice ? `현재 ${curPrice}원` : '', remPct].filter(Boolean).join(', ');
              if (inner) scenarioParts.push(`(${inner})`);
            }
            let scenarioHtml = `<div>● 진입 시나리오</div><div class="cal-next-scenario-line">${escapeHtml(scenarioParts.join(' '))}</div>`;
            if (pe.target_price_limit_up === true) {
              scenarioHtml += `<div class="cal-next-limit-up-warn">⚠ 전일 대비 상한가(+30%) 근접 — 정확 진입은 KRX 재량</div>`;
            }
            sectionNext.push(`<div class="cal-status-next-header cal-next-scenario">${scenarioHtml}</div>`);
          }
        }
        if (hasThresholds && !isShortTermHot) {
          nextStageLabel = isPredicted
            ? (stage || '')                   // predicted: 배지 자체가 예고 → 해당 stage 자체 지정 조건
            : (isNotice ? stage : nextStage); // 공시 예고: stage 자체 / 일반: 다음 stage

          if (nextStageLabel) {
            // 전환 시점 행
            let transitionText;
            if (isPredicted) {
              transitionText = `▶ 지정 시점: 공시 전 (자체 추정) ─ 아래 조건 전부 충족 시`;
            } else {
              // 다음 거래일 추정 — b.view_date 기준 +1일 (간이). next_trading_day가 있으면 우선.
              let nextDate = b.next_trading_day || '';
              if (!nextDate && vd) {
                try {
                  const d = new Date(vd + 'T00:00:00');
                  d.setDate(d.getDate() + 1);
                  nextDate = d.toISOString().slice(0, 10);
                } catch (e) {}
              }
              const dateText = nextDate ? `익일 (${nextDate})` : '익일';
              transitionText = `▶ 전환 시점: ${dateText} ─ 아래 조건 전부 충족 시`;
            }
            sectionNext.push(`<div class="cal-status-next-header">${escapeHtml(transitionText)}</div>`);

            // 지정 예정 기간 행 — b.start~b.end가 "다음 단계 예정 기간"
            if (b.start) {
              let periodText = escapeHtml(b.start);
              let daysExtra = '';
              if (b.end && b.end !== b.start) {
                periodText += ` ~ ${escapeHtml(b.end)}`;
                try {
                  const days = Math.round((new Date(b.end) - new Date(b.start)) / 86400000);
                  if (days > 0) daysExtra = ` (${days}거래일간 ${escapeHtml(nextStageLabel)})`;
                } catch (e) {}
              }
              const periodHtml = `<span class="cal-badge-date-range">${periodText}</span>${daysExtra}`;
              sectionNext.push(`<div class="cal-status-next-header">▶ 지정 예정 기간: ${periodHtml}</div>`);
            }

            // 조건 표 표제
            const tableTitleTime = isPredicted ? '미확정' : '익일 00시 기준';
            sectionNext.push(`<h4 class="cal-status-table-title">${escapeHtml(nextStageLabel)} 지정 조건 (${escapeHtml(tableTitleTime)})</h4>`);

            // DSN-001 §20.8 (v7.4 P2): path-level overall_progress_ratio 행
            // b.paths[] 배열 있으면 경로별 진척 1행씩. easiest_path_flag=true는 녹색 강조.
            if (Array.isArray(b.paths) && b.paths.length > 0) {
              b.paths.forEach(p => {
                const pLabel = p.label || p.id || '경로';
                const ratio = (typeof p.overall_progress_ratio === 'number')
                  ? Math.min(200, Math.round(p.overall_progress_ratio * 100))
                  : null;
                const ratioText = ratio != null ? ` — 전체 진척 ${ratio}%` : '';
                const cls = p.easiest_path_flag === true ? 'cal-path-overall easiest' : 'cal-path-overall';
                const tag = p.easiest_path_flag === true
                  ? '<span class="cal-path-easiest-tag">최단 경로</span>'
                  : '';
                sectionNext.push(`<div class="${cls}"><span class="cal-path-overall-label">[${escapeHtml(pLabel)}]</span>${escapeHtml(ratioText)}${tag}</div>`);
              });
            }

            // 조건 표 (thresholds[]) — v3.3 유지
            const rows = b.thresholds.map(t => {
              const diff = t.current - t.threshold;
              const diffPct = t.threshold > 0 ? (diff / t.threshold * 100) : 0;
              const sign = diff >= 0 ? '+' : '';
              let arrow, diffCls;
              if (diff > 0) { arrow = '▲'; diffCls = 'th-diff trig'; }
              else if (diffPct >= -5) { arrow = '·'; diffCls = 'th-diff near'; }
              else { arrow = '▼'; diffCls = 'th-diff safe'; }
              const rowCls = t.triggered ? 'th-row triggered' : 'th-row safe';
              return `<tr class="${rowCls}">
                <td class="th-cond">${escapeHtml(t.desc)}</td>
                <td class="th-base">${t.base_price ? t.base_price.toLocaleString() + '원' : '-'}</td>
                <td class="th-thresh">${t.threshold.toLocaleString()}원</td>
                <td class="th-cur">${t.current.toLocaleString()}원</td>
                <td class="${diffCls}">${arrow}${sign}${diffPct.toFixed(1)}%</td>
              </tr>`;
            }).join('');
            sectionNext.push(`<div class="cal-status-table-wrap"><table class="cal-status-table v33">
              <thead><tr><th>조건</th><th>기준가</th><th>임계가</th><th>현재가</th><th>차이</th></tr></thead>
              <tbody>${rows}</tbody>
            </table></div>`);

            if (isPredicted) {
              sectionNext.push(`<div class="cal-status-next-note">공시 전이므로 KRX 확정 조건과 다를 수 있음</div>`);
            }
          }
        }

        // 단기과열 §2: 조건표는 없지만 연장 규정 안내
        if (isShortTermHot && !isPredicted) {
          sectionNext.push(`<div class="cal-status-next-header">▶ 해제 종가 +20%↑ 시 3거래일 1회 연장 (즉석 판정)</div>`);
        }

        // upcoming + thresholds 없음: "지정 예정" 단독 안내 (§1도 비어있음)
        if (tempo === 'upcoming' && !hasThresholds && !isPredicted && !isNotice && b.start) {
          nextStageLabel = stage || label;
          let periodText = escapeHtml(b.start);
          if (b.end && b.end !== b.start) periodText += ` ~ ${escapeHtml(b.end)}`;
          sectionNext.push(`<div class="cal-status-next-header">▶ 지정 예정일: <span class="cal-badge-date-range">${periodText}</span> (${escapeHtml(nextStageLabel)})</div>`);
        }

        // v5.1: 공시 예고 §2 폴백 — thresholds 없는 notice는 reason_text + DART로 대체
        // 지정 중 배지(§5.1/§5.2)는 §3 DART 유지 — notice 한정
        const dartMovedToNext = !!(isNotice && !hasThresholds);
        if (dartMovedToNext) {
          // 지정 예정 기간 기본 행 (§2 본문에 다른 행 없으면 최소 1줄 보장)
          if (!sectionNext.length && b.start) {
            nextStageLabel = stage || label;
            let periodText = escapeHtml(b.start);
            if (b.end && b.end !== b.start) periodText += ` ~ ${escapeHtml(b.end)}`;
            sectionNext.push(`<div class="cal-status-next-header">▶ 지정 예정 기간: <span class="cal-badge-date-range">${periodText}</span> (${escapeHtml(nextStageLabel)})</div>`);
          }
          // 이시카와 임무 3: reason_text 부재/placeholder면 사유 행 자체 미렌더 (placeholder 노출 금지).
          // _isPlaceholderReason은 v6 §2에서도 쓰이는 유틸, 배지 루프 상단(524행)에서 선언됨.
          const reasonTextRaw = b.reason_text;
          if (!_isPlaceholderReason(reasonTextRaw)) {
            sectionNext.push(`<div class="cal-status-next-header">지정 사유: ${escapeHtml(String(reasonTextRaw).trim())}</div>`);
          }
          if (dartLinkHtml) sectionNext.push(dartLinkHtml);
        }

        // === § 3. KRX 규정 (비-투자경고용 v5.1 유지) ====================
        // FLR-20260423-002 §3 + DSN-001 §16.2.1: 투자주의 predicted는 auto_effects=[]
        // (krx-stage-conditions.json stages[0]), §3에 쓸 내용 없음 → DOM 자체 미생성.
        // v7.2 state enum 도입 시 b.state.startsWith('predicted')도 동일 트리거로 수용.
        const _stateIsPredicted = !!(b.state && typeof b.state === 'string' && b.state.startsWith('predicted'));
        const skipRegForAdvisoryNoticePredicted = (stage === '투자주의' && (isPredicted || _stateIsPredicted));
        const sectionReg = [];
        if (!isAdvisoryWarning && !skipRegForAdvisoryNoticePredicted) {
          // auto_effects[] 우선 렌더링. 배열이면 각 항목을 별도 행으로. 폴백은 단일 문구 1행.
          const _renderInsightRows = (stageName, tagLabel, cls) => {
            const ae = _resolveAutoEffects(b);
            if (ae && ae.length > 0) {
              ae.forEach(line => {
                sectionReg.push(`<div class="cal-status-insight ${cls}"><span class="cal-status-insight-stage">${escapeHtml(stageName)}(${escapeHtml(tagLabel)}) —</span> ${escapeHtml(line)}</div>`);
              });
              return true;
            }
            // 폴백: label 기반 문구
            const fallback = _resolveInsightFallback(stageName);
            if (fallback) {
              sectionReg.push(`<div class="cal-status-insight ${cls}">${escapeHtml(stageName)}(${escapeHtml(tagLabel)}) — ${escapeHtml(fallback)}</div>`);
              return true;
            }
            return false;
          };
          // 현재 단계 규정 (predicted/notice/upcoming은 현재 지정 아님 → 예정 규정만)
          if (stage && !isPredicted && !isNotice && tempo !== 'upcoming') {
            _renderInsightRows(stage, '현재', '');
          }
          // 예정 단계 규정
          if (nextStageLabel) {
            const tag = isPredicted ? '지정 시' : '예정';
            _renderInsightRows(nextStageLabel, tag, 'predicted');
          } else if ((isNotice || isPredicted) && stage) {
            _renderInsightRows(stage, (isPredicted ? '지정 시' : '예정'), 'predicted');
          }
          // DART 버튼 (공시 기반만)
          if (!isPredicted && stage && !dartMovedToNext && dartLinkHtml) {
            sectionReg.push(dartLinkHtml);
          }
        }

        // === v6 블록 (투자경고·투자경고 예고 전용 풀 구현, FLR-20260423-001) ===
        // 투자경고(isAdvisoryWarning) + upcoming(notice/predicted) = 투자경고 예고 케이스
        // 투자경고(isAdvisoryWarning) + active = 투자경고 지정 중 케이스
        let v6SectionsHtml = '';
        if (isAdvisoryWarning) {
          // --- §1. 투자경고 예고란 (details 접힘, 제도 공통 설명) ---
          // label "투자경고" vs "투자경고 예고" 구분 없이 동일 §1 문구 사용 (배지가 이미 구분)
          const s1Title = (isNotice || (tempo === 'upcoming' && !isPredicted))
            ? '투자경고 예고란'
            : '투자경고란';
          const s1Body = (isNotice || (tempo === 'upcoming' && !isPredicted))
            ? 'KRX가 투자주의 단계 종목 중 이상 급등 패턴이 지속되면 지정 예고를 발표하고, 예고일 익일 요건 충족 시 정식 지정됩니다.'
            : 'KRX 시장경보 2단계. 단일가매매 없음 — 증거금 100% 현금·신용매수 불가·대용 불인정이 자동 적용됩니다.';
          const s1Html = `<details class="cal-status-section v6 intro"><summary><h3>${escapeHtml(s1Title)}</h3></summary><div class="cal-status-intro-body">${escapeHtml(s1Body)}</div></details>`;

          // --- P3 §1 이력 요약 행 (DSN-001 §20.7): stock_alert_history 최근 1건 ---
          // 필드 미주입 시 자동 스킵 (graceful degradation). 이시카와/data-dev 임무 D 완료 후 활성화.
          let s1HistoryHtml = '';
          const historyArr = Array.isArray(b.stock_alert_history) ? b.stock_alert_history : null;
          if (historyArr && historyArr.length > 0) {
            // 최신 2건만 시간 역순 (date 내림차순 가정. 없으면 원배열 순서 유지)
            const recent = historyArr.slice(0, 2);
            const chips = recent.map(h => {
              const stg = h.stage || '';
              const dt = h.date || '';
              return `<span class="cal-status-history-chip">${escapeHtml(stg)}${dt ? ` ${escapeHtml(dt)}` : ''}</span>`;
            }).join('');
            s1HistoryHtml = `<div class="cal-status-history-row"><span class="cal-status-history-label">최근 이력:</span>${chips}</div>`;
          }

          // --- §2. 이 종목의 일정 (기본 펼침) ---
          const s2Items = [];
          const noticeDate = disclosureDate || vd || '';
          const designationDate = b.start || '';
          // "예고일" vs "지정일" 구분
          if (isNotice || (tempo === 'upcoming' && !isPredicted)) {
            if (noticeDate) s2Items.push(`<div class="cal-v6-schedule-item">● 예고일  <span class="cal-v6-schedule-date">${escapeHtml(noticeDate)}</span></div>`);
            if (designationDate) s2Items.push(`<div class="cal-v6-schedule-item">● 지정 예정  <span class="cal-v6-schedule-date">${escapeHtml(designationDate)}</span> <span class="cal-v6-schedule-hint">(발효 시 배지 전환)</span></div>`);
          } else if (isCurrentlyDesignated) {
            // P3 §20.7 warn_after_attention: 투자주의 → 투자경고 전환 시 별도 강조 태그.
            const warnAfterTag = b.warn_after_attention === true
              ? ' <span class="cal-v7-warn-after-attention">투자주의 → 투자경고 전환</span>'
              : '';
            if (designationDate) s2Items.push(`<div class="cal-v6-schedule-item">● 지정일  <span class="cal-v6-schedule-date">${escapeHtml(designationDate)}</span>${warnAfterTag}</div>`);
            if (b.end) s2Items.push(`<div class="cal-v6-schedule-item">● 재심사  <span class="cal-v6-schedule-date">${escapeHtml(b.end)}</span> <span class="cal-v6-schedule-hint">(10거래일 후)</span></div>`);
          }
          // 사유 (placeholder면 블록 통째 미노출)
          const reasonTextRaw = b.reason_text;
          if (!_isPlaceholderReason(reasonTextRaw)) {
            const reasonStr = String(reasonTextRaw).trim();
            // 긴 사유는 줄단위로 split하여 5줄까지만 표시
            const reasonLines = reasonStr.split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 5);
            const reasonBody = reasonLines.length > 0
              ? reasonLines.map(ln => `<div class="cal-v6-reason-line">${escapeHtml(ln)}</div>`).join('')
              : `<div class="cal-v6-reason-line">${escapeHtml(reasonStr)}</div>`;
            s2Items.push(`<div class="cal-v6-schedule-item cal-v6-reason">● 사유<div class="cal-v6-reason-body">${reasonBody}</div></div>`);
          }
          const s2Html = s2Items.length
            ? `<section class="cal-status-section v6 schedule"><h3>이 종목의 일정</h3>${s2Items.join('')}</section>`
            : '';

          // --- §3. 지정 시 적용되는 제한 ---
          // DSN-001 §15.5: badge.auto_effects[] JSON 우선.
          // task #61 판정 번복 (2026-04-23 04:45 KST team-lead, qa 3중 검증으로 결정):
          //   "추가 급등(2일 40%↑) 시 익일 매매거래정지 가능"은 KRX 원문(moc.krx.co.kr/.../03020100) 정합.
          //   원문: "2일간 주가상승률이 40% 이상(코넥스시장 20% 이상)인 종목에 대하여
          //         그 다음 매매거래일 1일간 매매거래가 정지됨" (투자경고 매매거래정지 섹션).
          //   togusa v1.3 JSON 패치 진행 중. 패치 완료 시 auto_effects[]로 자동 흡수.
          //   원본 폴백 4번째 줄 복원.
          // 폴백은 v1.2 JSON investment_warning.auto_effects[] 3건 + KRX 원문 매매거래정지 조항 1건.
          // data-dev 필드 주입(§16.6) 완료 후 후속 PR에서 폴백 완전 삭제 예정.
          const reexamDate = b.end || '';
          const s3AutoEffects = _resolveAutoEffects(b);
          const s3Items = (s3AutoEffects && s3AutoEffects.length > 0)
            ? s3AutoEffects
            : [
                '매수 시 위탁증거금 100% 현금 납부',
                '신용거래 금지',
                '대용증권 불인정 (KONEX 예외)',
                '추가 급등(2일 40%↑) 시 익일 매매거래정지 가능',
              ];
          const s3ItemsHtml = s3Items.map(t => `<li class="cal-v6-rule-item">${escapeHtml(t)}</li>`).join('');
          const s3ReexamHtml = reexamDate
            ? `<div class="cal-v6-rule-footnote">예상 재심사: <span class="cal-v6-schedule-date">${escapeHtml(reexamDate)}</span></div>`
            : '';
          const s3DartHtml = dartLinkHtml ? `<div class="cal-v6-rule-dart">${dartLinkHtml}</div>` : '';
          const s3Html = `<section class="cal-status-section v6 rules"><h3>지정 시 적용되는 제한</h3><ul class="cal-v6-rule-list">${s3ItemsHtml}</ul>${s3ReexamHtml}${s3DartHtml}</section>`;

          // --- P3 §20.7 이중 상태 — predicted_stage3_notice (투자경고 entered + 투자위험 predicted) ---
          // 조건: b.state === 'predicted_stage3_notice' 또는 b.predicted_next_stage 객체 있음.
          // §2 뒤에 "다음 단계 근접 (투자위험)" 추가 블록 + §3 뒤에 "예정 추가 제한" 블록.
          // 데이터 미주입 시 빈 문자열 (graceful degradation).
          let dualNextHtml = '';
          let dualAddRulesHtml = '';
          const pns = b.predicted_next_stage || null;
          const isDualState = (b.state === 'predicted_stage3_notice') || !!(pns && pns.stage);
          if (isAdvisoryWarning && isDualState && isCurrentlyDesignated) {
            const nextStage = (pns && pns.stage) || '투자위험';
            const nextDate = (pns && pns.date) || '';
            const remainPct = (pns && pns.remaining_pct != null)
              ? `+${(Number(pns.remaining_pct) * 100).toFixed(1)}%p 필요`
              : '';
            const transitionLine = nextDate
              ? `예상 전환 <span class="cal-v6-schedule-date">${escapeHtml(nextDate)}</span> (${escapeHtml(nextStage)} 지정)`
              : `예상 전환 (${escapeHtml(nextStage)} 지정)`;
            const remainLine = remainPct ? `<div class="cal-v7-transition-note">진입 시나리오: ${escapeHtml(remainPct)}</div>` : '';
            // path-level 보조 (predicted_next_stage.paths[] 있으면)
            const pnsPaths = Array.isArray(pns && pns.paths) ? pns.paths : [];
            const pathsHtml = pnsPaths.map(p => {
              const pLabel = p.label || p.id || '경로';
              const ratio = (typeof p.overall_progress_ratio === 'number')
                ? Math.min(200, Math.round(p.overall_progress_ratio * 100))
                : null;
              const ratioText = ratio != null ? ` — 전체 진척 ${ratio}%` : '';
              const cls = p.easiest_path_flag === true ? 'cal-path-overall easiest' : 'cal-path-overall';
              const tag = p.easiest_path_flag === true ? '<span class="cal-path-easiest-tag">최단 경로</span>' : '';
              return `<div class="${cls}"><span class="cal-path-overall-label">[${escapeHtml(pLabel)}]</span>${escapeHtml(ratioText)}${tag}</div>`;
            }).join('');
            // 면책 서브텍스트
            const disclaimerHtml = `<div class="cal-predicted-disclaimer">↳ 예측은 공개 종가와 KRX 규정 산술 결과 — 실제 지정 여부는 KRX 재량</div>`;
            dualNextHtml = `<section class="cal-status-section v6 next dual-next">
              <h3>다음 단계 근접 (${escapeHtml(nextStage)})</h3>
              <div class="cal-v6-schedule-item">● ${transitionLine}</div>
              ${disclaimerHtml}
              ${remainLine}
              ${pathsHtml}
            </section>`;
            // §3 추가 블록 — 투자위험 지정 시 추가 제한 (pns.auto_effects[] 있으면 사용)
            const pnsEffects = Array.isArray(pns && pns.auto_effects) ? pns.auto_effects : [];
            const addItems = pnsEffects.length > 0
              ? pnsEffects.map(e => (e && (e.quote || e.label)) || '').filter(Boolean)
              : ['+ 지정 직전 1거래일 매매거래정지'];
            const addItemsHtml = addItems.map(t => `<li class="cal-v6-rule-item">${escapeHtml(t)}</li>`).join('');
            dualAddRulesHtml = `<section class="cal-status-section v6 rules future-add">
              <h3>${escapeHtml(nextStage)} 지정 시 추가 제한</h3>
              <ul class="cal-v6-rule-list">${addItemsHtml}</ul>
            </section>`;
          }

          // v6 블록에서도 §20.3 reg-source-banner 렌더 (predicted_stage2_notice 또는 confidence=low)
          let v6RegBannerHtml = '';
          const _v6RegConf = b.regulation_source_confidence || '';
          if (_v6RegConf === 'low' || b.state === 'predicted_stage2_notice') {
            v6RegBannerHtml = `<div class="cal-reg-source-banner"><span class="cal-reg-source-banner-title">규정 출처 확인 중</span>이 예측의 임계값은 키움·KB증권 2차 자료 기반 잠정 수치입니다. KRX 원문 재대조 후 수치가 달라질 수 있습니다.</div>`;
          } else if (_v6RegConf === 'pending') {
            v6RegBannerHtml = `<div class="cal-reg-source-banner pending">규정 원문 1차 대조 진행 중 (2차 자료 기반 잠정 수치).</div>`;
          }
          v6SectionsHtml = s1Html + s1HistoryHtml + v6RegBannerHtml + s2Html + dualNextHtml + s3Html + dualAddRulesHtml;
        }

        // === 합치기 (비-투자경고: v5.1 구조 유지, 투자경고: v6 블록) ========
        // DSN-001 §18.3 (v7.3): confidence 기반 §2 헤더 문구 분기. predicted 배지만 적용.
        // high → "진입 임박 (D+N 예상)", medium → "진입 조건 근접" (날짜 생략), low → 배지 미노출(데이터 단)
        // predicted가 아니거나 confidence 필드 없으면 기본 "다음 단계 (...)" 문구 유지.
        let nextSectionTitle;
        if (isPredicted && b.confidence === 'high' && b.predicted_entry && b.predicted_entry.date) {
          const peDateShort = b.predicted_entry.date;
          // D+N 계산: view_date 기준 상대일
          let dN = '';
          try {
            if (vd) {
              const d0 = new Date(vd + 'T00:00:00');
              const d1 = new Date(peDateShort + 'T00:00:00');
              const diff = Math.round((d1 - d0) / 86400000);
              if (diff > 0) dN = `D+${diff}`;
            }
          } catch (e) {}
          nextSectionTitle = dN ? `진입 임박 (${dN} 예상)` : `진입 임박 (${escapeHtml(peDateShort)} 예상)`;
        } else if (isPredicted && b.confidence === 'high') {
          nextSectionTitle = '진입 임박';
        } else if (nextStageLabel) {
          nextSectionTitle = `다음 단계 (${escapeHtml(nextStageLabel)} 예고)`;
        } else if (isShortTermHot) {
          nextSectionTitle = '다음 단계 (연장 규정)';
        } else {
          nextSectionTitle = '다음 단계';
        }
        const sections = [];
        sections.push(`<div class="cal-status-head"><span class="cal-status-label sev-${b.severity || 'caution'}">${escapeHtml(label)}</span>${labelExtra}</div>`);
        if (isAdvisoryWarning) {
          // v6: 투자경고/투자경고 예고 풀 구현
          sections.push(v6SectionsHtml);
        } else {
          // v5.1 구조 유지 — 타 배지 (v6 FLR-001 후속 REQ에서 전수 리팩 예정)
          // P3 §1 이력 요약 행 (DSN-001 §20.7): stock_alert_history 있으면 현재 상태 섹션 상단에 삽입
          const _historyArr = Array.isArray(b.stock_alert_history) ? b.stock_alert_history : null;
          let _s1HistoryNonV6 = '';
          if (_historyArr && _historyArr.length > 0) {
            const recent = _historyArr.slice(0, 2);
            const chips = recent.map(h => {
              const stg = h.stage || '';
              const dt = h.date || '';
              return `<span class="cal-status-history-chip">${escapeHtml(stg)}${dt ? ` ${escapeHtml(dt)}` : ''}</span>`;
            }).join('');
            _s1HistoryNonV6 = `<div class="cal-status-history-row"><span class="cal-status-history-label">최근 이력:</span>${chips}</div>`;
          }
          if (sectionCurrent.length || _s1HistoryNonV6) {
            sections.push(`<section class="cal-status-section current"><h3>현재 상태</h3>${_s1HistoryNonV6}${sectionCurrent.join('')}</section>`);
          }
          if (sectionNext.length) {
            sections.push(`<section class="cal-status-section next"><h3>${nextSectionTitle}</h3>${sectionNext.join('')}</section>`);
          }
          if (sectionReg.length) {
            sections.push(`<section class="cal-status-section regulation"><h3>KRX 규정</h3>${sectionReg.join('')}</section>`);
          }
          // 타 배지 §3 "준비 중" 폴백 (v6 FLR-001 방침)
          // FLR-20260423-002: 투자주의 predicted는 auto_effects=[]라 §3 미생성 (폴백도 스킵)
          if (!sectionReg.length && stage && !isShortTermHot && !skipRegForAdvisoryNoticePredicted) {
            sections.push(`<section class="cal-status-section regulation v6-pending"><h3>지정 시 적용되는 제한</h3><div class="cal-v6-rule-pending">준비 중 — 상세는 KRX 공시 참조${dartLinkHtml ? `<div class="cal-v6-rule-dart">${dartLinkHtml}</div>` : ''}</div></section>`);
          }
        }
        const cls = isAdvisoryWarning ? 'v3 v5 v6' : 'v3 v5';
        return `<div class="cal-status-detail ${cls}${isPredicted ? ' predicted' : ''}">${sections.join('')}</div>`;
      }).join('');
      // REQ-021 v9.6 §I.1 — 그래프 박스 통째 제거 (이중 가드). utils.js renderStageFlowV9 무력화 정합.
      // 함수 자체는 첫 줄 return '' 보유 — 본 호출부도 명시 빈 문자열로 dead code 회귀 차단.
      const v9StageFlowHtml = '';
      // REQ-021 v9.6 §III.4 — predicted detail-only 영역도 명시 빈 문자열 (renderPredictedDetailOnly 자체도 첫 줄 return ''. 이중 가드)
      const v92PredictedDetailOnlyHtml = '';
      // REQ-021 v9.6 §IV.2 — 신용불가 사유 박스 (KRX 단계 + 증권사 사유 통합). 그래프 박스·v6 표 대체.
      const v96CreditBlockHtml = (typeof renderCreditBlockReasonBox === 'function')
        ? renderCreditBlockReasonBox(_v8SortedBadges, date || '', _v95CreditRiskInfo)
        : '';
      const statusDetailHtml = `${v96CreditBlockHtml}`;
      // causal 있으면 ishikawa는 details, 없으면 summary에 가므로 details 대상 아님
      const hasDetails = !!(statusDetailHtml || discListHtml || creditReasonHtml || (causalHtml && ishikawaHtml) || pickMeta);
      // toggle 요약 v3: period + label 만 (대표 정정 18:52 KST — 임계 정보는 표로 이동)
      const _badgeForSummary = (st.status_badges || []).find(b => b.start) || (st.status_badges || [])[0];
      let summarySnippet;
      if (_badgeForSummary) {
        const ps = _badgeForSummary.start || '';
        const pe = _badgeForSummary.end || '';
        const dateText = ps && pe && ps !== pe ? `${ps}~${pe}` : (ps || pe || '');
        const lbl = _badgeForSummary.label || '';
        summarySnippet = dateText ? `${dateText} ${lbl}`.trim() : lbl;
      } else if ((st.disclosures || []).length > 0) {
        summarySnippet = `공시 ${st.disclosures.length}건`;
      } else {
        summarySnippet = '';
      }
      // REQ-030 §2 — 접기 버튼 칩 디자인 (SPEC-001 §III.5). chevron-only 폐기.
      // 텍스트 "상세 보기" + 화살표 ▾ (CSS .cal-feature-card.expanded 시 회전 + ::after content "접기").
      const truncatedSummary = '';
      // REQ-045 §D — span → div 통일 (inline width:100% 무효 → 데스크탑 흐릿함 원인). chevron 폐기 (텍스트만).
      const chevronHtml = hasDetails
        ? `<div class="cal-detail-toggle" aria-label="상세 보기"><span class="cal-toggle-text">상세 보기</span></div>`
        : '';
      // v9.2 §III: 트리거 핀 — 헤더 배지 0건 + predicted strict 미충족 ≥1 케이스 시 노출
      // 위치: badgesRow 우측 끝 (CSS .dsn-v92-trigger-pin{margin-left:auto})
      const badgesRowHtml = (pickBadge || bullishBadge || discBadgeHtml || creditBadgeHtml || statusBadges || v92TriggerPinHtml)
        ? `<div class="cal-feature-badges">${statusBadges}${pickBadge}${bullishBadge}${discBadgeHtml}${creditBadgeHtml}${v92TriggerPinHtml}</div>`
        : '';
      // 테마 칩은 링크 아래 별도 줄
      const sparkHtml = it.interp?.intraday
        ? `<div class="cal-feature-sparkline">${buildSparkline(it.interp.intraday.prices, it.interp.intraday.base ?? it.interp.intraday.open, candleDir)}</div>`
        : '<div class="cal-feature-sparkline cal-spark-empty"></div>';

      // 240영업일 가격 레인지 바 (REQ-001 Phase 2 안 B / 레이아웃 v2 — 4행 분해)
      const r240 = it.interp?.range_240d;
      let rangeHtml = '';
      if (r240 && r240.high > 0 && r240.low > 0 && r240.current) {
        const span = r240.high - r240.low;
        const markerLeft = span > 0
          ? Math.max(0, Math.min(100, ((r240.current - r240.low) / span) * 100))
          : 50;
        const lowFillPct = 0;
        const highFillPct = markerLeft;
        const fmtPct = (v) => {
          if (v == null) return '';
          const sign = v > 0 ? '+' : '';
          return `${sign}${v.toFixed(1)}%`;
        };
        // 대표 지시 (2026-04-25 09:31~09:32):
        // - 신고가/신저가 양 끝 갱신 시 텍스트로 표시 ('신고가'/'신저가')
        // - 좌측 신저가 → 파랑(.down), 우측 신고가 → 빨강(.up)
        const isNewLow = r240.low === r240.current;
        const isNewHigh = r240.high === r240.current;
        const lowText = isNewLow ? '신저가' : fmtPct(r240.low_pct);
        const highText = isNewHigh ? '신고가' : fmtPct(r240.high_pct);
        const lowCls = isNewLow ? 'down' : ((r240.low_pct ?? 0) >= 0 ? 'up' : 'down');
        const highCls = isNewHigh ? 'up' : ((r240.high_pct ?? 0) <= 0 ? 'down' : 'up');
        rangeHtml = `<div class="stock-range v2">
          <div class="range-bar">
            <div class="range-fill" style="--low-pct:${lowFillPct}%;--high-pct:${highFillPct}%"></div>
            <div class="range-marker" style="left:${markerLeft}%"></div>
          </div>
          <div class="range-row range-prices">
            <span class="r-low">${r240.low.toLocaleString('ko-KR')}원</span>
            <span class="r-now">${r240.current.toLocaleString('ko-KR')}원</span>
            <span class="r-high">${r240.high.toLocaleString('ko-KR')}원</span>
          </div>
          <div class="range-row range-pcts">
            <span class="r-low ${lowCls}">${lowText}</span>
            <span class="r-now r-now-label">현재가</span>
            <span class="r-high ${highCls}">${highText}</span>
          </div>
          <div class="range-row range-dates">
            <span class="r-low">${escapeHtml(r240.low_date || '')}</span>
            <span class="r-now"></span>
            <span class="r-high">${escapeHtml(r240.high_date || '')}</span>
          </div>
        </div>`;
      }
      // 메타 줄 (등락률 | 거래대금) — 좌측 정렬·파이프 구분·거래대금 골드 (대표 정정 v2.2)
      const metaRow = `<div class="cal-feature-meta">
        <span class="cal-feature-pct ${dir}">${pctText}</span>
        <span class="cal-meta-sep">|</span>
        <span class="cal-trade-amount">${amountText}</span>
      </div>`;
      const _idAttr_full = it.code ? ` id="stock-${escapeHtml(it.code)}"` : '';
      return `
        <div class="cal-feature-card v2"${_idAttr_full} data-stock-code="${escapeHtml(it.code || '')}" data-stock-name="${escapeHtml(it.name || '')}">
          ${renderShareButton(it)}
          <div class="cal-feature-head v2">
            <div class="cal-feature-head-left">
              <div class="cal-trade-rank">#${it.rank}</div>
              <div class="cal-trade-candle">${candleHtml}</div>
              ${sparkHtml}
            </div>
            <div class="cal-feature-head-right">
              <div class="cal-feature-namecell">
                <span class="cal-feature-name">${escapeHtml(it.name)}</span>
              </div>
              ${metaRow}
            </div>
          </div>
          ${rangeHtml}
          ${badgesRowHtml}
          <div class="cal-feature-body">
            ${headlineHtml || ishikawaHtml || causalHtml || linksHtml || discListHtml || themesHtml || pickMeta
              ? `<div class="cal-feature-summary">${causalHtml || ishikawaHtml}${themesHtml ? `<div class="cal-theme-row">${themesHtml}</div>` : ''}${linksHtml}${hasDetails ? `<div class="cal-detail-toggle" aria-label="상세 보기"><span class="cal-toggle-text">상세 보기</span></div>` : ''}</div>${hasDetails ? `<div class="cal-feature-details">${statusDetailHtml}${discListHtml}${creditReasonHtml}${causalHtml ? ishikawaHtml : ''}${pickMeta}${(typeof renderMicroDisclaimerIfShared === 'function') ? renderMicroDisclaimerIfShared() : ''}</div>` : ''}`
              : `<div class="cal-feature-news-empty">뉴스 분석 대기 중</div>`}
          </div>
        </div>`;
    }

    // ===== interp 없음: full 카드 구조 유지 + "뉴스 없음" placeholder =====
    // 대표 지시 (B안, 2026-04-22 16:07 KST): 레이아웃 일관성 유지. compact 한 줄 폐지.
    // kiwoom JSON 기반 데이터만 사용 (range_240d/intraday/news 없음 → 해당 영역은 생략 또는 placeholder)
    const compactPC = it.interp?.pick_count;
    // REQ-039 표기 통일 — "거래대금+N" (강세 연속과 모호성 해소).
    const compactBadge = compactPC != null && compactPC >= 2
      ? `<span class="cal-streak-badge">거래대금+${compactPC}</span>`
      : '';
    // 테마 칩: interp 없어도 it.themes는 kiwoom merge 단계에서 있을 수 있음
    const simpleThemesHtml = (it.themes && it.themes.length > 0)
      ? `<div class="cal-theme-row">${it.themes.slice(0, 3).map(t => `<span class="cal-ind-chip">${escapeHtml(t.name)}</span>`).join('')}</div>`
      : '';
    // sparkline: intraday 없음 → 빈 영역(full 카드와 정렬 맞춤)
    const emptySparkHtml = '<div class="cal-feature-sparkline cal-spark-empty"></div>';
    // range bar: 데이터 부재 → 생략 (대표 지시: 빈 공간 두지 말 것)
    // 메타 줄 (등락률 | 거래대금)
    const metaRow = `<div class="cal-feature-meta">
      <span class="cal-feature-pct ${dir}">${pctText}</span>
      <span class="cal-meta-sep">|</span>
      <span class="cal-trade-amount">${amountText}</span>
    </div>`;
    // 본문: "관련 뉴스 없음" placeholder — 기존 .cal-feature-news-empty 스타일 재사용
    const emptyBodyHtml = simpleThemesHtml
      ? `${simpleThemesHtml}<div class="cal-feature-news-empty">관련 뉴스 없음</div>`
      : `<div class="cal-feature-news-empty">관련 뉴스 없음</div>`;
    const _idAttr_nointerp = it.code ? ` id="stock-${escapeHtml(it.code)}"` : '';
    return `
      <div class="cal-feature-card v2 no-interp"${_idAttr_nointerp} data-stock-code="${escapeHtml(it.code || '')}" data-stock-name="${escapeHtml(it.name || '')}">
        ${renderShareButton(it)}
        <div class="cal-feature-head v2">
          <div class="cal-feature-head-left">
            <div class="cal-trade-rank">#${it.rank}</div>
            <div class="cal-trade-candle">${candleHtml}</div>
            ${emptySparkHtml}
          </div>
          <div class="cal-feature-head-right">
            <div class="cal-feature-namecell">
              <span class="cal-feature-name">${escapeHtml(it.name)}</span>
              ${compactBadge}
            </div>
            ${metaRow}
          </div>
        </div>
        <div class="cal-feature-body">
          ${emptyBodyHtml}
        </div>
      </div>`;
  };

  const rankingBanner = '';
  const todayHtml = `
    <div class="cal-section">
      <div class="cal-section-title">오늘의 뉴스요약</div>
      ${narrPillsHtml}
      ${macroHtml}
      ${rankingBanner}
      ${todayStocks.length > 0 ? `
        <div class="cal-trade-list" style="margin-top:10px;">
          ${todayStocks.map(renderTodayCard).join('')}
        </div>
      ` : `
        ${isMarketClosed(date) ? (() => { const nd = getNextTradingDate(date); const nl = nd ? formatKoDate(nd) : ''; return `<div style="text-align:center;padding:32px 0;"><div style="font-size:15px;font-weight:700;color:var(--tx2);margin-bottom:6px;">오늘은 장이 쉽니다</div><div style="font-size:12px;color:var(--dm);">${nl ? '다음 거래일 ' + escapeHtml(nl) : ''}</div></div>`; })() : '<div class="cal-empty" style="padding:24px 0;">조건검색 데이터 없음 — 장 마감 후 또는 파이프라인 실행 후 업데이트</div>'}
      `}
    </div>
  `;

  const _rulesVersionBanner = _buildRulesVersionBanner(data && data.rules_version);
  inner.innerHTML = `
    ${_rulesVersionBanner}
    <div class="cal-content-head">
      <div class="cal-content-date">${formatKoDate(date)}</div>
      <div class="cal-content-meta">${metaText}</div>
    </div>
    ${todayHtml}
  `;

  // 접기/펼치기 이벤트 위임 (1회만 등록)
  // REQ-046 — CSS font-size:0 + ::after content trick 폐기 → JS textContent 직접 변경.
  // aria-label 동시 갱신 (스크린리더 정합).
  if (!window._cardCollapseInit) {
    document.addEventListener('click', e => {
      const toggle = e.target.closest('.cal-detail-toggle');
      if (!toggle) return;
      const card = toggle.closest('.cal-feature-card');
      if (!card) return;
      card.classList.toggle('expanded');
      const isExpanded = card.classList.contains('expanded');
      const txt = toggle.querySelector('.cal-toggle-text');
      if (txt) txt.textContent = isExpanded ? '접기' : '상세 보기';
      toggle.setAttribute('aria-label', isExpanded ? '접기' : '상세 보기');
    });
    window._cardCollapseInit = true;
  }

  // REQ-020 v9.5 §II.6 — 헤더 효과 배지 click 시 카드 자동 펼침 (v9.3 호환 — 셀렉터만 교체).
  // 함정 P2 #5: legacy `dsn-v93-header-badge` 셀렉터는 DOM 출력 0건 자연 차단 (잔존 CSS는 dead).
  // 함정 #11: 이벤트 버블링 충돌 방어 — stopPropagation 후 명시적 expanded 부착 (toggle 아닌 add).
  // REQ-046 — 헤더 배지 → expanded 추가 시도 토글 텍스트 동기 (CSS trick 폐기 정합).
  const _syncToggleText = (card) => {
    if (!card) return;
    const t = card.querySelector('.cal-detail-toggle');
    if (!t) return;
    const txt = t.querySelector('.cal-toggle-text');
    if (txt) txt.textContent = '접기';
    t.setAttribute('aria-label', '접기');
  };
  if (!window._headerBadgeExpandInit) {
    document.addEventListener('click', e => {
      const badge = e.target.closest('.dsn-v95-effect-badge');
      if (!badge) return;
      // "+N" 더보기 배지는 펼침 트리거 X (후속 toolitp 영역)
      if (badge.classList.contains('dsn-v95-effect-badge--more')) return;
      const card = badge.closest('.cal-feature-card');
      if (!card) return;
      e.stopPropagation();
      card.classList.add('expanded');
      _syncToggleText(card);
    });
    // 키보드 a11y — Enter·Space 키
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const badge = e.target.closest && e.target.closest('.dsn-v95-effect-badge');
      if (!badge) return;
      if (badge.classList.contains('dsn-v95-effect-badge--more')) return;
      const card = badge.closest('.cal-feature-card');
      if (!card) return;
      e.preventDefault();
      e.stopPropagation();
      card.classList.add('expanded');
      _syncToggleText(card);
    });
    window._headerBadgeExpandInit = true;
  }

  // 공유 버튼 이벤트 위임 (1회만 등록)
  if (!window._cardShareInit) {
    document.addEventListener('click', async e => {
      const btn = e.target.closest('.cal-share-btn');
      if (!btn) return;
      e.stopPropagation();
      e.preventDefault();
      const card = btn.closest('.cal-feature-card');
      if (!card) return;
      const code = card.getAttribute('data-stock-code') || '';
      const name = card.getAttribute('data-stock-name') || '';
      const urlParams = new URLSearchParams(window.location.search);
      const dateParam = urlParams.get('date');
      // date 파라미터 없으면 현재 선택된 날짜(전역) 또는 오늘 사용
      const dateStr = dateParam || (typeof calSelectedDate !== 'undefined' ? calSelectedDate : '');
      // OG 메타 HTML 경로로 공유 — 카톡/트위터 크롤러가 종목별 OG 이미지 수집
      // URL fragment는 현대 브라우저가 한글 raw 허용. 공백/특수문자만 제거.
      const nameSlug = (name || '').replace(/[\s\/?#%&]/g, '');
      const hashPart = nameSlug ? `#${nameSlug}` : '';  // fragment는 이름만 (식별 용도)
      const shareUrl = dateStr
        ? `${window.location.origin}/news/stock/${dateStr}/${code}.html${hashPart}`
        : `${window.location.origin}/news.html${hashPart}`;
      try {
        if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
          // URL만 공유 — 메신저가 title+text+url을 모두 붙여 중복 생기는 이슈 회피
          await navigator.share({ url: shareUrl });
          return;
        }
      } catch (err) {
        // 사용자 취소(AbortError)는 무시, 그 외엔 폴백
        if (err && err.name === 'AbortError') return;
      }
      // 폴백: 클립보드 복사
      try {
        await navigator.clipboard.writeText(shareUrl);
        showShareToast('링크가 복사되었습니다');
      } catch (err) {
        // 최후 폴백: execCommand
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); showShareToast('링크가 복사되었습니다'); }
        catch { showShareToast('복사 실패 — URL: ' + shareUrl); }
        document.body.removeChild(ta);
      }
    });
    window._cardShareInit = true;
  }

  // 해시 앵커로 진입 시 해당 카드로 스크롤 + 강조
  _scrollToHashStockIfAny();
}

// 공유 버튼 HTML 생성 (SVG 아이콘 + 접근성 속성)
function renderShareButton(it) {
  if (!it || !it.code) return ''; // code 없으면 딥링크 불가 → 버튼 자체 미노출
  const label = `${it.name || ''} 카드 공유하기`;
  return `<button type="button" class="cal-share-btn" aria-label="${escapeHtml(label)}" title="이 카드 공유하기">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  </button>`;
}

// 토스트 알림 (aria-live)
function showShareToast(msg) {
  let toast = document.getElementById('share-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'share-toast';
    toast.className = 'share-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.remove('show');
  // 리플로우 강제하여 재애니메이션
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// 해시에 #stock-{code} 있으면 해당 카드로 스크롤 + 강조
function _scrollToHashStockIfAny() {
  const hash = window.location.hash || '';
  // 하이브리드 형식 #stock-{code}-{name} 또는 기존 #stock-{code} 둘 다 수용 (code만 추출)
  const m = hash.match(/^#stock-([A-Za-z0-9]+)(?:-.+)?$/);
  if (!m) return;
  // 1회만 실행 — 재렌더 시 중간 스크롤 위치로 override되지 않도록
  if (window._scrolledToStockHash === hash) return;
  window._scrolledToStockHash = hash;
  const code = m[1];
  // 렌더가 비동기이므로 약간의 지연 후 시도 (최대 5회)
  let tries = 0;
  const tryScroll = () => {
    const el = document.getElementById('stock-' + code);
    if (el) {
      // CSS scroll-margin-top: 88px이 sticky header + 여유 오프셋 처리.
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('card-highlight');
      setTimeout(() => el.classList.remove('card-highlight'), 2000);
      // 다른 렌더/스크롤 코드가 override할 수 있어 1.5초 뒤 강제 재정렬
      setTimeout(() => {
        const el2 = document.getElementById('stock-' + code);
        if (!el2) return;
        const top = el2.getBoundingClientRect().top;
        if (Math.abs(top - 88) > 30) {
          el2.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      }, 1500);
      return;
    }
    if (++tries < 5) setTimeout(tryScroll, 400);
  };
  tryScroll();
}

// ───── 테마 거래대금 트렌드 ─────
async function initThemeTrend() {
  try {
    const res = await fetch('/data/themes/theme-trend.json');
    if (!res.ok) return;
    const data = await res.json();
    const container = document.getElementById('theme-trend');
    if (!container || !data.themes || !data.dates) return;

    const VISIBLE_DAYS = 7; // 화면에 보이는 영업일 수
    const allDates = data.dates;
    if (allDates.length < 1) return;
    const dates = allDates.slice(-20); // 최대 20영업일
    const dateSet = new Set(dates);
    const needsScroll = dates.length > VISIBLE_DAYS;

    // 모든 테마 표시 (데이터 있는 것만, 표시 기간 내 데이터 필터)
    const themes = data.themes
      .map(t => ({ ...t, data: (t.data || []).filter(d => dateSet.has(d.date)) }))
      .filter(t => t.data.length >= 1 && t.data.some(d => d.stock_count > 0))
      .sort((a, b) => {
        const aLast = a.data[a.data.length - 1]?.trade_amount || 0;
        const bLast = b.data[b.data.length - 1]?.trade_amount || 0;
        return bLast - aLast;
      })
      .slice(0, 12);

    if (themes.length === 0) {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const closedToday = isMarketClosed(todayStr);
      const nextDate = closedToday ? getNextTradingDate(todayStr) : null;
      const nextLabel = nextDate ? formatKoDate(nextDate) : '';
      const emptyMsg = closedToday
        ? `<div style="text-align:center;padding:32px 0;"><div style="font-size:15px;font-weight:700;color:var(--tx2);margin-bottom:6px;">오늘은 장이 쉽니다</div><div style="font-size:12px;color:var(--dm);">${nextLabel ? '다음 거래일 ' + escapeHtml(nextLabel) : ''}</div></div>`
        : '<div class="cal-empty" style="padding:24px 0;">테마 트렌드 데이터가 없습니다</div>';
      container.innerHTML = `
        <div class="theme-trend-header">
          <div class="theme-trend-title">테마 트렌드</div>
          <div class="theme-trend-sub">최근 거래대금 흐름</div>
        </div>
        ${emptyMsg}`;
      return;
    }

    const COLORS = ['#C49930','#5B8DEF','#E06B6B','#4BC9A0','#A97BDB','#E8963E','#6BB5E0','#D46BAD','#7B9E3D','#E0886B','#6B8FD4','#B86BD4'];

    // SVG 치수 — 반응형 (모바일 vs 데스크탑)
    const isMobile = window.innerWidth < 640;
    const yAxisW = isMobile ? 40 : 48;
    const H = isMobile ? 180 : 160;
    const PAD = isMobile
      ? { top: 10, right: 36, bottom: 26 }
      : { top: 12, right: 32, bottom: 28 };
    const plotH = H - PAD.top - PAD.bottom;

    // 차트 SVG 폭: 7일 기준 가용폭을 날짜 수에 비례 확장
    // 데스크탑은 컨테이너 실측 폭 기반 (좌측 쏠림 방지)
    const wrapPadding = isMobile ? 28 : 40; // .theme-trend-wrap 좌우 padding 합
    const measuredW = container.clientWidth || 720;
    const availableW = Math.max(280, measuredW - wrapPadding - yAxisW);
    const baseW = isMobile ? 320 : availableW;
    const chartW = needsScroll ? Math.round(baseW * (dates.length / VISIBLE_DAYS)) : baseW;
    const plotW = chartW - PAD.right;

    // 날짜 인덱스 맵
    const dateIdx = {};
    dates.forEach((d, i) => { dateIdx[d] = i; });

    // Y축 최대값
    let yMax = 0;
    themes.forEach(t => t.data.forEach(d => { if (d.trade_amount > yMax) yMax = d.trade_amount; }));
    yMax = yMax * 1.1; // 10% headroom

    const xStep = plotW / Math.max(dates.length - 1, 1);

    function toX(i) { return 8 + i * xStep; } // 차트 SVG 내부 좌측 약간 여백
    function toY(v) { return PAD.top + plotH - (v / yMax) * plotH; }
    function fmtTril(v) { return (v / 1e12).toFixed(1) + '조'; }
    function fmtDate(d) { return d.slice(5).replace('-', '/'); }

    // Y축 별도 SVG (고정)
    let yAxisSvg = '<svg class="theme-trend-svg" viewBox="0 0 ' + yAxisW + ' ' + H + '" width="' + yAxisW + '" xmlns="http://www.w3.org/2000/svg">';
    const axisFontSize = isMobile ? 9 : 7;
    for (let i = 0; i <= 2; i++) {
      const v = (yMax / 2) * i;
      const y = toY(v);
      yAxisSvg += '<text x="' + (yAxisW - 4) + '" y="' + (y + 3) + '" text-anchor="end" fill="#8B95A8" font-size="' + axisFontSize + '">' + fmtTril(v) + '</text>';
    }
    yAxisSvg += '</svg>';

    // 차트 SVG 빌드
    let svg = '<svg class="theme-trend-svg" viewBox="0 0 ' + chartW + ' ' + H + '" width="' + chartW + '" xmlns="http://www.w3.org/2000/svg">';

    // 가로 눈금선 (3개)
    for (let i = 0; i <= 2; i++) {
      const v = (yMax / 2) * i;
      const y = toY(v);
      svg += '<line x1="0" y1="' + y + '" x2="' + chartW + '" y2="' + y + '" stroke="#E8ECF2" stroke-width="0.5"/>';
    }

    // X축 날짜 라벨
    dates.forEach((d, i) => {
      const xFontSize = isMobile ? 10 : 7;
      svg += '<text x="' + toX(i) + '" y="' + (H - 4) + '" text-anchor="middle" fill="#8B95A8" font-size="' + xFontSize + '">' + fmtDate(d) + '</text>';
    });

    // 각 테마 polyline + 투명 히트 서클
    themes.forEach((theme, ti) => {
      const color = COLORS[ti % COLORS.length];
      const points = [];
      const dataMap = {};
      theme.data.forEach(d => { dataMap[d.date] = d; });

      dates.forEach((d, i) => {
        if (dataMap[d]) {
          points.push({ x: toX(i), y: toY(dataMap[d].trade_amount), date: d, amount: dataMap[d].trade_amount });
        }
      });

      if (points.length < 1) return;

      if (points.length === 1) {
        svg += '<circle cx="' + points[0].x + '" cy="' + points[0].y + '" r="3" fill="' + color + '" data-theme="' + escapeHtml(theme.name) + '" data-amount="' + points[0].amount + '" data-date="' + points[0].date + '" data-theme-idx="' + ti + '" class="tt-hit tt-dot" style="cursor:pointer"/>';
      } else {
        const polyPts = points.map(p => p.x + ',' + p.y).join(' ');
        const strokeW = isMobile ? 2 : 1.2;
        const dotR = isMobile ? 3.5 : 2;
        const hitR = isMobile ? 16 : 12;
        svg += '<polyline points="' + polyPts + '" fill="none" stroke="' + color + '" stroke-width="' + strokeW + '" stroke-linecap="round" stroke-linejoin="round" opacity="0.8" data-theme-idx="' + ti + '"/>';
        points.forEach(p => {
          svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + hitR + '" fill="transparent" stroke="none" data-theme="' + escapeHtml(theme.name) + '" data-amount="' + p.amount + '" data-date="' + p.date + '" data-theme-idx="' + ti + '" class="tt-hit" style="cursor:pointer"/>';
          svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + dotR + '" fill="' + color + '" data-theme-idx="' + ti + '" class="tt-dot"/>';
        });
      }
    });

    svg += '</svg>';

    // 레전드
    let legend = '<div class="theme-trend-legend">';
    themes.forEach((t, i) => {
      legend += '<span class="theme-trend-legend-item" data-legend-idx="' + i + '"><span class="swatch" style="background:' + COLORS[i % COLORS.length] + '"></span>' + escapeHtml(t.name) + '</span>';
    });
    legend += '</div>';

    const dateRange = fmtDate(dates[0]) + ' ~ ' + fmtDate(dates[dates.length - 1]);
    container.innerHTML =
      '<div class="theme-trend-header"><div class="theme-trend-title">테마별 거래대금 추이</div><div class="theme-trend-sub">최근 ' + dates.length + '영업일 · ' + dateRange + '</div></div>' +
      '<div class="theme-trend-wrap">' +
        '<div class="trend-y-axis">' + yAxisSvg + '</div>' +
        (needsScroll ? '<div class="trend-fade-left"></div>' : '') +
        '<div class="trend-scroll-area">' + svg + '</div>' +
        legend +
        '<div id="trend-detail" class="trend-detail"></div>' +
        '<div class="theme-trend-tooltip" id="tt-trend"></div>' +
      '</div>';

    // -- 횡스크롤 초기화 --
    const scrollArea = container.querySelector('.trend-scroll-area');
    const fadeLeft = container.querySelector('.trend-fade-left');
    if (scrollArea && needsScroll) {
      requestAnimationFrame(() => {
        scrollArea.scrollLeft = scrollArea.scrollWidth;
        if (fadeLeft) fadeLeft.style.opacity = scrollArea.scrollLeft > 8 ? '1' : '0';
      });
      if (fadeLeft) {
        scrollArea.addEventListener('scroll', () => {
          fadeLeft.style.opacity = scrollArea.scrollLeft > 8 ? '1' : '0';
        }, { passive: true });
      }
    }

    // -- 레전드 토글 (단일 선택) --
    let selectedIdx = -1; // -1 = 전체 표시
    const legendItems = container.querySelectorAll('.theme-trend-legend-item');
    const svgEl = scrollArea.querySelector('.theme-trend-svg');

    function applyLegendFilter() {
      const none = selectedIdx === -1;
      // SVG 요소 opacity — 비활성 포인트는 완전 숨김 + 클릭 차단
      svgEl.querySelectorAll('[data-theme-idx]').forEach(el => {
        const idx = parseInt(el.dataset.themeIdx);
        const active = none || idx === selectedIdx;
        const isDot = el.classList.contains('tt-dot');
        const isHit = el.classList.contains('tt-hit');
        if (isDot) {
          // 시각 dot (단일 포인트는 tt-hit+tt-dot 동시): 비활성이면 완전 숨김
          el.style.opacity = active ? '' : '0';
          el.style.pointerEvents = active ? '' : 'none';
          if (!isHit) return; // tt-dot 전용이면 여기서 끝
        }
        if (isHit) {
          // 히트 서클: 비활성이면 이벤트 차단
          el.style.pointerEvents = active ? '' : 'none';
          return;
        }
        el.style.opacity = active ? '' : '0.1';
      });
      // 레전드 스타일
      legendItems.forEach(li => {
        const idx = parseInt(li.dataset.legendIdx);
        const active = none || idx === selectedIdx;
        li.classList.toggle('selected', idx === selectedIdx);
        li.classList.toggle('dimmed', !none && !active);
      });
    }

    legendItems.forEach(li => {
      li.addEventListener('click', () => {
        const idx = parseInt(li.dataset.legendIdx);
        // 이미 선택된 테마를 다시 클릭하면 전체 표시로 복귀
        selectedIdx = (selectedIdx === idx) ? -1 : idx;
        applyLegendFilter();
      });
    });

    // -- 포인트 클릭 → 종목 테이블 --
    const detailDiv = document.getElementById('trend-detail');
    let activePoint = null; // "theme|date" key

    function fmtAmount(v) {
      if (v == null) return '-';
      if (v >= 1e12) return (v / 1e12).toFixed(1) + '조';
      if (v >= 1e8) return (v / 1e8).toFixed(0) + '억';
      if (v >= 1e4) return Math.round(v / 1e4).toLocaleString() + '만';
      return v.toLocaleString();
    }

    function showStockDetail(themeName, dateStr, themeIdx) {
      const key = themeName + '|' + dateStr;
      // 기존 골드 링 제거
      svgEl.querySelectorAll('.tt-gold-ring').forEach(el => el.remove());
      activePoint = key;
      // 테마 데이터에서 stocks 찾기
      const theme = themes[themeIdx];
      if (!theme) return;
      const dayData = theme.data.find(d => d.date === dateStr);
      // 종목코드/종목명 기준 dedup
      const rawStocks = dayData && dayData.stocks ? dayData.stocks : [];
      const seenStockKey = new Set();
      const stocks = rawStocks.filter(s => {
        const key = s.stock_code || s.code || s.name || '';
        if (!key || seenStockKey.has(key)) return false;
        seenStockKey.add(key);
        return true;
      });
      // 골드 링 추가
      const hits = svgEl.querySelectorAll('.tt-hit[data-theme="' + themeName.replace(/"/g, '\\"') + '"][data-date="' + dateStr + '"]');
      hits.forEach(h => {
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('cx', h.getAttribute('cx'));
        ring.setAttribute('cy', h.getAttribute('cy'));
        ring.setAttribute('r', '5');
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', '#C49930');
        ring.setAttribute('stroke-width', '2');
        ring.classList.add('tt-gold-ring');
        svgEl.appendChild(ring);
      });
      // 테이블 렌더
      const chipDate = dateStr.slice(5).replace('-', '/');
      let html = '<div class="trend-detail-chip">' + chipDate + ' &middot; ' + escapeHtml(themeName) + '</div>';
      if (stocks.length === 0) {
        html += '<div style="font-size:12px;color:var(--dm);padding:8px 0;">종목 데이터가 없습니다</div>';
      } else {
        html += '<table class="trend-detail-table"><thead><tr><th>종목명</th><th class="th-price">종가</th><th class="th-candle"></th><th>등락률</th><th class="th-amount">거래대금</th></tr></thead><tbody>';
        stocks.forEach(s => {
          const pctClass = s.change_pct > 0 ? '#E03131' : s.change_pct < 0 ? '#1971C2' : 'var(--tx)';
          const pctStr = (s.change_pct > 0 ? '+' : '') + s.change_pct.toFixed(2) + '%';
          html += '<tr><td>' + escapeHtml(s.name) + '</td><td class="td-price">' + (s.price ? s.price.toLocaleString() : '-') + '</td><td class="td-candle">' + miniCandle(s.open_price, s.high_price, s.low_price, s.price, s.change_pct) + '</td><td style="color:' + pctClass + ';font-weight:600">' + pctStr + '</td><td class="td-amount">' + fmtAmount(s.trade_amount) + '</td></tr>';
        });
        html += '</tbody></table>';
      }
      detailDiv.innerHTML = html;
      // 트랜지션
      detailDiv.classList.remove('open');
      requestAnimationFrame(() => { detailDiv.classList.add('open'); });
    }

    // -- 툴팁 + 클릭 --
    const tooltip = document.getElementById('tt-trend');
    const wrap = container.querySelector('.theme-trend-wrap');

    if (!isMobile) {
      wrap.addEventListener('mousemove', function(e) {
        const hit = e.target.closest('.tt-hit');
        if (!hit) { tooltip.classList.remove('show'); return; }
        // 비활성 테마 포인트는 툴팁 표시 안 함
        const hitIdx = parseInt(hit.dataset.themeIdx);
        if (selectedIdx !== -1 && hitIdx !== selectedIdx) { tooltip.classList.remove('show'); return; }
        const name = hit.dataset.theme;
        const amount = Number(hit.dataset.amount);
        tooltip.textContent = name + ' ' + fmtTril(amount);
        tooltip.classList.add('show');
        const wrapRect = wrap.getBoundingClientRect();
        let left = e.clientX - wrapRect.left + 12;
        const ttWidth = tooltip.offsetWidth || 120;
        if (left + ttWidth > wrapRect.width) left = e.clientX - wrapRect.left - ttWidth - 12;
        tooltip.style.left = left + 'px';
        tooltip.style.top = (e.clientY - wrapRect.top - 28) + 'px';
      });
      wrap.addEventListener('mouseleave', function() { tooltip.classList.remove('show'); });
    }

    wrap.addEventListener('click', function(e) {
      const hit = e.target.closest('.tt-hit');
      if (!hit) {
        // 포인트 외 클릭 → 선택 해제
        svgEl.querySelectorAll('.tt-gold-ring').forEach(el => el.remove());
        activePoint = null;
        detailDiv.classList.remove('open');
        detailDiv.innerHTML = '';
        return;
      }
      tooltip.classList.remove('show');
      const themeName = hit.dataset.theme;
      const dateStr = hit.dataset.date;
      const themeIdx = parseInt(hit.dataset.themeIdx);
      // 레전드 필터 활성 시, 비선택 테마 클릭 무시
      if (selectedIdx !== -1 && selectedIdx !== themeIdx) return;
      showStockDetail(themeName, dateStr, themeIdx);
    });

  } catch (e) { console.warn('theme-trend:', e); }
}

// ───── 테마 지도 ─────
async function initThemeMap() {
  try {
    const res = await fetch('/data/themes/theme-map.json');
    if (!res.ok) return;
    const data = await res.json();
    const grid = document.getElementById('theme-map-grid');
    const expand = document.getElementById('theme-map-expand');
    if (!grid || !data.themes) return;

    // 종목 2개 이상 테마만 표시
    const themes = data.themes.filter(t => t.stock_count >= 2);
    if (themes.length === 0) return;

    let activeTheme = null;

    grid.innerHTML = themes.map(t =>
      `<span class="theme-map-chip" data-theme-id="${t.id}">${escapeHtml(t.name)}<span class="chip-count">${t.stock_count}</span></span>`
    ).join('');

    grid.addEventListener('click', (e) => {
      const chip = e.target.closest('.theme-map-chip');
      if (!chip) return;
      const tid = parseInt(chip.dataset.themeId);
      const theme = themes.find(t => t.id === tid);
      if (!theme) return;

      // 토글
      if (activeTheme === tid) {
        activeTheme = null;
        expand.classList.remove('show');
        chip.classList.remove('active');
        return;
      }

      // 이전 active 해제
      grid.querySelectorAll('.active').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeTheme = tid;

      // 확장 패널
      const stocksHtml = theme.stocks.slice(0, 10).map(s =>
        `<div class="theme-map-stock">
          <span class="theme-map-stock-name">${escapeHtml(s.name)}</span>
          <span class="theme-map-stock-industry">${escapeHtml(s.industry || '')}</span>
        </div>`
      ).join('');

      expand.innerHTML = `
        <div class="theme-map-expand-title">${escapeHtml(theme.name)} — ${theme.stock_count}종목</div>
        ${stocksHtml}
      `;
      expand.classList.add('show');
    });
  } catch (e) { console.warn('theme-map:', e); }
}

// ───── 테마 트리 (Indented Tree + Inline Bar) ─────
async function initThemeTree(dateOverride) {
  try {
    // 휴장일이면 안내 메시지 표시 후 종료 (테마 트리는 거래일 데이터 기반)
    if (dateOverride && isMarketClosed(dateOverride)) {
      const tc = document.getElementById('theme-tree-container');
      if (tc) {
        const nextDate = getNextTradingDate(dateOverride);
        const nextLabel = nextDate ? formatKoDate(nextDate) : '';
        tc.innerHTML = `<div style="text-align:center;padding:32px 0;"><div style="font-size:15px;font-weight:700;color:var(--tx2);margin-bottom:6px;">오늘은 장이 쉽니다</div><div style="font-size:12px;color:var(--dm);">${nextLabel ? '다음 거래일 ' + escapeHtml(nextLabel) : ''}</div></div>`;
      }
      return;
    }
    // theme-tree.json 캐시 (최초 1회만 fetch)
    if (!_themeTreeCache) {
      const res = await fetch('/data/themes/theme-tree.json');
      if (!res.ok) return;
      _themeTreeCache = await res.json();
    }
    const data = JSON.parse(JSON.stringify(_themeTreeCache)); // deep copy
    if (!data.nodes || data.nodes.length === 0) {
      const tc = document.getElementById('theme-tree-container');
      if (tc) {
        const _n2 = new Date();
        const _t2 = `${_n2.getFullYear()}-${String(_n2.getMonth()+1).padStart(2,'0')}-${String(_n2.getDate()).padStart(2,'0')}`;
        const isLive = (dateOverride === _t2 || !dateOverride) && _n2.getHours() < 16 && !isMarketClosed(_t2);
        tc.innerHTML = `<div class="cal-empty" style="padding:24px 0;">${isLive ? '테마 데이터가 없습니다' : '테마 데이터가 없습니다'}</div>`;
      }
      return;
    }

    // 날짜 지정 시: 해당 날짜의 stock JSON에서 테마 필터링
    const targetDate = dateOverride || data.date;
    if (dateOverride) {
      try {
        const stockRes = await fetch(`/data/interpreted/stock-${dateOverride}.json`);
        if (stockRes.ok) {
          const stockData = await stockRes.json();
          // 해당 날짜 종목들의 테마 이름 수집
          const activeThemes = new Set();
          const themeStocks = {}; // theme_name -> [{code, name, change_pct, trade_amount}]
          for (const s of (stockData.stocks || [])) {
            for (const t of (s.themes || [])) {
              const tName = typeof t === 'string' ? t : t.name;
              activeThemes.add(tName);
              if (!themeStocks[tName]) themeStocks[tName] = [];
              themeStocks[tName].push({
                code: s.code, name: s.name,
                change_pct: s.change_pct || 0,
                trade_amount: s.trade_amount || 0
              });
            }
          }
          // 해당 날짜 테마가 있는 노드만 유지 + 종목 교체
          const nodeById = {};
          data.nodes.forEach(n => { nodeById[n.id] = n; });
          // 활성 노드 ID 수집 (이름 매칭)
          const activeIds = new Set();
          data.nodes.forEach(n => {
            if (activeThemes.has(n.name)) {
              activeIds.add(n.id);
              // 종목 정보 교체
              n.stocks = (themeStocks[n.name] || []);
              n.stock_count = n.stocks.length;
              n.total_stock_count = n.stock_count;
              n.trade_amount = n.stocks.reduce((s, x) => s + (x.trade_amount || 0), 0);
            }
          });
          // 조상 노드도 유지 (트리 연결용)
          data.nodes.forEach(n => {
            if (activeIds.has(n.id)) {
              let pid = n.parent_id;
              while (pid && nodeById[pid] && !activeIds.has(pid)) {
                activeIds.add(pid);
                pid = nodeById[pid].parent_id;
              }
            }
          });
          // 조상-전용 노드의 stocks도 해당 날짜 데이터로 교체
          data.nodes.forEach(n => {
            if (activeIds.has(n.id) && !activeThemes.has(n.name)) {
              n.stocks = (themeStocks[n.name] || []);
              n.stock_count = n.stocks.length;
              n.total_stock_count = n.stock_count;
              n.trade_amount = n.stocks.reduce((s, x) => s + (x.trade_amount || 0), 0);
            }
          });
          // 활성 노드만 필터
          data.nodes = data.nodes.filter(n => activeIds.has(n.id));
          // 부모-자식 종목 중복 제거: 모든 자손에 있는 종목은 부모에서 제외
          const nodeByIdD = {};
          const childrenMapD = {};
          data.nodes.forEach(n => { nodeByIdD[n.id] = n; });
          data.nodes.forEach(n => {
            if (n.parent_id) {
              if (!childrenMapD[n.parent_id]) childrenMapD[n.parent_id] = [];
              childrenMapD[n.parent_id].push(n.id);
            }
          });
          function collectDescendantCodes(nid) {
            const codes = new Set();
            (childrenMapD[nid] || []).forEach(cid => {
              const child = nodeByIdD[cid];
              if (child && child.stocks) child.stocks.forEach(s => codes.add(s.code));
              collectDescendantCodes(cid).forEach(c => codes.add(c));
            });
            return codes;
          }
          data.nodes.forEach(n => {
            const descCodes = collectDescendantCodes(n.id);
            // descendant_stock_count: 자신 + 모든 자손의 고유 종목 수
            const ownCodes = new Set((n.stocks || []).map(s => s.code));
            const allCodes = new Set([...ownCodes, ...descCodes]);
            n.descendant_stock_count = allCodes.size;
            if (descCodes.size > 0 && n.stocks) {
              n.stocks = n.stocks.filter(s => !descCodes.has(s.code));
              n.stock_count = n.stocks.length;
              n.trade_amount = n.stocks.reduce((sum, s) => sum + (s.trade_amount || 0), 0);
            }
          });
        }
      } catch (e) { /* stock JSON 없으면 기본 트리 사용 */ }
    }

    // 필터링 후 노드가 없으면 빈 상태 표시
    if (!data.nodes || data.nodes.length === 0) {
      const tc = document.getElementById('theme-tree-container');
      if (tc) {
        const _n3 = new Date();
        const _t3 = `${_n3.getFullYear()}-${String(_n3.getMonth()+1).padStart(2,'0')}-${String(_n3.getDate()).padStart(2,'0')}`;
        const isLive = (dateOverride === _t3) && _n3.getHours() < 16 && !isMarketClosed(_t3);
        tc.innerHTML = `<div class="cal-empty" style="padding:24px 0;">${isLive ? '테마 데이터가 없습니다' : '해당 날짜의 테마 데이터가 없습니다'}</div>`;
      }
      return;
    }

    const ROOT_COLORS = ['#C9A962','#7C8CBA','#E07C5A','#6BA37E','#B47CC7','#5CABB5','#D4A05A','#8B7EC8','#C75C7C'];
    const nodes = data.nodes;
    const nodeMap = {};
    nodes.forEach(n => { nodeMap[n.id] = { ...n, children: [] }; });
    const roots = [];
    nodes.forEach(n => {
      if (n.parent_id && nodeMap[n.parent_id]) {
        nodeMap[n.parent_id].children.push(nodeMap[n.id]);
      } else if (!n.parent_id) {
        roots.push(nodeMap[n.id]);
      }
    });

    // 자식 거래대금 합산 (재귀, 상향식)
    // unique_trade_amount: 형제 테마 간 종목 중복을 제거한 정확한 합산값 (Python에서 계산)
    function sumTradeAmount(node) {
      // 자식 먼저 재귀 처리 (avg_change_pct 가중평균에 필요)
      node.children.forEach(c => sumTradeAmount(c));
      // 거래대금: unique_trade_amount가 양수면 사용, 0이면 자식 합산으로 대체
      if (node.unique_trade_amount != null && node.unique_trade_amount > 0) {
        node._totalAmt = node.unique_trade_amount;
      } else {
        let childSum = 0;
        node.children.forEach(c => { childSum += c._totalAmt; });
        node._totalAmt = node.trade_amount + childSum;
      }
      // avg_change_pct도 자식 가중 평균 계산
      if (node.trade_amount === 0 && node.children.length > 0) {
        let wSum = 0, wDiv = 0;
        node.children.forEach(c => {
          if (c._totalAmt > 0) { wSum += c._avgPct * c._totalAmt; wDiv += c._totalAmt; }
        });
        node._avgPct = wDiv > 0 ? wSum / wDiv : 0;
      } else {
        node._avgPct = node.avg_change_pct;
      }
      return node._totalAmt;
    }
    roots.forEach(r => sumTradeAmount(r));

    // 거래대금 내림차순 정렬 (재귀)
    function sortByAmt(arr) {
      arr.sort((a, b) => b._totalAmt - a._totalAmt);
      arr.forEach(n => sortByAmt(n.children));
    }
    sortByAmt(roots);

    // _totalAmt > 0인 루트만 표시 (거래대금 0 자식만 있는 루트도 제외)
    const visRoots = roots.filter(r => r._totalAmt > 0);

    // 글로벌 최대 거래대금
    const globalMax = Math.max(...visRoots.map(r => r._totalAmt), 1);

    function fmtAmt(v) {
      if (v >= 1e12) return (v / 1e12).toFixed(1) + '조';
      if (v >= 1e8) return Math.round(v / 1e8).toLocaleString() + '억';
      if (v >= 1e4) return Math.round(v / 1e4).toLocaleString() + '만';
      return v.toString();
    }

    function lighten(hex, pct) {
      const num = parseInt(hex.slice(1), 16);
      let r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
      r = Math.min(255, Math.round(r + (255 - r) * pct));
      g = Math.min(255, Math.round(g + (255 - g) * pct));
      b = Math.min(255, Math.round(b + (255 - b) * pct));
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    const container = document.getElementById('theme-tree-container');
    if (!container) return;
    container.innerHTML = '';  // 날짜 변경 시 기존 트리 제거 (누적 방지)

    function renderNode(node, depth, rootColor) {
      const hasChildren = node.children.length > 0 && node.children.some(c => c._totalAmt > 0 || c.trade_amount > 0);
      const amt = node._totalAmt;
      const pct = node._avgPct;
      const descStocks = node.descendant_stock_count || (Array.isArray(node.stocks) ? node.stocks.length : 0);
      const isZero = amt === 0 && descStocks === 0;
      const barW = isZero ? 0 : Math.max(4, (amt / globalMax) * 120);
      const barColor = depth === 0 ? rootColor : lighten(rootColor, depth * 0.2);
      const pctColor = pct >= 0 ? '#EF4444' : '#3B82F6';
      const indent = depth * 24;

      const wrapper = document.createElement('div');
      const row = document.createElement('div');
      row.className = 'theme-tree-row';
      row.style.paddingLeft = indent + 'px';

      const arrow = document.createElement('span');
      arrow.className = 'theme-tree-arrow' + (hasChildren ? '' : ' leaf');
      arrow.textContent = '\u25B6';
      row.appendChild(arrow);

      const bar = document.createElement('span');
      bar.className = 'theme-tree-bar';
      bar.style.width = barW + 'px';
      bar.style.maxWidth = '120px';
      bar.style.background = barColor;
      if (isZero) bar.style.display = 'none';
      row.appendChild(bar);

      const name = document.createElement('span');
      name.className = 'theme-tree-name' + (isZero ? ' zero' : '');
      name.textContent = node.name;
      row.appendChild(name);

      if (!isZero) {
        const amtEl = document.createElement('span');
        amtEl.className = 'theme-tree-amt';
        amtEl.textContent = fmtAmt(amt);
        row.appendChild(amtEl);

        // 등락률 제거 (대표 지시 4/14 — 테마트리에 불필요)

        const ownCount = node.stock_count || (Array.isArray(node.stocks) ? node.stocks.length : 0);
        const descCount = node.descendant_stock_count || ownCount;
        if (descCount > 0) {
          const cntEl = document.createElement('span');
          cntEl.className = 'theme-tree-stock-count';
          cntEl.textContent = descCount + '\uC885\uBAA9';
          row.appendChild(cntEl);
        }
      } else {
        // trade_amount=0: dateOverride 후 종목이 채워질 수 있으므로 일단 표시
        // descendant_stock_count로 판단 — 자손 포함 종목이 0이면 숨김
        const descAny = node.descendant_stock_count || 0;
        if (descAny === 0) {
          wrapper.style.display = 'none';
        }
      }

      wrapper.appendChild(row);

      // --- 종목 행 렌더링 헬퍼 ---
      function renderStockRows(stocks, stockIndent) {
        // 종목코드(or 종목명) 기준 dedup — 같은 테마에 동일 종목 2회 표시 방지
        const seenKey = new Set();
        const dedupedStocks = stocks.filter(s => {
          const key = s.stock_code || s.code || s.name || s.stock_name || '';
          if (!key || seenKey.has(key)) return false;
          seenKey.add(key);
          return true;
        });
        const MAX_VISIBLE = 5;
        const frag = document.createDocumentFragment();
        const visible = dedupedStocks.slice(0, MAX_VISIBLE);
        const rest = dedupedStocks.slice(MAX_VISIBLE);

        visible.forEach(s => frag.appendChild(makeStockRow(s, stockIndent)));

        if (rest.length > 0) {
          const hiddenContainer = document.createElement('div');
          hiddenContainer.style.display = 'none';
          rest.forEach(s => hiddenContainer.appendChild(makeStockRow(s, stockIndent)));
          frag.appendChild(hiddenContainer);

          const moreRow = document.createElement('div');
          moreRow.className = 'theme-tree-stock-row';
          moreRow.style.paddingLeft = stockIndent + 'px';
          const moreLabel = document.createElement('span');
          moreLabel.className = 'theme-tree-stock-more';
          moreLabel.textContent = '\u00B7\u00B7\u00B7 \uC678 ' + rest.length + '\uC885\uBAA9';
          moreLabel.addEventListener('click', (e) => {
            e.stopPropagation();
            hiddenContainer.style.display = '';
            moreRow.style.display = 'none';
          });
          moreRow.appendChild(moreLabel);
          frag.appendChild(moreRow);
        }
        return frag;
      }

      function makeStockRow(s, stockIndent) {
        const sr = document.createElement('div');
        sr.className = 'theme-tree-stock-row';
        sr.style.paddingLeft = stockIndent + 'px';

        const sName = document.createElement('span');
        sName.className = 'theme-tree-stock-name';
        sName.textContent = s.name || s.stock_name || '';
        sr.appendChild(sName);

        const sPct = s.change_pct != null ? s.change_pct : s.pct;
        if (sPct != null) {
          const sPctEl = document.createElement('span');
          sPctEl.className = 'theme-tree-stock-pct';
          sPctEl.style.color = sPct >= 0 ? '#EF4444' : '#3B82F6';
          sPctEl.textContent = (sPct >= 0 ? '+' : '') + sPct.toFixed(2) + '%';
          sr.appendChild(sPctEl);
        }

        const sAmt = s.trade_amount != null ? s.trade_amount : s.amount;
        if (sAmt != null && sAmt > 0) {
          const sAmtEl = document.createElement('span');
          sAmtEl.className = 'theme-tree-stock-amt';
          sAmtEl.textContent = fmtAmt(sAmt);
          sr.appendChild(sAmtEl);
        }
        return sr;
      }

      const hasStocks = Array.isArray(node.stocks) && node.stocks.length > 0;
      const hasExpandable = hasChildren || hasStocks;
      const stockIndent = (depth + 1) * 24;

      if (hasChildren || hasStocks) {
        const childContainer = document.createElement('div');
        childContainer.className = 'theme-tree-children collapsed';
        if (hasChildren) {
          node.children.forEach(c => {
            // 거래대금 0인 자식도 표시 (연한 회색)
            childContainer.appendChild(renderNode(c, depth + 1, rootColor));
          });
        }
        if (hasStocks) {
          childContainer.appendChild(renderStockRows(node.stocks, stockIndent));
        }
        wrapper.appendChild(childContainer);

        row.addEventListener('click', () => {
          const isCollapsed = childContainer.classList.contains('collapsed');
          if (isCollapsed) {
            childContainer.classList.remove('collapsed');
            childContainer.style.maxHeight = childContainer.scrollHeight + 'px';
            arrow.classList.add('expanded');
          } else {
            childContainer.style.maxHeight = '0px';
            childContainer.classList.add('collapsed');
            arrow.classList.remove('expanded');
          }
        });

        // max-height transition 후 auto로 전환 (중첩 펼침 대응)
        childContainer.addEventListener('transitionend', () => {
          if (!childContainer.classList.contains('collapsed')) {
            childContainer.style.maxHeight = 'none';
          }
        });

        // hasStocks만 있고 children이 없으면 arrow 표시
        if (!hasChildren && hasStocks) {
          arrow.classList.remove('leaf');
        }
      }

      return wrapper;
    }

    const frag = document.createDocumentFragment();
    visRoots.forEach((root, i) => {
      frag.appendChild(renderNode(root, 0, ROOT_COLORS[i % ROOT_COLORS.length]));
    });
    container.appendChild(frag);

  } catch (e) { console.warn('theme-tree:', e); }
}

/* ───── 초기화 호출 ───── */
// initThemeTrend/initThemeMap/initThemeTree는 _refreshDataAsync에서 비동기 호출
initCalendar();
