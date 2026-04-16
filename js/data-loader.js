/* ───── data-loader.js — 데이터 fetch/캐시 ───── */

let themesData = null;
let _themeTreeCache = null;

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

async function loadCalDayData(date) {
  if (calDayCache[date]) return calDayCache[date];
  // kiwoom + stock-daily를 병렬 fetch (카페 인덱스는 stock-daily 없을 때만)
  const dateHash = date.replace(/-/g, '');
  const [kiwoom, stockDailyDirect] = await Promise.all([
    loadKiwoomDate(date),
    fetch(`/data/interpreted/${calCategory}-${date}.json?v=${dateHash}`).then(r => r.ok ? r.json() : null).catch(() => null)
  ]);
  let stockDailyData = stockDailyDirect;
  // 당일 데이터 없으면 최근 7일 이내 이전 날짜 fallback (병렬)
  if (!stockDailyData) {
    const d = new Date(date + 'T00:00:00');
    const fallbackFetches = [];
    for (let i = 1; i <= 7; i++) {
      const prev = new Date(d);
      prev.setDate(prev.getDate() - i);
      const prevStr = prev.toISOString().slice(0, 10);
      const prevHash = prevStr.replace(/-/g, '');
      fallbackFetches.push(
        fetch(`/data/interpreted/${calCategory}-${prevStr}.json?v=${prevHash}`)
          .then(r => r.ok ? r.json().then(j => ({ date: prevStr, data: j })) : null)
          .catch(() => null)
      );
    }
    const results = (await Promise.all(fallbackFetches)).filter(Boolean);
    if (results.length > 0) {
      stockDailyData = results[0].data;
      stockDailyData._fallback_date = results[0].date;
    }
  }
  // 카페 포스트: stock-daily 있으면 스킵 (뉴스 파이프라인이 대체)
  let postsOfDay = [];
  if (!stockDailyData) {
    const cafeIndex = await loadIndex();
    if (cafeIndex && cafeIndex.posts) {
      const idsOfDay = cafeIndex.posts
        .filter(p => {
          const d = p.post_date || (p.fetched_at || '').slice(0, 10);
          return d === date;
        })
        .map(p => p.post_id)
        .slice(0, 3);
      postsOfDay = (await Promise.all(idsOfDay.map(id => loadPost(id)))).filter(Boolean);
    }
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
            .filter(n => !(n.newzy_verdict || '').startsWith('반대'))  // 이시카와 판정 컬럼 (legacy: newzy_verdict)
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
      // 전일 해석 전파: 캐시 우선, 없으면 stock JSON만 직접 fetch (재귀 방지)
      let prevData = calDayCache[prevDate];
      if (!prevData) {
        const prevHash = prevDate.replace(/-/g, '');
        const prevStock = await fetch(`/data/interpreted/${calCategory}-${prevDate}.json?v=${prevHash}`).then(r => r.ok ? r.json() : null).catch(() => null);
        if (prevStock) {
          const prevMap = new Map();
          for (const st of (prevStock.stocks || [])) {
            if (!st.name) continue;
            const chainNews = (st.news || []).find(n => n.causal_chain) || null;
            prevMap.set(st.name, {
              causal_chain: chainNews ? [chainNews.causal_chain] : [],
              differentiator: chainNews ? chainNews.causal_chain : '',
              macro_event: (st.news || [])[0]?.macro_event || null,
              news_digest: (st.news || []).map(n => ({ url: n.url, inferred_title: n.title, source: n.source })),
            });
          }
          prevData = { interpretedByName: prevMap };
        }
      }
      if (!prevData || !prevData.interpretedByName) continue;
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
  _persistCache();
  return result;
}
