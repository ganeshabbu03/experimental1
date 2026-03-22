from __future__ import annotations

import logging
from typing import Dict

from sqlalchemy import inspect
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)

# Idempotent compatibility patch for older databases (including Supabase).
# `create_all()` only creates missing tables and does not add missing columns.
REQUIRED_COLUMNS: Dict[str, Dict[str, str]] = {
    "users": {
        "password": "TEXT",
        "provider": "VARCHAR(50)",
        "provider_id": "VARCHAR(255)",
        "is_active": "BOOLEAN DEFAULT TRUE",
        "updated_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
    "projects": {
        "description": "TEXT",
        "is_active": "BOOLEAN DEFAULT TRUE",
        "updated_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
    "files": {
        "parent_id": "INTEGER",
        "file_type": "VARCHAR(50)",
        "content": "TEXT",
        "is_active": "BOOLEAN DEFAULT TRUE",
        "updated_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
}


def _quote_identifier(engine: Engine, identifier: str) -> str:
    if engine.dialect.name.startswith("mysql"):
        return f"`{identifier}`"
    return f'"{identifier}"'


def ensure_schema_compatibility(engine: Engine) -> None:
    try:
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
    except SQLAlchemyError as exc:
        logger.warning("Skipping schema compatibility check; cannot inspect DB: %s", exc)
        return

    if not existing_tables:
        return

    table_quote = _quote_identifier

    try:
        with engine.begin() as conn:
            for table_name, columns in REQUIRED_COLUMNS.items():
                if table_name not in existing_tables:
                    continue

                current_columns = {col["name"] for col in inspector.get_columns(table_name)}
                q_table = table_quote(engine, table_name)

                for column_name, ddl in columns.items():
                    if column_name in current_columns:
                        continue

                    q_column = table_quote(engine, column_name)
                    sql = f"ALTER TABLE {q_table} ADD COLUMN {q_column} {ddl}"
                    conn.exec_driver_sql(sql)
                    logger.info("Added missing column %s.%s", table_name, column_name)
    except SQLAlchemyError as exc:
        logger.warning("Schema compatibility patch skipped due to DB error: %s", exc)
