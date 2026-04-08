#!/usr/bin/env python3
"""Build data/calendar/index.json from kiwoom + cafe sources.

Scans existing data directories and aggregates per-day counts:
  - kiwoom_count : number of stocks in data/kiwoom/{date}.json (accumulated_stocks)
  - cafe_count   : number of cafe posts grouped by day (post_date fallback fetched_at)
  - news_count   : sum of news_count across cafe posts on that day
                   (no standalone news source exists; news cards live inside cafe posts)

activity_score normalized by max raw across observed days (2 decimals).

Empty data dirs produce empty days/max_observed. Corrupt files are skipped
with a stderr warning (no mock generation — FLR-AGT-002).
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
KIWOOM_DIR = DATA / "kiwoom"
CAFE_POSTS_DIR = DATA / "cafe" / "posts"
OUT_DIR = DATA / "calendar"
OUT_FILE = OUT_DIR / "index.json"

KST = timezone(timedelta(hours=9))


def _warn(msg: str) -> None:
    print(f"[build_calendar_index] WARN: {msg}", file=sys.stderr)


def _load_json(path: Path):
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        _warn(f"skip {path}: {e}")
        return None


def _extract_day(post: dict) -> str | None:
    """post_date 만 사용. fetched_at 폴백 금지 (날짜 몰림 버그 회피).

    None 반환 시 호출측에서 'undated' 버킷으로 분리 처리한다.
    """
    raw = post.get("post_date")
    if not raw:
        return None
    if len(raw) >= 10 and raw[4] == "-" and raw[7] == "-":
        return raw[:10]
    return None


def scan_kiwoom() -> dict[str, int]:
    out: dict[str, int] = {}
    if not KIWOOM_DIR.is_dir():
        return out
    for p in sorted(KIWOOM_DIR.glob("*.json")):
        name = p.stem
        if not (len(name) == 10 and name[4] == "-" and name[7] == "-"):
            continue  # skip index.json / latest.json
        data = _load_json(p)
        if not isinstance(data, dict):
            continue
        stocks = data.get("accumulated_stocks")
        if stocks is None:
            stocks = data.get("latest_stocks") or []
        if isinstance(stocks, (list, dict)):
            out[name] = len(stocks)
    return out


def scan_cafe() -> tuple[dict[str, int], dict[str, int], dict[str, int]]:
    cafe_counts: dict[str, int] = {}
    news_counts: dict[str, int] = {}
    undated: dict[str, int] = {"cafe": 0, "news": 0}
    if not CAFE_POSTS_DIR.is_dir():
        return cafe_counts, news_counts, undated
    for p in sorted(CAFE_POSTS_DIR.glob("*.json")):
        post = _load_json(p)
        if not isinstance(post, dict):
            continue
        day = _extract_day(post)
        nc = post.get("news_count") or 0
        if not day:
            undated["cafe"] += 1
            if isinstance(nc, int):
                undated["news"] += nc
            continue
        cafe_counts[day] = cafe_counts.get(day, 0) + 1
        if isinstance(nc, int):
            news_counts[day] = news_counts.get(day, 0) + nc
    return cafe_counts, news_counts, undated


def build() -> dict:
    kiwoom = scan_kiwoom()
    cafe, news, undated = scan_cafe()

    all_days = sorted(set(kiwoom) | set(cafe) | set(news))
    days: dict[str, dict] = {}
    raws: dict[str, float] = {}

    for d in all_days:
        k = kiwoom.get(d, 0)
        c = cafe.get(d, 0)
        n = news.get(d, 0)
        raw = k + c * 2 + n * 1.5
        raws[d] = raw
        days[d] = {
            "kiwoom_count": k,
            "cafe_count": c,
            "news_count": n,
            "activity_score": 0.0,  # filled after normalization
        }

    max_raw = max(raws.values()) if raws else 0.0
    for d, raw in raws.items():
        score = round(raw / max_raw, 2) if max_raw > 0 else 0.0
        days[d]["activity_score"] = score

    max_observed: dict[str, int] = {}
    if all_days:
        max_observed = {
            "kiwoom": max(kiwoom.values()) if kiwoom else 0,
            "cafe": max(cafe.values()) if cafe else 0,
            "news": max(news.values()) if news else 0,
        }

    return {
        "schema_version": 1,
        "updated_at": datetime.now(KST).isoformat(timespec="seconds"),
        "days": days,
        "max_observed": max_observed,
        "undated": undated,
    }


def main() -> int:
    payload = build()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(
        f"wrote {OUT_FILE.relative_to(ROOT)} "
        f"days={len(payload['days'])} max_observed={payload['max_observed']} "
        f"undated={payload.get('undated')}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
