"""Serve the real API against an existing PostgreSQL test DB, rolling back all UI-test writes.

Run from the repository root: .venv-wsl/bin/python scripts/serve_phase7_test_api.py
No DDL or migrations. Stop with Ctrl+C to roll back the enclosing transaction.
"""
from __future__ import annotations

import os
from pathlib import Path
import sys
import threading

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
import uvicorn

load_dotenv()
url = make_url(os.environ["DATABASE_URL"]).set(database="firn_test_db")
if url.get_backend_name() != "postgresql" or url.database != "firn_test_db":
    raise RuntimeError("UI verification requires the dedicated PostgreSQL firn_test_db")
os.environ["DATABASE_URL"] = url.render_as_string(hide_password=False)
os.environ["CORS_ORIGINS"] = "http://localhost:3001,http://127.0.0.1:3001"

from backend.app.db import get_db
from backend.app.main import app

engine = create_engine(url)
lock = threading.Lock()
with engine.connect() as connection:
    transaction = connection.begin()
    version = connection.execute(text("select version_num from alembic_version")).scalar_one()
    if version != "0003_monitoring_replanning":
        raise RuntimeError(f"Test DB schema must already be at 0003; found {version}. No migration performed.")

    def test_db():
        # A shared outer transaction permits real PostgreSQL requests without persistent writes.
        with lock:
            with Session(bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint") as session:
                yield session

    app.dependency_overrides[get_db] = test_db
    try:
        uvicorn.run(app, host="0.0.0.0", port=8001, log_level="warning")
    finally:
        app.dependency_overrides.pop(get_db, None)
        transaction.rollback()
engine.dispose()
