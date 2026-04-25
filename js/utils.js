/* ───── utils.js — 의존성 없는 순수 함수 ───── */

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

// 내부 에이전트 이름·고유명을 사용자 화면에서 제거 (상품 톤 유지)
function sanitize(s) {
  if (s == null) return '';
  return String(s)
    .replace(/박성진\s*매매\s*가치관(?:상)?/g, '내부 거래 기준')
    .replace(/박성진\s*(?:스타일|매매스타일)/g, '내부 거래 스타일')
    .replace(/박성진/g, '내부 기준')
    // legacy: DB에 남은 과거 텍스트 방어 — 토구사(legacy: 주주), 이시카와(legacy: 뉴지) 잔재 제거
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

function pad2(n) { return String(n).padStart(2, '0'); }
function ymd(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }

/* ───── DSN-20260425-DSN-002 v8 — 시제 분리 분기 함수 5종 ─────
   §6.2 + §10 placeholder + 인계 prompt §3·§4·§5.1.
   SP_STAGES = ['단기과열'] (togusa B-5 critical_review). 명세 §10 잠정값(투자위험 등) 대비 prompt 우선.
   reason: 시장감시규정 §5의2 단기과열완화제도가 단일가매매 자동 적용 단계. 투자위험은 거래정지 1일+신용제한이며 단일가매매 자동 적용 아님.
*/
const DSN_V8_SP_STAGES = ['단기과열'];

function dsnV8StripStageLabel(label) {
  if (!label) return '';
  return String(label)
    .replace(/\s*예고\s*/g, '')
    .replace(/\s*예상\s*/g, '')
    .replace(/\s*근접\s*/g, '')
    .replace(/[\[\]\(\)]/g, ' ')
    .trim();
}

function dsnV8GetTenseChip(badge) {
  // 시제 칩 4종 분기 (B-12 — design v8.1 사후 갱신).
  //   predicted source            → [예측 진입]
  //   label에 "예고" 포함            → [지정 예고]   (KRX 공식 예고 단계)
  //   "예고" 미포함 + view_date<start → [지정 예정]   (공시 확정 + 시작일 미도래)
  //   그 외                       → [지정 중]
  const label = badge.label || '';
  const isPredicted = (badge.source === 'predicted')
    || label.includes('예상')
    || label.includes('근접');
  if (isPredicted) {
    return { text: '예측 진입', cls: 'dsn-v8-tense-chip--predicted' };
  }
  if (label.includes('예고')) {
    return { text: '지정 예고', cls: 'dsn-v8-tense-chip--disclosure' };
  }
  if (badge.view_date && badge.start && badge.view_date < badge.start) {
    return { text: '지정 예정', cls: 'dsn-v8-tense-chip--disclosure' };
  }
  return { text: '지정 중', cls: 'dsn-v8-tense-chip--disclosure' };
}

function dsnV8GetSinglePriceStatus(badge, currentDate) {
  // §4.3 + §5.1 — SP_STAGES = ['단기과열'] (togusa B-5 critical_review).
  // §5.1 줄 3 의무: 단일가 라인 항상 1줄 노출 (null 금지). predicted/sp=null/start=null 모두 명시 fallback.
  // B-11 시정: predicted에 대해 null 리턴 → 호출부 if 가드로 라인 누락. 4/13 217590 케이스 회귀.
  const label = badge.label || '';
  const isPredicted = (badge.source === 'predicted')
    || label.includes('예상') || label.includes('근접');
  // start/end 부재 → "해당 없음 (이 단계 미적용)" (B-4 가드, predicted/disclosure 공통)
  if (!badge.start || !badge.end) return '해당 없음 (이 단계 미적용)';
  const stripped = dsnV8StripStageLabel(label);
  const stageHasSP = DSN_V8_SP_STAGES.some(s => stripped.includes(s));
  if (!stageHasSP) return '해당 없음 (이 단계 미적용)';
  const today = currentDate || (badge.view_date || new Date().toISOString().slice(0, 10));
  // predicted: KRX 공식 지정 전 → "적용 중" 불가. start 미만이면 "적용 예정 (지정 시)", 그 외 "해당 없음".
  if (isPredicted) {
    if (today < badge.start) return '적용 예정 (지정 시)';
    return '해당 없음';
  }
  // disclosure
  if (badge.single_price === true && today >= badge.start && today <= badge.end) {
    return '적용 중';
  }
  if (today < badge.start) return '적용 예정 (지정 시)';
  return '해당 없음';
}

function dsnV8GetScheduleLines(badge) {
  // §4.2 source별 일정 라벨. start/end null 시 "미정 (조건 충족 시 발효)" fallback
  const isPredicted = (badge.source === 'predicted')
    || (badge.label || '').includes('예상')
    || (badge.label || '').includes('근접');
  const isNotice = (badge.label || '').includes('예고');
  let startLabel, endLabel;
  if (isPredicted) {
    startLabel = '예측 발효일'; endLabel = '예측 종료일';
  } else if (isNotice) {
    startLabel = '예고일'; endLabel = '지정 예정';
  } else {
    startLabel = '지정일'; endLabel = '해제 예정';
  }
  const start = badge.start;
  const end = badge.end;
  // 인계 prompt §3 — predicted start/end null fallback
  const startValue = start || '미정 (조건 충족 시 발효)';
  const endValue = end || '미정 (조건 충족 시 발효)';
  return {
    start: { label: startLabel, value: startValue },
    end: { label: endLabel, value: endValue },
  };
}

function dsnV8GetConfidenceLine(badge) {
  // predicted only. confidence null/undefined → "신뢰도: 미상 (추정)"
  const isPredicted = (badge.source === 'predicted')
    || (badge.label || '').includes('예상')
    || (badge.label || '').includes('근접');
  if (!isPredicted) return null;
  const conf = badge.confidence;
  if (conf == null || conf === '') return '미상 (추정)';
  return String(conf);
}

function dsnV8FormatThresholds(thresholds, label, badgeContext) {
  // §6.2 formatThresholds + 0/0 fallback (§3 D3 표제 의무)
  // v9 §B: badgeContext.thresholds 전달 시 base_price=null(지수 ratio) 항목은 raw 분자/분모 표기로 치환.
  const arr = Array.isArray(thresholds) ? thresholds : [];
  const total = arr.length;
  const triggered = arr.filter(t => t && t.triggered).length;
  const stripped = dsnV8StripStageLabel(label || '');
  const titleStage = stripped || (label || '진입');
  if (total === 0) {
    return `<div class="dsn-v8-thresholds">
      <div class="dsn-v8-thresholds__title">🎯 ${escapeHtml(titleStage)}에 진입하는 조건 (0/0 충족)</div>
      <div class="dsn-v8-thresholds__empty">(자동 평가 없음) — 지정 사유는 사유 박스 참조</div>
    </div>`;
  }
  const _detectUnit = (t) => {
    const d = (t && t.desc) || '';
    if (/배\s*(이상|이하|↑|↓)?/.test(d) || /비율|ratio/i.test(d)) return '배';
    if (t && t.base_price == null) return '';
    return '원';
  };
  const items = arr.map(t => {
    const cls = t.triggered ? 'dsn-v8-thresholds__item dsn-v8-thresholds__item--triggered'
      : 'dsn-v8-thresholds__item dsn-v8-thresholds__item--unmet';
    // v9 §B: 지수 ratio raw 표기 우선
    const v9Raw = (typeof getRawExplanation === 'function') ? getRawExplanation(t, badgeContext) : '';
    if (v9Raw) {
      return `<li class="${cls}">${escapeHtml(v9Raw)}</li>`;
    }
    const desc = t.desc || '';
    const unit = _detectUnit(t);
    const fmt = (v) => unit === '배'
      ? Number(v).toFixed(2) + '배'
      : (unit ? Number(v).toLocaleString() + unit : Number(v).toLocaleString());
    const cur = (t.current != null) ? fmt(t.current) : '';
    const thr = (t.threshold != null) ? fmt(t.threshold) : '';
    const bodyParts = [desc];
    if (cur && thr) bodyParts.push(`${cur} ${t.triggered ? '≥' : '<'} ${thr}`);
    else if (thr) bodyParts.push(`임계 ${thr}`);
    return `<li class="${cls}">${escapeHtml(bodyParts.join(' — '))}</li>`;
  }).join('');
  return `<div class="dsn-v8-thresholds">
    <div class="dsn-v8-thresholds__title">🎯 ${escapeHtml(titleStage)}에 진입하는 조건 (${triggered}/${total} 충족)</div>
    <ul class="dsn-v8-thresholds__list">${items}</ul>
  </div>`;
}

function dsnV8RenderBlock(badge, ctx) {
  // §3·§5.1 — 단일 배지 1블록. 5줄 요약 + 🎯 thresholds + 통합 펼침
  // v9.1 §B: predicted 칩은 imminent/predicted 분기 (strict 3 AND 조건). ctx.allBadges 인접 검증 필수.
  const viewDateForChip = (ctx && ctx.currentDate) || badge.view_date || '';
  const allBadgesForChip = (ctx && ctx.allBadges) || null;
  const tenseChipHtml = (typeof renderTenseChip === 'function')
    ? renderTenseChip(badge, viewDateForChip, allBadgesForChip)
    : null;
  const tense = dsnV8GetTenseChip(badge);
  const isPredicted = (badge.source === 'predicted')
    || (badge.label || '').includes('예상')
    || (badge.label || '').includes('근접');
  const blockCls = isPredicted ? 'dsn-v8-block dsn-v8-block--predicted' : 'dsn-v8-block dsn-v8-block--disclosure';
  const sched = dsnV8GetScheduleLines(badge);
  const spStatus = dsnV8GetSinglePriceStatus(badge, ctx && ctx.currentDate);
  const label = badge.label || '';
  const sourceNote = isPredicted ? '<span class="dsn-v8-block__source-note">(KRX 미공식 · 자체 추정)</span>' : '';

  // 5줄 요약
  const summaryRows = [];
  summaryRows.push(`<div class="dsn-v8-summary__label">● ${escapeHtml(sched.start.label)}</div><div class="dsn-v8-summary__value">${escapeHtml(sched.start.value)}</div>`);
  summaryRows.push(`<div class="dsn-v8-summary__label">● ${escapeHtml(sched.end.label)}</div><div class="dsn-v8-summary__value">${escapeHtml(sched.end.value)}</div>`);
  if (spStatus) {
    summaryRows.push(`<div class="dsn-v8-summary__label">● 단일가 매매</div><div class="dsn-v8-summary__value">${escapeHtml(spStatus)}</div>`);
  }
  // 4번째 줄: 공시=사유 / 예측=신뢰도
  if (isPredicted) {
    const conf = dsnV8GetConfidenceLine(badge);
    if (conf) summaryRows.push(`<div class="dsn-v8-summary__label">● 신뢰도</div><div class="dsn-v8-summary__value">${escapeHtml(conf)}</div>`);
  } else {
    const reasonRaw = badge.reason_text;
    const placeholders = ['공시 원문 참조', '-', '–', '—', 'null', 'N/A', 'n/a', '없음', ''];
    const reasonStr = reasonRaw ? String(reasonRaw).trim() : '';
    if (reasonStr && !placeholders.includes(reasonStr)) {
      // 80자 이내 1줄 클램프 (5줄 요약 §5.1 정책)
      const oneLine = reasonStr.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
      summaryRows.push(`<div class="dsn-v8-summary__reason">📋 사유 — ${escapeHtml(oneLine)}</div>`);
    }
  }

  // 🎯 thresholds (v9 §B: badge context 전달로 지수 ratio raw 표기 분기)
  const thresholdsHtml = dsnV8FormatThresholds(badge.thresholds || [], label, badge);

  // 추정 경고 배너 (predicted + (pending|low|미상))
  let warningBannerHtml = '';
  const regConf = badge.regulation_source_confidence || '';
  const showBanner = isPredicted && (regConf === 'pending' || regConf === 'low' || !regConf);
  if (showBanner) {
    warningBannerHtml = `<div class="dsn-v8-warning-banner">⚠ 추정 라벨 — KRX 공식 지정이 아닙니다. 규정 검증 진행 중.</div>`;
  }

  // 통합 펼침 (definition / regulation / source)
  const stripped = dsnV8StripStageLabel(label);
  const summaryToggleText = isPredicted
    ? `${stripped}란 / 적용 예정 제한 / 산출 근거 ▾`
    : `${stripped}란 / 규정 상세 / 공시 원문 ▾`;
  const ctxDart = (ctx && ctx.dartUrl) || '';
  const sourceBlockHtml = isPredicted
    ? `<div class="dsn-v8-extra__source"><p>산출 근거: 공개 종가 + KRX 임계 산술 · 신뢰도 ${escapeHtml(dsnV8GetConfidenceLine(badge) || '미상')}</p></div>`
    : (ctxDart ? `<div class="dsn-v8-extra__source"><a href="${escapeHtml(ctxDart)}" target="_blank" rel="noopener noreferrer">공시 원문 보기 (DART) →</a></div>` : '');
  const definitionText = (ctx && ctx.stageDefinition) || '';
  const regulationText = (ctx && ctx.regulationDetail) || '';
  const definitionHtml = definitionText
    ? `<div class="dsn-v8-extra__definition"><h5>${escapeHtml(stripped)}이란</h5><p>${escapeHtml(definitionText)}</p></div>`
    : '';
  const regulationHtml = regulationText
    ? `<div class="dsn-v8-extra__regulation"><h5>${isPredicted ? '적용 예정' : '지정 시'} 적용되는 제한</h5><p>${escapeHtml(regulationText)}</p></div>`
    : '';
  const extraHtml = (definitionHtml || regulationHtml || sourceBlockHtml)
    ? `<details class="dsn-v8-extra"><summary>${escapeHtml(summaryToggleText)}</summary>${definitionHtml}${regulationHtml}${sourceBlockHtml}</details>`
    : '';

  // v9.1: tenseChipHtml 우선 사용 — predicted 케이스 imminent 분기 포함
  const chipHtml = tenseChipHtml
    || `<span class="dsn-v8-tense-chip ${tense.cls}">[${escapeHtml(tense.text)}]</span>`;
  return `<div class="${blockCls}">
    <div class="dsn-v8-block__header">
      ${chipHtml}
      <span class="dsn-v8-block__label">${escapeHtml(label)}</span>
      ${sourceNote}
    </div>
    <div class="dsn-v8-summary">${summaryRows.join('')}</div>
    ${thresholdsHtml}
    ${warningBannerHtml}
    ${extraHtml}
  </div>`;
}

// 복수 배지 시제 순서 정렬 (현재 → 예측). source !== 'predicted'를 앞으로.
function dsnV8SortBadges(badges) {
  return [...badges].sort((a, b) => {
    const ap = (a.source === 'predicted') ? 1 : 0;
    const bp = (b.source === 'predicted') ? 1 : 0;
    return ap - bp;
  });
}

/* ───── DSN-20260425-DSN-003 v9 — 단계 플로우 그래프 + raw 신뢰 표기 + 현재 상태 1줄 + 인과 라인 ─────
   §A·§B·§C·§D + §6.1 BEM + §6.2 함수 시그니처 5종.
   togusa C-1 매트릭스(rules/krx-stage-flow.json) 기반 placeholder. 사후 외부화 가능.
*/
const KRX_MAIN_TRACK = ['투자주의', '투자경고 예고', '투자경고', '투자위험 예고', '투자위험', '매매거래정지'];
const KRX_SHORT_TERM_TRACK = ['단기과열 예고', '단기과열'];

function dsnV9MatchStageIndex(track, badgeLabel) {
  // 배지 라벨을 트랙 노드와 매칭. 정확 일치 우선, 그 다음 prefix 매칭.
  // "투자위험 근접" predicted_shadow → "투자위험 예고" 노드에 매핑 (krx-stage-flow.json predicted_track 정의).
  if (!badgeLabel) return -1;
  // 정확 일치
  let idx = track.findIndex(label => label === badgeLabel);
  if (idx !== -1) return idx;
  // predicted_shadow 매핑: "X 근접" → KRX 공식 "X 예고" 노드
  if (badgeLabel.endsWith('근접')) {
    const stripped = badgeLabel.replace(/\s*근접\s*$/, '').trim();
    // "투자위험 근접" → "투자위험 예고"
    idx = track.findIndex(label => label === `${stripped} 예고`);
    if (idx !== -1) return idx;
    // "투자주의 근접" → "투자주의" (1단계는 예고 부재)
    idx = track.findIndex(label => label === stripped);
    if (idx !== -1) return idx;
  }
  // prefix
  return track.findIndex(label => badgeLabel.startsWith(label));
}

function getStageFlow(badges, viewDate) {
  // 노드 상태 매트릭스 산출. {trackMain, trackShortTerm} 각 NodeState[].
  // NodeState = {label, state: 'unvisited'|'current'|'predicted', causalFrom?: boolean}
  const trackMain = KRX_MAIN_TRACK.map(label => ({ label, state: 'unvisited' }));
  const trackShortTerm = KRX_SHORT_TERM_TRACK.map(label => ({ label, state: 'unvisited' }));
  if (!Array.isArray(badges) || badges.length === 0) {
    return { trackMain, trackShortTerm };
  }

  const hasPredictedBadge = badges.some(b =>
    (b.source === 'predicted')
    || (b.label || '').includes('근접')
    || (b.label || '').includes('예상')
  );

  for (const badge of badges) {
    const label = badge.label || '';
    const isShortTerm = label.includes('단기과열');
    const target = isShortTerm ? trackShortTerm : trackMain;
    const trackArr = isShortTerm ? KRX_SHORT_TERM_TRACK : KRX_MAIN_TRACK;
    const idx = dsnV9MatchStageIndex(trackArr, label);
    if (idx === -1) continue;
    const isPredicted = (badge.source === 'predicted')
      || label.includes('근접')
      || label.includes('예상');
    if (isPredicted) {
      // current가 이미 있으면 덮어쓰지 않음 (공시 우선)
      if (target[idx].state !== 'current') {
        target[idx].state = 'predicted';
      }
    } else {
      target[idx].state = 'current';
      if (hasPredictedBadge && badges.length > 1) {
        target[idx].causalFrom = true;
      }
    }
  }
  return { trackMain, trackShortTerm };
}

function dsnV9FormatMD(dateStr) {
  // YYYY-MM-DD → M/D
  if (!dateStr) return '';
  const m = String(dateStr).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return dateStr;
  return `${parseInt(m[2], 10)}/${parseInt(m[3], 10)}`;
}

function getCurrentStateSummary(badges, viewDate) {
  // §C 카드 펼침 영역 1줄 헤더. 시제 3택 (미지정/기간/예고 중).
  // v9.1 §C.3: "지정 중" → "기간". label 정제 X (예: "투자경고 예고 기간" 그대로).
  if (!Array.isArray(badges) || badges.length === 0) return '';
  // 공시 우선
  const disclosure = badges.find(b =>
    b.source !== 'predicted'
    && !(b.label || '').includes('근접')
    && !(b.label || '').includes('예상')
  );
  const predicted = badges.find(b =>
    (b.source === 'predicted')
    || (b.label || '').includes('근접')
    || (b.label || '').includes('예상')
  );
  const primary = disclosure || predicted;
  if (!primary) return '';

  const today = viewDate || primary.view_date || new Date().toISOString().slice(0, 10);
  const start = primary.start || '';
  const end = primary.end || '';
  const label = primary.label || '';

  const isPredictedPrimary = primary === predicted && !disclosure;
  if (isPredictedPrimary) {
    return `📍 현재 = ${escapeHtml(label)} 진입 예측 (자체 추정 · KRX 미공식)`;
  }
  // disclosure
  if (start && today < start) {
    return `📍 현재 = ${escapeHtml(label)} (공시 발효 ${escapeHtml(dsnV9FormatMD(start))}, 미지정 상태)`;
  }
  if (start && end && today >= start && today <= end) {
    // v9.1: label 정제 X — "투자경고 예고 기간"으로 그대로 노출 (예고 단계 명시 보존)
    return `📍 현재 = ${escapeHtml(label)} 기간 (${escapeHtml(dsnV9FormatMD(start))}~${escapeHtml(dsnV9FormatMD(end))})`;
  }
  return `📍 현재 = ${escapeHtml(label)}`;
}

/* ───── DSN-20260425-DSN-004 v9.1 — 시제 칩 5번째 [내일 가능] + 법무 푸터 ─────
   §B 시제 칩 분기 (predicted source 시간차 기반 imminent 분기).
   §E "내일" 산출 — build_daily.py status_badges.next_trading_day_for_predicted 신뢰. renderer 재산출 X.
   §G CSS BEM dsn-v9-tense-chip--imminent.
   §D 법무 푸터 1줄 (펼침 영역 최하단).
*/

function formatYMD(date) {
  // Date → YYYY-MM-DD
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getNextTradingDay(dateStr) {
  // §E.4 renderer 측 안전망. 우선순위: build_daily.py 산출 next_trading_day_for_predicted 신뢰.
  // 본 함수는 view_date+1 거래일 비교용(getPredictedTenseVariant 내부) 또는 build_daily 미산출 케이스 폴백.
  // 이시카와 P0 — 연 경계 가드: holidays.json은 2026 단년. 2027+ view_date 산출 시 캘린더+1 폴백 + warn (FLR-20260425).
  // KOREA_HOLIDAYS estimated 등급 hit 시 console.warn 1회 (FLR-20260423-FLR-002 verified 절차).
  if (!dateStr) return '';
  const holidaysData = (typeof window !== 'undefined' && window.KOREA_HOLIDAYS) || null;
  const holidaysYear = holidaysData && holidaysData.year ? Number(holidaysData.year) : null;
  const holidaysSet = holidaysData && holidaysData.holidays ? new Set(Object.keys(holidaysData.holidays)) : null;
  const marketClosedSet = holidaysData && holidaysData.market_closed ? new Set(Object.keys(holidaysData.market_closed)) : null;
  const isEstimated = holidaysData && holidaysData.verification_status === 'estimated';

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  let next = new Date(date);
  let safety = 14;
  while (safety-- > 0) {
    next.setDate(next.getDate() + 1);
    const nextYear = next.getFullYear();
    // 이시카와 P0 연 경계 가드 — holidays.json 데이터 연도 초과 시 캘린더+1 폴백 (주말만 스킵)
    if (holidaysYear && nextYear > holidaysYear) {
      if (typeof console !== 'undefined') {
        console.warn(`[DSN-v9.1] getNextTradingDay: ${nextYear}+ holidays data missing (loaded year ${holidaysYear}), fallback to calendar+1 weekday only (FLR-20260425). build_daily.py 산출 신뢰 권고.`);
      }
      const dowFb = next.getDay();
      if (dowFb === 0 || dowFb === 6) continue;
      return formatYMD(next);
    }
    const dow = next.getDay();
    if (dow === 0 || dow === 6) continue;
    const ymd = formatYMD(next);
    if (holidaysSet && holidaysSet.has(ymd)) {
      if (isEstimated && typeof console !== 'undefined') {
        console.warn(`[DSN-v9.1] getNextTradingDay: holidays.json estimated grade hit (${ymd}). build_daily.py 산출 신뢰 권고.`);
      }
      continue;
    }
    if (marketClosedSet && marketClosedSet.has(ymd)) {
      if (isEstimated && typeof console !== 'undefined') {
        console.warn(`[DSN-v9.1] getNextTradingDay: holidays.json estimated grade hit (${ymd}). build_daily.py 산출 신뢰 권고.`);
      }
      continue;
    }
    return ymd;
  }
  return '';
}

// v9.1 strict 룰 — KRX_MAIN_TRACK 인접 단계 검증용.
// 인용: rules/krx-stage-flow.json#flow.stages[].predicted_shadow.flow_node + $027360_4_24_mapping.
// 4/24 027360 케이스: disclosure="투자경고 예고"(stages[1]) + predicted="투자위험 근접"(stages[3] predicted_shadow) → 단계 도약(차이 2) → [예측 진입] 폴백.
const KRX_MAIN_TRACK_LABELS_FOR_STRICT = ['투자주의', '투자경고 예고', '투자경고', '투자위험 예고', '투자위험', '매매거래정지'];

function matchMainTrackStep(label) {
  // togusa C-1 매트릭스 — KRX_MAIN_TRACK 인덱스 산출. predicted "X 근접"은 KRX 공식 "X 예고"(또는 1단계 자체)로 매핑.
  // 인용: rules/krx-stage-flow.json#flow.stages[].predicted_shadow.flow_node ("stages[N] (label) 노드의 'predicted_shadow'").
  if (!label) return -1;
  let idx = KRX_MAIN_TRACK_LABELS_FOR_STRICT.findIndex(l => l === label);
  if (idx !== -1) return idx;
  if (label.endsWith('근접')) {
    const stripped = label.replace(/\s*근접\s*$/, '').trim();
    idx = KRX_MAIN_TRACK_LABELS_FOR_STRICT.findIndex(l => l === `${stripped} 예고`);
    if (idx !== -1) return idx;
    idx = KRX_MAIN_TRACK_LABELS_FOR_STRICT.findIndex(l => l === stripped);
    if (idx !== -1) return idx;
  }
  return -1;
}

function getCurrentStageIndex(badges) {
  // current = disclosure source 중 KRX_MAIN_TRACK 최대 인덱스 (predicted 제외).
  if (!Array.isArray(badges) || badges.length === 0) return -1;
  let maxIdx = -1;
  for (const b of badges) {
    if (!b) continue;
    const isPredicted = (b.source === 'predicted')
      || (b.label || '').includes('근접')
      || (b.label || '').includes('예상');
    if (isPredicted) continue;
    const idx = matchMainTrackStep(b.label || '');
    if (idx > maxIdx) maxIdx = idx;
  }
  return maxIdx;
}

function getPredictedTenseVariant(badge, viewDate, allBadges) {
  // §B.2 predicted 배지 시제 칩 분기 — 'imminent' (D+1 거래일 특정) vs 'predicted' (일자 미특정).
  // togusa strict 3 AND 조건 모두 충족 시에만 'imminent':
  //   1) badge.source === 'predicted'
  //   2) predicted_shadow.flow_node === current_stage_index + 1 (KRX_MAIN_TRACK 인접)
  //   3) badge.next_trading_day_for_predicted == view_date+1 거래일
  // 인용: rules/krx-stage-flow.json $027360_4_24_mapping ("stages[1] disclosure + stages[3] predicted_shadow = 단계 도약 → [예측 진입] 폴백").
  if (!badge || badge.source !== 'predicted') return null;
  const ntd = badge.next_trading_day_for_predicted;
  if (!ntd) return 'predicted';
  if (!viewDate) return 'predicted';
  // 조건 3: D+1 거래일 일치
  if (ntd !== getNextTradingDay(viewDate)) return 'predicted';
  // 조건 2: 인접 검증 (current+1만 허용). allBadges 미전달 시 보수적으로 'predicted' 폴백.
  if (Array.isArray(allBadges) && allBadges.length > 0) {
    const currentIdx = getCurrentStageIndex(allBadges);
    const predictedIdx = matchMainTrackStep(badge.label || '');
    if (currentIdx === -1 || predictedIdx === -1) return 'predicted';
    if (predictedIdx !== currentIdx + 1) return 'predicted';  // 단계 도약 차단 (4/24 027360 케이스)
  } else {
    // allBadges 부재 시 인접 검증 불가 → 안전 폴백
    return 'predicted';
  }
  return 'imminent';
}

function renderTenseChip(badge, viewDate, allBadges) {
  // §B.2 시제 칩 분기 진입점. v8 §4.4 칩 4종 + v9.1 §B 5번째 [내일 가능].
  // allBadges: 같은 카드의 status_badges 전체 (strict 인접 검증용).
  // backend schema (commit e9e384d): badge.next_trading_day_source ∈ {'verified','estimated','fallback_homepage','fallback_legacy','unknown'}.
  // estimated/fallback grade는 칩에 data-source-grade 속성 + ⚠️ prefix + tooltip 노출 (DSN-004 §IX 함정 #2).
  if (!badge) return '';
  const isPredicted = (badge.source === 'predicted')
    || (badge.label || '').includes('예상')
    || (badge.label || '').includes('근접');
  if (isPredicted) {
    const variant = getPredictedTenseVariant(badge, viewDate, allBadges);
    if (variant === 'imminent') {
      const grade = badge.next_trading_day_source || '';
      const isEstimated = (grade === 'estimated' || grade === 'fallback_homepage' || grade === 'fallback_legacy');
      const gradeAttr = grade ? ` data-source-grade="${escapeHtml(grade)}"` : '';
      const tooltip = isEstimated
        ? ' title="추정 휴장 캘린더 — KRX 공시 미발표"'
        : '';
      const warnPrefix = isEstimated
        ? '<span class="dsn-v9-tense-chip__grade-warn" aria-label="추정 휴장 캘린더">⚠️</span>'
        : '';
      return `<span class="dsn-v8-tense-chip dsn-v8-tense-chip--predicted dsn-v9-tense-chip--imminent"${gradeAttr}${tooltip}>${warnPrefix}[내일 가능]</span>`;
    }
    return `<span class="dsn-v8-tense-chip dsn-v8-tense-chip--predicted">[예측 진입]</span>`;
  }
  // disclosure: v8 dsnV8GetTenseChip 재사용
  const tense = dsnV8GetTenseChip(badge);
  return `<span class="dsn-v8-tense-chip ${tense.cls}">[${escapeHtml(tense.text)}]</span>`;
}

function renderDisclaimerFooter() {
  // §D.2 법무 푸터 1줄 (legal P0 확정 텍스트). 펼침 영역 최하단 노출.
  return `<div class="dsn-v91-disclaimer-footer">`
    + `<span class="dsn-v91-disclaimer-footer__icon">ⓘ</span>`
    + `<span class="dsn-v91-disclaimer-footer__text">투자판단 권고 아님 · 매매 결정은 본인 책임</span>`
    + `</div>`;
}

function getCausalLine(badges) {
  // §D multi-badge 인과 라인. 2개+이고 disclosure+predicted 동시일 때만 노출.
  if (!Array.isArray(badges) || badges.length < 2) return '';
  const disclosure = badges.find(b =>
    b.source !== 'predicted'
    && !(b.label || '').includes('근접')
    && !(b.label || '').includes('예상')
  );
  const predicted = badges.find(b =>
    (b.source === 'predicted')
    || (b.label || '').includes('근접')
    || (b.label || '').includes('예상')
  );
  if (!disclosure || !predicted) return '';
  const dLabel = disclosure.label || '';
  const pLabel = predicted.label || '';
  const dTag = dLabel.includes('예고') ? '[지정 예고]' : '[지정 중]';
  return `${dTag} ${escapeHtml(dLabel)} → [예측 진입] ${escapeHtml(pLabel)} (다음 단계 가능)`;
}

function getRawExplanation(threshold, badgeContext) {
  // §B raw 표기. base_price=null 케이스(지수 ratio)는 분자/분모 raw 산출 식 노출.
  // 실제 데이터에 stock_change_pct/index_change_pct 필드 부재 — badgeContext.price_chg + threshold.current(ratio)로 역산.
  if (!threshold) return '';
  const desc = threshold.desc || '';
  const isIndexRatio = (threshold.base_price == null) && /지수|ratio|배\s*이상/i.test(desc);
  if (isIndexRatio && badgeContext) {
    const ratio = threshold.current;
    const thrVal = threshold.threshold;
    const stockPct = (badgeContext.price_chg != null) ? badgeContext.price_chg * 100 : null;
    let stockBase = null, stockNow = null;
    // 같은 배지 thresholds에서 base_price≠null 항목 중 가장 빠른(price 비교) entry로 종목 base/현재가 추정
    if (Array.isArray(badgeContext.thresholds)) {
      const priceEntries = badgeContext.thresholds.filter(t =>
        t && t.base_price != null && t.current != null && /3일|5일|15일|일\s*전|기준가|최고가/.test(t.desc || '')
      );
      // 우선순위: "3일 전" > "5일 전" > "15일 최고가" 등 base_price 가장 작은 것(가장 큰 상승률)
      if (priceEntries.length > 0) {
        // 가장 큰 상승률 = (current - base_price) 가 가장 큰 entry
        priceEntries.sort((a, b) => {
          const ra = (a.current - a.base_price) / a.base_price;
          const rb = (b.current - b.base_price) / b.base_price;
          return rb - ra;
        });
        stockBase = priceEntries[0].base_price;
        stockNow = priceEntries[0].current;
      }
    }
    if (stockPct != null && stockBase != null && stockNow != null && ratio != null && thrVal != null) {
      const indexPct = stockPct / ratio;
      const fmtN = (n) => Number(n).toLocaleString('ko-KR');
      const fmtPct = (n) => (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
      return `종목 ${fmtPct(stockPct)} (${fmtN(stockBase)}원→${fmtN(stockNow)}원) ÷ 종합지수 ${fmtPct(indexPct)} = ${Number(ratio).toFixed(2)}배 (${Number(thrVal).toFixed(2)}배 이상 충족)`;
    }
    // fallback: 부분 raw
    if (ratio != null && thrVal != null) {
      return `종합지수 대비 ${Number(ratio).toFixed(2)}배 ÷ 임계 ${Number(thrVal).toFixed(2)}배 (${threshold.triggered ? '충족' : '미충족'})`;
    }
  }
  // base_price=not null 케이스 — v8 기존 표기 유지(호출자에서 분기). 빈 문자열 반환 시 v8 fallback.
  return '';
}

function renderStageFlowV9(badges, ctx) {
  // §A 단계 플로우 그래프 전체. ctx={currentDate, ...}
  if (!Array.isArray(badges) || badges.length === 0) return '';
  const viewDate = (ctx && ctx.currentDate) || '';
  const flow = getStageFlow(badges, viewDate);
  const currentLine = getCurrentStateSummary(badges, viewDate);
  const causalLine = getCausalLine(badges);

  const renderNode = (node) => {
    let cls = 'dsn-v9-stage-flow__node';
    let dataAttr = '';
    if (node.state === 'current') cls += ' dsn-v9-stage-flow__node--current';
    else if (node.state === 'predicted') cls += ' dsn-v9-stage-flow__node--predicted';
    if (node.causalFrom) dataAttr = ' data-causal-from="true"';
    return `<span class="${cls}"${dataAttr}>${escapeHtml(node.label)}</span>`;
  };
  const renderTrack = (nodes, modCls) => {
    const parts = [];
    nodes.forEach((n, i) => {
      parts.push(renderNode(n));
      if (i < nodes.length - 1) {
        parts.push('<span class="dsn-v9-stage-flow__arrow" aria-hidden="true">→</span>');
      }
    });
    return `<div class="dsn-v9-stage-flow__track ${modCls}">${parts.join('')}</div>`;
  };

  const currentLineHtml = currentLine ? `<div class="dsn-v9-current-state">${currentLine}</div>` : '';
  const causalLineHtml = causalLine ? `<div class="dsn-v9-causal-line">${causalLine}</div>` : '';

  return `<section class="dsn-v9-stage-flow">
    ${currentLineHtml}
    ${causalLineHtml}
    <h5 class="dsn-v9-stage-flow__title">KRX 시장경보 단계 흐름</h5>
    ${renderTrack(flow.trackMain, 'dsn-v9-stage-flow__track--main')}
    <h5 class="dsn-v9-stage-flow__title dsn-v9-stage-flow__title--sub">단기과열 (별도 트랙)</h5>
    ${renderTrack(flow.trackShortTerm, 'dsn-v9-stage-flow__track--short-term')}
  </section>`;
}

function miniCandle(open, high, low, close, changePct) {
  if (!close) return '';
  var W = 12, H = 24;
  var hasOHLC = open && high && low;
  // OHLC 없으면 pct 기반 단순 바 (심지 없음, 높이=pct 비례)
  if (!hasOHLC) {
    if (changePct == null) return '';
    var isUp = changePct >= 0;
    var color = isUp ? '#E03131' : '#1971C2';
    // 등락률 절대값에 비례: 1%=2px, 30%=24px (최대), 최소 3px
    var bodyH = Math.max(3, Math.min(H, Math.abs(changePct) * 0.8));
    var bodyTop = isUp ? (H - bodyH) : 0;
    return '<svg width="'+W+'" height="'+H+'" style="vertical-align:middle">' +
      '<rect x="2" y="'+bodyTop+'" width="8" height="'+bodyH+'" fill="'+color+'" rx="1"/></svg>';
  }
  // 캔들 색상: 시가 vs 종가 기준 (당일 봉 방향)
  var isUp = (close >= open);
  var color = isUp ? '#E03131' : '#1971C2';
  var range = high - low;
  if (range === 0) return '<svg width="'+W+'" height="'+H+'"><line x1="6" y1="0" x2="6" y2="'+H+'" stroke="#8B95A8" stroke-width="1"/></svg>';
  var scale = H / range;
  var wickTop = 0;
  var wickBot = H;
  var bodyTop = (high - Math.max(open, close)) * scale;
  var bodyBot = (high - Math.min(open, close)) * scale;
  var bodyH = Math.max(bodyBot - bodyTop, 1);
  return '<svg width="'+W+'" height="'+H+'" style="vertical-align:middle">' +
    '<line x1="6" y1="'+wickTop+'" x2="6" y2="'+wickBot+'" stroke="'+color+'" stroke-width="1"/>' +
    '<rect x="2" y="'+bodyTop+'" width="8" height="'+bodyH+'" fill="'+color+'" rx="1"/>' +
    '</svg>';
}
