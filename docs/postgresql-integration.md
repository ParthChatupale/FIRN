# PostgreSQL Integration Check

PostgreSQL is FIRN's application database. The regular API tests use temporary in-memory SQLite for fast isolation; opt-in tests exercise the plan lifecycle and persisted monitoring clock against PostgreSQL itself.

## Safety boundary

- The primary `.env` connection must point to `firn_db`.
- The runner derives a separate connection to `firn_test_db` and refuses to run unless that database is owned by `firn_app`.
- Alembic migrations run against `firn_test_db` only.
- The runner migrates only `firn_test_db` to Alembic head (`0003_monitoring_replanning`).
- The tests are wrapped in PostgreSQL transactions and roll back inserted rows at teardown.
- The tests check a PostgreSQL JSONB round trip, the one-active-plan-per-station constraint, and monitoring-session/telemetry-cursor persistence.

## Run from WSL

After creating `firn_test_db` owned by `firn_app`, run from the repository root:

```bash
.venv-wsl/bin/python -B scripts/run_postgres_integration.py
```

The runner migrates the isolated test database to Alembic head before running `tests/test_postgres_integration.py`. It never migrates or writes application records to `firn_db`. The local application database remains at `0002_plan_management` until the new migration is deliberately applied there.
