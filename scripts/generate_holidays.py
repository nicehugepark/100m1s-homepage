"""
한국 법정공휴일 + KRX 휴장일 JSON 생성기.

사용법:
  python3 scripts/generate_holidays.py [year]
  기본: 현재 연도

출력: data/holidays.json
"""

import json
import sys
from datetime import date, timedelta
from pathlib import Path

try:
    import holidays
except ImportError:
    print("ERROR: pip install holidays 필요")
    sys.exit(1)


def generate(year: int) -> dict:
    """공휴일 + KRX 휴장일 데이터 생성."""
    kr = holidays.KR(years=year)

    # KRX 추가 휴장일 (법정공휴일 아니지만 거래소 휴장)
    extra_market_closed = {
        date(year, 5, 1): "근로자의날",
        date(year, 12, 31): "연말 폐장일",  # KRX는 12/31 휴장
    }

    # 공휴일 맵: date -> name
    holiday_map = {}
    for d, name in sorted(kr.items()):
        holiday_map[d.isoformat()] = name
    for d, name in extra_market_closed.items():
        if d.isoformat() not in holiday_map:
            holiday_map[d.isoformat()] = name

    # 모든 주말
    weekends = {}
    current = date(year, 1, 1)
    end = date(year, 12, 31)
    while current <= end:
        if current.weekday() == 5:  # 토요일
            weekends[current.isoformat()] = "토요일"
        elif current.weekday() == 6:  # 일요일
            weekends[current.isoformat()] = "일요일"
        current += timedelta(days=1)

    # KRX 휴장일 = 주말 + 공휴일 + 추가 휴장
    market_closed = {}
    market_closed.update(weekends)
    market_closed.update(holiday_map)

    return {
        "year": year,
        "generated_at": date.today().isoformat(),
        "holidays": dict(sorted(holiday_map.items())),
        "market_closed": dict(sorted(market_closed.items())),
    }


if __name__ == "__main__":
    year = int(sys.argv[1]) if len(sys.argv) > 1 else date.today().year
    data = generate(year)

    out_path = Path(__file__).resolve().parent.parent / "data" / "holidays.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"wrote {out_path}")
    print(f"  공휴일: {len(data['holidays'])}일")
    print(f"  KRX 휴장일(주말 포함): {len(data['market_closed'])}일")
