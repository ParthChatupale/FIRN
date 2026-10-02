from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

source = os.environ.get("DATABASE_URL", "")
if not source.startswith("postgresql+psycopg://"):
    raise SystemExit("DATABASE_URL must be the configured PostgreSQL app URL")

source_url = make_url(source)
if source_url.database != "firn_db":
    raise SystemExit("Safety stop: .env DATABASE_URL must point to firn_db")

test_url = source_url.set(database="firn_test_db")
engine = create_engine(test_url, connect_args={"connect_timeout": 5})
with engine.connect() as connection:
    database, owner = connection.execute(
        text(
            "SELECT current_database(), "
            "(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())"
        )
    ).one()
if database != "firn_test_db" or owner != "firn_app":
    raise SystemExit("Safety stop: expected firn_app-owned firn_test_db")
engine.dispose()

env = os.environ.copy()
env["DATABASE_URL"] = test_url.render_as_string(hide_password=False)
env["FIRN_TEST_DATABASE_URL"] = env["DATABASE_URL"]
env["PYTHONDONTWRITEBYTECODE"] = "1"

subprocess.run(
    [sys.executable, "-B", "-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head"],
    cwd=ROOT,
    env=env,
    check=True,
)
result = subprocess.run(
    [
        sys.executable,
        "-B",
        "-m",
        "pytest",
        "-p",
        "no:cacheprovider",
        "tests/test_postgres_integration.py",
    ],
    cwd=ROOT,
    env=env,
    check=False,
)
raise SystemExit(result.returncode)
