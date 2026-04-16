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
  // 색상은 등락률(전일대비) 기준으로 통일. 스파크라인·등락률 숫자와 일관.
  var isUp = (changePct != null) ? (changePct >= 0) : (close >= open);
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
