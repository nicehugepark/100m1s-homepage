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

function dsnV8FormatThresholds(thresholds, label) {
  // §6.2 formatThresholds + 0/0 fallback (§3 D3 표제 의무)
  const arr = Array.isArray(thresholds) ? thresholds : [];
  const total = arr.length;
  const triggered = arr.filter(t => t && t.triggered).length;
  const stripped = dsnV8StripStageLabel(label || '');
  const titleStage = stripped || (label || '진입');
  if (total === 0) {
    // fallback: "(자동 평가 없음) — 지정 사유는 사유 박스 참조"
    return `<div class="dsn-v8-thresholds">
      <div class="dsn-v8-thresholds__title">🎯 ${escapeHtml(titleStage)}에 진입하는 조건 (0/0 충족)</div>
      <div class="dsn-v8-thresholds__empty">(자동 평가 없음) — 지정 사유는 사유 박스 참조</div>
    </div>`;
  }
  // 단위 추론: base_price=null + desc에 "배"/"%"/"비율" 키워드 → 단위 없음 (ratio).
  // base_price 있고 desc가 "최고가"/"종가"/"기준가"/"가격" 키워드 또는 default → "원" 부착.
  const _detectUnit = (t) => {
    const d = (t && t.desc) || '';
    if (/배\s*(이상|이하|↑|↓)?/.test(d) || /비율|ratio/i.test(d)) return '배';
    if (t && t.base_price == null) return '';
    return '원';
  };
  const items = arr.map(t => {
    const cls = t.triggered ? 'dsn-v8-thresholds__item dsn-v8-thresholds__item--triggered'
      : 'dsn-v8-thresholds__item dsn-v8-thresholds__item--unmet';
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

  // 🎯 thresholds
  const thresholdsHtml = dsnV8FormatThresholds(badge.thresholds || [], label);

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

  return `<div class="${blockCls}">
    <div class="dsn-v8-block__header">
      <span class="dsn-v8-tense-chip ${tense.cls}">[${escapeHtml(tense.text)}]</span>
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
