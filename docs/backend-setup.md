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

## 4. Apply migrations and run the API

The local `firn_db` is currently at revision `0002_plan_management`; Phase 6 adds `0003_monitoring_replanning`. The command below upgrades whichever database `DATABASE_URL` names. Do not run it until that target is intentionally selected. For the isolated PostgreSQL test workflow, use the guarded test runner instead:

```bash
alembic -c backend/alembic.ini upgrade head
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

The API exposes `/api/health`, `/api/station`, simulation-run endpoints, plan management, and monitoring/replanning endpoints documented in `docs/plan-management.md` and `docs/monitoring-and-replanning.md`. Interactive API docs are at `/docs` while the server is running.

Run tests with:

```bash
pytest
```

API tests use an isolated in-memory SQLite database. PostgreSQL migration/connection checks must use `firn_db` with the local `firn_app` role; no production or shared database is touched by the unit tests.

## Current status

The local `firn_db` was verified and upgraded to revision `0002_plan_management` for Phase 5. Phase 6 revision `0003_monitoring_replanning` is tested via the guarded `firn_test_db` workflow; the main `firn_db` migration is deliberately left for an explicitly selected/manual step. A local ignored `.env` configures the API connection. The frontend monitoring workflow remains later work in Phase 7. Automated API tests use isolated in-memory SQLite, with PostgreSQL round-trip tests on `firn_test_db`.
