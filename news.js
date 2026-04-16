let themesData = null;

async function loadThemes() {
  try {
    const res = await fetch('/data/themes/themes.json');
    if (!res.ok) throw new Error('themes.json HTTP ' + res.status);
    return await res.json();
  } catch (e) { return null; }
}

async function loadIndex() {
  try {
    const res = await fetch('/data/cafe/index.json');
    if (!res.ok) throw new Error('index.json HTTP ' + res.status);
    return await res.json();
  } catch (e) { return null; }
}

async function loadPost(postId) {
  try {
    const res = await fetch(`/data/cafe/posts/${postId}.json`);
    if (!res.ok) throw new Error(postId + ' HTTP ' + res.status);
    return await res.json();
  } catch (e) { return null; }
}

async function loadKiwoomIndex() {
  try {
    const res = await fetch('/data/kiwoom/index.json');
    if (!res.ok) throw new Error('kiwoom/index.json HTTP ' + res.status);
    return await res.json();
  } catch (e) { return null; }
}

async function loadKiwoomDate(date) {
  const dateHash = date.replace(/-/g, '');
  try {
    const res = await fetch(`/data/kiwoom/${date}.json?v=${dateHash}`);
    if (res.ok) return await res.json();
  } catch (e) { /* fall through */ }
  // 폴백: stock-*.json에서 종목 리스트 추출 (kiwoom 파일 미생성 시)
  try {
    const fb = await fetch(`/data/interpreted/stock-${date}.json?v=${dateHash}`);
    if (fb.ok) {
      const d = await fb.json();
      if (d.stocks && d.stocks.length > 0) {
        return { daily_top: d.stocks.map(s => ({
          ticker: s.code, name: s.name, rank: s.rank,
          max_trade_amount: s.trade_amount, max_change_pct: s.change_pct
        })) };
      }
    }
  } catch (e) { /* ignore */ }
  return null;
}

function fmtTradeAmount(won) {
  if (won == null) return '—';
  if (won >= 1_000_000_000_000) return (won / 1_000_000_000_000).toFixed(1) + '조';
  if (won >= 100_000_000) return Math.round(won / 100_000_000).toLocaleString() + '억';
  if (won >= 10_000) return Math.round(won / 10_000).toLocaleString() + '만';
  return won.toLocaleString();
}

function fmtNum(n) {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('ko-KR');
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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

// 내부 에이전트 이름·고유명을 사용자 화면에서 제거 (상품 톤 유지)
function sanitize(s) {
  if (s == null) return '';
  return String(s)
    .replace(/박성진\s*매매\s*가치관(?:상)?/g, '내부 거래 기준')
    .replace(/박성진\s*(?:스타일|매매스타일)/g, '내부 거래 스타일')
    .replace(/박성진/g, '내부 기준')
    .replace(/주주\s*이견[:：]?/g, '추가 관점:')
    .replace(/주주\s*Top\s*Pick/gi, '엄선 종목')
    .replace(/주주\s*검증/g, '재검증')
    .replace(/주주가\s*/g, '')
    .replace(/주주\s*/g, '')
    .replace(/뉴지\s*미처리/g, '분석 대기')
    .replace(/뉴지\s*선별/g, '선별')
    .replace(/뉴지가\s*/g, '')
    .replace(/뉴지\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
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

/* ───── 토스 캘린더 로직 ───── */
let calIndex = null;           // data/calendar/index.json (없으면 null)
let holidayData = null;        // data/holidays.json (공휴일 + KRX 휴장일)
let calViewYear, calViewMonth; // 현재 보기 연·월 (month: 1~12)
let calSelectedDate = null;    // 'YYYY-MM-DD'
let calCategory = 'stock';     // 'stock' | 'realestate' | 'policy' (Phase 2/3 확장용)
const calDayCache = {};        // date → { kiwoom, cafePosts, narratives }

async function loadCalendarIndex() {
  try {
    const res = await fetch('/data/calendar/index.json');
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

async function loadHolidayData() {
  try {
    const res = await fetch('/data/holidays.json');
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

function isHoliday(iso) {
  return holidayData && holidayData.holidays && (iso in holidayData.holidays);
}

function getHolidayName(iso) {
  if (!holidayData || !holidayData.holidays) return null;
  return holidayData.holidays[iso] || null;
}

function isMarketClosed(iso) {
  if (!holidayData || !holidayData.market_closed) return isWeekendDate(iso);
  return iso in holidayData.market_closed;
}

// 비거래일이면 테마트리·거래대금 추이 숨김
function toggleThemeSections(iso) {
  const closed = isMarketClosed(iso);
  const tree = document.getElementById('theme-tree');
  const trend = document.getElementById('theme-trend');
  if (tree) tree.style.display = closed ? 'none' : '';
  if (trend) trend.style.display = closed ? 'none' : '';
}

function pad2(n) { return String(n).padStart(2, '0'); }
function ymd(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }
function formatKoDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = ['일','월','화','수','목','금','토'][new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${dow})`;
}
function isWeekendDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

// 다음 거래일 계산 (최대 10일 탐색)
function getNextTradingDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  for (let i = 0; i < 10; i++) {
    dt.setDate(dt.getDate() + 1);
    const next = ymd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
    if (!isMarketClosed(next)) return next;
  }
  return null;
}

function calHasData(date) {
  if (!calIndex || !calIndex.days) return false;
  const entry = calIndex.days[date];
  if (!entry) return false;
  return (entry.stock_count ?? 0) >= 1 && (entry.news_count ?? 0) >= 1;
}

function renderCalendar() {
  const grid = document.getElementById('toss-cal-grid');
  const ymEl = document.getElementById('toss-cal-ym');
  const subEl = document.getElementById('toss-cal-sub');
  const prevBtn = document.getElementById('toss-cal-prev');
  const nextBtn = document.getElementById('toss-cal-next');

  ymEl.textContent = `${calViewYear}년 ${calViewMonth}월`;

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth() + 1;
  const todayD = today.getDate();
  const todayStr = ymd(todayY, todayM, todayD);

  // 서브 텍스트 (해당 월 집계)
  subEl.textContent = '';

  // 네비게이션 제한
  nextBtn.disabled = (calViewYear > todayY) || (calViewYear === todayY && calViewMonth >= todayM);

  // 그리드 렌더
  const firstDow = new Date(calViewYear, calViewMonth - 1, 1).getDay();
  const daysInMonth = new Date(calViewYear, calViewMonth, 0).getDate();
  const dows = ['일','월','화','수','목','금','토'];
  let html = '';
  dows.forEach((d, i) => {
    const cls = i === 0 ? 'sun' : (i === 6 ? 'sat' : '');
    html += `<div class="toss-cal-dow ${cls}">${d}</div>`;
  });
  for (let i = 0; i < firstDow; i++) {
    html += `<div class="toss-cal-cell outside"></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = ymd(calViewYear, calViewMonth, d);
    const isFuture = (calViewYear > todayY) ||
                     (calViewYear === todayY && calViewMonth > todayM) ||
                     (calViewYear === todayY && calViewMonth === todayM && d > todayD);
    const hasData = isFuture ? false : calHasData(date);
    const dow = new Date(calViewYear, calViewMonth - 1, d).getDay();
    const isWeekend = (dow === 0 || dow === 6);
    const isToday = (date === todayStr);
    const isHol = isHoliday(date);
    const classes = ['toss-cal-cell'];
    const isTodayMarketHours = isToday && !isMarketClosed(date) && (new Date().getHours() < 16);
    if (isFuture) classes.push('future');
    else if (!hasData && !isTodayMarketHours) classes.push('no-data');
    else if (!hasData && isTodayMarketHours) classes.push('market-hours');
    if (isWeekend) classes.push('weekend');
    if (dow === 0) classes.push('sunday');
    if (dow === 6) classes.push('saturday');
    if (isHol) classes.push('holiday');
    if (isToday) classes.push('today');
    if (date === calSelectedDate) classes.push('selected');
    const holName = getHolidayName(date);
    const aria = `${date}${isToday ? ' (오늘)' : ''}${isTodayMarketHours ? ' (장중)' : ''}${holName ? ' ' + holName : ''}`;
    const isClickable = !isFuture && (hasData || isTodayMarketHours);
    html += `<div class="${classes.join(' ')}" data-date="${date}" role="button" tabindex="${isClickable ? 0 : -1}" aria-label="${aria}">${d}</div>`;
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.toss-cal-cell[data-date]').forEach(el => {
    if (el.classList.contains('future')) return;
    el.addEventListener('click', () => onCalCellClick(el.dataset.date));
  });
}

async function onCalCellClick(date, pushState) {
  calSelectedDate = date;
  toggleThemeSections(date);
  // Static URL — /news/{date}.html로 공유 시 날짜별 OG 이미지 매칭
  if (pushState !== false) {
    history.pushState(null, '', '/news/stock/' + date + '.html');
  }
  renderCalendar();
  const inner = document.getElementById('cal-content');
  inner.innerHTML = `
    <div class="cal-content-head">
      <div class="cal-content-date">${formatKoDate(date)}</div>
      <div class="cal-content-meta">불러오는 중…</div>
    </div>
    <div class="cal-empty"><div>데이터 로드 중</div></div>
  `;
  const data = await loadCalDayData(date);
  renderCalExpandContent(date, data);
  // 테마트리도 해당 날짜 기준으로 재렌더링
  if (!isMarketClosed(date)) {
    initThemeTree(date);
  }
}

async function loadCalDayData(date) {
  if (calDayCache[date]) return calDayCache[date];
  const [kiwoom, cafeIndex] = await Promise.all([
    loadKiwoomDate(date),
    loadIndex()
  ]);
  // 해당 날짜 소스 포스트 수집 (병렬 로드)
  let postsOfDay = [];
  if (cafeIndex && cafeIndex.posts) {
    const idsOfDay = cafeIndex.posts
      .filter(p => {
        const d = p.post_date || (p.fetched_at || '').slice(0, 10);
        return d === date;
      })
      .map(p => p.post_id)
      .slice(0, 10);
    postsOfDay = (await Promise.all(idsOfDay.map(id => loadPost(id)))).filter(Boolean);
  }
  // 내러티브 dedupe
  const narrSet = new Set();
  for (const p of postsOfDay) {
    for (const sec of (p.sections || [])) {
      for (const st of (sec.stocks || [])) {
        for (const nc of (st.news_cards || [])) {
          if (nc.summary) narrSet.add(nc.summary.trim());
        }
      }
    }
  }
  // 해석 파일 로드 (stock-daily)
  const dateHash = date.replace(/-/g, '');
  let stockDailyData = await fetch(`/data/interpreted/${calCategory}-${date}.json?v=${dateHash}`).then(r => r.ok ? r.json() : null).catch(() => null);
  // 당일 데이터 없으면 최근 7일 이내 이전 날짜 fallback
  if (!stockDailyData) {
    const d = new Date(date + 'T00:00:00');
    for (let i = 1; i <= 7; i++) {
      const prev = new Date(d);
      prev.setDate(prev.getDate() - i);
      const prevStr = prev.toISOString().slice(0, 10);
      const prevHash = prevStr.replace(/-/g, '');
      const prevData = await fetch(`/data/interpreted/${calCategory}-${prevStr}.json?v=${prevHash}`).then(r => r.ok ? r.json() : null).catch(() => null);
      if (prevData) {
        stockDailyData = prevData;
        stockDailyData._fallback_date = prevStr;
        break;
      }
    }
  }
  // 종목명 → 해석 stock 객체 병합 맵
  const interpretedByName = new Map();
  let macroEvents = [];
  // Phase 1 뉴스 파이프라인 산출물 (stock-YYYY-MM-DD.json) — DB 종목 마스터 + 이시카와/토구사 해석
  try {
    if (stockDailyData) {
      const stockDaily = stockDailyData;
      for (const st of (stockDaily.stocks || [])) {
        if (!st.name) continue;
        // 기존 해석이 있으면 themes/theme_paths만 병합 (cafe에 테마 없을 수 있음)
        if (interpretedByName.has(st.name)) {
          const existing = interpretedByName.get(st.name);
          const stThemes = (st.themes || []).map(t => typeof t === 'string' ? { name: t } : t);
          if (stThemes.length > 0 && (!existing.themes || existing.themes.length === 0)) {
            existing.themes = stThemes;
          }
          if ((st.theme_paths || []).length > 0 && (!existing.theme_paths || existing.theme_paths.length === 0)) {
            existing.theme_paths = st.theme_paths;
          }
          continue;
        }
        {
          // stock-*.json 형식 → 기존 렌더러 호환 변환
          // 가비지 뉴스 필터: VI발동, 신고가, 단순 등락률 로봇 기사 제거
          const garbageRe = /[+-]?\d[\d.]*%\s*(VI\s*발동|\d+주\s*신[고저]가|상한가|하한가)|거래량\s*(폭발|급증|돌파)/;
          const newsItems = (st.news || [])
            .filter(n => !(n.newzy_verdict || '').startsWith('반대'))
            .filter(n => !garbageRe.test(n.title || ''));
          const topNews = newsItems[0];
          const pp = st.prev_pick;
          const industryLabel = st.industry ? `업종: ${st.industry}` : '';
          const sectorLabel = st.sector ? (() => {
            // 괄호 밖의 첫 콤마에서만 자르기 (괄호 안 콤마는 무시)
            let depth = 0, cutIdx = -1;
            for (let i = 0; i < st.sector.length; i++) {
              if (st.sector[i] === '(') depth++;
              else if (st.sector[i] === ')') depth--;
              else if (st.sector[i] === ',' && depth === 0) { cutIdx = i; break; }
            }
            return cutIdx >= 0 ? st.sector.slice(0, cutIdx).trim() : st.sector.trim();
          })() : '';
          // causal_chain이 있는 뉴스를 우선 탐색 (첫 번째 뉴스에 없을 수 있음)
          const chainNews = newsItems.find(n => n.causal_chain) || null;
          const causalText = chainNews ? chainNews.causal_chain : '';
          const diffParts = [
            causalText,
            !causalText && industryLabel ? `업종: ${industryLabel}` : '',
            !causalText && sectorLabel ? `주요제품: ${sectorLabel}` : '',
          ].filter(Boolean);
          // 테마: theme_paths 우선, 없으면 themes, 없으면 industry 폴백
          const trimIndustry = (s) => s.replace(/\s*(제조업|업)$/, '').replace(/기타\s*/, '');
          let themes = (st.themes || []).map(t => typeof t === 'string' ? { name: t } : t);
          const themePaths = st.theme_paths || [];
          // industry 폴백 제거 (산업분류 ≠ 테마, 대표 결정)

          interpretedByName.set(st.name, {
            name: st.name,
            themes,
            theme_paths: themePaths,
            causal_chain: causalText ? [causalText] : (st.causal_chain ? [st.causal_chain] : []),
            differentiator: diffParts.join(' · ') || st.causal_chain || '',
            macro_event: topNews?.macro_event || null,
            news_digest: newsItems.map(n => ({ url: n.url, inferred_title: n.title, source: n.source })),
            industry: st.industry,
            sector: st.sector,
            fallback: st.fallback,
            fallback_date: st.fallback_date,
            pick_count: st.pick_count,
            prev_pick: pp,
            disclosures: st.disclosures || [],
            credit_risk: !!st.credit_risk,
            credit_reason: st.credit_reason || null,
            close_price: st.close_price || null,
            intraday: st.intraday || null,
            status_badges: st.status_badges || [],
          });
        }
      }
      // 매크로 이벤트 보충
      if (Array.isArray(stockDaily.macro_events) && macroEvents.length === 0) {
        macroEvents = stockDaily.macro_events;
      }
      // fallback 날짜 표시를 위해 안내 이벤트 삽입
      if (stockDailyData._fallback_date) {
        macroEvents.unshift({
          keyword: '데이터 안내',
          summary: `최신 분석 데이터 준비 중 — ${stockDailyData._fallback_date} 기준 데이터를 표시합니다.`,
          source_count: 0
        });
      }
    }
  } catch (e) { console.warn('stock-daily merge:', e); }

  // 전일 해석 전파 (stock-*.json try-catch 밖 — 에러 삼킴 방지)
  try {
    const prevPickDates = new Set();
    for (const [name, curr] of interpretedByName) {
      if (curr.prev_pick && curr.prev_pick.date) {
        const chain = curr.causal_chain || [];
        if (chain.length === 0) prevPickDates.add(curr.prev_pick.date);
      }
    }
    for (const prevDate of prevPickDates) {
      const prevData = await loadCalDayData(prevDate);
      if (!prevData.interpretedByName) continue;
      for (const [name, prevInterp] of prevData.interpretedByName) {
        if (!interpretedByName.has(name)) continue;
        const curr = interpretedByName.get(name);
        if ((curr.causal_chain || []).length > 0) continue;
        if ((prevInterp.causal_chain || []).length > 0) {
          // curr를 base로 두고, prev에서 분석성 필드만 보충 (당일 가격/공시/분봉/신용 등 보존)
          const merged = Object.assign({}, curr, {
            causal_chain: prevInterp.causal_chain,
            differentiator: prevInterp.differentiator || curr.differentiator,
            macro_event: prevInterp.macro_event || curr.macro_event,
            news_digest: prevInterp.news_digest || curr.news_digest,
          });
          interpretedByName.set(name, merged);
        }
      }
    }
  } catch (e) { console.warn('prev-day propagation:', e); }
  // data_source: stock JSON에 포함된 소스 태그 (kiwoom / kiwoom_ranking)
  const dataSource = (stockDailyData && stockDailyData.data_source) || 'kiwoom';
  const result = {
    kiwoom,
    cafePosts: postsOfDay,
    narratives: Array.from(narrSet),
    interpretedByName,
    macroEvents,
    dataSource
  };
  calDayCache[date] = result;
  return result;
}

function renderCalExpandContent(date, data) {
  const inner = document.getElementById('cal-content');
  const kiwoomStocks = data.kiwoom ? (data.kiwoom.daily_top || data.kiwoom.latest_stocks || []) : [];
  const hasInterpretedStocks = data.interpretedByName && data.interpretedByName.size > 0;
  const hasAny = (data.narratives.length > 0) || kiwoomStocks.length > 0 || data.cafePosts.length > 0 || hasInterpretedStocks;

  if (!hasAny) {
    const closed = isMarketClosed(date);
    let emptyMsg;
    if (closed) {
      const reason = getHolidayName(date) || '주말';
      const nextDate = getNextTradingDate(date);
      const nextLabel = nextDate ? formatKoDate(nextDate) : '';
      emptyMsg = `
        <div style="text-align:center;padding:32px 0;">
          <div style="font-size:15px;font-weight:700;color:var(--tx2);margin-bottom:6px;">오늘은 장이 쉽니다</div>
          <div style="font-size:12px;color:var(--dm);">${escapeHtml(reason)}${nextLabel ? ' · 다음 거래일: ' + escapeHtml(nextLabel) : ''}</div>
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
    inner.innerHTML = `
      <div class="cal-content-head">
        <div class="cal-content-date">${formatKoDate(date)}</div>
        <div class="cal-content-meta">${closed ? '휴장' : '데이터 없음'}</div>
      </div>
      ${closedMacroHtml}
      ${emptyMsg}
    `;
    return;
  }

  // 특징주 수집 (종목명 → 뉴스카드 매핑 포함)
  const cafeStockMap = new Map(); // name → { stock, newsCards[] }
  for (const p of data.cafePosts) {
    for (const sec of (p.sections || [])) {
      for (const st of (sec.stocks || [])) {
        if (!st.name) continue;
        if (!cafeStockMap.has(st.name)) {
          cafeStockMap.set(st.name, { stock: st, newsCards: [] });
        }
        const entry = cafeStockMap.get(st.name);
        for (const nc of (st.news_cards || [])) entry.newsCards.push(nc);
      }
    }
  }

  // 키움 name → {ticker, change_pct} 맵 (특징주 join용)
  const kiwoomByName = new Map();
  for (const s of kiwoomStocks) {
    if (s && s.name) kiwoomByName.set(s.name, s);
  }

  // interpretedByName을 특징주/종목 구성에서 사용하기 위해 먼저 참조
  const interpByName = data.interpretedByName || new Map();

  // 특징주 결정: 부각 종목 우선, 비면 거래대금 TOP fallback
  let featureSource = 'primary';
  let featureItems = []; // { name, pct, themes, newsCards, ticker, reason }
  if (cafeStockMap.size > 0) {
    for (const [name, e] of cafeStockMap.entries()) {
      const kw = kiwoomByName.get(name);
      const ticker = e.stock.ticker || kw?.ticker;
      const pct = e.stock.change_pct ?? kw?.max_change_pct ?? kw?.change_pct ?? null;
      const themes = (themesData?.stocks?.[ticker]?.themes || []).slice(0, 3);
      // 사유: theme_label 우선, 없으면 news_cards[0].theme_hint
      let reason = (e.stock.theme_label || '').trim();
      if (!reason && e.newsCards.length > 0) {
        reason = (e.newsCards[0].theme_hint || '').trim();
      }
      // URL 중복 제거
      const seenUrl = new Set();
      const links = [];
      for (const nc of e.newsCards) {
        if (!nc.url || seenUrl.has(nc.url)) continue;
        seenUrl.add(nc.url);
        links.push({ url: nc.url, source: nc.source || '' });
      }
      const interp = data.interpretedByName ? data.interpretedByName.get(name) : null;
      featureItems.push({ name, pct, themes, links, ticker, reason, interp });
    }
    // 해석 있는 것 우선 정렬
    featureItems.sort((a, b) => (b.interp ? 1 : 0) - (a.interp ? 1 : 0));
    featureItems = featureItems.slice(0, 14);
  } else if (kiwoomStocks.length > 0) {
    featureSource = 'fallback';
    featureItems = kiwoomStocks.slice(0, 6).map(s => {
      const pct = s.max_change_pct ?? s.change_pct ?? null;
      const themes = (themesData?.stocks?.[s.ticker]?.themes || []).slice(0, 3);
      return { name: s.name, pct, themes, links: [], ticker: s.ticker, reason: '' };
    });
  } else if (interpByName.size > 0) {
    // kiwoom JSON 없음, 카페 없음 → stock-*.json 기반 특징주
    featureSource = 'fallback';
    featureItems = [];
    for (const [name, interp] of interpByName) {
      if (featureItems.length >= 6) break;
      const themes = (interp.themes || []).slice(0, 3).map(t => typeof t === 'string' ? { name: t } : t);
      featureItems.push({ name, pct: interp.change_pct ?? null, themes, links: [], ticker: interp.code || '', reason: '', interp });
    }
  }

  // 오늘의 종목: 거래대금 TOP을 base로, 카페·해석 정보 join
  let todayStocks;
  if (kiwoomStocks.length > 0) {
    todayStocks = kiwoomStocks.map((s, i) => {
      const pct = s.max_change_pct ?? s.change_pct ?? null;
      const interp = interpByName.get(s.name);
      let themes;
      if (interp && Array.isArray(interp.themes) && interp.themes.length > 0) {
        themes = interp.themes.slice(0, 3).map(t => typeof t === 'string' ? { name: t } : t);
      } else {
        themes = (themesData?.stocks?.[s.ticker]?.themes || []).slice(0, 2);
      }
      const cafe = cafeStockMap.get(s.name);
      const links = [];
      const seen = new Set();
      if (cafe) {
        for (const nc of (cafe.newsCards || [])) {
          if (!nc.url || seen.has(nc.url)) continue;
          seen.add(nc.url);
          links.push({ url: nc.url, source: nc.source || '' });
        }
      }
      return { rank: i + 1, name: s.name, ticker: s.ticker, pct, amount: s.max_trade_amount ?? s.trade_amount, themes, interp, links, open: s.open, high: s.high, low: s.low, price: s.last_price ?? s.price };
    });
  } else if (interpByName.size > 0) {
    // kiwoom JSON 없음 → stock-*.json (interpretedByName)에서 종목 구성
    todayStocks = [];
    let idx = 0;
    for (const [name, interp] of interpByName) {
      idx++;
      const cafe = cafeStockMap.get(name);
      const links = [];
      const seen = new Set();
      if (cafe) {
        for (const nc of (cafe.newsCards || [])) {
          if (!nc.url || seen.has(nc.url)) continue;
          seen.add(nc.url);
          links.push({ url: nc.url, source: nc.source || '' });
        }
      }
      let themes = [];
      if (Array.isArray(interp.themes) && interp.themes.length > 0) {
        themes = interp.themes.slice(0, 3).map(t => typeof t === 'string' ? { name: t } : t);
      }
      todayStocks.push({
        rank: interp.rank || idx,
        name,
        ticker: interp.code || interp.ticker || '',
        pct: interp.change_pct ?? null,
        amount: interp.trade_amount ?? null,
        price: interp.close_price ?? null,
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
  const metaText = todayStocks.length > 0
    ? `오늘의 종목 : ${todayStocks.length}개${streakSuffix}${sourceSuffix}`
    : '—';

  // ① 매크로 이벤트 (내러티브 폴백에도 사용)
  const macroEvents = (data.macroEvents || [])
    .filter(m => m.summary && m.summary.length >= 10)
    .slice(0, 5);
  const macroHtml = macroEvents.length > 0
    ? `<div class="cal-macro-strip">${macroEvents.map(m => `<span class="cal-macro-chip" title="${escapeHtml(sanitize(m.title || ''))}">${escapeHtml(sanitize(m.summary))}</span>`).join('')}</div>`
    : '';

  // ② 내러티브: 카페 요약이 있을 때만 표시 (매크로 폴백은 macroHtml 칩과 중복되므로 제거)
  const narrPillsHtml = data.narratives.length > 0
    ? `<div class="cal-narr-stack">${data.narratives.slice(0, 8).map(n => `<span class="cal-narr-pill">${escapeHtml(sanitize(n))}</span>`).join('')}</div>`
    : '';

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
    const dir = (pct ?? 0) >= 0 ? 'up' : 'down';
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

    // 해석 있으면 카드 확장, 없으면 compact 한 줄
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
      const ishikawaLine = (diffRaw && diffRaw !== causalText) ? diffRaw : '';
      const ishikawaHtml = ishikawaLine ? `<div class="cal-ishikawa-line">${escapeHtml(sanitize(ishikawaLine))}</div>` : '';
      // 공시 (DART) — 뱃지는 namecell, 목록은 카드 최하단
      const discs = st.disclosures || [];
      let discBadgeHtml = '';
      let discListHtml = '';
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
          const conditionHtml = d.condition
            ? `<span class="cal-disc-condition">조건: ${escapeHtml(sanitize(d.condition))}${d.regulation_period ? ' — ' + escapeHtml(sanitize(d.regulation_period)) : ''}</span>`
            : '';
          return `<a class="cal-disc-item" href="${escapeHtml(d.url || '#')}" target="_blank" rel="noopener noreferrer"><span class="${catCls}">${escapeHtml(catLabel)}</span><span class="cal-disc-summary">${escapeHtml(d.title)}${periodHtml}${conditionHtml}</span><svg class="cal-disc-ext" width="10" height="10" viewBox="0 0 10 10"><path d="M3 1h6v6M9 1L4 6" stroke="currentColor" stroke-width="1.2" fill="none"/></svg></a>`;
        }).join('');
        const moreHtml = moreCount > 0 ? `<span class="cal-disc-more">+${moreCount}건 더보기</span>` : '';
        const codeId = it.code || it.name;
        const sectionId = `disc-${escapeHtml(codeId)}`;
        discBadgeHtml = `<span class="cal-disc-badge">공시</span>${cbWarn}`;
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
      const pickMeta = (pp && pc >= 2)
        ? `<div class="cal-pick-meta"><div class="cal-disc-item"><span class="cal-disc-cat streak">${pc}연속</span><span class="cal-disc-summary">전일 순위 #${pp.rank} · ${fmtTradeAmount(pp.trade_amount)} · ${(pp.change_pct||0)>=0?'+':''}${(pp.change_pct||0).toFixed(2)}%</span></div></div>`
        : '';
      // 종목명 우측 연속 배지: 2+ → "N연속", 1이면 비표시
      const pickBadge = pc != null && pc >= 2
        ? `<span class="cal-streak-badge">${pc}연속</span>`
        : '';
      const creditBadgeHtml = it.interp?.credit_risk
        ? '<span class="cal-credit-badge">신용불가</span>' : '';
      const creditReasonHtml = (st.credit_risk && st.credit_reason)
        ? `<div class="cal-credit-reason"><div class="cal-disc-item"><span class="cal-disc-cat credit">신용불가</span><span class="cal-disc-summary">${escapeHtml(sanitize(st.credit_reason))}</span></div></div>`
        : '';
      // 종목 상태 뱃지 (투자주의/경고/위험/단기과열)
      const statusBadges = (st.status_badges || []).map(b => {
        const cls = b.severity === 'danger' ? 'cal-status-badge danger'
          : b.severity === 'warning' ? 'cal-status-badge warning'
          : b.severity === 'hot' ? 'cal-status-badge hot'
          : 'cal-status-badge caution';
        return `<span class="${cls}">${escapeHtml(b.label)}</span>`;
      }).join('');

      // 상태 뱃지 상세 사유 (뱃지 아래에 표시)
      const statusDetailHtml = (st.status_badges || []).filter(b => b.summary || b.condition).map(b => {
        const parts = [];
        if (b.start && b.end && b.start !== b.end) {
          parts.push(`<span class="cal-badge-period">${b.start} ~ ${b.end}</span>`);
        } else if (b.start) {
          parts.push(`<span class="cal-badge-period">${b.start}부터</span>`);
        }
        if (b.summary) parts.push(`<span class="cal-badge-summary">${escapeHtml(b.summary)}</span>`);
        if (b.condition) parts.push(`<span class="cal-badge-condition">조건: ${escapeHtml(b.condition)}</span>`);
        if (b.thresholds && b.thresholds.length > 0) {
          const thHtml = b.thresholds.map(t => {
            const icon = t.triggered ? '⚠️' : '✓';
            const cls = t.triggered ? 'cal-threshold triggered' : 'cal-threshold safe';
            return `<div class="${cls}">${icon} ${escapeHtml(t.desc)}: 기준가 ${t.base_price.toLocaleString()}원 → 임계가 ${t.threshold.toLocaleString()}원 (현재 ${t.current.toLocaleString()}원)</div>`;
          }).join('');
          parts.push(thHtml);
        }
        if (b.regulation) parts.push(`<span class="cal-badge-regulation">${escapeHtml(b.regulation)}</span>`);
        return `<div class="cal-status-detail">${parts.join('')}</div>`;
      }).join('');
      const badgesRowHtml = (pickBadge || discBadgeHtml || creditBadgeHtml || statusBadges)
        ? `<div class="cal-feature-badges">${statusBadges}${pickBadge}${discBadgeHtml}${creditBadgeHtml}</div>`
        : '';
      // 테마 칩은 링크 아래 별도 줄
      const sparkHtml = it.interp?.intraday
        ? `<div class="cal-feature-sparkline">${buildSparkline(it.interp.intraday.prices, it.interp.intraday.base ?? it.interp.intraday.open, dir)}</div>`
        : '<div class="cal-feature-sparkline cal-spark-empty"></div>';
      return `
        <div class="cal-feature-card">
          <div class="cal-feature-head">
            <div class="cal-trade-rank">#${it.rank}</div>
            <div class="cal-trade-candle">${candleHtml}</div>
            ${sparkHtml}
            <div class="cal-feature-namecell">
              <span class="cal-feature-name">${escapeHtml(it.name)}</span>
            </div>
          </div>
          <div class="cal-feature-nums">
            <div class="cal-feature-pct ${dir}">${pctText}</div>
            <div class="cal-close-price">${it.price ? it.price.toLocaleString('ko-KR') : ''}</div>
            <div class="cal-trade-amount">${amountText}</div>
          </div>
          ${badgesRowHtml}
          <div class="cal-feature-body">
            ${headlineHtml || ishikawaHtml || causalHtml || linksHtml || discListHtml || themesHtml || pickMeta
              ? `${headlineHtml}${ishikawaHtml}${causalHtml}${linksHtml}${themesHtml ? `<div class="cal-theme-row">${themesHtml}</div>` : ''}${pickMeta}${statusDetailHtml}${discListHtml}${creditReasonHtml}`
              : `<div class="cal-feature-news-empty">뉴스 분석 대기 중</div>`}
          </div>
        </div>`;
    }

    // compact row (해석 없음)
    const cafeLinks = (it.links || []).slice(0, 3).map(l => {
      const label = (() => {
        try { return new URL(l.url).hostname.replace(/^www\./, ''); } catch (e) { return '링크'; }
      })();
      return `<a class="cal-feature-link" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    }).join('');
    const linksHtml = cafeLinks ? `<div class="cal-feature-links" style="margin-top:4px;">${cafeLinks}</div>` : '';
    // compact에도 연속 배지: 2+ → "N연속", 1이면 비표시
    const compactPC = it.interp?.pick_count;
    const compactBadge = compactPC != null && compactPC >= 2
      ? `<span class="cal-streak-badge">${compactPC}연속</span>`
      : '';
    return `
      <div class="cal-trade-row">
        <div class="cal-trade-rank">#${it.rank}</div>
        <div class="cal-trade-name-cell">
          <span class="cal-trade-name">${escapeHtml(it.name)}</span>
          ${compactBadge}
          ${linksHtml}
        </div>
        <div class="cal-trade-amount">${amountText}</div>
        <div class="cal-close-price">${it.price ? it.price.toLocaleString('ko-KR') : ''}</div>
        <div class="cal-trade-pct ${dir}">${pctText}</div>
        <div class="cal-trade-candle">${candleHtml}</div>
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
        <div class="cal-empty" style="padding:24px 0;">${isMarketClosed(date) ? (() => { const r = getHolidayName(date) || '주말'; const nd = getNextTradingDate(date); return '오늘은 장이 쉽니다 (' + r + ')' + (nd ? ' · 다음 거래일: ' + formatKoDate(nd) : ''); })() : '조건검색 데이터 없음 — 장 마감 후 또는 파이프라인 실행 후 업데이트'}</div>
      `}
    </div>
  `;

  inner.innerHTML = `
    <div class="cal-content-head">
      <div class="cal-content-date">${formatKoDate(date)}</div>
      <div class="cal-content-meta">${metaText}</div>
    </div>
    ${todayHtml}
  `;
}

async function initCalendar() {
  const meta = document.getElementById('meta');
  if (meta) meta.textContent = '';
  const [calIdx, themes, holidays] = await Promise.all([loadCalendarIndex(), loadThemes(), loadHolidayData()]);
  calIndex = calIdx;
  themesData = themes;
  holidayData = holidays;
  const now = new Date();
  const todayStr = ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());
  // URL ?cat= / ?date= 파라미터. cat 기본값 stock.
  const urlParams = new URLSearchParams(window.location.search);
  const urlCat = urlParams.get('cat');
  if (urlCat && ['stock', 'realestate', 'policy'].includes(urlCat)) calCategory = urlCat;
  const urlDate = urlParams.get('date');
  // 해시 앵커(#2026-04-10) 지원 — news/YYYY-MM-DD.html에서 리다이렉트
  const hashDate = window.location.hash.replace('#', '');
  const hasUrlDate = (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate))
    || (hashDate && /^\d{4}-\d{2}-\d{2}$/.test(hashDate));
  let initialDate = hasUrlDate ? (urlDate || hashDate) : todayStr;
  // URL 날짜가 없고, 오늘 데이터도 없으면 최근 수집일로 폴백
  if (!hasUrlDate && !calHasData(todayStr) && calIndex && calIndex.days) {
    const collectedDays = Object.keys(calIndex.days)
      .filter(d => d <= todayStr)
      .sort();
    if (collectedDays.length > 0) {
      initialDate = collectedDays[collectedDays.length - 1];
    }
  }
  const [iy, im] = initialDate.split('-').map(Number);
  calViewYear = iy;
  calViewMonth = im;
  calSelectedDate = initialDate;
  renderCalendar();
  onCalCellClick(initialDate, false); // 초기 로드 시 pushState 안 함

  // 브라우저 뒤로/앞으로 지원
  window.addEventListener('popstate', () => {
    const p = new URLSearchParams(window.location.search);
    const d = p.get('date');
    const h = window.location.hash.replace('#', '');
    const date = d || (h && /^\d{4}-\d{2}-\d{2}$/.test(h) ? h : null);
    const c = p.get('cat');
    if (c && ['stock', 'realestate', 'policy'].includes(c)) calCategory = c;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) onCalCellClick(date, false);
  });

  document.getElementById('toss-cal-prev').addEventListener('click', () => {
    calViewMonth--;
    if (calViewMonth < 1) { calViewMonth = 12; calViewYear--; }
    renderCalendar();
  });
  document.getElementById('toss-cal-next').addEventListener('click', () => {
    const now2 = new Date();
    if (calViewYear > now2.getFullYear() ||
        (calViewYear === now2.getFullYear() && calViewMonth >= now2.getMonth() + 1)) return;
    calViewMonth++;
    if (calViewMonth > 12) { calViewMonth = 1; calViewYear++; }
    renderCalendar();
  });
}

initCalendar();

function miniCandle(open, high, low, close, changePct) {
  if (!close) return '';
  const W = 12, H = 24;
  const hasOHLC = open && high && low;
  // OHLC 없으면 pct 기반 단순 바 (심지 없음, 높이=pct 비례)
  if (!hasOHLC) {
    if (changePct == null) return '';
    const isUp = changePct >= 0;
    const color = isUp ? '#E03131' : '#1971C2';
    // 등락률 절대값에 비례: 1%=2px, 30%=24px (최대), 최소 3px
    const bodyH = Math.max(3, Math.min(H, Math.abs(changePct) * 0.8));
    const bodyTop = isUp ? (H - bodyH) : 0;
    return '<svg width="'+W+'" height="'+H+'" style="vertical-align:middle">' +
      '<rect x="2" y="'+bodyTop+'" width="8" height="'+bodyH+'" fill="'+color+'" rx="1"/></svg>';
  }
  // 색상은 등락률(전일대비) 기준으로 통일. 스파크라인·등락률 숫자와 일관.
  const isUp = (changePct != null) ? (changePct >= 0) : (close >= open);
  const color = isUp ? '#E03131' : '#1971C2';
  const range = high - low;
  if (range === 0) return '<svg width="'+W+'" height="'+H+'"><line x1="6" y1="0" x2="6" y2="'+H+'" stroke="#8B95A8" stroke-width="1"/></svg>';
  const scale = H / range;
  const wickTop = 0;
  const wickBot = H;
  const bodyTop = (high - Math.max(open, close)) * scale;
  const bodyBot = (high - Math.min(open, close)) * scale;
  const bodyH = Math.max(bodyBot - bodyTop, 1);
  return '<svg width="'+W+'" height="'+H+'" style="vertical-align:middle">' +
    '<line x1="6" y1="'+wickTop+'" x2="6" y2="'+wickBot+'" stroke="'+color+'" stroke-width="1"/>' +
    '<rect x="2" y="'+bodyTop+'" width="8" height="'+bodyH+'" fill="'+color+'" rx="1"/>' +
    '</svg>';
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
      container.innerHTML = `
        <div class="theme-trend-header">
          <div class="theme-trend-title">테마 트렌드</div>
          <div class="theme-trend-sub">최근 거래대금 흐름</div>
        </div>
        <div class="cal-empty" style="padding:24px 0;">테마 트렌드 데이터가 없습니다</div>`;
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

    // ── 횡스크롤 초기화 ──
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

    // ── 레전드 토글 (단일 선택) ──
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

    // ── 포인트 클릭 → 종목 테이블 ──
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

    // ── 툴팁 + 클릭 ──
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
initThemeTrend();

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
initThemeMap();

// ───── 테마 트리 (Indented Tree + Inline Bar) ─────
// 글로벌 캐시: theme-tree.json (계층 구조 참조용)
let _themeTreeCache = null;
async function initThemeTree(dateOverride) {
  try {
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
initThemeTree();
