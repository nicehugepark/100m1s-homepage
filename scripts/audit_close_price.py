#!/usr/bin/env python3
"""Q-20260606-111 — PM320 종가 파이프라인 전수 감사 (대표 2026-06-06 02:11 "전체 로직 점검").

3축 대조 (모든 pm320 pick 날짜·종목):
  A. 매매 버튼 종가 = pm320_history[*].pm320_pick.entry_price (= build_card_history P0 = dailybars D close)
  B. 카드 종가     = interpreted/stock-{date}.json 의 해당 code close_price (renderer last_price 소스)
  C. 원천 종가     = stocks.db dailybars (code, date) close (마감 종가 SSOT)

불일치 전수 목록 (날짜/종목/A/B/C/차이) 출력 + 파생 일관성(물타기·익절 = entry_price 기반) 확인.

read-only. 데이터 미존재 시 SKIP 명시 (거짓 PASS 금지, FLR-AGT-002).
exit 0 = 불일치 0, exit 1 = 불일치 존재(목록 출력).
"""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # homepage repo
HIST_DIR = ROOT / "data" / "pm320_history"
INTERP_DIR = ROOT / "data" / "interpreted"
DB_PATH = ROOT / "data" / "stocks.db"

WATERING_RATIO = 0.936
TAKE_PROFIT_RATIO = 1.032


def _dailybars_close(con: sqlite3.Connection, code: str, date: str) -> int | None:
    row = con.execute(
        "SELECT close FROM dailybars WHERE code=? AND date=?", (code, date)
    ).fetchone()
    return int(row[0]) if row and row[0] is not None else None


def _interp_close(date: str, code: str) -> tuple[int | None, str | None]:
    """interpreted/stock-{date}.json 에서 code 의 카드 종가. (close, name) 또는 (None, None)."""
    fp = INTERP_DIR / f"stock-{date}.json"
    if not fp.exists():
        return None, None
    try:
        d = json.loads(fp.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None, None
    for s in d.get("stocks", []):
        if s.get("code") == code:
            c = s.get("close_price")
            if c is None:
                c = s.get("price")  # fallback (renderer last_price 체인 정합)
            return (int(c) if c is not None else None), s.get("name")
    return None, None


def main() -> int:
    if not HIST_DIR.is_dir():
        print(f"ERROR: {HIST_DIR} 부재", file=sys.stderr)
        return 2
    con = None
    if DB_PATH.exists():
        con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)

    total_picks = 0
    mismatches: list[dict] = []
    skipped_db = 0
    skipped_card = 0
    deriv_mismatches: list[dict] = []

    for fp in sorted(HIST_DIR.glob("*.json")):
        date = fp.stem  # YYYY-MM-DD
        try:
            d = json.loads(fp.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for s in d.get("stocks", []):
            pk = s.get("pm320_pick") or {}
            if not pk.get("is_pick"):
                continue
            code = s.get("code")
            entry = pk.get("entry_price")  # A: 버튼 종가
            if entry is None or code is None:
                continue
            total_picks += 1
            entry = int(entry)

            # B: 카드 종가
            card_close, name = _interp_close(date, code)
            if card_close is None:
                skipped_card += 1

            # C: 원천 종가 (dailybars)
            src_close = _dailybars_close(con, code, date) if con else None
            if src_close is None:
                skipped_db += 1

            # 3축 대조 — 존재하는 축끼리 비교.
            vals = {"button": entry, "card": card_close, "source": src_close}
            present = {k: v for k, v in vals.items() if v is not None}
            if len(present) >= 2 and len(set(present.values())) > 1:
                mismatches.append(
                    {
                        "date": date,
                        "code": code,
                        "name": name or s.get("name"),
                        "button(entry)": entry,
                        "card": card_close,
                        "source(dailybars)": src_close,
                    }
                )

            # 파생 일관성 — 물타기·익절가가 entry(P0) 기반인지 (build_card_history 정의).
            wt = pk.get("watering_target_price")
            tp = pk.get("take_profit_target_price")
            if wt is not None and round(entry * WATERING_RATIO) != int(wt):
                deriv_mismatches.append(
                    {
                        "date": date,
                        "code": code,
                        "field": "watering_target_price",
                        "expected": round(entry * WATERING_RATIO),
                        "actual": int(wt),
                    }
                )
            if tp is not None and round(entry * TAKE_PROFIT_RATIO) != int(tp):
                deriv_mismatches.append(
                    {
                        "date": date,
                        "code": code,
                        "field": "take_profit_target_price",
                        "expected": round(entry * TAKE_PROFIT_RATIO),
                        "actual": int(tp),
                    }
                )

    if con:
        con.close()

    print("=" * 72)
    print(f"PM320 종가 3축 전수 감사 — pick {total_picks}건")
    print(
        f"  카드 종가 SKIP(interp 부재): {skipped_card} / 원천 종가 SKIP(dailybars 부재): {skipped_db}"
    )
    print("=" * 72)
    print(f"\n[3축 불일치] {len(mismatches)}건")
    for m in mismatches:
        print(
            f"  {m['date']} {m['code']}({m['name']}): "
            f"버튼={m['button(entry)']} 카드={m['card']} 원천={m['source(dailybars)']}"
        )
    print(f"\n[파생 불일치 (물타기·익절 ≠ entry 기반)] {len(deriv_mismatches)}건")
    for m in deriv_mismatches:
        print(
            f"  {m['date']} {m['code']} {m['field']}: 기대={m['expected']} 실제={m['actual']}"
        )

    fail = len(mismatches) > 0 or len(deriv_mismatches) > 0
    print(
        f"\n{'FAIL' if fail else 'PASS'}: 3축 불일치 {len(mismatches)} + 파생 불일치 {len(deriv_mismatches)}"
    )
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
