#!/usr/bin/env python3
"""Q-046 v0.4 PPT 이미지 10건 생성 (Imagen 4)
사용: python3 _generate.py <img-id>  (예: img-1, img-2, ...)
       python3 _generate.py all       (10건 일괄)
       python3 _generate.py poc       (img-1만 PoC)
"""

import os
import sys
import time
from pathlib import Path

from google import genai
from google.genai import types

# Load API key
KEY = os.environ.get("GOOGLE_AI_API_KEY")
if not KEY:
    with open("/Users/seongjinpark/company/100m1s/.env") as f:
        for line in f:
            if line.startswith("GOOGLE_AI_API_KEY="):
                KEY = line.split("=", 1)[1].strip()
                break

OUT_DIR = Path("/Users/seongjinpark/company/100m1s-homepage/lab/images/q046-v04")

# 10 images spec (design 산출물 4 그대로)
SPECS = {
    "img-1": {
        "file": "case-01-cover.png",
        "aspect": "16:9",
        "prompt": "Educational presentation cover illustration, flat minimal vector style. Centered: a magnifying glass icon over a stock candle chart, a checklist clipboard, and a shield icon. Background pure white #FFFFFF with subtle light beige #F1F3F5 radial. Color palette: #C92A2A red for chart down candles, #1864AB blue for shield, #C49930 amber for magnifying glass rim. NO movie/cinema styling, NO noir, NO dark shadows, NO photorealism. Korean financial education textbook style, clean infographic. Educational, professional, light. 16:9 aspect ratio. (Fictional case illustration, not actual stocks.)",
    },
    "img-2": {
        "file": "case-02-matrix.png",
        "aspect": "2:1",  # 1280x640 -> closest to 2:1
        "prompt": "12-row by 9-column heatmap matrix infographic, white #FFFFFF background, flat educational diagram style. Vertical axis labeled with 12 short Korean keywords (통정, 가장, 풍문, 허위, CB, M&A, CFD, 사모, 임상, 테마, 감사, CB고급) for fictional case categories. Horizontal axis labeled P1 through P9 (매집, 털기, 띄움, 띄움털기, 분배, 재매집, 재분배, 난입, 이탈) for behavioral patterns. Matrix cells filled with 3-level red gradient: deep red #C92A2A for double-check, light red #FFA8A8 for single-check, white blank otherwise. Clean grid lines #DEE2E6. Sans-serif Korean font, no decoration, no cinematic shading. 2:1 aspect.",
    },
    "img-3": {
        "file": "case-03-case1-cycle.png",
        "aspect": "16:9",
        "prompt": "Stock manipulation cycle horizontal timeline diagram, D-90 to D+30 axis. 4 stages with icons: 매집 (blue circle #1864AB) -> 통정매매 (amber circle #C49930) -> 갭상승 (red triangle #C92A2A) -> 분배 (dark red descending arrows). Two parallel arrow tracks: upper red labeled '세력 행동' (adversary), lower blue labeled '매매자 인지 시점' (trader awareness). Flat infographic, white background, NO movie scene, NO noir lighting, NO photorealism. Educational textbook style, clean lines, sans-serif Korean labels (short keywords). Bottom small note: '가상 사례 (㈜A 모델)'. 16:9 aspect ratio.",
    },
    "img-4": {
        "file": "case-04-case2-painting.png",
        "aspect": "16:9",
        "prompt": "Behavior diagram showing fake order painting fraud scheme. Central node labeled '1 trader' connected by lines to 8 HTS terminal icons and 8 phantom account icons (가상 차명계좌). Below: stylized order book mockup with red 'X' marks indicating 30-second 70% cancellation pattern. Flat icons, white background, blue #1864AB for legitimate, red #C92A2A for fraudulent. Short Korean labels. NO cinematic shading, NO movie style. Educational network diagram. Bottom note: '가상 사례'. 16:9.",
    },
    "img-5": {
        "file": "case-05-case3-rumor.png",
        "aspect": "16:9",
        "prompt": "Rumor propagation network diagram. Center node labeled '풍문책 (1명)' in deep red #C92A2A. Radiating outward: 12 'alba' (part-timer) nodes in light red, connecting to 'cafe' and 'telegram' platform icons. Numerical badges: '동조성 80%+' and '작성자 다양성 ≤ 5명' as red warning labels. Flat node-graph infographic, white background. Sans-serif Korean minimal labels. NO movie, NO noir. Educational. Bottom note: '가상 사례 (실제 채널 무관)'. 16:9.",
    },
    "img-6": {
        "file": "case-06-jaccard.png",
        "aspect": "16:9",
        "prompt": "Side-by-side comparison table. Top banner text: 'Jaccard 0.40 표면 동일'. Two columns: left column 'Case 4 허위공시' with light red background #FFF5F5, right column 'Case 9 바이오 임상' with light blue background #E7F5FF. 12 rows of axis labels in short Korean keywords with contrasting values. Clean educational table, white outer background, sans-serif Korean. NO cinema, NO photorealism. Bottom note: '가상 사례'. 16:9.",
    },
    "img-7": {
        "file": "case-07-case5-cb.png",
        "aspect": "16:9",
        "prompt": "CB (전환사채) issuance to distribution timeline diagram. Horizontal axis: D-180, D-90, D-7, D+30. D-180: bond document icon with label 'CB 100억 발행, 전환가 5,000원'. D-90: rising candle chart amber accumulation. D-7: lightning icon with 'CB 전환청구'. D+30: descending dark red arrows with '분배'. Below timeline: defense gate label 'CB 공시 30일 윈도우 = 진입 차단' in blue #1864AB. Flat infographic, white background. NO cinematic, NO movie. Educational. Bottom note: '가상 사례 (㈜D 모델)'. 16:9.",
    },
    "img-8": {
        "file": "case-08-case6-mna.png",
        "aspect": "16:9",
        "prompt": "Empty-shell M&A asset flow diagram. 3 horizontal phases with vertical bar chart visualization. Phase 1 D-90: '인수자 자기자본 0 + 사채 200억' shown as red bars. Phase 2 D+30: '자산 매각 -50%' as blue descending bars. Phase 3 D+60: '자산 50억 -80%' as small dark red bars. Connecting horizontal arrows between phases. Flat infographic, white background. Short Korean labels. NO movie, NO noir. Educational. Bottom note: '가상 사례 (㈜M 모델)'. 16:9.",
    },
    "img-10": {
        "file": "case-10-case11-audit.png",
        "aspect": "16:9",
        "prompt": "Audit qualified-opinion pre-distribution timeline diagram with strong red warning emphasis. Horizontal axis: D-180 매출 위장 -> D-30 감사인 변경 -> D-15 사전 분배 (red descending arrows, very prominent) -> D+0 의견거절 (large red lightning icon) -> D+1 거래정지 (black 'STOP' shield icon). Visual escalation through increasing red intensity. White background, NO movie noir, but high warning contrast. Flat educational infographic. Bottom note: '가상 사례 (㈜W2 모델)'. 16:9.",
    },
    "img-11": {
        "file": "case-11-cb-loop.png",
        "aspect": "16:9",
        "prompt": "Infinite cycle loop circular diagram for CB refixing plus put option scheme. Circular clockwise arrow flow: P1 매집 -> P2 매집후털기 -> P6 재매집 -> P7 다시분배 -> P5 분배 -> P9 이탈경합 -> back to P1. Each node labeled with short Korean keyword. Center text: 'CB 무한 사이클' in deep red #C92A2A. Outer ring annotations: 'D-180 1차', 'D-90 2차', 'D+0 3차' time anchors. Flat circular infographic, white background, deep red primary. NO movie. Educational. 16:9.",
    },
    "img-12": {
        "file": "case-12-checklist.png",
        "aspect": "16:9",
        "prompt": "Trader self-check 12-item visual card. Layout: 3-column by 4-row grid of checkbox items. Each item has subtle blue checkbox icon #1864AB with short Korean keyword label: 'DART 30일', '거래대금 1등', '다양성 6명+', '신용 변화', '호가 취소', '외국계 %', '사모 %', 'RSI MA20', '윗꼬리', '호가 두께', '분당 매도', 'DART 16:30'. Top banner: '진입 직전 5분 자가체크' in dark text. Bottom: small blue shield icon with 'DEFENSE' label. Clean educational card, white background. NO cinema. Sans-serif Korean. 16:9.",
    },
}

P0 = ["img-2", "img-3", "img-7", "img-10", "img-11", "img-12"]
P1 = ["img-1", "img-4", "img-5", "img-6", "img-8"]


def generate(img_id):
    spec = SPECS[img_id]
    out_path = OUT_DIR / spec["file"]
    print(f"[{img_id}] generating -> {spec['file']}")
    client = genai.Client(api_key=KEY)
    try:
        resp = client.models.generate_images(
            model="imagen-4.0-generate-001",
            prompt=spec["prompt"],
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio=spec["aspect"],
            ),
        )
        if not resp.generated_images:
            print(f"[{img_id}] NO IMAGE returned")
            return False
        img = resp.generated_images[0].image
        img.save(str(out_path))
        size = out_path.stat().st_size
        print(f"[{img_id}] OK {size} bytes")
        return True
    except Exception as e:
        print(f"[{img_id}] FAIL: {e}")
        return False


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "poc"
    if target == "poc":
        generate("img-1")
    elif target == "p0":
        for k in P0:
            generate(k)
            time.sleep(1)
    elif target == "p1":
        for k in P1:
            generate(k)
            time.sleep(1)
    elif target == "all":
        for k in P0 + P1:
            generate(k)
            time.sleep(1)
    elif target in SPECS:
        generate(target)
    else:
        print(f"unknown target: {target}")
        sys.exit(1)
