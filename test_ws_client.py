"""
Quick WebSocket sanity check (no browser needed).
Run this while `uvicorn inference_api:app --reload --port 8000` is already running.

Usage: python test_ws_client.py
"""

import asyncio
import json
import websockets

URL = "ws://127.0.0.1:8000/ws/telemetry"
N_MESSAGES = 200


async def main():
    async with websockets.connect(URL) as ws:
        print(f"Connected to {URL}, listening for {N_MESSAGES} messages...\n")
        for i in range(N_MESSAGES):
            raw = await ws.recv()
            msg = json.loads(raw)
            print(f"[{i+1}] {msg['sector_id']:22s} risk={msg['risk_score']:3d} "
                  f"({msg['risk_level']:8s}) ch4={msg['telemetry']['ch4_pct']:.2f}%")
            if msg["anomaly_factors"]:
                print(f"     factors: {msg['anomaly_factors']}")


if __name__ == "__main__":
    asyncio.run(main())
