"""
뉴지 — 주식차트연구소 카페 스크레이퍼

매 시간 GitHub Actions cron으로 실행.
새 게시글 발견 → 본문 파싱 → 종목 추출 → 뉴스 링크 요약 → 호재/악재 판단 → JSON 저장.

저작권: 원문은 저장하지 않음. 요약 + 메타데이터만.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

try:
    from bs4 import BeautifulSoup, NavigableString, Tag  # type: ignore
    _BS4_AVAILABLE = True
except Exception:  # pragma: no cover
    _BS4_AVAILABLE = False

# ─── 설정 ──────────────────────────────────────────────
CAFE_ID = "11974608"
MENU_ID = "167"
MENU_URL = f"https://cafe.naver.com/f-e/cafes/{CAFE_ID}/menus/{MENU_ID}?viewType=L"
ARTICLE_URL_TEMPLATE = f"https://cafe.naver.com/f-e/cafes/{CAFE_ID}/articles/{{article_id}}?boardtype=L&menuid={MENU_ID}"

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data" / "cafe"
STATE_PATH = DATA_DIR / "state.json"
INDEX_PATH = DATA_DIR / "index.json"

KST = timezone(timedelta(hours=9))


def log(msg: str) -> None:
    print(f"[{datetime.now(KST).isoformat(timespec='seconds')}] {msg}", flush=True)


# ─── State ────────────────────────────────────────────
def load_state() -> dict:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"seen_article_ids": [], "last_run_at": None}


def save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(
        json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def load_index() -> dict:
    if INDEX_PATH.exists():
        return json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    return {"posts": [], "updated_at": None}


def save_index(index: dict) -> None:
    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(
        json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8"
    )


# ─── Playwright 카페 접근 ──────────────────────────────
def get_browser_context(p):
    browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
    context = browser.new_context(
        viewport={"width": 1280, "height": 900},
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
        ),
        locale="ko-KR",
    )
    return browser, context


def _save_debug(page, tag: str) -> None:
    """디버그용 HTML + 스크린샷 저장."""
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        (DATA_DIR / f"debug_{tag}.html").write_text(page.content(), encoding="utf-8")
    except Exception:
        pass
    try:
        page.screenshot(path=str(DATA_DIR / f"debug_{tag}.png"), full_page=True)
    except Exception:
        pass


def naver_login(page, naver_id: str, naver_pw: str) -> bool:
    """네이버 로그인.

    핵심 전략:
    1. page.fill() — 실제 input event 발생 (JS evaluate 대신)
    2. IP보안 토글 자동 OFF (cloud IP 인증 challenge 회피)
    3. 텍스트 매칭 클릭 (셀렉터 변화 견딤)
    """
    try:
        page.goto(
            "https://nid.naver.com/nidlogin.login",
            wait_until="domcontentloaded",
            timeout=20000,
        )
        page.wait_for_selector("#id", timeout=10000)
        time.sleep(1)

        # 1) ID/PW 입력 — page.fill() 사용 (input event 자동 발생)
        try:
            page.fill("#id", naver_id)
            page.fill("#pw", naver_pw)
        except Exception:
            # fallback: JS 값 set
            page.evaluate(
                """([id, pw]) => {
                    const idEl = document.querySelector('#id');
                    const pwEl = document.querySelector('#pw');
                    if (idEl) { idEl.value = id; idEl.dispatchEvent(new Event('input', {bubbles: true})); }
                    if (pwEl) { pwEl.value = pw; pwEl.dispatchEvent(new Event('input', {bubbles: true})); }
                }""",
                [naver_id, naver_pw],
            )

        # 2) IP보안 토글 OFF — 새 IP 인증 challenge 회피
        try:
            ip_off = page.evaluate(
                """() => {
                    // 후보 1: 표준 checkbox name=switch
                    const cb = document.querySelector('input#switch, input[name="switch"]');
                    if (cb && cb.checked) {
                        cb.checked = false;
                        cb.dispatchEvent(new Event('change', {bubbles: true}));
                        cb.dispatchEvent(new Event('click', {bubbles: true}));
                        return 'unchecked-input';
                    }
                    // 후보 2: 토글 라벨/스위치 — 클래스 패턴
                    const toggleLabel = document.querySelector('label[for="switch"]');
                    if (toggleLabel) {
                        toggleLabel.click();
                        return 'clicked-label';
                    }
                    // 후보 3: ARIA 스위치 (요즘 네이버 UI)
                    const switches = document.querySelectorAll('[role="switch"]');
                    for (const s of switches) {
                        if (s.getAttribute('aria-checked') === 'true') {
                            s.click();
                            return 'clicked-aria-switch';
                        }
                    }
                    return 'no-toggle-found';
                }"""
            )
            log(f"IP보안 토글 처리: {ip_off}")
            time.sleep(0.5)
        except Exception as e:
            log(f"⚠️ IP보안 토글 처리 실패: {e}")

        # 3) 로그인 버튼 클릭 — 텍스트 매칭 우선
        clicked = False
        try:
            btn = page.get_by_role("button", name="로그인")
            if btn:
                btn.click(timeout=3000)
                clicked = True
                log("로그인 버튼 클릭 (role=button name=로그인)")
        except Exception:
            pass
        if not clicked:
            for sel in [
                "button:has-text('로그인')",
                "#log\\.login",
                "button.btn_login",
                ".btn_login",
                "input[type='submit']",
            ]:
                try:
                    el = page.query_selector(sel)
                    if el:
                        el.click()
                        clicked = True
                        log(f"로그인 버튼 클릭: {sel}")
                        break
                except Exception:
                    continue
        if not clicked:
            try:
                page.evaluate("document.querySelector('form').submit()")
                clicked = True
                log("form.submit() fallback")
            except Exception:
                pass

        # URL 변화 polling
        try:
            page.wait_for_function(
                "() => !location.href.includes('nidlogin.login')",
                timeout=15000,
            )
        except Exception:
            pass
        time.sleep(2)

        current_url = page.url
        log(f"로그인 후 URL: {current_url}")

        if (
            "nidlogin" in current_url
            or "captcha" in current_url
            or "otp" in current_url
        ):
            log("⚠️ 로그인 실패 — 캡차·2FA·IP차단 가능성")
            _save_debug(page, "login_failed")
            return False

        _save_debug(page, "login_success")
        return True

    except Exception as e:
        log(f"⚠️ 로그인 예외: {e}")
        _save_debug(page, "login_exception")
        return False


def fetch_menu_article_ids(page) -> list[str]:
    """메뉴 페이지의 글 목록에서 article ID 리스트 수집."""
    page.goto(MENU_URL, wait_until="domcontentloaded", timeout=20000)
    time.sleep(4)  # SPA 렌더링 대기
    # 카페는 iframe 안에 게시판이 들어있는 경우 + f-e 신버전은 SPA
    # 두 패턴 모두 시도
    article_ids: set[str] = set()

    # 전체 HTML에서 articles/<숫자> 패턴 추출
    html = page.content()
    for m in re.finditer(rf"/cafes/{CAFE_ID}/articles/(\d+)", html):
        article_ids.add(m.group(1))

    # iframe 내부도 확인
    for frame in page.frames:
        try:
            fhtml = frame.content()
            for m in re.finditer(rf"/cafes/{CAFE_ID}/articles/(\d+)", fhtml):
                article_ids.add(m.group(1))
        except Exception:
            pass

    log(f"메뉴에서 발견한 article ID 수: {len(article_ids)}")
    return sorted(article_ids, key=int, reverse=True)


def fetch_article_html(page, article_id: str) -> str | None:
    """글 본문 HTML(텍스트 위주) 수집.

    DEBUG_FETCH=1 환경변수 설정 시 디버그 HTML을 data/debug_article_<id>_<source>.html 저장.
    """
    url = ARTICLE_URL_TEMPLATE.format(article_id=article_id)
    debug = os.environ.get("DEBUG_FETCH") == "1"
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=20000)
        time.sleep(3)
        # 본문 영역 셀렉터 후보 (네이버 카페 신/구 버전)
        for sel in [
            ".se-main-container",
            "#postViewArea",
            ".article_content",
            "article",
        ]:
            try:
                el = page.query_selector(sel)
                if el:
                    html = el.inner_html()
                    if debug:
                        (
                            DATA_DIR
                            / f"debug_article_{article_id}_main_{sel.replace('.', '').replace('#', '')}.html"
                        ).write_text(html, encoding="utf-8")
                    log(
                        f"  [{article_id}] main page selector {sel} 매칭 ({len(html)} bytes)"
                    )
                    return html
            except Exception:
                continue
        # iframe 내부
        for frame in page.frames:
            for sel in [".se-main-container", "#postViewArea", ".article_content"]:
                try:
                    el = frame.query_selector(sel)
                    if el:
                        html = el.inner_html()
                        if debug:
                            (
                                DATA_DIR
                                / f"debug_article_{article_id}_iframe_{sel.replace('.', '').replace('#', '')}.html"
                            ).write_text(html, encoding="utf-8")
                        log(
                            f"  [{article_id}] iframe selector {sel} 매칭 ({len(html)} bytes)"
                        )
                        return html
                except Exception:
                    continue
        # fallback: 전체 페이지
        full = page.content()
        if debug:
            (DATA_DIR / f"debug_article_{article_id}_fallback.html").write_text(
                full, encoding="utf-8"
            )
        log(
            f"  [{article_id}] ⚠️ 셀렉터 매칭 실패, 전체 페이지 fallback ({len(full)} bytes)"
        )
        return full
    except Exception as e:
        log(f"⚠️ article {article_id} fetch 실패: {e}")
        return None


# ─── 파싱 ────────────────────────────────────────────
# 표 라인 매처 — 매우 관대 (공백/특수문자 다양)
STOCK_LINE_RE = re.compile(
    r"(?P<rank>\d{1,3})\s*"
    r"(?P<tag>[신경주증])?\s*"
    r"(?P<name>[가-힣][가-힣A-Za-z0-9&·\-]{0,29})\s*"
    r"(?P<price>[\d,]+)\s*[▲▼↑↓]?\s*"
    r"(?P<change>[\d,]+)\s*"
    r"(?P<change_pct>[+\-]?\d{1,2}\.\d{1,2})"
)
# 종목명만 매처 — 표 외 종목도 잡기 위해
KOREAN_NAME_RE = re.compile(r"[가-힣][가-힣A-Za-z0-9&·\-]{1,28}")
DATE_RE = re.compile(r"(20\d{2})[\-./]?(\d{1,2})[\-./]?(\d{1,2})")


def html_to_text(html: str) -> str:
    """간단한 HTML → 텍스트. BeautifulSoup 없이."""
    text = re.sub(r"<br\s*/?>", "\n", html)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n", "\n\n", text)
    return text.strip()


BLOCK_RE = re.compile(
    r"<(p|div|li|section|article|figure)[^>]*>(.*?)</\1>",
    re.DOTALL | re.IGNORECASE,
)
LINK_RE = re.compile(
    r'<a[^>]+href="(https?://[^"]+)"[^>]*>(.*?)</a>', re.DOTALL | re.IGNORECASE
)


def extract_stock_news_blocks(html: str) -> list[dict]:
    """HTML 블록 단위로 (종목명 리스트, 뉴스 URL, 테마 라벨) 페어 추출.

    네이버 카페 본문은 보통 <p>종목1, 종목2 : <a href="news">설명</a></p> 형태.
    이 패턴을 잡아 종목과 뉴스를 1:1 또는 N:1 로 매칭한다.
    """
    pairs = []
    seen_pair_keys = set()

    for bm in BLOCK_RE.finditer(html):
        block_html = bm.group(2)
        # 외부 링크 수집
        external = []
        for lm in LINK_RE.finditer(block_html):
            url = lm.group(1)
            host = urlparse(url).netloc
            if "cafe.naver.com" in host:
                continue
            if "naver.com/articles" in url:
                continue
            external.append({"url": url, "source": host})
        if not external:
            continue

        block_text = html_to_text(block_html)
        # "종목명들 : 설명" 패턴
        if " : " not in block_text:
            continue
        prefix, _, theme = block_text.partition(" : ")
        # 종목명 분리 (콤마/슬래시/, 등)
        raw_names = re.split(r"[,，、/]", prefix)
        stock_names = []
        for n in raw_names:
            n = n.strip().strip("()[]【】").strip()
            # 너무 길거나 짧으면 제외
            if 1 < len(n) <= 30 and re.search(r"[가-힣A-Za-z]", n):
                stock_names.append(n)
        if not stock_names:
            continue

        for ext in external:
            key = (tuple(stock_names), ext["url"])
            if key in seen_pair_keys:
                continue
            seen_pair_keys.add(key)
            pairs.append(
                {
                    "stock_names": stock_names,
                    "url": ext["url"],
                    "source": ext["source"],
                    "theme_label": theme.strip(),
                }
            )
    return pairs


TITLE_DATE_RE = re.compile(r"\[?\(?\s*(20\d{2})[./\-](\d{1,2})[./\-](\d{1,2})\.?\s*\)?\]?")
# "2026년 4월 8일" / "2026년 04월 07일"
TITLE_YMD_KO_RE = re.compile(r"(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일")
# "4월 8일" / "3월6일" (공백 무관)
TITLE_KOREAN_DATE_RE = re.compile(r"(\d{1,2})\s*월\s*(\d{1,2})\s*일")
# "04/07" / "4/7" — 연도 없음 (년도 표현 없을 때만 사용)
TITLE_MD_SLASH_RE = re.compile(r"(?<!\d)(\d{1,2})/(\d{1,2})(?!\d)")
# HTML meta 셀렉터용 정규식
META_PUBLISHED_RE = re.compile(
    r'<meta[^>]+property=["\']article:published_time["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
META_TIME_DT_RE = re.compile(
    r'<time[^>]+datetime=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
STOPWORDS = {
    "상승", "하락", "상한가", "하한가", "종목", "관련주", "기대감", "수혜",
    "이슈", "공시", "테마", "차익", "실현", "재부각", "부각", "신규상장",
    "시장", "정리", "이하", "미만", "이상", "거래대금", "펀드", "리츠",
    "우선주", "스팩", "환기", "관리", "상승률", "하락률", "그룹", "기업",
    "주가", "강세", "약세", "매수", "매도", "투자", "추가", "최대주주",
    "지분", "양도", "기준", "경우", "포함", "제외", "하였", "하였습니다",
    "영향", "여파", "기대", "수준", "소식", "이야기", "마감", "오늘", "내일",
    "작년", "올해", "분기", "실적", "전망", "본격", "사업", "부문", "인수",
}


SHORT_NOTE_RE = re.compile(
    r"^\s*(\d{1,2})/(\d{1,2})\s*(하향|상향|상승|하락)\s*[::]\s*(.+)$"
)


def detect_format(text: str) -> str:
    """본문 텍스트로 형식 판별."""
    has_rise = "[상승]" in text
    has_fall = "[하락]" in text
    if has_rise or has_fall:
        return "rank_table"
    # short_note: 첫 비어있지 않은 줄이 "M/D 방향: 종목,종목,..." 형식
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        if SHORT_NOTE_RE.match(line):
            return "short_note"
        break
    if len(text) >= 200:
        return "essay"
    return "unknown"


def parse_short_note(html: str, text: str, title: str | None) -> dict:
    """짧은 메모 형식: "M/D 하향: 종목A, 종목B, ..." 한 줄 포맷.

    - 방향 키워드 정규화: 상승→상향, 하락→하향
    - 종목명 콤마 분리 (STOPWORDS·길이·문자 필터)
    - post_date: 제목 우선, 실패 시 본문 M/D + 현재 연도
    """
    direction: str | None = None
    stocks_raw: list[str] = []
    md_month: int | None = None
    md_day: int | None = None

    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        m = SHORT_NOTE_RE.match(line)
        if m:
            md_month = int(m.group(1))
            md_day = int(m.group(2))
            raw_dir = m.group(3)
            direction = "상승" if raw_dir in ("상향", "상승") else "하향"
            payload = m.group(4)
            for tok in re.split(r"[,，、]", payload):
                tok = tok.strip().strip("()[]【】 .·*-").strip()
                if not tok or len(tok) < 2 or len(tok) > 20:
                    continue
                if not re.search(r"[가-힣A-Za-z]", tok):
                    continue
                if tok in STOPWORDS:
                    continue
                stocks_raw.append(tok)
        break

    stocks = [
        {"name": n, "ticker": None, "theme_label": None, "news_cards": []}
        for n in stocks_raw
    ]

    # post_date
    post_date = _extract_post_date(text, title, html)
    if not post_date and md_month and md_day:
        try:
            if 1 <= md_month <= 12 and 1 <= md_day <= 31:
                yi = datetime.now(KST).year
                post_date = f"{yi:04d}-{md_month:02d}-{md_day:02d}"
        except ValueError:
            pass

    section_type = direction or "상승"
    return {
        "sections": [{"type": section_type, "stocks": stocks}] if stocks else [],
        "post_date": post_date,
        "direction": direction,
    }


def _valid_ymd(y: int, m: int, d: int) -> bool:
    if not (2000 <= y <= 2100 and 1 <= m <= 12 and 1 <= d <= 31):
        return False
    try:
        datetime(y, m, d)
        return True
    except ValueError:
        return False


def _resolve_year_from_md(mi: int, di: int) -> int | None:
    """월·일만 주어졌을 때 연도 결정. 기본 현재 연도, 미래면 작년(12월→1월 경계)."""
    if not (1 <= mi <= 12 and 1 <= di <= 31):
        return None
    today = datetime.now(KST).date()
    yi = today.year
    try:
        candidate = datetime(yi, mi, di).date()
    except ValueError:
        return None
    if candidate > today:
        yi -= 1
        try:
            datetime(yi, mi, di)
        except ValueError:
            return None
    return yi


def _extract_post_date(
    text: str, title: str | None, html: str | None = None
) -> str | None:
    """다중 소스 post_date 추출. 추측 금지 — 실패 시 None.

    순서:
      1) 제목: YYYY-MM-DD / YYYY.MM.DD. / [YYYY/MM/DD] / (YYYY.MM.DD.)
      2) 제목: YYYY년 M월 D일
      3) 제목: M월 D일 (연도 없음 → 현재연도, 미래면 작년)
      4) 제목: MM/DD (연도 없음 → 동일 규칙)
      5) 본문 첫 1500자: 위와 동일 순서
      6) HTML 메타: article:published_time / time[datetime]
    """
    # helpers
    def from_ymd(y, mo, d):
        try:
            yi, mi, di = int(y), int(mo), int(d)
            if _valid_ymd(yi, mi, di):
                return f"{yi:04d}-{mi:02d}-{di:02d}"
        except ValueError:
            return None
        return None

    def from_md(mo, d):
        try:
            mi, di = int(mo), int(d)
            yi = _resolve_year_from_md(mi, di)
            if yi and _valid_ymd(yi, mi, di):
                return f"{yi:04d}-{mi:02d}-{di:02d}"
        except ValueError:
            return None
        return None

    # 1~4) 제목
    if title:
        m = TITLE_YMD_KO_RE.search(title)
        if m and (r := from_ymd(*m.groups())):
            return r
        m = TITLE_DATE_RE.search(title)
        if m and (r := from_ymd(*m.groups())):
            return r
        m = TITLE_KOREAN_DATE_RE.search(title)
        if m and (r := from_md(*m.groups())):
            return r
        m = TITLE_MD_SLASH_RE.search(title)
        if m and (r := from_md(*m.groups())):
            return r

    # 5) 본문 첫 1500자
    head = text[:1500] if text else ""
    if head:
        m = TITLE_YMD_KO_RE.search(head)
        if m and (r := from_ymd(*m.groups())):
            return r
        m = TITLE_DATE_RE.search(head)
        if m and (r := from_ymd(*m.groups())):
            return r
        m = TITLE_KOREAN_DATE_RE.search(head)
        if m and (r := from_md(*m.groups())):
            return r
        m = TITLE_MD_SLASH_RE.search(head)
        if m and (r := from_md(*m.groups())):
            return r

    # 6) HTML 메타
    if html:
        for rx in (META_PUBLISHED_RE, META_TIME_DT_RE):
            mm = rx.search(html)
            if mm:
                val = mm.group(1)
                if len(val) >= 10 and val[4] == "-" and val[7] == "-":
                    try:
                        yi, mi, di = int(val[0:4]), int(val[5:7]), int(val[8:10])
                        if _valid_ymd(yi, mi, di):
                            return f"{yi:04d}-{mi:02d}-{di:02d}"
                    except ValueError:
                        pass
    return None


def _extract_stock_names_from_line(line: str) -> list[str]:
    """한 라인에서 종목명 후보 추출. ':' 이전이 리스트인 경우 + 콤마 분리 패턴."""
    # ':' 있으면 이전 부분만
    head = line.split(":", 1)[0] if ":" in line else line
    # <카테고리 제목> 제거
    head = re.sub(r"<[^>]+>", " ", head)
    head = head.strip("() [](){}【】·\t ")
    names: list[str] = []
    for tok in re.split(r"[,，、/]", head):
        tok = tok.strip().strip("()[]【】 .·*-").strip()
        if not tok or len(tok) < 2 or len(tok) > 20:
            continue
        if not re.search(r"[가-힣A-Za-z]", tok):
            continue
        # 숫자·퍼센트 라인 제외
        if re.search(r"\d%", tok) or re.fullmatch(r"[\d,./]+", tok):
            continue
        if tok in STOPWORDS:
            continue
        # 접미사 '들'·조사 잘라냄 생략 — 원문 그대로
        names.append(tok)
    return names


NAME_LIST_COLON_RE = re.compile(
    r"([가-힣A-Za-z][가-힣A-Za-z0-9&·\-]{1,19}"
    r"(?:\s*,\s*[가-힣A-Za-z][가-힣A-Za-z0-9&·\-]{1,19}){0,9})"
    r"\s*[::]"
)


_SECTOR_HEADER_RE = re.compile(r"^\s*[<〈<]([^<>〈〉]{1,40})[>〉>]\s*$")
_COMMA_SPLIT_RE = re.compile(r"\s*[,，、]\s*")
_STOCK_NAME_TOKEN_RE = re.compile(r"^[가-힣A-Za-z][가-힣A-Za-z0-9&·\-\s]{0,30}$")


def _clean_stock_name(tok: str) -> str | None:
    tok = tok.strip().strip("*·•-—()[]【】{}").strip()
    # 끝 콜론/물결 제거
    tok = re.sub(r"[::]\s*$", "", tok).strip()
    if not tok or len(tok) < 2 or len(tok) > 20:
        return None
    if not re.search(r"[가-힣A-Za-z]", tok):
        return None
    if re.fullmatch(r"[\d,./%+\-]+", tok):
        return None
    # 종목명은 공백을 거의 포함하지 않음 (있어도 1개 이내 복합 브랜드)
    if tok.count(" ") >= 2:
        return None
    bad_kw = ("거래대금", "상승률", "하락률", "기준", "종목은", "포함하는", "제외",
              "너무", "많기", "올리는", "줄여서", "무의미", "탓에", "다보니")
    if any(k in tok for k in bad_kw):
        return None
    if tok in STOPWORDS:
        return None
    return tok


def _parse_rank_table_dom(html: str, title: str | None) -> dict | None:
    """DOM(`<p>` 단위) 기반 rank_table 파서.

    네이버 SmartEditor 구조 가정:
      - 본문 블록은 `p.se-text-paragraph` 단위
      - 한 <p> 내에 "종목명 : <a href=뉴스URL>이유</a>" 1:1 구조
      - `<카테고리>` 헤더 <p> → 다음 <p>들에 sector 상속
      - "종목A, 종목B, ..." 콤마 리스트 <p>는 sector 내 다중 종목 선언

    실패 시 None → 호출부가 regex fallback으로 폴백.
    """
    if not _BS4_AVAILABLE:
        return None
    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        return None

    # 1) 본문 <p> 순서대로 수집. se-text-paragraph 우선, 없으면 모든 <p>.
    paragraphs = soup.select("p.se-text-paragraph")
    if not paragraphs:
        paragraphs = soup.find_all("p")
    if not paragraphs:
        return None

    sections: dict[str, list[dict]] = {"상승": [], "하락": []}
    index: dict[str, dict[str, dict]] = {"상승": {}, "하락": {}}
    current_section: str | None = None
    current_sector: str | None = None
    # 이전 콤마 리스트 <p>에서 선언된 sector 멤버 (다음 <p>에서 "*종목:이유"가 오면 매칭용)
    sector_members: dict[str, list[str]] = {}
    # 섹터 헤더 직후 콤마 리스트가 나오기 전까지 수집된 공통 이유 링크
    sector_pending_links: list[dict] = []
    sector_pending_reason: str | None = None
    # 섹터별 마지막 공통 이유·링크 (같은 섹터 내 후속 콤마 리스트에 상속)
    sector_last_reason: dict[str, str] = {}
    sector_last_links: dict[str, list[dict]] = {}

    def get_or_create(sect: str, name: str) -> dict:
        if name in index[sect]:
            return index[sect][name]
        stock = {
            "name": name,
            "ticker": None,
            "theme_label": None,
            "sector_label": None,  # 섹터 상속은 콤마 리스트 처리에서 명시적으로만
            "news_cards": [],
        }
        index[sect][name] = stock
        sections[sect].append(stock)
        return stock

    for p in paragraphs:
        ptext = p.get_text(" ", strip=True).replace("\xa0", " ").strip()
        if not ptext:
            continue

        # 섹션 마커
        if "[상승]" in ptext:
            current_section = "상승"
            current_sector = None
            continue
        if "[하락]" in ptext:
            current_section = "하락"
            current_sector = None
            continue
        if current_section is None:
            continue

        # 필터 안내 라인 스킵
        if "거래대금" in ptext and "제외" in ptext:
            continue
        if "상한가" in ptext and "포함" in ptext:
            continue

        # 섹터 헤더 `<건설주 / 재건주>`
        m_sector = _SECTOR_HEADER_RE.match(ptext)
        if m_sector:
            current_sector = m_sector.group(1).strip()
            sector_members[current_sector] = []
            sector_pending_links = []
            sector_pending_reason = None
            continue

        # <p> 내 링크 수집
        links = []
        for a in p.find_all("a"):
            href = (a.get("href") or "").strip()
            if not href.startswith("http"):
                continue
            host = urlparse(href).netloc
            if "cafe.naver.com" in host:
                continue
            atext = a.get_text(" ", strip=True)
            links.append({"url": href, "source": host, "text": atext})

        # 콜론(":" 또는 전각 "：") 기준 분리
        if ":" in ptext or "：" in ptext:
            # 첫 콜론 분리
            idx = min(
                (i for i in (ptext.find(":"), ptext.find("：")) if i >= 0),
                default=-1,
            )
            head = ptext[:idx].strip()
            tail = ptext[idx + 1 :].strip()
            # head에서 선행 장식 제거
            head = re.sub(r"^[*·•\-\s]+", "", head).strip()

            # head가 콤마 리스트? → 다중 종목 (공통 이유)
            tokens = [_clean_stock_name(t) for t in _COMMA_SPLIT_RE.split(head)]
            tokens = [t for t in tokens if t]
            if not tokens:
                continue

            # 이유 = tail (링크 텍스트 기반 우선)
            # tail에서 링크 뒤 꼬리말 (", 영향(?)", "(?)") 잘라내기 위해 링크 텍스트 우선
            if links:
                reason = links[0]["text"] or tail
            else:
                reason = tail
            # 꼬리 물음표·공백 정리
            reason = re.sub(r"\s+", " ", reason).strip(" .-")

            # 단일 종목 라인(`종목명 : 이유`)은 독립 테마 — 섹터 상속 금지.
            # 단 현재 섹터 콤마 리스트에 이미 있던 종목(예: `* 화성밸브 : 보강`)은 예외.
            sector_member_set = set(sector_members.get(current_sector or "", []))
            is_sector_reinforce = bool(sector_member_set) and any(
                t in sector_member_set for t in tokens
            )
            for name in tokens:
                stock = get_or_create(current_section, name)
                if not stock["theme_label"]:
                    stock["theme_label"] = reason or None
                # 섹터 멤버 보강 케이스에만 sector_label 유지/부여
                if is_sector_reinforce and current_sector and not stock.get("sector_label"):
                    stock["sector_label"] = current_sector
                for lk in links:
                    if any(c.get("url") == lk["url"] for c in stock["news_cards"]):
                        continue
                    stock["news_cards"].append(
                        {
                            "url": lk["url"],
                            "source": lk["source"],
                            "theme_hint": reason or lk["text"] or None,
                        }
                    )
            # 단일 종목 라인이 섹터 멤버 보강이 아니면 → 섹터 영향권 이탈
            if not is_sector_reinforce:
                current_sector = None
                sector_pending_links = []
                sector_pending_reason = None
            continue

        # 콜론 없음 → 콤마 리스트 (섹터 멤버 선언) 가능성
        # 예: "대우건설, GS건설, 수산세보틱스, ..."
        if "," in ptext:
            tokens = [_clean_stock_name(t) for t in _COMMA_SPLIT_RE.split(ptext)]
            tokens = [t for t in tokens if t]
            if len(tokens) >= 2:
                # 섹터 공통 이유: 섹터 헤더 이후 쌓인 sector_pending_links 우선,
                # 없으면 이번 <p>의 링크 사용
                effective_links = list(sector_pending_links) + list(links)
                effective_reason = sector_pending_reason or (
                    links[0]["text"] if links else None
                )
                # 같은 섹터의 이전 콤마 리스트에서 쓰인 이유·링크 상속 (pending이 비었을 때만)
                if current_sector and not effective_links:
                    effective_links = list(sector_last_links.get(current_sector, []))
                if current_sector and not effective_reason:
                    effective_reason = sector_last_reason.get(current_sector)
                for name in tokens:
                    stock = get_or_create(current_section, name)
                    if current_sector and not stock.get("sector_label"):
                        stock["sector_label"] = current_sector
                    if effective_reason and not stock["theme_label"]:
                        stock["theme_label"] = effective_reason
                    for lk in effective_links:
                        if any(c.get("url") == lk["url"] for c in stock["news_cards"]):
                            continue
                        stock["news_cards"].append(
                            {
                                "url": lk["url"],
                                "source": lk["source"],
                                "theme_hint": lk.get("text") or effective_reason,
                            }
                        )
                if current_sector is not None:
                    sector_members[current_sector] = tokens
                    if effective_reason:
                        sector_last_reason[current_sector] = effective_reason
                    if effective_links:
                        sector_last_links[current_sector] = effective_links
                # 멤버들이 공통 이유를 받았으므로 pending 소진
                sector_pending_links = []
                sector_pending_reason = None
                continue

        # 링크 <p>이지만 콜론/콤마 없음 → 섹터 공통 이유로 pending
        if links and current_sector is not None:
            sector_pending_links.extend(links)
            sector_pending_reason = sector_pending_reason or links[0]["text"]
        # 이미 콤마 리스트가 이전에 나왔으면, 그 멤버들에 소급 적용
        if links and current_sector:
            sector_reason = links[0]["text"]
            for name in sector_members.get(current_sector, []):
                # 해당 종목이 index에 있으면 보강
                for sect in ("상승", "하락"):
                    if name in index[sect]:
                        st = index[sect][name]
                        if not st["theme_label"]:
                            st["theme_label"] = sector_reason
                        if not any(c.get("url") == links[0]["url"] for c in st["news_cards"]):
                            st["news_cards"].append(
                                {
                                    "url": links[0]["url"],
                                    "source": links[0]["source"],
                                    "theme_hint": sector_reason,
                                }
                            )

    # 검증: 최소 1종목 이상 채워졌고, 단일 종목에 모든 링크가 몰리지 않았는지
    total_stocks = sum(len(v) for v in sections.values())
    if total_stocks == 0:
        return None
    # 첫 종목에 뉴스가 ≥7개 몰림 = regex 파서와 동일 증상 → 실패 처리
    for sect_list in sections.values():
        if sect_list and len(sect_list[0]["news_cards"]) >= 7 and all(
            len(s["news_cards"]) == 0 for s in sect_list[1:]
        ):
            return None

    return {
        "sections": [
            {"type": k, "stocks": v} for k, v in sections.items() if v
        ],
        "post_date": _extract_post_date(
            BeautifulSoup(html, "html.parser").get_text(" ", strip=True), title, html
        ),
    }


def parse_rank_table(html: str, text: str, title: str | None) -> dict:
    """[상승]/[하락] 형식 파서.

    전략:
    - `[상승]` / `[하락]` 마커로 본문을 섹션별로 분할
    - 각 섹션 내에서 `종목명[, 종목명]... :` 정규식으로 종목명 리스트 추출
    - 섹션 내 콤마 구분 종목 리스트도 캡처 (예: "흥아해운, 한국ANKOR유전, ...")
    - extract_stock_news_blocks 로 블록 기반 news_cards 매칭 (기존 로직 재사용)

    2026-04-08: DOM(`<p>` 단위) 파서를 우선 시도. 실패 시 아래 regex fallback.
    근거: 원본 HTML은 `<p>종목명 : <a href=뉴스URL>이유</a></p>` 1:1 구조인데
    html_to_text로 평문화 후 정규식 재추출하면 손실 발생(FLR 카페 파서 다양성).
    """
    dom_result = _parse_rank_table_dom(html, title)
    if dom_result is not None:
        return dom_result

    sections: dict[str, list[dict]] = {"상승": [], "하락": []}
    index: dict[str, dict[str, dict]] = {"상승": {}, "하락": {}}

    def get_or_create(section: str, name: str) -> dict:
        if name in index[section]:
            return index[section][name]
        stock = {
            "name": name,
            "ticker": None,
            "theme_label": None,
            "news_cards": [],
        }
        index[section][name] = stock
        sections[section].append(stock)
        return stock

    # 1) 섹션 분할
    rise_start = text.find("[상승]")
    fall_start = text.find("[하락]")
    span_map: dict[str, str] = {}
    if rise_start >= 0:
        end = fall_start if fall_start > rise_start else len(text)
        span_map["상승"] = text[rise_start:end]
    if fall_start >= 0:
        end = rise_start if rise_start > fall_start else len(text)
        span_map["하락"] = text[fall_start:end]

    # 2) 섹션별 종목명 추출
    for sect, span in span_map.items():
        # 카테고리 제목 블록 처리: <건설주 / 재건주> 다음에 콤마 리스트
        # <...> 를 분리자로 남김
        cleaned = re.sub(r"<[^<>]{1,40}>", " | ", span)
        # 첫째 패턴: "종목[, 종목...] :"
        for m in NAME_LIST_COLON_RE.finditer(cleaned):
            raw = m.group(1)
            for tok in re.split(r"[,，、]", raw):
                tok = tok.strip()
                if not tok or len(tok) < 2 or len(tok) > 20:
                    continue
                if tok in STOPWORDS:
                    continue
                if re.fullmatch(r"[\d,./%+\-]+", tok):
                    continue
                if not re.search(r"[가-힣A-Za-z]", tok):
                    continue
                # 필터 단어 포함 제외
                if any(
                    k in tok
                    for k in ("거래대금", "상승률", "하락률", "종목은", "기준")
                ):
                    continue
                get_or_create(sect, tok)

        # 둘째 패턴: 카테고리 제목 뒤 콤마 리스트 (': ' 없이 나열)
        # "|" 마커(원 <...>) 직후 라인의 콤마 리스트 잡기
        for chunk in cleaned.split("|"):
            # 콤마 3개 이상 연속 한글 리스트
            for lm in re.finditer(
                r"((?:[가-힣A-Za-z][가-힣A-Za-z0-9&·\-]{1,19}\s*,\s*){2,}"
                r"[가-힣A-Za-z][가-힣A-Za-z0-9&·\-]{1,19})",
                chunk,
            ):
                for tok in lm.group(1).split(","):
                    tok = tok.strip()
                    if not tok or len(tok) < 2 or len(tok) > 20:
                        continue
                    if tok in STOPWORDS:
                        continue
                    get_or_create(sect, tok)

    # 블록 기반 news_cards (기존 로직) — 단 유효 종목만 매칭
    pairs = extract_stock_news_blocks(html)
    for pair in pairs:
        for sname in pair["stock_names"]:
            # 카테고리 제목 조각 필터 (<...> 부스러기)
            if "<" in sname or ">" in sname:
                continue
            if len(sname) > 20 or len(sname) < 2:
                continue
            if " " in sname:  # 공백 포함 복합 토큰 제거
                continue
            target = None
            matched = sname
            for sect in ("상승", "하락"):
                for existing in index[sect]:
                    if sname == existing or sname in existing or existing in sname:
                        target = sect
                        matched = existing
                        break
                if target:
                    break
            if target is None:
                target = "상승"
                matched = sname
                get_or_create(target, matched)
            stock = index[target][matched]
            if not stock["theme_label"]:
                stock["theme_label"] = pair["theme_label"]
            if not any(c.get("url") == pair["url"] for c in stock["news_cards"]):
                stock["news_cards"].append(
                    {
                        "url": pair["url"],
                        "source": pair["source"],
                        "theme_hint": pair["theme_label"],
                    }
                )

    return {
        "sections": [{"type": k, "stocks": v} for k, v in sections.items() if v],
        "post_date": _extract_post_date(text, title, html),
    }


def parse_essay(html: str, text: str, title: str | None) -> dict:
    """에세이·회고·강의 형식. 종목 표 없음 → sections 비움, 본문 요약 보존."""
    # 본문 앞 1500자 요약 (저작권상 원문 전체 저장 금지)
    body_snippet = text[:1500]
    # 키워드 후보 — 2~6자 한글 어절 빈도, stopword 제외
    words = re.findall(r"[가-힣]{2,6}", text)
    freq: dict[str, int] = {}
    for w in words:
        if w in STOPWORDS:
            continue
        freq[w] = freq.get(w, 0) + 1
    top_keywords = [w for w, _ in sorted(freq.items(), key=lambda x: -x[1])[:15]]
    return {
        "sections": [],
        "post_date": _extract_post_date(text, title, html),
        "essay": {
            "body_snippet": body_snippet,
            "top_keywords": top_keywords,
        },
    }


def parse_post(html: str, title: str | None = None) -> dict:
    """본문 HTML → 구조화된 데이터. 형식별로 분기.

    반환 스키마:
      parse_format: "rank_table" | "essay" | "unknown"
      parse_status: "ok" | "unsupported_format"
      sections: list  (essay·unknown 은 [])
      post_date: str|None
      essay: dict (essay 형식만)
    """
    text = html_to_text(html)
    fmt = detect_format(text)
    base = {"parse_format": fmt, "parse_status": "ok"}
    if fmt == "rank_table":
        return {**base, **parse_rank_table(html, text, title)}
    if fmt == "short_note":
        return {**base, **parse_short_note(html, text, title)}
    if fmt == "essay":
        return {**base, **parse_essay(html, text, title)}
    return {
        **base,
        "parse_status": "unsupported_format",
        "sections": [],
        "post_date": _extract_post_date(text, title, html),
    }


def _legacy_parse_post_unused(html: str) -> dict:
    """구버전 단일 가정 파서 — 폐기. 보관용."""
    text = html_to_text(html)
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    sections: dict[str, list[dict]] = {"상승": [], "하락": []}
    section_index: dict[str, dict[str, dict]] = {"상승": {}, "하락": {}}
    current_section = None

    def get_or_create(section: str, name: str) -> dict:
        if name in section_index[section]:
            return section_index[section][name]
        stock = {
            "rank": None,
            "name": name,
            "ticker": None,
            "price_won": None,
            "change_won": None,
            "change_pct": None,
            "theme_label": None,
            "news_cards": [],
            "strength_score": None,
        }
        section_index[section][name] = stock
        sections[section].append(stock)
        return stock

    # 1) 표 라인 파싱 (느슨)
    for line in lines:
        if "[상승]" in line:
            current_section = "상승"
            continue
        if "[하락]" in line:
            current_section = "하락"
            continue
        if not current_section:
            continue
        m = STOCK_LINE_RE.search(line)
        if not m:
            continue
        try:
            name = m.group("name").strip()
            if not name or len(name) < 2:
                continue
            stock = get_or_create(current_section, name)
            if stock["rank"] is None:
                stock["rank"] = int(m.group("rank"))
            stock["price_won"] = int(m.group("price").replace(",", ""))
            stock["change_won"] = int(m.group("change").replace(",", ""))
            stock["change_pct"] = float(m.group("change_pct"))
        except (ValueError, AttributeError):
            continue

    # 2) 블록 기반 종목-뉴스 페어 (가장 reliable)
    pairs = extract_stock_news_blocks(html)
    for pair in pairs:
        for sname in pair["stock_names"]:
            # 표에 이미 있는 섹션 우선
            target_section = None
            for sect in ("상승", "하락"):
                # 부분 일치 허용 (이름 표기 차이 흡수)
                for existing in section_index[sect]:
                    if sname == existing or sname in existing or existing in sname:
                        target_section = sect
                        sname = existing  # 정규화
                        break
                if target_section:
                    break
            if target_section is None:
                target_section = "상승"  # 새 종목 기본
            stock = get_or_create(target_section, sname)
            if not stock["theme_label"]:
                stock["theme_label"] = pair["theme_label"]
            # 중복 URL 방지
            if not any(c.get("url") == pair["url"] for c in stock["news_cards"]):
                stock["news_cards"].append(
                    {
                        "url": pair["url"],
                        "source": pair["source"],
                        "theme_hint": pair["theme_label"],
                    }
                )

    # 3) strength_score 계산 (가능한 경우만)
    import math

    for section in sections.values():
        for stock in section:
            try:
                if (
                    stock.get("change_pct") is not None
                    and stock.get("price_won")
                    and stock.get("change_won")
                ):
                    ta = max(
                        abs(stock["change_won"]) * stock["price_won"],
                        1_000_000_000,
                    )
                    stock["strength_score"] = round(
                        abs(stock["change_pct"]) * math.log10(ta / 1_000_000_000),
                        2,
                    )
            except Exception:
                pass

    # 4) 날짜 추출
    post_date = None
    head_text = text[:800]
    m = DATE_RE.search(head_text)
    if m:
        y, mo, d = m.groups()
        try:
            post_date = f"{y}-{int(mo):02d}-{int(d):02d}"
        except ValueError:
            pass

    return {
        "sections": [{"type": k, "stocks": v} for k, v in sections.items() if v],
        "post_date": post_date,
    }


# ─── 뉴스 요약 + 호재/악재 (Gemini) ──────────────────────
def gemini_analyze_news(news_url: str, news_title_hint: str = "") -> dict:
    """Gemini로 뉴스 요약 + 호재/악재/강도 판단. API 키 없으면 mock.

    참고: strength(강/중/약)는 LLM 자가 보고 — calibration 데이터 0.
    거짓 정밀성 회피를 위해 % 숫자 대신 카테고리만 사용. (FLR-20260408-AGT-001)
    """
    api_key = os.environ.get("GOOGLE_AI_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {
            "summary": f"[mock] {news_title_hint or '(요약 미생성 — API 키 없음)'}",
            "judgment": "중립",
            "strength": "약",
            "reasoning": "API 키 없음",
        }
    try:
        import urllib.error
        import urllib.request

        # 1) 뉴스 본문 fetch (간단)
        req = urllib.request.Request(
            news_url,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            news_html = resp.read().decode("utf-8", errors="ignore")
        news_text = html_to_text(news_html)[:3000]  # 처음 3000자만

        # 2) Gemini 호출
        prompt = f"""당신은 100M1S 회사의 주식투자팀 에이전트 "주주"입니다.
박성진 대표는 차트 위주 종가배팅 트레이더입니다.
종목 컨텍스트: {news_title_hint}

다음 뉴스를 한국 주식 시장 관점에서 분석하세요:

URL: {news_url}
본문(일부): {news_text}

판단:
- judgment: "호재" / "악재" / "중립"
- strength: 신호의 강도 — "강" / "중" / "약" 셋 중 하나
  · 강 = 명확하고 즉시 영향, 다중 출처/데이터 뒷받침
  · 중 = 영향 가능성 있으나 확정적이지 않음
  · 약 = 단서 수준, 추측 동반

다음 JSON 형식으로만 답하세요:
{{"summary": "3-5줄 한국어 요약", "judgment": "호재"|"악재"|"중립", "strength": "강"|"중"|"약", "reasoning": "1-2줄 판단 근거"}}"""

        payload = json.dumps(
            {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.3,
                    "responseMimeType": "application/json",
                },
            }
        ).encode("utf-8")

        gemini_url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.0-flash-exp:generateContent?key={api_key}"
        )
        req = urllib.request.Request(
            gemini_url,
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
        text = result["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
        # strength 정규화 (혹시 LLM이 다른 값 반환 시)
        strength = parsed.get("strength", "중")
        if strength not in ("강", "중", "약"):
            strength = "중"
        return {
            "summary": parsed.get("summary", ""),
            "judgment": parsed.get("judgment", "중립"),
            "strength": strength,
            "reasoning": parsed.get("reasoning", ""),
        }
    except Exception as e:
        log(f"⚠️ Gemini 분석 실패 ({news_url}): {e}")
        return {
            "summary": f"[분석 실패] {news_url}",
            "judgment": "중립",
            "strength": "약",
            "reasoning": f"오류: {e}",
        }


# ─── Main ────────────────────────────────────────────
def run() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    state = load_state()
    index = load_index()

    # 백필 모드: BACKFILL=1 이면 state.json 무시, 모든 article 처리
    backfill = os.environ.get("BACKFILL", "").strip() in ("1", "true", "True", "yes")
    if backfill:
        log("🔁 BACKFILL 모드 — state.json 무시, 모든 신규 article 처리")
        seen_ids: set[str] = set()
    else:
        seen_ids = set(state.get("seen_article_ids", []))

    # 한 번에 처리할 최대 article 수 (default 10, MAX_ARTICLES env로 override)
    try:
        max_articles = int(os.environ.get("MAX_ARTICLES", "10"))
    except ValueError:
        max_articles = 10
    log(f"최대 처리 article: {max_articles}")

    naver_id = os.environ.get("NAVER_CAFE_ID")
    naver_pw = os.environ.get("NAVER_CAFE_PASSWORD")
    cookies_env_present = bool(os.environ.get("NAVER_COOKIES", "").strip())
    if not cookies_env_present and (not naver_id or not naver_pw):
        log("❌ NAVER_COOKIES 없음 + NAVER_CAFE_ID/PASSWORD 없음")
        return 2

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log(
            "❌ playwright 미설치 — pip install playwright && playwright install chromium"
        )
        return 3

    # 쿠키 기반 인증 (NAVER_COOKIES JSON env 있으면 우선) — 봇 감지 우회
    cookies_json = os.environ.get("NAVER_COOKIES", "").strip()

    with sync_playwright() as p:
        browser, context = get_browser_context(p)

        cookies_loaded = False
        if cookies_json:
            try:
                cookie_list = json.loads(cookies_json)
                normalized = []
                # Cookie-Editor / Chrome export → Playwright 형식 정규화
                ss_map = {
                    "no_restriction": "None",
                    "norestriction": "None",
                    "none": "None",
                    "lax": "Lax",
                    "strict": "Strict",
                    "unspecified": "Lax",
                    "": "Lax",
                }
                for c in cookie_list:
                    name = c.get("name")
                    value = c.get("value")
                    if not name or value is None:
                        continue
                    domain = (c.get("domain") or ".naver.com").strip()
                    if not domain:
                        domain = ".naver.com"
                    # naver.com만 허용 (혹시 다른 도메인 섞여 있으면 제외)
                    if "naver.com" not in domain:
                        continue
                    # leading dot 보정 — Playwright는 양식 그대로 받음
                    same_site = (c.get("sameSite") or "").strip().lower()
                    same_site_norm = ss_map.get(same_site, "Lax")
                    cookie = {
                        "name": str(name),
                        "value": str(value),
                        "domain": domain,
                        "path": c.get("path") or "/",
                        "httpOnly": bool(c.get("httpOnly", False)),
                        "secure": bool(c.get("secure", True)),
                        "sameSite": same_site_norm,
                    }
                    # expirationDate (Cookie-Editor) → expires (Playwright)
                    exp = c.get("expirationDate") or c.get("expires")
                    if exp:
                        try:
                            exp_f = float(exp)
                            if exp_f > 0:
                                cookie["expires"] = exp_f
                        except (TypeError, ValueError):
                            pass
                    normalized.append(cookie)

                if normalized:
                    context.add_cookies(normalized)
                    log(f"🍪 NAVER_COOKIES 주입 완료 ({len(normalized)}개)")
                    cookies_loaded = True
                else:
                    log("⚠️ NAVER_COOKIES 정규화 후 유효 쿠키 0건")
            except Exception as e:
                log(f"⚠️ NAVER_COOKIES 파싱 실패: {e}")

        page = context.new_page()

        if cookies_loaded:
            log("쿠키 기반 인증 모드 — 로그인 단계 스킵")
            # 검증: 카페 메인 접근 → 로그인 상태 확인
            try:
                page.goto(
                    "https://www.naver.com",
                    wait_until="domcontentloaded",
                    timeout=15000,
                )
                time.sleep(2)
                # 로그인 상태 확인 — "MY" 또는 "로그아웃" 텍스트 또는 nickname
                logged_in = page.evaluate(
                    """() => {
                        const text = document.body.innerText || '';
                        return text.includes('로그아웃') || text.includes('MY');
                    }"""
                )
                _save_debug(page, "cookie_auth_check")
                if not logged_in:
                    log("❌ 쿠키 인증 실패 — 쿠키 만료 또는 무효")
                    log("→ 새 쿠키 추출 후 NAVER_COOKIES secret 갱신 필요")
                    browser.close()
                    return 5
                log("✓ 쿠키 인증 성공")
            except Exception as e:
                log(f"⚠️ 쿠키 검증 예외: {e}")
                _save_debug(page, "cookie_check_exception")
                browser.close()
                return 6
        else:
            # 쿠키 없거나 실패 — ID/PW fallback
            log("네이버 로그인 시도 (ID/PW)…")
            if not naver_login(page, naver_id, naver_pw):
                log("❌ 로그인 실패. 디버그 HTML 저장 후 종료.")
                _save_debug(page, "login_final")
                browser.close()
                return 4

        log("메뉴 article 목록 수집…")
        article_ids = fetch_menu_article_ids(page)
        new_ids = [aid for aid in article_ids if aid not in seen_ids]
        log(f"신규 article: {len(new_ids)}")

        new_posts = []
        for aid in new_ids[:max_articles]:
            log(f"→ article {aid} 처리 중…")
            html = fetch_article_html(page, aid)
            if not html:
                continue
            parsed = parse_post(html)  # run()에선 title 미수집 — 제목 포함 날짜는 본문 fallback

            # 종목별 뉴스 카드에 Gemini 분석 적용 — post 당 최대 50 호출
            # (멀티 뉴스 종목 안전 처리)
            MAX_GEMINI_PER_POST = 50
            calls = 0
            for section in parsed["sections"]:
                for stock in section["stocks"]:
                    for card in stock.get("news_cards", []):
                        if calls >= MAX_GEMINI_PER_POST:
                            break
                        hint = f"{stock['name']} {card.get('theme_hint', '')}"
                        analysis = gemini_analyze_news(card["url"], hint)
                        card.update(analysis)
                        # theme_hint는 내부용 — 응답에서 제거
                        card.pop("theme_hint", None)
                        calls += 1
                    if calls >= MAX_GEMINI_PER_POST:
                        break
                if calls >= MAX_GEMINI_PER_POST:
                    break

            stock_count = sum(len(s["stocks"]) for s in parsed["sections"])
            news_count = sum(
                len(stock.get("news_cards", []))
                for s in parsed["sections"]
                for stock in s["stocks"]
            )

            post_record = {
                "post_id": aid,
                "post_url": ARTICLE_URL_TEMPLATE.format(article_id=aid),  # 내부용
                "post_date": parsed.get("post_date"),
                "fetched_at": datetime.now(KST).isoformat(timespec="seconds"),
                "parse_format": parsed.get("parse_format"),
                "parse_status": parsed.get("parse_status"),
                "stock_count": stock_count,
                "news_count": news_count,
                "sections": parsed["sections"],
            }
            if "essay" in parsed:
                post_record["essay"] = parsed["essay"]

            # 개별 파일 저장
            post_dir = DATA_DIR / "posts"
            post_dir.mkdir(exist_ok=True)
            (post_dir / f"{aid}.json").write_text(
                json.dumps(post_record, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            new_posts.append(
                {
                    "post_id": aid,
                    "post_date": post_record["post_date"],
                    "fetched_at": post_record["fetched_at"],
                    "stock_count": stock_count,
                    "news_count": news_count,
                }
            )
            seen_ids.add(aid)
            time.sleep(2)  # rate limit

        browser.close()

    # 인덱스 + state 갱신
    if new_posts:
        index.setdefault("posts", [])
        index["posts"] = new_posts + index["posts"]
        index["posts"] = index["posts"][:100]  # 최근 100개만
    index["updated_at"] = datetime.now(KST).isoformat(timespec="seconds")
    save_index(index)

    state["seen_article_ids"] = sorted(seen_ids, key=int, reverse=True)[:500]
    state["last_run_at"] = datetime.now(KST).isoformat(timespec="seconds")
    save_state(state)

    log(f"✓ 완료. 신규 {len(new_posts)}건 처리.")
    return 0


if __name__ == "__main__":
    sys.exit(run())
