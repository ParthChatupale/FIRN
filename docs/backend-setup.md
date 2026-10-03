# Local Backend Setup

The backend uses FastAPI, SQLAlchemy, Alembic, psycopg 3, and the existing PostgreSQL database `firn_db`. Database credentials are local-only. Never put a real password in Git, source code, or chat.

## 1. Install the project dependencies

From the repository root, in the WSL terminal:

```bash
cd /mnt/c/FIRN/firn-polar-ops
python3 -m venv --without-pip .venv-wsl
python3 -m pip --python .venv-wsl/bin/python install --upgrade pip
python3 -m pip --python .venv-wsl/bin/python install -e '.[dev,optimization]'
source .venv-wsl/bin/activate
```

The project pins SQLAlchemy to its 2.1 series, which supports Python 3.11 and newer; this avoids relying on the older globally installed SQLAlchemy that failed to import under Python 3.14. [SQLAlchemy installation and supported Python versions](https://docs.sqlalchemy.org/en/21/intro.html)

## 2. Dedicated database login

The database already exists and the `firn_app` application login has been verified. Do not use the PostgreSQL `postgres` superuser from the API. If setting up a fresh environment, create a least-privilege login from WSL:

```bash
sudo -u postgres psql -d firn_db
```

At the `psql` prompt:

```sql
CREATE ROLE firn_app LOGIN;
\password firn_app
GRANT CONNECT ON DATABASE firn_db TO firn_app;
GRANT USAGE, CREATE ON SCHEMA public TO firn_app;
```

The `\password` command prompts for the password without putting it in shell history. Then exit with `\q`.

## 3. Configure the local connection

Copy `.env.example` to `.env` in the repository root and replace the placeholder password locally. If it contains URL-reserved characters, percent-encode them in the URL. The checked-in example contains no real credential and `.env` is ignored by Git.

The expected local connection is:

```text
postgresql+psycopg://firn_app:<local-password>@127.0.0.1:5432/firn_db
```

## 4. Run the API from WSL

For this workstation, PostgreSQL runs in WSL. Start the FastAPI process in that same WSL terminal; do **not** run `uvicorn` from Windows PowerShell. `127.0.0.1` in `.env` must resolve inside the same environment as the PostgreSQL server.

The main `firn_db` is already migrated through `0003_monitoring_replanning`. Do not run a migration as part of ordinary startup.

```bash
cd /mnt/c/FIRN/firn-polar-ops
source .venv-wsl/bin/activate
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

In a second terminal, confirm the service before opening the frontend:

```bash
curl http://127.0.0.1:8000/api/health
```

It must return `{"status":"ok","database":"ok"}`. If it returns 503 or hangs, stop the server and confirm the WSL PostgreSQL service with `sudo service postgresql status`; do not create a second database or rerun migrations.

The API exposes `/api/health`, `/api/station`, simulation-run endpoints, plan management, and monitoring/replanning endpoints documented in `docs/plan-management.md` and `docs/monitoring-and-replanning.md`. Interactive API docs are at `/docs` while the server is running.

Run tests with:

```bash
pytest
```

API tests use an isolated in-memory SQLite database. PostgreSQL migration/connection checks must use `firn_db` with the local `firn_app` role; no production or shared database is touched by the unit tests.

## Current status

The local `firn_db` is migrated through `0003_monitoring_replanning`. A local ignored `.env` configures the API connection. The Phase 7 frontend workflow uses persisted runs, plans, and monitoring sessions. Automated API tests use isolated in-memory SQLite, with PostgreSQL round-trip tests on `firn_test_db`.
