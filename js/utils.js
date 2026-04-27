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
    ? `${stripped}란 / 적용 예정 제한 ▾`
    : `${stripped}란 / 규정 상세 / 공시 원문 ▾`;
  const ctxDart = (ctx && ctx.dartUrl) || '';
  const sourceBlockHtml = isPredicted
    ? ''
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
  // v9.3.1 §I — 노드 상태 매트릭스 산출. {trackMain, trackShortTerm} 각 NodeState[].
  // NodeState = {label, state: 'unvisited'|'current'|'upcoming'|'predicted-imminent'}
  //   - 'current': source='disclosure' AND start<=viewDate<=end (또는 "X 예고" 라벨이 D-1 인접 시 idx=current)
  //   - 'upcoming': source='disclosure' AND viewDate<start AND getNextTradingDay(viewDate)===start (D-1 인접 단계만, 또는 "X 예고" D-1 시 idx+1=upcoming 분리 부착)
  //   - 'predicted-imminent': isPredicted AND getPredictedBadgeVisibility==='header' (strict 3 AND 충족)
  //   - 'unvisited': 기본 (도약 케이스 disclosure 포함, predicted detail-only 포함 — v9.3.1 휴지 C=a)
  const trackMain = KRX_MAIN_TRACK.map(label => ({ label, state: 'unvisited' }));
  const trackShortTerm = KRX_SHORT_TERM_TRACK.map(label => ({ label, state: 'unvisited' }));
  if (!Array.isArray(badges) || badges.length === 0) {
    return { trackMain, trackShortTerm };
  }

  // v9.3 §I.2 — D-1 인접 정의 자체가 도약 차단 (getNextTradingDay(viewDate)===start만 upcoming).
  //   currentIdx 기반 인접 체크 불필요. D-3+ 케이스는 nextTd !== start로 자동 unvisited 분류.

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
      // v9.3.1 §I — 휴지 사이클 0 결정 C=a: vis==='detail-only' 시 state 부착 폐기 (unvisited 유지).
      // strict 3 AND 충족(vis==='header')만 'predicted-imminent' 부착.
      const vis = (typeof getPredictedBadgeVisibility === 'function')
        ? getPredictedBadgeVisibility(badge, viewDate, badges)
        : 'header';
      if (vis === 'header' && target[idx].state === 'unvisited') {
        target[idx].state = 'predicted-imminent';
      }
      // vis==='detail-only' → state 부착 폐기 (unvisited 유지)
    } else {
      // disclosure source — current vs upcoming 분기 (§I.2 + v9.3.1 §I 휴지 A=a)
      const start = badge.start || '';
      const end = badge.end || '';
      const today = viewDate || '';
      if (start && today && today < start) {
        // v9.3 §I.2 — 발효일 미도래 → D-1 인접만 upcoming (대표 본질 가치 "당장 오늘 혹은 다음 영업일에 필연").
        // getNextTradingDay(today)===start AND today<start 동시 충족 시 D-1 정확 인접.
        const nextTd = (typeof getNextTradingDay === 'function') ? getNextTradingDay(today) : '';
        if (nextTd && nextTd === start) {
          // v9.3.1 §I 휴지 A=a — "X 예고" 라벨이면 idx=current(예고 진행 중) + idx+1=upcoming(다음 단계 발효 예정) 분리 부착.
          // guard: idx+1 < trackArr.length (마지막 단계 예고는 분리 부착 폐기, 자체만 upcoming).
          if (label.endsWith('예고') && idx + 1 < trackArr.length) {
            target[idx].state = 'current';
            target[idx + 1].state = 'upcoming';
          } else {
            target[idx].state = 'upcoming';
          }
          continue;
        } else {
          // D-2+ — unvisited 유지 (시간 여유 인지)
          continue;
        }
      } else if (start && end && today >= start && today <= end) {
        target[idx].state = 'current';
      } else {
        target[idx].state = 'current'; // 보수적 fallback (start 없거나 정보 부족)
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
      // 휴지 메트릭 의무 — predicted_shadow_v9_1_fired_count (사이클 4 폐기 트리거 측정).
      // 옵션 1: window 전역 카운터 + console.info(ticker, count). 옵션 2: DOM data-v91-fired="true" (qa grep).
      if (typeof window !== 'undefined') {
        window.__v91_fired_count = (window.__v91_fired_count || 0) + 1;
        const ticker = (badge && (badge.ticker || badge.code || badge.stock_code)) || '';
        if (typeof console !== 'undefined' && console.info) {
          console.info(`[v9.1] [내일 가능] fired: ticker=${ticker} grade=${grade || 'unset'} (count=${window.__v91_fired_count})`);
        }
      }
      return `<span class="dsn-v8-tense-chip dsn-v8-tense-chip--predicted dsn-v9-tense-chip--imminent" data-v91-fired="true"${gradeAttr}${tooltip}>${warnPrefix}[내일 가능]</span>`;
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

/* ───── DSN-20260425-DSN-005 v9.2 — 그래프 박스 자동 효과 + predicted 위계 분리 ─────
   §I 박스 데이터: 각 노드 박스 하단에 "X/X · {auto_effects_short}" 1줄 노출 (휴지 약한 명사형).
   §II predicted 위계: strict 3 AND 미충족 → 헤더 비노출, 펼침 detail-only.
   §III predicted-only 카드: 옵션 1-a 트리거 핀 "↗ 추정 N건".
   §I.3 매트릭스: rules/krx-stage-flow.json#flow.stages[].auto_effects_short (verified 9건, commit f3c0da7).
   homepage 인라인 상수 — 메인 레포 동기화 시 교체 가능. (사이클 0 strict 룰처럼)
*/
const AUTO_EFFECTS_SHORT = {
  '투자주의': '',
  '투자경고 예고': '',
  '투자경고': '신용금지',
  '투자위험 예고': '거래정지',
  '투자위험': '거래정지',
  '매매거래정지': '거래 중지',
  '해제': '정상 복귀',
  '단기과열 예고': '',
  '단기과열': '단일가매매',           // legacy fallback (dayOffset 미지정)
  '단기과열 D+0': '(D+2부터)',        // v9.3 사이클 2.5 — 휴지 G=a (togusa P0 부정합 보정)
  '단기과열 D+1': '(D+2부터)',        // v9.3 사이클 2.5 — 휴지 G=a
  '단기과열 D+2': '거래정지 1일',     // v9.3 §III.3
  '단기과열 D+3-5': '단일가매매'      // v9.3 §III.3
};

function getAutoEffectsShort(stageLabel, dayOffset) {
  // §I.3 stage 라벨 → 자동 효과 1줄. 미정의/(없음) → '' 반환.
  // v9.3 §III.3 + 사이클 2.5 (휴지 G=a) — togusa P0 부정합 보정:
  //   KRX SSOT(krx-stage-conditions.json:726·772~775·781) D+0·D+1=효과 부재 / D+2=거래정지 1일 / D+3~D+5=단일가매매
  //   D+0/D+1 박스 효과 텍스트 = '(D+2부터)' 약한 명사형 (휴지 동사 회피 룰 정합. 5자 모바일 안전).
  if (!stageLabel) return '';
  if (stageLabel === '단기과열' && dayOffset) {
    if (dayOffset === 'd+0') return AUTO_EFFECTS_SHORT['단기과열 D+0'];
    if (dayOffset === 'd+1') return AUTO_EFFECTS_SHORT['단기과열 D+1'];
    if (dayOffset === 'd+2') return AUTO_EFFECTS_SHORT['단기과열 D+2'];
    if (dayOffset === 'd+3-5') return AUTO_EFFECTS_SHORT['단기과열 D+3-5'];
    if (dayOffset === 'd+6+') return ''; // 자동 해제 후
  }
  if (Object.prototype.hasOwnProperty.call(AUTO_EFFECTS_SHORT, stageLabel)) {
    return AUTO_EFFECTS_SHORT[stageLabel] || '';
  }
  return '';
}

/* ───── DSN-20260426-DSN-001 v9.3 §II·§III — 헤더 뱃지 통합 + 단기과열 D+N 분기 ─────
   §II: 시장경보·거래정지·단일가 통합 라벨. 원 단계 라벨은 data-krx-stage·title·aria-label 보존.
   §III: 단기과열 D+1·D+2='거래정지' / D+3~D+5='단일가' 분기. computeTradingDayDiff 영업일 차이.
*/

function computeTradingDayDiff(startDate, viewDate) {
  // v9.3 §III.2 — 영업일 차이 산출 (휴장 제외). startDate=D+0, viewDate가 D+N이면 N 반환.
  // 음수=발효 전, 0+=발효 후. KOREA_HOLIDAYS·marketClosed 의존 (getNextTradingDay와 동일 데이터 셋).
  if (!startDate || !viewDate) return null;
  if (startDate === viewDate) return 0;
  const sd = new Date(startDate);
  const vd = new Date(viewDate);
  if (isNaN(sd.getTime()) || isNaN(vd.getTime())) return null;
  // 발효 전 (음수)
  if (vd < sd) {
    return -computeTradingDayDiff(viewDate, startDate); // 재귀로 부호 반전
  }
  // 영업일 카운트 (start 다음 영업일부터 view까지)
  const holidaysData = (typeof window !== 'undefined' && window.KOREA_HOLIDAYS) || null;
  const holidaysSet = holidaysData && holidaysData.holidays ? new Set(Object.keys(holidaysData.holidays)) : null;
  const marketClosedSet = holidaysData && holidaysData.market_closed ? new Set(Object.keys(holidaysData.market_closed)) : null;
  let cur = new Date(sd);
  let n = 0;
  let safety = 30;
  while (safety-- > 0) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getDay();
    const ymd = formatYMD(cur);
    if (dow === 0 || dow === 6) {
      if (ymd === formatYMD(vd)) return n; // viewDate가 휴일이어도 자기 위치 0 반환 (보수)
      continue;
    }
    if (holidaysSet && holidaysSet.has(ymd)) {
      if (ymd === formatYMD(vd)) return n;
      continue;
    }
    if (marketClosedSet && marketClosedSet.has(ymd)) {
      if (ymd === formatYMD(vd)) return n;
      continue;
    }
    n += 1;
    if (ymd === formatYMD(vd)) return n;
  }
  return null;
}

function getShortTermDayOffset(badge, viewDate) {
  // v9.3 §III.2 + 사이클 2.5 — 단기과열 트랙 D 결정. D+0/D+1 분리 (효과 부재 동일 처리이나 디버그·메트릭 추적용).
  // 발효 전 → 'd+0' (badge.start 미도래 — viewDate < start 케이스. 사이클 2.5 정정: 지정 당일=days=0)
  // days=0 (지정 당일=D+0 — viewDate==badge.start) / days=1 → 'd+1' (D+1) / days=2 → 'd+2' / 3~5 → 'd+3-5' / 6+ → 'd+6+'
  if (!badge || !badge.start || !viewDate) return 'unknown';
  const days = computeTradingDayDiff(badge.start, viewDate);
  if (days === null) return 'unknown';
  if (days < 0) return 'd+0';      // 발효 전 (badge.start 미도래) — D+0과 동일 처리(효과 부재)
  if (days === 0) return 'd+0';    // 지정 당일 (D+0)
  if (days === 1) return 'd+1';    // D+1
  if (days === 2) return 'd+2';    // D+2 (거래정지 1일)
  if (days >= 3 && days <= 5) return 'd+3-5';  // D+3~D+5 (단일가매매)
  return 'd+6+';                   // D+6+ (자동 해제)
}

function getShortTermBadgeKind(badge, viewDate) {
  // v9.3 §III.2 + 사이클 2.5 — 단기과열 헤더 뱃지 종류.
  //   'short-term-self'=원라벨 '단기과열' (D+0/D+1, 효과 부재 — togusa P0 부정합 보정 / 휴지 G=a)
  //   'time-stop'=거래정지 (D+2, 매매거래정지 1일)
  //   'single-price'=단일가 (D+3~D+5, 30분 단위 단일가매매)
  //   'market-warn'=시장경보(예고/근접 등)
  // D+0/D+1: 효과 부재이므로 원라벨 유지. D+2부터 변경 정책 적용 — togusa P0 부정합 보정 / 휴지 G=a
  // ("단기과열→단일가" 정책(휴지 결정 C=b)과 D+0/D+1='단기과열' 예외 분기 충돌 — 본 주석 명시 의무)
  if (!badge || !(badge.label || '').includes('단기과열')) return 'market-warn';
  // 예고·근접은 시장경보로 통합
  if ((badge.label || '').includes('예고') || (badge.label || '').includes('근접')) return 'market-warn';
  const offset = getShortTermDayOffset(badge, viewDate);
  if (offset === 'd+0' || offset === 'd+1') return 'short-term-self';
  if (offset === 'd+2') return 'time-stop';
  if (offset === 'd+3-5') return 'single-price';
  return 'market-warn';
}

function getHeaderBadgeLabel(badge, viewDate) {
  // v9.3 §II.1 + 사이클 2.5 — 헤더 뱃지 통합 라벨 매핑.
  // 매매거래정지 → '거래정지' (E=a 4자 가독성)
  // 단기과열 D+0/D+1 → '단기과열' 원라벨 (효과 부재 예외 — 휴지 G=a)
  // 단기과열 D+2 → '거래정지' / D+3-5 → '단일가' (C=b 분기)
  // 그 외 (투자주의/경고/위험/예고/근접) → '시장경보' (B=a 통합)
  if (!badge || !badge.label) return '시장경보';
  const label = badge.label;
  if (label === '매매거래정지') return '거래정지';
  if (label.includes('단기과열')) {
    const kind = getShortTermBadgeKind(badge, viewDate);
    if (kind === 'short-term-self') return '단기과열';  // 사이클 2.5 — 원라벨 예외 유지
    if (kind === 'time-stop') return '거래정지';
    if (kind === 'single-price') return '단일가';
    return '시장경보';
  }
  return '시장경보';
}

function getHeaderBadgeTitle(badge, viewDate) {
  // v9.3 §II.1 + 사이클 2.5 — 헤더 뱃지 hover/aria-label 텍스트. 원 단계 라벨 + (시장경보 N단계 D-N) 형식.
  // D+0/D+1은 "단기과열 (D+2 거래정지 예정)" 보강으로 사용자 정보 보강 (자동 효과 부재 + 향후 효과 안내).
  if (!badge || !badge.label) return '';
  const label = badge.label;
  // 매매거래정지
  if (label === '매매거래정지') return '매매거래정지 (정식명)';
  // 단기과열 분기
  if (label.includes('단기과열')) {
    if (label.includes('예고')) return '단기과열 예고';
    if (label.includes('근접')) return '단기과열 근접 (자체 추정 · KRX 미공식)';
    const kind = getShortTermBadgeKind(badge, viewDate);
    if (kind === 'short-term-self') {
      const offset = getShortTermDayOffset(badge, viewDate);
      if (offset === 'd+0') return '단기과열 D+0 (D+2 거래정지 예정)';
      if (offset === 'd+1') return '단기과열 D+1 (D+2 거래정지 예정)';
      return '단기과열';
    }
    if (kind === 'time-stop') return '단기과열 D+2 매매거래정지 1일';
    if (kind === 'single-price') return '단기과열 D+3~D+5 30분 단일가매매';
    return '단기과열';
  }
  // 시장경보 단계 매핑
  const stageMap = {
    '투자주의': '시장경보 1단계',
    '투자경고 예고': '시장경보 2단계 D-1',
    '투자경고': '시장경보 2단계',
    '투자위험 예고': '시장경보 3단계 D-1',
    '투자위험': '시장경보 3단계',
    '투자주의 근접': '시장경보 1단계 추정',
    '투자경고 근접': '시장경보 2단계 추정',
    '투자위험 근접': '시장경보 3단계 추정 · KRX 미공식'
  };
  const tag = stageMap[label] || '시장경보';
  return `${label} (${tag})`;
}

function getKrxStageDataset(badge) {
  // v9.3 §II.1 — data-krx-stage 속성값. 원 단계 라벨 그대로 보존 (FLR-010 방어).
  if (!badge || !badge.label) return '';
  return badge.label;
}

function getPredictedBadgeVisibility(badge, viewDate, allBadges) {
  // §II.2 predicted 배지 헤더 노출 분기 — strict 3 AND 충족 → 'header', 미충족 → 'detail-only'.
  // disclosure source는 항상 'header' (분기 무해당).
  if (!badge || badge.source !== 'predicted') return 'header';
  const variant = getPredictedTenseVariant(badge, viewDate, allBadges);
  return variant === 'imminent' ? 'header' : 'detail-only';
}

function countStrictUnmetPredicted(badges, viewDate) {
  // §III.4 트리거 핀 노출 조건 — disclosure 0 + predicted strict 미충족 ≥1 케이스 카운트.
  if (!Array.isArray(badges) || badges.length === 0) return 0;
  let count = 0;
  for (const b of badges) {
    if (!b) continue;
    const isPredicted = (b.source === 'predicted')
      || (b.label || '').includes('근접')
      || (b.label || '').includes('예상');
    if (!isPredicted) continue;
    const vis = getPredictedBadgeVisibility(b, viewDate, badges);
    if (vis === 'detail-only') count += 1;
  }
  return count;
}

function getNodeBoxText(node, badges, viewDate) {
  // v9.3 §I.3 그래프 노드 박스 하단 텍스트 산출. 매트릭스 4종 + state 4축 정합:
  //   미경험: '' (빈 칸)
  //   현재 (disclosure 진행중, state='current'): "X/X~X/XX · {효과}" 또는 효과 0건이면 "X/X~X/XX"
  //   필연 (disclosure 발효 D-1, state='upcoming'): "X/X · {효과}" (variant='upcoming')
  //   추정 임박 (predicted strict 충족, state='predicted-imminent'): "X/X · {효과}" (variant='predicted')
  //   추정 비임박 (predicted strict 미충족, state='predicted'): '' (시각만 점선 유지)
  //   기타: ''
  // 휴지 약한 명사형 정합 — 동사 0건. 효과 0건이면 effectText 빈 문자열.
  // v9.3 §IX 함정 #1 P0: 분기 4종 확장 의무 — predicted-imminent / upcoming 누락 시 박스 효과 빈 칸.
  if (!node) return { dateText: '', effectText: '', variant: 'empty' };
  const validStates = ['current', 'upcoming', 'predicted-imminent', 'predicted'];
  if (!validStates.includes(node.state)) {
    return { dateText: '', effectText: '', variant: 'empty' };
  }
  if (!Array.isArray(badges) || badges.length === 0) {
    return { dateText: '', effectText: '', variant: 'empty' };
  }
  // 노드 라벨에 매칭되는 배지 탐색 (current/upcoming=disclosure 우선, predicted=predicted)
  const label = node.label || '';
  const matchBadge = (b) => {
    const bl = b.label || '';
    if (bl === label) return true;
    if (bl.endsWith('근접')) {
      const stripped = bl.replace(/\s*근접\s*$/, '').trim();
      if (`${stripped} 예고` === label) return true;
      if (stripped === label) return true;
    }
    return bl.startsWith(label);
  };
  let badge = null;
  const isDisclosureNode = (node.state === 'current' || node.state === 'upcoming');
  const isPredictedNode = (node.state === 'predicted-imminent' || node.state === 'predicted');

  if (isDisclosureNode) {
    badge = badges.find(b => {
      const isPred = (b.source === 'predicted') || (b.label || '').includes('근접') || (b.label || '').includes('예상');
      return !isPred && matchBadge(b);
    });
  } else if (isPredictedNode) {
    badge = badges.find(b => {
      const isPred = (b.source === 'predicted') || (b.label || '').includes('근접') || (b.label || '').includes('예상');
      return isPred && matchBadge(b);
    });
  }
  if (!badge) return { dateText: '', effectText: '', variant: 'empty' };

  const today = viewDate || badge.view_date || '';
  const start = badge.start || '';
  const end = badge.end || '';

  // v9.3 §III.3: 단기과열 dayOffset 분기 — getAutoEffectsShort에 dayOffset 전달
  const isShortTerm = (badge.label || '').includes('단기과열') && !(badge.label || '').includes('예고') && !(badge.label || '').includes('근접');
  const dayOffset = isShortTerm ? getShortTermDayOffset(badge, today) : null;
  const effectText = getAutoEffectsShort(label, dayOffset);

  if (isDisclosureNode) {
    if (node.state === 'upcoming') {
      // v9.3 §I.3 — 필연 (D-1): "X/X · {효과}", variant='upcoming'
      if (start) return { dateText: dsnV9FormatMD(start), effectText, variant: 'upcoming' };
      return { dateText: '', effectText: '', variant: 'empty' };
    }
    // current
    // v9.3.2 §I (REQ-017 사이클 2 휴지 A=a): "예고" 단계 진행 중 (today<start)인 경우
    // 박스 날짜 = today (= viewDate, 예고 단계의 발효일). badge.start는 다음 단계(본 지정) 진입일이라 부정합.
    // viewDate fallback (P0 함정 차단): viewDate||badge.view_date||'' — 둘 다 부재 시 빈 박스 회귀.
    if (label.endsWith('예고') && start && today && today < start) {
      return { dateText: dsnV9FormatMD(today), effectText, variant: 'current' };
    }
    if (start && end && today >= start && today <= end) {
      return {
        dateText: `${dsnV9FormatMD(start)}~${dsnV9FormatMD(end)}`,
        effectText,
        variant: 'current'
      };
    }
    if (start) {
      return { dateText: dsnV9FormatMD(start), effectText, variant: 'current' };
    }
    return { dateText: '', effectText: '', variant: 'empty' };
  }

  // predicted 노드 (state=predicted-imminent or predicted)
  if (node.state === 'predicted') {
    // strict 미충족 — 점선 시각만, 박스 효과 빈 칸 (DSN-005 §I.5)
    return { dateText: '', effectText: '', variant: 'empty' };
  }
  // state='predicted-imminent' — strict 충족, 박스 효과 노출
  const ntd = badge.next_trading_day_for_predicted || '';
  if (!ntd) return { dateText: '', effectText: '', variant: 'empty' };
  return { dateText: dsnV9FormatMD(ntd), effectText, variant: 'predicted' };
}

function renderNodeBoxEffect(node, badges, viewDate) {
  // §I HTML 산출 — 박스 하단 영역. 빈 칸이면 영역 자체 비표시 (CSS .dsn-v92-stage-flow__node-effect--empty display:none).
  const info = getNodeBoxText(node, badges, viewDate);
  if (info.variant === 'empty' || (!info.dateText && !info.effectText)) {
    return '';
  }
  const variantCls = info.variant === 'current' ? ' dsn-v92-stage-flow__node-effect--current'
    : info.variant === 'upcoming' ? ' dsn-v92-stage-flow__node-effect--upcoming'
    : info.variant === 'predicted' ? ' dsn-v92-stage-flow__node-effect--predicted'
    : '';
  // 휴지 약한 명사형 — 가운뎃점 분리. 효과 비어있으면 날짜만.
  const inner = info.effectText
    ? `${escapeHtml(info.dateText)} · ${escapeHtml(info.effectText)}`
    : `${escapeHtml(info.dateText)}`;
  return `<div class="dsn-v92-stage-flow__node-effect${variantCls}">${inner}</div>`;
}

function renderStageFlowV9(badges, ctx) {
  // §A 단계 플로우 그래프 전체. ctx={currentDate, ...}
  // v9.2 §I — 노드 박스 하단 자동 효과 1줄 추가.
  if (!Array.isArray(badges) || badges.length === 0) return '';
  const viewDate = (ctx && ctx.currentDate) || '';
  const flow = getStageFlow(badges, viewDate);
  const currentLine = getCurrentStateSummary(badges, viewDate);
  const causalLine = getCausalLine(badges);

  const renderNode = (node) => {
    // v9.3 §I — 노드 4축 위계 (current/upcoming/predicted-imminent/unvisited).
    // §IV: data-causal-from 부착 로직 제거 (CSS ::after ↘ 화살표 제거 정합).
    let cls = 'dsn-v9-stage-flow__node';
    if (node.state === 'current') cls += ' dsn-v9-stage-flow__node--current';
    else if (node.state === 'upcoming') cls += ' dsn-v9-stage-flow__node--upcoming';
    else if (node.state === 'predicted-imminent') cls += ' dsn-v9-stage-flow__node--predicted-imminent';
    else if (node.state === 'predicted') cls += ' dsn-v9-stage-flow__node--predicted';
    // v9.2 §I: 박스 하단 자동 효과 1줄 (current/upcoming/predicted-imminent 노드)
    const effectHtml = renderNodeBoxEffect(node, badges, viewDate);
    return `<span class="${cls}"><span class="dsn-v9-stage-flow__node-label">${escapeHtml(node.label)}</span>${effectHtml}</span>`;
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

function renderPredictedDetailOnly(badges, viewDate) {
  // §II.4 펼침 영역 안 predicted 상세 — strict 미충족 (헤더 비노출) predicted 배지를 시제 칩과 함께 노출.
  // 위치: §A 그래프 + §B raw 직후, §3 disclosure 상세 직전. (renderer.js 호출부에서 위치 결정)
  if (!Array.isArray(badges) || badges.length === 0) return '';
  const detailOnlyBadges = badges.filter(b => {
    if (!b) return false;
    const isPred = (b.source === 'predicted')
      || (b.label || '').includes('근접')
      || (b.label || '').includes('예상');
    if (!isPred) return false;
    return getPredictedBadgeVisibility(b, viewDate, badges) === 'detail-only';
  });
  if (detailOnlyBadges.length === 0) return '';
  const items = detailOnlyBadges.map(b => {
    const chip = `<span class="dsn-v8-tense-chip dsn-v8-tense-chip--predicted">[예측 진입]</span>`;
    return `<li class="dsn-v92-predicted-detail-only__item">${chip} ${escapeHtml(b.label || '')}</li>`;
  }).join('');
  return `<div class="dsn-v92-predicted-detail-only">`
    + `<div class="dsn-v92-predicted-detail-only__title">추정 시그널 (KRX 미공식 · 자체 추정)</div>`
    + `<ul class="dsn-v92-predicted-detail-only__list">${items}</ul>`
    + `</div>`;
}

function renderTriggerPin(badges, viewDate) {
  // §III 트리거 핀 — disclosure 0 + predicted strict 미충족 ≥1 카드에서만 노출. 우측 끝.
  if (!Array.isArray(badges) || badges.length === 0) return '';
  const hasDisclosure = badges.some(b => {
    if (!b) return false;
    const isPred = (b.source === 'predicted')
      || (b.label || '').includes('근접')
      || (b.label || '').includes('예상');
    return !isPred;
  });
  if (hasDisclosure) return '';
  const hasImminent = badges.some(b => {
    if (!b) return false;
    const isPred = (b.source === 'predicted')
      || (b.label || '').includes('근접')
      || (b.label || '').includes('예상');
    if (!isPred) return false;
    return getPredictedBadgeVisibility(b, viewDate, badges) === 'header';
  });
  if (hasImminent) return '';
  const n = countStrictUnmetPredicted(badges, viewDate);
  if (n <= 0) return '';
  // 휴지 메트릭 — __v92_pin_count (사이클 4 임계 5건 추적용)
  if (typeof window !== 'undefined') {
    window.__v92_pin_count = (window.__v92_pin_count || 0) + 1;
  }
  return `<span class="dsn-v92-trigger-pin" aria-label="추정 시그널 ${n}건">`
    + `<span class="dsn-v92-trigger-pin__icon">↗</span>`
    + `<span class="dsn-v92-trigger-pin__text">추정 </span>`
    + `<span class="dsn-v92-trigger-pin__count">${n}건</span>`
    + `</span>`;
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
