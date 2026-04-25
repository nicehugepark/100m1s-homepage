"""REQ-008 Invariant 5 — 색깔·UI 의미 단위 테스트.

목적:
- `.up` / `.down` 한국 증시 관습 색깔 hex 값 정합 보장
- `js/renderer.js` 신고가/신저가 분기 의미 단위 정합 보장
- pre-commit / CI 단계에서 의도적·우발적 swap 차단

실행:
  python3 scripts/tests/test_ui_invariants.py
종료 코드:
  0 = 모두 PASS
  1 = 한 건이라도 FAIL
"""

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CSS_PATH = os.path.join(ROOT, "news.css")
JS_PATH = os.path.join(ROOT, "js", "renderer.js")

# 한국 증시 관습 (전 세계 다수와 반대):
# - 양수(상승) = 빨강 (#C53939)
# - 음수(하락) = 파랑 (#1958C7)
EXPECTED_UP_HEX = "#C53939"
EXPECTED_DOWN_HEX = "#1958C7"

failures: list[str] = []


def fail(msg: str) -> None:
    failures.append(msg)
    print(f"  FAIL: {msg}")


def ok(msg: str) -> None:
    print(f"  PASS: {msg}")


def read(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: news.css `.up` / `.down` color hex 검증
# ─────────────────────────────────────────────────────────────────────────────
def test_css_up_down_colors() -> None:
    print("[1] news.css .up/.down 색깔 hex 검증")
    css = read(CSS_PATH)

    # 도메인 의미 클래스 화이트리스트 (단순 swap 차단용)
    # form: <selector>.up / <selector>.down → 한국 증시 관습 hex 강제
    targets = [
        ".section-title.up",
        ".section-title.down",
        ".stock-pct.up",
        ".stock-pct.down",
        ".kiwoom-pct.up",
        ".kiwoom-pct.down",
        ".cal-trade-pct.up",
        ".cal-trade-pct.down",
        ".cal-feature-pct.up",
        ".cal-feature-pct.down",
    ]

    for sel in targets:
        # 정확히 셀렉터로 시작하는 룰만 매치 (오버라이드/유사 셀렉터 회피)
        # `.section-title.up { color: #XXXXXX;` 같은 패턴
        pattern = re.compile(
            re.escape(sel) + r"\s*\{[^}]*color\s*:\s*(#[0-9A-Fa-f]{3,6})", re.MULTILINE
        )
        match = pattern.search(css)
        if not match:
            # 셀렉터 없으면 skip (해당 클래스 미사용 가능). but 알려는 줌
            print(f"  SKIP: '{sel}' 미존재")
            continue
        actual = match.group(1).upper()
        expected = EXPECTED_UP_HEX if sel.endswith(".up") else EXPECTED_DOWN_HEX
        if actual.upper() == expected.upper():
            ok(f"{sel} = {actual}")
        else:
            fail(
                f"{sel} = {actual} (expected {expected}) "
                f"— 한국 증시 관습 위반 (양수=빨강 #C53939, 음수=파랑 #1958C7)"
            )


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: renderer.js 신고가/신저가 분기 의미 단위 정합
# ─────────────────────────────────────────────────────────────────────────────
def test_js_new_high_low_branch() -> None:
    print("[2] renderer.js 신고가/신저가 분기 정합")
    js = read(JS_PATH)

    # 2-1. isNewLow / isNewHigh 정의 검사
    def_pat_low = re.compile(
        r"const\s+isNewLow\s*=\s*\(?\s*r240\.low\s*===\s*r240\.current\s*\)?\s*;"
    )
    def_pat_high = re.compile(
        r"const\s+isNewHigh\s*=\s*\(?\s*r240\.high\s*===\s*r240\.current\s*\)?\s*;"
    )
    if def_pat_low.search(js):
        ok("isNewLow = (r240.low === r240.current)")
    else:
        fail(
            "isNewLow 정의 미발견 또는 swap 의심 "
            "(기대: const isNewLow = r240.low === r240.current)"
        )
    if def_pat_high.search(js):
        ok("isNewHigh = (r240.high === r240.current)")
    else:
        fail(
            "isNewHigh 정의 미발견 또는 swap 의심 "
            "(기대: const isNewHigh = r240.high === r240.current)"
        )

    # 2-2. lowText / highText 분기 텍스트
    if re.search(r"const\s+lowText\s*=\s*isNewLow\s*\?\s*['\"]신저가['\"]", js):
        ok("lowText = isNewLow ? '신저가'")
    else:
        fail("lowText 분기 미발견 또는 텍스트 swap 의심")
    if re.search(r"const\s+highText\s*=\s*isNewHigh\s*\?\s*['\"]신고가['\"]", js):
        ok("highText = isNewHigh ? '신고가'")
    else:
        fail("highText 분기 미발견 또는 텍스트 swap 의심")

    # 2-3. lowCls / highCls 클래스 분기
    # lowCls: isNewLow → 'down', else low_pct >= 0 → 'up' / 'down'
    # highCls: isNewHigh → 'up', else high_pct <= 0 → 'down' / 'up'
    if re.search(r"const\s+lowCls\s*=\s*isNewLow\s*\?\s*['\"]down['\"]", js):
        ok("lowCls = isNewLow ? 'down' (신저가 → 파랑)")
    else:
        fail(
            "lowCls 분기 미발견 또는 swap 의심 (기대: const lowCls = isNewLow ? 'down')"
        )
    if re.search(r"const\s+highCls\s*=\s*isNewHigh\s*\?\s*['\"]up['\"]", js):
        ok("highCls = isNewHigh ? 'up' (신고가 → 빨강)")
    else:
        fail(
            "highCls 분기 미발견 또는 swap 의심 "
            "(기대: const highCls = isNewHigh ? 'up')"
        )


# ─────────────────────────────────────────────────────────────────────────────
# 실행
# ─────────────────────────────────────────────────────────────────────────────
def main() -> int:
    print("REQ-008 Invariant 5 — 색깔·UI 의미 단위 테스트\n")
    test_css_up_down_colors()
    print()
    test_js_new_high_low_branch()
    print()
    if failures:
        print(f"[FAIL] 총 {len(failures)}건 위반")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("[PASS] 모든 invariant 통과")
    return 0


if __name__ == "__main__":
    sys.exit(main())
