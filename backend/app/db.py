"""Database engine and request-scoped SQLAlchemy sessions."""

from __future__ import annotations

import os
from collections.abc import Generator
from functools import lru_cache

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

load_dotenv()


class DatabaseNotConfigured(RuntimeError):
    """Raised when an endpoint requiring PostgreSQL has no DATABASE_URL."""


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise DatabaseNotConfigured("DATABASE_URL is not configured")
    if not database_url.startswith("postgresql+psycopg://"):
        raise ValueError("DATABASE_URL must use the postgresql+psycopg driver")
    return create_engine(database_url, pool_pre_ping=True, pool_size=5, max_overflow=5)


def get_db() -> Generator[Session, None, None]:
    engine = get_engine()
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    with session_factory() as session:
        yield session
