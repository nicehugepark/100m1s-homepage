#!/usr/bin/env python3
"""
🔴 P0-2 셀프테스트 (FLR-20260605-TEC-001) — 공유 URL manifest 존재 보장 + 404 봉쇄.

대상: js/renderer.js 의 _computeShareUrl (공유 URL 결정 SSOT, 핸들러 verbatim 위임) +
      _manifestHasPage (manifest 판정) + _loadPageManifest (manifest 로드/schema validation).

playwright(headless chromium)로 renderer.js + calendar.js 를 실제 브라우저 컨텍스트에 로드,
fetch 를 인터셉트해 manifest 를 주입하고 실 함수를 호출해 판정.

검증 3종:
  (a) 존재하는 과거 카드 공유 → OG landing URL (/pm320/stock/{date}/{code}.html, Q-20260605-105)
  (b) manifest 에 없는 종목/날짜 공유 → pm320.html 폴백 (404 경로 아님)
  (c) 무회귀:
      c1. OPEN 시간 오늘 카드 + manifest 에 페이지 존재 → OG URL (OG 미리보기 유지)
      c2. manifest null(부재/parse 실패) + 오늘+PRE_MARKET → pm320.html 폴백 (휴리스틱 degrade)
      c3. manifest null + 과거 카드 → OG URL (과거 카드 무회귀)
  (d) _loadPageManifest schema validation: pages 누락 JSON → null (보수적)

종료코드 0 = 전부 PASS, 1 = 1건+ FAIL.
"""

import http.server
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).resolve().parents[2]
PORT = 8771
ORIGIN = f"http://localhost:{PORT}"

MANIFEST = {
    "schema": "page-manifest/v1",
    "generated_at": "2026-06-05T01:00:00Z",
    "total_pages": 2,
    "pages": {
        "2026-06-04": ["000650", "005935"],
        "2026-06-05": ["000660"],  # 오늘(OPEN) 페이지 존재 케이스용
    },
}

# pages 누락 — schema validation 이 null 로 떨어뜨려야 함
BAD_MANIFEST = {"schema": "page-manifest/v1", "generated_at": "x", "oops": True}


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    def handler(*a, **k):
        return QuietHandler(*a, directory=str(REPO_ROOT), **k)

    httpd = socketserver.TCPServer(("", PORT), handler)
    httpd.allow_reuse_address = True
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def run():
    httpd = serve()
    failures = []

    def check(name, got, expect_contains, expect_not_contains=None):
        ok = expect_contains in got
        if expect_not_contains is not None and expect_not_contains in got:
            ok = False
        status = "PASS" if ok else "FAIL"
        print(f"  [{status}] {name}: {got}")
        if not ok:
            failures.append((name, got, expect_contains, expect_not_contains))

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            # service_workers='block' — sw.js 가 fetch 를 가로채 page.route 를 무력화하므로
            #   (d) manifest fetch/route 테스트를 위해 SW 차단. (a~c)는 SW 무관(순수 함수).
            context = browser.new_context(service_workers="block")
            page = context.new_page()

            # initCalendar 가 load 시 네트워크 init 하지 않게 stub (renderer.js L끝 호출).
            page.add_init_script("window.initCalendar = function(){};")

            # renderer.js + calendar.js 로드 (calendar.js 의 실 getMarketState 사용 가능).
            #   Q-20260605-104/105 — news.html 은 redirect stub 이므로 본 페이지 pm320.html 로드.
            page.goto(f"{ORIGIN}/pm320.html")
            # pm320.html 의 defer 스크립트 로드 완료 대기
            page.wait_for_function(
                "typeof window._computeShareUrl === 'function'", timeout=10000
            )
            page.wait_for_function(
                "typeof window._manifestHasPage === 'function'", timeout=10000
            )

            origin = ORIGIN
            tok = "2026060510"

            # ---- (a) 존재하는 과거 카드 → OG URL ----
            url_a = page.evaluate(
                "([o,t,m]) => window._computeShareUrl(o,'000650','2026-06-04',t,m,Date.now(),null)",
                [origin, tok, MANIFEST],
            )
            check(
                "(a) 과거 카드 존재 → OG",
                url_a,
                "/pm320/stock/2026-06-04/000650.html",
                "pm320.html?stock",
            )

            # ---- (b) manifest 에 없는 종목 → pm320.html 폴백 (404 아님) ----
            url_b = page.evaluate(
                "([o,t,m]) => window._computeShareUrl(o,'999999','2026-06-04',t,m,Date.now(),null)",
                [origin, tok, MANIFEST],
            )
            check(
                "(b) 미배포 종목 → 폴백",
                url_b,
                "/pm320.html?stock=999999",
                "/pm320/stock/",
            )

            # ---- (b2) 날짜 키 자체 없음 → 폴백 ----
            url_b2 = page.evaluate(
                "([o,t,m]) => window._computeShareUrl(o,'000650','2026-06-03',t,m,Date.now(),null)",
                [origin, tok, MANIFEST],
            )
            check(
                "(b2) manifest 없는 날짜 → 폴백",
                url_b2,
                "/pm320.html?stock=000650",
                "/pm320/stock/",
            )

            # ---- (c1) OPEN 시간 오늘 카드 + manifest 페이지 존재 → OG URL (무회귀) ----
            # getMarketStateFn = OPEN 강제 stub. manifest 에 2026-06-05/000660 존재 → OG 유지.
            now_0605 = "Date.UTC(2026,5,5,2,0,0)"  # 2026-06-05 11:00 KST 부근
            url_c1 = page.evaluate(
                "([o,t,m,n]) => window._computeShareUrl(o,'000660','2026-06-05',t,m,n,()=> 'OPEN')",
                [origin, tok, MANIFEST, page.evaluate(f"() => {now_0605}")],
            )
            check(
                "(c1) OPEN 오늘 카드+페이지존재 → OG 유지",
                url_c1,
                "/pm320/stock/2026-06-05/000660.html",
                "pm320.html?stock",
            )

            # ---- (c2) manifest null + 오늘+PRE_MARKET → 폴백 (휴리스틱 degrade) ----
            url_c2 = page.evaluate(
                "([o,t,n]) => window._computeShareUrl(o,'000660','2026-06-05',t,null,n,()=> 'PRE_MARKET')",
                [origin, tok, page.evaluate(f"() => {now_0605}")],
            )
            check(
                "(c2) manifest null+오늘 PRE_MARKET → 폴백",
                url_c2,
                "/pm320.html?stock=000660",
                "/pm320/stock/",
            )

            # ---- (c3) manifest null + 과거 카드 → OG URL (과거 무회귀) ----
            url_c3 = page.evaluate(
                "([o,t,n]) => window._computeShareUrl(o,'000650','2026-06-04',t,null,n,()=> 'POST_MARKET')",
                [origin, tok, page.evaluate(f"() => {now_0605}")],
            )
            check(
                "(c3) manifest null+과거 카드 → OG",
                url_c3,
                "/pm320/stock/2026-06-04/000650.html",
                "pm320.html?stock",
            )

            # ---- (d) _loadPageManifest fetch + schema validation ----
            # 단일 동적 route (mode 가변) — SW 차단 컨텍스트라 page.route 가 정상 가로챔.
            import json as _json

            mode = {"v": "good"}

            def _manifest_route(route):
                if mode["v"] == "good":
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=_json.dumps(MANIFEST),
                    )
                elif mode["v"] == "bad":
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=_json.dumps(BAD_MANIFEST),
                    )
                else:  # 404
                    route.fulfill(status=404, body="")

            page.route("**/page-manifest.json**", _manifest_route)

            # d1: 정상 manifest fetch → pages object 채워짐
            mode["v"] = "good"
            ok_load = page.evaluate(
                "async () => { delete window._pageManifestPromise; delete window._pageManifest;"
                " const m = await window._loadPageManifest();"
                " return !!(m && m.pages && Array.isArray(m.pages['2026-06-04'])); }"
            )
            check(
                "(d1) 정상 manifest 로드 → pages object", str(ok_load).lower(), "true"
            )

            # d2: pages 누락 JSON → null (schema validation 보수적)
            mode["v"] = "bad"
            null_load = page.evaluate(
                "async () => { delete window._pageManifestPromise; delete window._pageManifest;"
                " const m = await window._loadPageManifest();"
                " return m === null && window._pageManifest === null; }"
            )
            check(
                "(d2) pages 누락 JSON → null (보수적)", str(null_load).lower(), "true"
            )

            # d3: fetch 404 → null (보수적)
            mode["v"] = "404"
            nf_load = page.evaluate(
                "async () => { delete window._pageManifestPromise; delete window._pageManifest;"
                " const m = await window._loadPageManifest(); return m === null; }"
            )
            check("(d3) manifest 404 → null (보수적)", str(nf_load).lower(), "true")

            browser.close()
    finally:
        httpd.shutdown()

    print()
    if failures:
        print(f"❌ {len(failures)}건 FAIL")
        return 1
    print("✅ 전체 PASS (manifest 존재 보장 + 404 봉쇄 + 무회귀 + schema validation)")
    return 0


if __name__ == "__main__":
    sys.exit(run())
