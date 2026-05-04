"""REQ-008 Invariant 4 — UI 도메인 텍스트 화이트리스트 검사.

목적:
- `js/renderer.js` + `news.css`에 신규 도메인 텍스트(투자주의/경고 등 KRX 규정 키워드 포함)가
  추가될 때 togusa가 관리하는 화이트리스트 등록 없이는 통과 못 하게 차단
- FLR-002 패턴(출처 불명 창작 문구) 재발 근본 차단

사용:
  # pre-commit hook (기본): staged diff에서 변경 라인만 검사
  python3 scripts/precommit/check_ui_domain_text.py

  # baseline 검사 (CI/PR 단위): 작업트리 전체 검사
  python3 scripts/precommit/check_ui_domain_text.py --check-baseline

종료 코드:
  0 = 통과
  1 = 미등록 매치 발견 (커밋 차단 또는 baseline 실패)
  2 = 환경 오류 (화이트리스트 JSON 없음 등)

화이트리스트 위치:
  $UI_TEXT_WHITELIST 환경변수 또는
  ../100m1s/rules/_whitelist/ui-text.json (홈페이지 레포 부모 디렉토리 기준)
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_WL_REL = "../100m1s/rules/_whitelist/ui-text.json"
TARGET_FILES = [
    os.path.join(ROOT, "js", "renderer.js"),
    os.path.join(ROOT, "news.css"),
]

# 한국어 문자열 리터럴 추출 — JS template literal/string + CSS content/title 등
# 따옴표(`'"`) 또는 backtick으로 감싼 한글 포함 토큰
_KO_STRING_RE = re.compile(r"""(['"`])([^'"`\\]*[가-힣][^'"`\\]*?)\1""")

# non_domain 통과 패턴 (정규식, 라인 단위 매치 시 도메인 검사 면제)
_NON_DOMAIN_PATTERNS = [
    # 한 줄 주석 (단, JSDoc 같은 다중 줄 일부도 // 시작)
    re.compile(r"^\s*//"),
    # 다중 줄 주석 단일 줄 형식 / 블록 시작/끝 단독 줄
    re.compile(r"^\s*/\*"),
    re.compile(r"^\s*\*/?\s*"),
    # CSS 주석 라인
    re.compile(r"^\s*/\*.*\*/\s*$"),
    # CSS 클래스 정의 시작 (`.cal-... { ... }`) — 셀렉터에 한글 없을 때
    # (실제 한국어가 셀렉터에 들어가지 않으므로 한글 매치 자체가 없음 → 도메인 검사 통과)
    # 변수명/함수명/속성명만 있는 라인 (한글 없으면 자동 통과)
    # stage enum 비교 패턴: `stage === '투자경고'` — 화이트리스트 stage_label에 등록되어 통과
]

DOMAIN_KW_RE: re.Pattern | None = None
WL_ITEMS_BY_TEXT: set[str] = set()


def load_whitelist(path: str) -> dict:
    if not os.path.isfile(path):
        print(f"ERROR: 화이트리스트 JSON 미존재: {path}", file=sys.stderr)
        sys.exit(2)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def index_whitelist(wl: dict) -> tuple[re.Pattern, set[str]]:
    """화이트리스트에서 도메인 패턴 + 등록된 텍스트 집합 추출."""
    pat_str = wl.get("$domain_keywords_pattern", "")
    if not pat_str:
        print("ERROR: 화이트리스트에 $domain_keywords_pattern 없음", file=sys.stderr)
        sys.exit(2)
    pat = re.compile(pat_str)

    items: set[str] = set()
    cats = wl.get("categories", {})
    for cat_name, cat in cats.items():
        if cat_name == "non_domain":
            continue
        if not isinstance(cat, dict):
            continue
        for it in cat.get("items", []) or []:
            if isinstance(it, str):
                items.add(it.strip())
            elif isinstance(it, dict):
                # text 또는 key 필드
                t = it.get("text") or it.get("value")
                if t:
                    items.add(str(t).strip())
    return pat, items


def is_non_domain_line(line: str) -> bool:
    """주석 등 도메인 검사 면제 라인 판정."""
    for pat in _NON_DOMAIN_PATTERNS:
        if pat.match(line):
            return True
    return False


def extract_ko_strings(line: str) -> list[str]:
    """라인에서 한국어를 포함한 문자열 리터럴 토큰 전부 추출."""
    out = []
    for m in _KO_STRING_RE.finditer(line):
        s = m.group(2).strip()
        if s and DOMAIN_KW_RE and DOMAIN_KW_RE.search(s):
            out.append(s)
    return out


def get_changed_lines() -> list[tuple[str, int, str]]:
    """staged diff에서 추가/변경 라인 추출. (file, lineno, content)."""
    try:
        diff = subprocess.run(
            ["git", "diff", "--staged", "--unified=0", "--", *TARGET_FILES],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        ).stdout
    except FileNotFoundError:
        return []

    out: list[tuple[str, int, str]] = []
    cur_file = ""
    cur_line = 0
    for raw in diff.splitlines():
        if raw.startswith("+++ b/"):
            cur_file = raw[6:]
            continue
        m = re.match(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@", raw)
        if m:
            cur_line = int(m.group(1))
            continue
        if raw.startswith("+") and not raw.startswith("+++"):
            out.append((cur_file, cur_line, raw[1:]))
            cur_line += 1
        elif not raw.startswith("-") and not raw.startswith("\\"):
            cur_line += 1
    return out


def get_baseline_lines() -> list[tuple[str, int, str]]:
    """baseline: 대상 파일 전체 라인."""
    out: list[tuple[str, int, str]] = []
    for path in TARGET_FILES:
        if not os.path.isfile(path):
            continue
        rel = os.path.relpath(path, ROOT)
        with open(path, encoding="utf-8") as f:
            for i, line in enumerate(f, start=1):
                out.append((rel, i, line.rstrip("\n")))
    return out


def check_lines(lines: list[tuple[str, int, str]]) -> list[dict]:
    """미등록 매치 리스트 반환."""
    violations: list[dict] = []
    for path, lineno, content in lines:
        if is_non_domain_line(content):
            continue
        # 한국어 도메인 문자열 추출
        strs = extract_ko_strings(content)
        for s in strs:
            if s not in WL_ITEMS_BY_TEXT:
                violations.append(
                    {
                        "file": path,
                        "line": lineno,
                        "text": s,
                        "context": content.strip()[:120],
                    }
                )
    return violations


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check-baseline",
        action="store_true",
        help="staged diff 대신 작업트리 전체 검사",
    )
    parser.add_argument(
        "--whitelist",
        default=os.environ.get(
            "UI_TEXT_WHITELIST",
            os.path.normpath(os.path.join(ROOT, DEFAULT_WL_REL)),
        ),
        help="화이트리스트 JSON 경로 (기본: $UI_TEXT_WHITELIST 또는 표준 경로)",
    )
    args = parser.parse_args()

    global DOMAIN_KW_RE, WL_ITEMS_BY_TEXT
    wl = load_whitelist(args.whitelist)
    DOMAIN_KW_RE, WL_ITEMS_BY_TEXT = index_whitelist(wl)

    mode = "baseline" if args.check_baseline else "staged-diff"
    lines = get_baseline_lines() if args.check_baseline else get_changed_lines()
    if not lines:
        print(f"[{mode}] 검사 대상 라인 없음 (renderer.js / news.css 변경 없음)")
        return 0

    violations = check_lines(lines)
    if not violations:
        print(
            f"[{mode}] PASS — UI 도메인 텍스트 미등록 매치 0건 ({len(lines)} 라인 검사)"
        )
        return 0

    print(f"[{mode}] FAIL — UI 도메인 텍스트 미등록 매치 {len(violations)}건:")
    for v in violations:
        print(f"  {v['file']}:{v['line']}")
        print(f"    text: {v['text']}")
        print(f"    line: {v['context']}")
    print()
    print("=== 조치 ===")
    print("1. 신규 텍스트가 KRX 규정 fact라면:")
    print(
        "   togusa에 SendMessage로 화이트리스트 추가 요청 (rules/_whitelist/ui-text.json)"
    )
    print(
        "   - 어느 카테고리(stage_label/insight_text/section_title 등)에 등록할지 명시"
    )
    print("   - regulation_basis (krx-stage-conditions.json 또는 DSN-001 §X) 출처 첨부")
    print("2. UI 라벨/구조 텍스트라면 design-lead에 워크스루 요청")
    print("3. 검사 면제(주석 등)면 라인을 //로 시작하도록 정리")
    return 1


if __name__ == "__main__":
    sys.exit(main())
