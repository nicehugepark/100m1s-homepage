#!/usr/bin/env python3
"""REQ-012 cycle 3.5 — fixture sync 스크립트.

backend e9e384d (worktree-req012-build-daily) 의 _next_trading_day_strict
산출 결과를 homepage data/interpreted/stock-YYYY-MM-DD.json predicted
배지에 1회성 후처리 패치.

대상 필드:
  - next_trading_day_for_predicted: str (YYYY-MM-DD)
  - next_trading_day_source: str (verified/estimated/fallback_homepage/fallback_legacy/unknown)

설계:
  - main repo build_daily 모듈을 import하여 동일 함수 호출 (결정론 1:1).
  - status_badges[*] 중 source=='predicted' 인 항목에만 적용.
  - view_date 또는 fixture date를 입력으로 사용 (badge.view_date 우선).
  - 이미 필드가 있으면 skip (idempotent).

실행:
  cd 100m1s-homepage/.claude/worktrees/req012-cycle2-impl
  python3 scripts/sync-req012-next-td.py [--dry-run] [--days 4/20 4/21 ...]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_HOMEPAGE = Path(__file__).resolve().parents[1]
INTERPRETED = REPO_HOMEPAGE / "data" / "interpreted"

# main 100m1s repo의 build_daily 모듈 path 주입.
# worktree-req012-build-daily 에 e9e384d 통합 함수가 있음.
MAIN_REPO_BUILD = Path(
    "/Users/seongjinpark/company/100m1s/.claude/worktrees/req012-build-daily"
)
sys.path.insert(0, str(MAIN_REPO_BUILD))

from scripts.news_pipeline.build_daily import _next_trading_day_strict  # noqa: E402


def patch_fixture(path: Path, dry_run: bool = False) -> dict:
    raw = json.loads(path.read_text())
    fixture_date = raw.get("date")
    stocks = raw.get("stocks") or []
    grade_dist: dict[str, int] = {}
    patched = 0
    skipped_existing = 0
    skipped_nondate = 0

    for s in stocks:
        for b in s.get("status_badges", []) or []:
            if b.get("source") != "predicted":
                continue
            if "next_trading_day_for_predicted" in b:
                skipped_existing += 1
                continue
            view_date = b.get("view_date") or fixture_date
            if not view_date:
                skipped_nondate += 1
                continue
            ntd, grade = _next_trading_day_strict(view_date)
            if not ntd:
                continue
            b["next_trading_day_for_predicted"] = ntd
            b["next_trading_day_source"] = grade
            grade_dist[grade] = grade_dist.get(grade, 0) + 1
            patched += 1

    if patched and not dry_run:
        # 들여쓰기 2 — 기존 fixture 양식 보존 (build_daily 출력 양식 일치).
        path.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n")

    return {
        "file": path.name,
        "fixture_date": fixture_date,
        "predicted_total": sum(
            1
            for s in stocks
            for b in (s.get("status_badges") or [])
            if b.get("source") == "predicted"
        ),
        "patched": patched,
        "skipped_existing": skipped_existing,
        "skipped_nondate": skipped_nondate,
        "grade_dist": grade_dist,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--pattern",
        default="stock-2026-04-2[0-4].json",
        help="glob (default 4/20~4/24)",
    )
    args = ap.parse_args()

    files = sorted(INTERPRETED.glob(args.pattern))
    if not files:
        print(f"[sync] no files match {args.pattern} in {INTERPRETED}", file=sys.stderr)
        sys.exit(1)

    total_patched = 0
    total_grade: dict[str, int] = {}
    for fp in files:
        rep = patch_fixture(fp, dry_run=args.dry_run)
        total_patched += rep["patched"]
        for g, n in rep["grade_dist"].items():
            total_grade[g] = total_grade.get(g, 0) + n
        print(json.dumps(rep, ensure_ascii=False))

    print(
        json.dumps(
            {
                "_summary": {
                    "files": len(files),
                    "total_patched": total_patched,
                    "grade_dist": total_grade,
                    "dry_run": args.dry_run,
                }
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
