"""
키움 '500억이상' 조건검색 스크레이퍼

매 10분 (KST 10:00~21:50) 키움 조건검색을 호출하여
거래대금 500억+ 종목 목록을 수집·저장.

저장 구조:
  data/kiwoom/<YYYY-MM-DD>.json  — 그날 누적 + latest snapshot
  data/kiwoom/latest.json         — 가장 최근 스냅샷 (페이지 로딩용)
  data/kiwoom/index.json          — 보유 날짜 인덱스
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

KST = timezone(timedelta(hours=9))
REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data" / "kiwoom"
SCRIPT_DIR = Path(__file__).parent


def log(msg: str) -> None:
    print(f"[{datetime.now(KST).isoformat(timespec='seconds')}] {msg}", flush=True)


def parse_int(val) -> int:
    if val is None or val == "":
        return 0
    s = str(val).replace("+", "").replace(",", "").strip()
    if s.startswith("-"):
        try:
            return int(s)
        except ValueError:
            return 0
    s = s.lstrip("0") or "0"
    try:
        return int(s)
    except ValueError:
        return 0


def parse_float(val) -> float:
    if val is None or val == "":
        return 0.0
    s = str(val).replace("+", "").replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_kiwoom_stock(s: dict) -> dict:
    """키움 조건검색 응답 1건 → 표준 dict.

    키움 필드 코드 (조건검색 ka10172):
      9001: 종목코드 (A 접두)
      302: 종목명
      10:  현재가
      11:  전일대비
      12:  등락률 (×1000 스케일 — 9590 = 9.59%)
      13:  거래량
      14:  거래대금 (백만원 단위, 미반환되는 경우 있음 → price×volume fallback)
      16:  시가
      17:  고가
      18:  저가
    """
    code = str(s.get("9001", "")).lstrip("A")
    price = parse_int(s.get("10", ""))
    volume = parse_int(s.get("13", ""))
    raw_amount = parse_int(s.get("14", "")) * 1_000_000  # 백만원 → 원
    # ka10172는 fid 14를 비워두는 경우가 많음 → price×volume으로 근사
    trade_amount = raw_amount if raw_amount > 0 else price * volume
    return {
        "ticker": code,
        "name": str(s.get("302", "")).strip(),
        "price": price,
        "open": parse_int(s.get("16", "")),
        "high": parse_int(s.get("17", "")),
        "low": parse_int(s.get("18", "")),
        "change": parse_int(s.get("11", "")),
        "change_pct": parse_float(s.get("12", ""))
        / 1000.0,  # FLR-20260408 등락률 스케일
        "volume": volume,
        "trade_amount": trade_amount,
    }


def merge_into_daily(daily: dict, snapshot: dict) -> None:
    """누적 종목 사전 갱신 (그날 한 번이라도 등장한 종목들)"""
    accum = daily.setdefault("accumulated_stocks", {})
    snap_time = snapshot["fetched_at"][11:16]  # "HH:MM"
    for st in snapshot["stocks"]:
        ticker = st["ticker"]
        if not ticker:
            continue
        if ticker in accum:
            ex = accum[ticker]
            ex["max_trade_amount"] = max(ex["max_trade_amount"], st["trade_amount"])
            ex["max_change_pct"] = max(ex["max_change_pct"], st["change_pct"])
            ex["min_change_pct"] = min(ex["min_change_pct"], st["change_pct"])
            ex["appearances"] = ex.get("appearances", 0) + 1
            ex["last_seen"] = snap_time
            ex["last_price"] = st["price"]
            # OHLC 갱신: high/low는 하루 중 최대/최소
            if st.get("high"):
                ex["high"] = max(ex.get("high", 0), st["high"])
            if st.get("low") and st["low"] > 0:
                ex["low"] = min(ex.get("low", st["low"]), st["low"])
            if st.get("open") and not ex.get("open"):
                ex["open"] = st["open"]
        else:
            accum[ticker] = {
                "ticker": ticker,
                "name": st["name"],
                "max_trade_amount": st["trade_amount"],
                "max_change_pct": st["change_pct"],
                "min_change_pct": st["change_pct"],
                "first_seen": snap_time,
                "last_seen": snap_time,
                "appearances": 1,
                "last_price": st["price"],
                "open": st.get("open", 0),
                "high": st.get("high", 0),
                "low": st.get("low", 0),
            }


def run() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(SCRIPT_DIR))

    appkey = os.environ.get("KIWOOM_APPKEY")
    secret = os.environ.get("KIWOOM_SECRETKEY")
    if not appkey or not secret:
        log("❌ KIWOOM_APPKEY/KIWOOM_SECRETKEY 환경변수 없음")
        return 2

    try:
        from kiwoom_client import KiwoomClient
    except ImportError as e:
        log(f"❌ kiwoom_client 임포트 실패: {e}")
        return 3

    client = KiwoomClient()

    log("토큰 발급…")
    client.get_token()
    if not client.token:
        log("❌ 토큰 발급 실패")
        return 4

    try:
        log("조건검색 목록 조회…")
        conditions = client.condition_list()
        log(f"등록된 조건식 {len(conditions)}개")

        target_seq = None
        target_name = None
        for seq, name in conditions:
            if "500억" in name:
                target_seq = seq
                target_name = name
                break

        if not target_seq:
            available = [n for _, n in conditions]
            log(f"❌ '500억' 조건검색 미등록 (등록된: {available})")
            return 5

        log(f"조건검색 실행: [{target_seq}] {target_name}")
        raw_stocks = client.condition_search(target_seq)
        log(f"종목 {len(raw_stocks)}개 수신")

        if not raw_stocks:
            log("⚠️ 결과 0건 (장 시간외 또는 조건 불충족)")
            return 0

        stocks = [parse_kiwoom_stock(s) for s in raw_stocks]
        # 거래대금 desc 정렬
        stocks = [s for s in stocks if s["ticker"]]
        stocks.sort(key=lambda x: x["trade_amount"], reverse=True)
        for i, s in enumerate(stocks):
            s["rank"] = i + 1

        now = datetime.now(KST)
        today = now.strftime("%Y-%m-%d")
        snap_iso = now.isoformat(timespec="seconds")

        snapshot = {
            "fetched_at": snap_iso,
            "stocks": stocks,
        }

        # 일별 파일 갱신
        daily_path = DATA_DIR / f"{today}.json"
        if daily_path.exists():
            try:
                daily = json.loads(daily_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                daily = {}
        else:
            daily = {}

        if not daily:
            daily = {
                "date": today,
                "condition_name": target_name,
                "first_snapshot_at": snap_iso,
                "snapshot_count": 0,
                "accumulated_stocks": {},
            }

        daily["last_snapshot_at"] = snap_iso
        daily["snapshot_count"] = daily.get("snapshot_count", 0) + 1
        daily["latest_stocks"] = stocks[:30]

        merge_into_daily(daily, snapshot)

        # 누적 종목을 max_trade_amount desc로 정렬한 daily_top 도출
        accum_list = list(daily["accumulated_stocks"].values())
        accum_list.sort(key=lambda x: x["max_trade_amount"], reverse=True)
        daily["daily_top"] = accum_list[:50]

        daily_path.write_text(
            json.dumps(daily, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        # latest.json (페이지 빠른 로딩용)
        latest = {
            "date": today,
            "fetched_at": snap_iso,
            "snapshot_count": daily["snapshot_count"],
            "stocks": stocks[:30],
        }
        (DATA_DIR / "latest.json").write_text(
            json.dumps(latest, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        # index.json
        idx_path = DATA_DIR / "index.json"
        if idx_path.exists():
            try:
                idx = json.loads(idx_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                idx = {}
        else:
            idx = {}
        idx.setdefault("dates", [])
        if today not in idx["dates"]:
            idx["dates"].insert(0, today)
            idx["dates"] = idx["dates"][:90]  # 최근 90일
        idx["updated_at"] = snap_iso
        idx_path.write_text(
            json.dumps(idx, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        log(f"✓ {today} 스냅샷 #{daily['snapshot_count']} 저장 ({len(stocks)} 종목)")

    finally:
        try:
            client.revoke_token()
        except Exception:
            pass

    return 0


if __name__ == "__main__":
    sys.exit(run())
