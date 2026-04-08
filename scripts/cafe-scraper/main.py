"""
뉴지 — 주식차트연구소 카페 스크레이퍼

매 시간 GitHub Actions cron으로 실행.
새 게시글 발견 → 본문 파싱 → 종목 추출 → 뉴스 링크 요약 → 호재/악재 판단 → JSON 저장.

저작권: 원문은 저장하지 않음. 요약 + 메타데이터만.
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

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


def naver_login(page, naver_id: str, naver_pw: str) -> bool:
    """네이버 로그인. 봇 감지 가능성 있음 — 실패 시 raw HTML 저장."""
    try:
        page.goto("https://nid.naver.com/nidlogin.login", wait_until="domcontentloaded")
        page.wait_for_selector("#id", timeout=10000)
        # JS로 직접 set (붙여넣기 감지 회피)
        page.evaluate(
            """([id, pw]) => {
                document.querySelector('#id').value = id;
                document.querySelector('#pw').value = pw;
            }""",
            [naver_id, naver_pw],
        )
        page.click(".btn_login, #log\\.login")
        page.wait_for_load_state("networkidle", timeout=15000)
        # 로그인 성공 검증 — naver.com 메인으로 리다이렉트되는지
        if "nid.naver.com" in page.url and "login" in page.url:
            log(f"⚠️ 로그인 실패 가능성. 현재 URL: {page.url}")
            return False
        return True
    except Exception as e:
        log(f"⚠️ 로그인 예외: {e}")
        return False


def fetch_menu_article_ids(page) -> list[str]:
    """메뉴 페이지의 글 목록에서 article ID 리스트 수집."""
    page.goto(MENU_URL, wait_until="networkidle")
    time.sleep(2)
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
    """글 본문 HTML(텍스트 위주) 수집."""
    url = ARTICLE_URL_TEMPLATE.format(article_id=article_id)
    try:
        page.goto(url, wait_until="networkidle")
        time.sleep(2)
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
                    return el.inner_html()
            except Exception:
                continue
        # iframe 내부
        for frame in page.frames:
            for sel in [".se-main-container", "#postViewArea", ".article_content"]:
                try:
                    el = frame.query_selector(sel)
                    if el:
                        return el.inner_html()
                except Exception:
                    continue
        return page.content()
    except Exception as e:
        log(f"⚠️ article {article_id} fetch 실패: {e}")
        return None


# ─── 파싱 ────────────────────────────────────────────
STOCK_LINE_RE = re.compile(
    r"(?P<rank>\d{1,3})\s+"
    r"(?P<tag>[신경주증]?)\s*"
    r"(?P<name>[가-힣A-Za-z0-9&·\-]+)\s+"
    r"(?P<price>[\d,]+)\s*"
    r"[▲▼↑↓]?\s*"
    r"(?P<change>[\d,]+)\s+"
    r"(?P<change_pct>[+\-][\d.]+)"
)
THEME_LINE_RE = re.compile(r"^([가-힣A-Za-z0-9·]+)\s*:\s*(.+)$")


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


def extract_news_links(html: str) -> list[dict]:
    """본문에서 외부 뉴스 링크 추출. 네이버 카페 내부 링크는 제외."""
    links = []
    seen = set()
    for m in re.finditer(r'href="(https?://[^"]+)"', html):
        url = m.group(1)
        host = urlparse(url).netloc
        if "cafe.naver.com" in host or "naver.com/articles" in url:
            continue
        if url in seen:
            continue
        seen.add(url)
        links.append({"url": url, "source": host})
    return links


def parse_post(html: str) -> dict:
    """본문 HTML → 구조화된 데이터.
    종목 누락 방지를 위해 여러 패턴을 시도하고, 추출된 모든 종목을 보존."""
    text = html_to_text(html)
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    sections = {"상승": [], "하락": []}
    current_section = None

    # 1) 종목 표 추출 — 매우 관대하게
    for line in lines:
        if "[상승]" in line or line.startswith("상승"):
            current_section = "상승"
            continue
        if "[하락]" in line or line.startswith("하락"):
            current_section = "하락"
            continue

        if current_section:
            m = STOCK_LINE_RE.search(line)
            if m:
                try:
                    sections[current_section].append(
                        {
                            "rank": int(m.group("rank")),
                            "category_tag": m.group("tag") or None,
                            "name": m.group("name"),
                            "price_won": int(m.group("price").replace(",", "")),
                            "change_won": int(m.group("change").replace(",", "")),
                            "change_pct": float(m.group("change_pct")),
                            "ticker": None,  # KRX 매핑 미구현
                            "theme_label": None,
                            "news_links": [],
                        }
                    )
                except (ValueError, AttributeError):
                    pass

    # 2) 테마 라벨 매칭 — "종목명 : 설명" 패턴
    theme_map: dict[str, str] = {}
    for line in lines:
        m = THEME_LINE_RE.match(line)
        if m:
            name = m.group(1).strip()
            theme = m.group(2).strip()
            if 1 < len(name) < 30:
                theme_map[name] = theme

    for section in sections.values():
        for stock in section:
            for name_key, theme in theme_map.items():
                if name_key in stock["name"] or stock["name"] in name_key:
                    stock["theme_label"] = theme
                    break

    # 3) 뉴스 링크 (전체 본문 기준 — 종목별 매칭은 LLM 단계로 위임)
    all_news_links = extract_news_links(html)

    # strength_score 계산
    import math

    for section in sections.values():
        for stock in section:
            try:
                ta = max(stock["change_won"] * stock.get("price_won", 1), 1_000_000_000)
                # 거래대금 추출이 누락된 경우 fallback
                stock["strength_score"] = round(
                    abs(stock["change_pct"]) * math.log10(ta / 1_000_000_000),
                    2,
                )
            except Exception:
                stock["strength_score"] = None

    return {
        "sections": [{"type": k, "stocks": v} for k, v in sections.items() if v],
        "all_news_links": all_news_links,
        "raw_text_excerpt": text[:200] + "…"
        if len(text) > 200
        else text,  # 디버깅용 일부
    }


# ─── 뉴스 요약 + 호재/악재 (Gemini) ──────────────────────
def gemini_analyze_news(news_url: str, news_title_hint: str = "") -> dict:
    """Gemini로 뉴스 요약 + 호재/악재 판단. API 키 없으면 mock."""
    api_key = os.environ.get("GOOGLE_AI_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {
            "summary": f"[mock] {news_title_hint or '(요약 미생성 — API 키 없음)'}",
            "judgment": "중립",
            "confidence": 0.0,
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

다음 뉴스를 한국 주식 시장 관점에서 분석하세요:

URL: {news_url}
본문(일부): {news_text}

다음 JSON 형식으로만 답하세요:
{{"summary": "3-5줄 한국어 요약", "judgment": "호재" 또는 "악재" 또는 "중립", "confidence": 0.0~1.0 숫자, "reasoning": "1-2줄 판단 근거"}}"""

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
        return {
            "summary": parsed.get("summary", ""),
            "judgment": parsed.get("judgment", "중립"),
            "confidence": float(parsed.get("confidence", 0.0)),
            "reasoning": parsed.get("reasoning", ""),
        }
    except Exception as e:
        log(f"⚠️ Gemini 분석 실패 ({news_url}): {e}")
        return {
            "summary": f"[분석 실패] {news_url}",
            "judgment": "중립",
            "confidence": 0.0,
            "reasoning": f"오류: {e}",
        }


# ─── Main ────────────────────────────────────────────
def run() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    state = load_state()
    index = load_index()
    seen_ids = set(state.get("seen_article_ids", []))

    naver_id = os.environ.get("NAVER_CAFE_ID")
    naver_pw = os.environ.get("NAVER_CAFE_PASSWORD")
    if not naver_id or not naver_pw:
        log("❌ NAVER_CAFE_ID / NAVER_CAFE_PASSWORD 환경변수 없음")
        return 2

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log(
            "❌ playwright 미설치 — pip install playwright && playwright install chromium"
        )
        return 3

    with sync_playwright() as p:
        browser, context = get_browser_context(p)
        page = context.new_page()

        log("네이버 로그인 시도…")
        if not naver_login(page, naver_id, naver_pw):
            log("❌ 로그인 실패. 디버그 HTML 저장 후 종료.")
            (DATA_DIR / "debug_login.html").write_text(page.content(), encoding="utf-8")
            browser.close()
            return 4

        log("메뉴 article 목록 수집…")
        article_ids = fetch_menu_article_ids(page)
        new_ids = [aid for aid in article_ids if aid not in seen_ids]
        log(f"신규 article: {len(new_ids)}")

        new_posts = []
        for aid in new_ids[:10]:  # 한 번에 최대 10개
            log(f"→ article {aid} 처리 중…")
            html = fetch_article_html(page, aid)
            if not html:
                continue
            parsed = parse_post(html)

            # 뉴스 링크 분석 (상위 5개만 — 비용 제한)
            for nl in parsed["all_news_links"][:5]:
                analysis = gemini_analyze_news(nl["url"])
                nl.update(analysis)

            post_record = {
                "post_id": aid,
                "post_url": ARTICLE_URL_TEMPLATE.format(article_id=aid),
                "fetched_at": datetime.now(KST).isoformat(timespec="seconds"),
                "sections": parsed["sections"],
                "news_cards": parsed["all_news_links"][:5],
                "stock_count": sum(len(s["stocks"]) for s in parsed["sections"]),
            }

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
                    "post_url": post_record["post_url"],
                    "fetched_at": post_record["fetched_at"],
                    "stock_count": post_record["stock_count"],
                    "news_count": len(post_record["news_cards"]),
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
