#!/usr/bin/env python3
"""Q-20260605-105 — 종목 상세 URL 이전: news/stock/{date}/{code}.html → pm320/stock/...

대표 2026-06-05 21:52 (토요일 계획 철회, 07:00 빌드 전 완결).

동작 (date/code 상세 페이지 1043장 대상, date-level {date}.html 은 별도 후속):
  1. news/stock/{date}/{code}.html → pm320/stock/{date}/{code}.html 복사 (내용 그대로,
     내부 og:image 절대 URL은 옛 og 경로 유지 = 무파손).
  2. 옛 경로 파일 → 경량 redirect stub 재생성:
     location.replace('/pm320/stock/{date}/{code}.html' + location.search) + noscript meta refresh
     + canonical 새 경로. (크롤러는 canonical 로 새 경로 인지, 사용자는 자동 이동.)

과거 링크 무파손 절대 원칙: 옛 경로 GET → stub → 새 경로(query 보존). 새 경로 = 기존 content 동일.

idempotent: 이미 stub 인 옛 파일(REDIRECT_MARKER 포함)은 재복사 SKIP (재실행 안전).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_BASE = ROOT / "news" / "stock"
DST_BASE = ROOT / "pm320" / "stock"

REDIRECT_MARKER = "Q-20260605-105-STUB"

# date/code 상세 페이지: news/stock/YYYY-MM-DD/NNNNNN.html (1043장)
DETAIL_RE = re.compile(r"^\d{4}-\d{2}-\d{2}/\d+\.html$")
# date-level 페이지: news/stock/YYYY-MM-DD.html (calendar pushState 타깃, 277장)
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}\.html$")


def make_stub(rel_path: str) -> str:
    """옛 경로 → 새 경로 redirect stub HTML. rel_path = 'YYYY-MM-DD/NNNNNN.html'."""
    new_url = f"/pm320/stock/{rel_path}"
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<!-- {REDIRECT_MARKER} — News→PM320 URL 이전 (Q-20260605-105). 과거 공유 링크 무파손 redirect. -->
<meta name="robots" content="noindex">
<link rel="canonical" href="https://100m1s.com{new_url}">
<script>
  (function () {{
    try {{
      location.replace('{new_url}' + (location.search || '') + (location.hash || ''));
    }} catch (e) {{
      location.href = '{new_url}';
    }}
  }})();
</script>
<noscript><meta http-equiv="refresh" content="0; url={new_url}"></noscript>
</head>
<body>
<p>PM320 종목 페이지로 이동합니다. <a href="{new_url}">자동 이동되지 않으면 여기를 눌러주세요 →</a></p>
</body>
</html>
"""


def _migrate_one(src: Path, rel: str, stats: dict[str, int]) -> None:
    """src(옛 경로) → 새 경로 복사 + 옛 경로 stub 치환. rel = SRC_BASE 기준 상대경로."""
    content = src.read_text(encoding="utf-8")
    if REDIRECT_MARKER in content:
        stats["skipped"] += 1  # 이미 stub (재실행 idempotent)
        return
    dst = DST_BASE / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(content, encoding="utf-8")  # 1) 새 경로 복사 (내용 그대로)
    stats["copied"] += 1
    src.write_text(make_stub(rel), encoding="utf-8")  # 2) 옛 경로 → stub
    stats["stubbed"] += 1


def main() -> int:
    if not SRC_BASE.is_dir():
        print(f"ERROR: {SRC_BASE} 부재", file=sys.stderr)
        return 1
    stats = {"copied": 0, "stubbed": 0, "skipped": 0}
    # date/code 상세 (1043) + date-level (277, calendar pushState 타깃) 둘 다 이전.
    for src in sorted(SRC_BASE.glob("*/*.html")):
        rel = src.relative_to(SRC_BASE).as_posix()
        if DETAIL_RE.match(rel):
            _migrate_one(src, rel, stats)
    for src in sorted(SRC_BASE.glob("*.html")):
        rel = src.relative_to(SRC_BASE).as_posix()
        if DATE_RE.match(rel):
            _migrate_one(src, rel, stats)
    print(
        f"copied(new path)={stats['copied']} "
        f"stubbed(old path)={stats['stubbed']} skipped(already stub)={stats['skipped']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
