"""
키움증권 REST + WebSocket API 클라이언트
PM320 POC - 토큰 발급, 조건검색(WebSocket), 시세 조회(REST) 검증

키움 API 프로토콜:
  - 시세/종목정보/주문/계좌: REST (POST https://[mock]api.kiwoom.com/api/dostk/...)
  - 조건검색/실시간시세:     WebSocket (wss://[mock]api.kiwoom.com:10000/api/dostk/websocket)

WebSocket 조건검색 호출 순서 (필수):
  1. LOGIN (토큰 전송)
  2. CNSRLST (조건검색 목록 조회 — 반드시 검색 전 1회 호출)
  3. CNSRREQ (조건검색 실행)
"""

import asyncio
import json
import os
import ssl

import requests

BASE_URL = os.getenv("KIWOOM_BASE_URL", "https://mockapi.kiwoom.com")
APPKEY = os.getenv("KIWOOM_APPKEY")
SECRETKEY = os.getenv("KIWOOM_SECRETKEY")


class KiwoomClient:
    def __init__(self):
        self.base_url = BASE_URL
        self.appkey = APPKEY
        self.secretkey = SECRETKEY
        self.token = None
        self.token_expires = None

    def _rest_headers(self, api_id):
        """REST API 공통 헤더"""
        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "api-id": api_id,
        }
        if self.token:
            headers["authorization"] = f"Bearer {self.token}"
        return headers

    @property
    def _ws_url(self):
        """WebSocket URL 생성 (REST 도메인에서 파생)"""
        domain = self.base_url.replace("https://", "").replace("http://", "")
        return f"wss://{domain}:10000/api/dostk/websocket"

    # ═══════════════════════════════════════════════════════
    # REST API
    # ═══════════════════════════════════════════════════════

    def get_token(self):
        """접근토큰 발급 (au10001)"""
        url = f"{self.base_url}/oauth2/token"
        body = {
            "grant_type": "client_credentials",
            "appkey": self.appkey,
            "secretkey": self.secretkey,
        }
        resp = requests.post(
            url, json=body, headers={"Content-Type": "application/json;charset=UTF-8"}
        )
        data = resp.json()

        if resp.status_code == 200 and "token" in data:
            self.token = data["token"]
            self.token_expires = data.get("expires_dt")
            print(f"[토큰] 발급 성공 (만료: {self.token_expires})")
        else:
            print(f"[토큰] 발급 실패: {data}")

        return data

    def revoke_token(self):
        """접근토큰 폐기 (au10002)"""
        url = f"{self.base_url}/oauth2/revoke"
        body = {
            "token": self.token,
            "appkey": self.appkey,
            "secretkey": self.secretkey,
        }
        resp = requests.post(url, json=body)
        print(f"[토큰] 폐기: {resp.json().get('return_msg', '')}")
        return resp.json()

    def get_stock_info(self, stk_cd):
        """주식기본정보요청 (ka10001) — 현재가, 등락률, 거래량 등"""
        url = f"{self.base_url}/api/dostk/stkinfo"
        resp = requests.post(
            url,
            json={"stk_cd": stk_cd},
            headers=self._rest_headers("ka10001"),
        )
        return resp.json()

    def get_stock_list(self, mrkt_tp="0"):
        """종목정보 리스트 (ka10099) — 0:코스피, 10:코스닥"""
        url = f"{self.base_url}/api/dostk/stkinfo"
        resp = requests.post(
            url,
            json={"mrkt_tp": mrkt_tp},
            headers=self._rest_headers("ka10099"),
        )
        return resp.json()

    # ═══════════════════════════════════════════════════════
    # WebSocket API — 조건검색
    # ═══════════════════════════════════════════════════════

    async def _ws_connect(self):
        """WebSocket 연결 + SSL 설정"""
        try:
            import websockets
        except ImportError:
            raise RuntimeError("websockets 패키지 필요: pip install websockets")

        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        return websockets.connect(self._ws_url, ssl=ssl_ctx, open_timeout=15)

    async def ws_condition_list(self):
        """조건검색 목록 조회 (ka10171, WebSocket)

        Returns:
            list: [[seq, name], ...] 형태의 조건검색식 목록
        """
        async with await self._ws_connect() as ws:
            # 1. LOGIN
            await ws.send(json.dumps({"trnm": "LOGIN", "token": self.token}))
            login = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
            if login.get("return_code") != 0:
                raise RuntimeError(f"WebSocket LOGIN 실패: {login}")

            # 2. CNSRLST
            await ws.send(json.dumps({"trnm": "CNSRLST"}))
            resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
            if resp.get("return_code") != 0:
                raise RuntimeError(f"조건검색 목록 조회 실패: {resp}")

            return resp.get("data", [])

    async def ws_condition_search(self, seq, search_type="0", stex_tp="K"):
        """조건검색 실행 (ka10172, WebSocket)

        호출 순서: LOGIN → CNSRLST → CNSRREQ (순서 필수)

        Args:
            seq: 조건검색식 일련번호 (문자열)
            search_type: "0"=일반검색, "1"=일반+실시간
            stex_tp: "K"=KRX

        Returns:
            list: [{"9001": 종목코드, "302": 종목명, "10": 현재가, ...}, ...]
        """
        async with await self._ws_connect() as ws:
            # 1. LOGIN
            await ws.send(json.dumps({"trnm": "LOGIN", "token": self.token}))
            login = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
            if login.get("return_code") != 0:
                raise RuntimeError(f"WebSocket LOGIN 실패: {login}")

            # 2. CNSRLST (검색 전 반드시 호출)
            await ws.send(json.dumps({"trnm": "CNSRLST"}))
            await asyncio.wait_for(ws.recv(), timeout=10)

            # 3. CNSRREQ
            req = {
                "trnm": "CNSRREQ",
                "seq": str(seq),
                "search_type": search_type,
                "stex_tp": stex_tp,
                "cont_yn": "N",
                "next_key": "",
            }
            await ws.send(json.dumps(req))

            all_stocks = []
            while True:
                try:
                    r = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
                except asyncio.TimeoutError:
                    break

                if r.get("return_code") not in (0, None):
                    raise RuntimeError(f"조건검색 실패: {r}")

                stocks = r.get("data", [])
                if isinstance(stocks, list):
                    all_stocks.extend(stocks)

                # 연속조회
                if r.get("cont_yn") == "Y" and r.get("next_key"):
                    cont_req = {**req, "cont_yn": "Y", "next_key": r["next_key"]}
                    await ws.send(json.dumps(cont_req))
                else:
                    break

            return all_stocks

    def condition_list(self):
        """조건검색 목록 (동기 래퍼)"""
        return asyncio.run(self.ws_condition_list())

    def condition_search(self, seq, **kwargs):
        """조건검색 실행 (동기 래퍼)"""
        return asyncio.run(self.ws_condition_search(seq, **kwargs))


def parse_kiwoom_int(val):
    """키움 API 숫자 문자열 파싱 (부호, 패딩 제거)"""
    if not val:
        return 0
    return int(val.replace("+", "").replace("-", "").lstrip("0") or "0")


def run_poc():
    """POC 전체 플로우 실행"""
    from datetime import datetime

    print("=" * 60)
    print("PM320 키움 REST + WebSocket API POC")
    print(f"실행 시각: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"REST: {BASE_URL}")
    print("=" * 60)

    if not APPKEY or not SECRETKEY:
        print("\nKIWOOM_APPKEY, KIWOOM_SECRETKEY를 .env에 설정하세요.")
        return

    client = KiwoomClient()

    # Step 1: 토큰 발급
    print("\n─── STEP 1: 토큰 발급 ───")
    client.get_token()
    if not client.token:
        return

    # Step 2: 조건검색 목록 (WebSocket)
    print("\n─── STEP 2: 조건검색 목록 (WebSocket ka10171) ───")
    conditions = client.condition_list()
    print(f"  조건식 {len(conditions)}개")
    for seq, name in conditions:
        print(f"    [{seq}] {name}")

    # Step 3: 조건검색 실행 (첫 번째 조건식)
    if conditions:
        seq, name = conditions[0]
        print(f"\n─── STEP 3: 조건검색 실행 [{seq}] {name} (WebSocket ka10172) ───")
        stocks = client.condition_search(seq)
        print(f"  결과: {len(stocks)}종목")
        for s in stocks[:5]:
            code = s.get("9001", "").replace("A", "")
            print(f"    {code} {s.get('302', '')}")

    # Step 4: 시세 조회 (REST)
    print("\n─── STEP 4: 시세 조회 (REST ka10001) ───")
    info = client.get_stock_info("005930")
    if info.get("return_code") == 0:
        print(f"  {info['stk_nm']} 현재가: {info['cur_prc']}원 ({info['flu_rt']}%)")

    # 정리
    print("\n─── CLEANUP ───")
    client.revoke_token()
    print("\nPOC 완료")


if __name__ == "__main__":
    run_poc()
