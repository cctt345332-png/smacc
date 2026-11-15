import csv
import hashlib
import json
import os
import sqlite3
import threading
import time
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen

APP_DIR = Path(os.environ.get("PROGRAMDATA", Path.home())) / "MasarBiometricAgent"
CONFIG_FILE = APP_DIR / "config.json"
DB_FILE = APP_DIR / "queue.db"
DEFAULT_CONFIG = {"server_url": "", "device_id": "", "device_key": "", "watch_folder": str(APP_DIR / "inbox"), "interval_seconds": 30}


def load_config():
    APP_DIR.mkdir(parents=True, exist_ok=True)
    (APP_DIR / "inbox").mkdir(exist_ok=True)
    if not CONFIG_FILE.exists():
        CONFIG_FILE.write_text(json.dumps(DEFAULT_CONFIG, ensure_ascii=False, indent=2), encoding="utf-8")
    data = DEFAULT_CONFIG.copy()
    try: data.update(json.loads(CONFIG_FILE.read_text(encoding="utf-8")))
    except Exception: pass
    return data


def db():
    conn = sqlite3.connect(DB_FILE)
    conn.execute("CREATE TABLE IF NOT EXISTS queue (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, sent INTEGER NOT NULL DEFAULT 0)")
    conn.commit(); return conn


def normalize_row(row):
    row = {str(k).strip().lower(): str(v).strip() for k, v in row.items() if k is not None}
    user_id = row.get("device_user_id") or row.get("user_id") or row.get("userid") or row.get("employee_id") or row.get("pin")
    timestamp = row.get("occurred_at") or row.get("timestamp") or row.get("datetime") or row.get("date")
    if not user_id or not timestamp: return None
    return {"device_user_id": user_id, "occurred_at": timestamp, "event_type": row.get("event_type") or row.get("type") or "punch", "external_id": row.get("external_id") or hashlib.sha1(f"{user_id}|{timestamp}|{row.get('event_type','')}").hexdigest()}


def read_csv(path):
    for encoding in ("utf-8-sig", "cp1256", "cp1252"):
        try:
            with path.open("r", encoding=encoding, newline="") as f:
                return [x for x in (normalize_row(r) for r in csv.DictReader(f)) if x]
        except UnicodeDecodeError: continue
    return []


def enqueue_files(config):
    folder = Path(config["watch_folder"]); folder.mkdir(parents=True, exist_ok=True)
    conn = db()
    for path in sorted(folder.glob("*.csv")):
        rows = read_csv(path)
        if rows:
            conn.execute("INSERT INTO queue(payload) VALUES (?)", (json.dumps(rows, ensure_ascii=False),))
            path.rename(path.with_suffix(".sent.csv"))
    conn.commit(); conn.close()


def send_queue(config):
    if not config["server_url"] or not config["device_id"] or not config["device_key"]: return
    conn = db(); rows = conn.execute("SELECT id,payload,attempts FROM queue WHERE sent=0 ORDER BY id LIMIT 10").fetchall()
    for row_id, payload, attempts in rows:
        url = config["server_url"].rstrip("/") + f"/api/v1/hr/biometric/devices/{config['device_id']}/logs"
        req = Request(url, data=json.dumps({"logs": json.loads(payload)}).encode(), headers={"Content-Type": "application/json", "X-Device-Key": config["device_key"]}, method="POST")
        try:
            with urlopen(req, timeout=20) as response:
                if 200 <= response.status < 300: conn.execute("UPDATE queue SET sent=1 WHERE id=?", (row_id,))
        except Exception:
            conn.execute("UPDATE queue SET attempts=attempts+1 WHERE id=?", (row_id,))
    conn.commit(); conn.close()


def run():
    config = load_config()
    while True:
        try:
            enqueue_files(config); send_queue(config)
        except Exception as exc:
            (APP_DIR / "agent.log").open("a", encoding="utf-8").write(f"{datetime.now().isoformat()} {exc}\n")
        time.sleep(max(10, int(config.get("interval_seconds", 30))))

if __name__ == "__main__": run()
