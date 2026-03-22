from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import SQLAlchemyError
import os
import time
from urllib.parse import urlsplit, urlunsplit
from dotenv import load_dotenv

# Load env from apps/backend/.env
load_dotenv()

Base = declarative_base()


def _pick_database_url() -> tuple[str, str]:
    candidates = [
        ("DEEXEN_DATABASE_URL", os.getenv("DEEXEN_DATABASE_URL")),
        ("SUPABASE_DATABASE_URL", os.getenv("SUPABASE_DATABASE_URL")),
        ("DATABASE_URL", os.getenv("DATABASE_URL")),
    ]
    for name, value in candidates:
        if value and value.strip():
            return value.strip(), name
    return "sqlite:///./deexen_demo.db", "default-sqlite"


def _redact_url(url: str) -> str:
    try:
        parsed = urlsplit(url)
        if not parsed.netloc:
            return url

        host_port = parsed.hostname or ""
        if parsed.port:
            host_port = f"{host_port}:{parsed.port}"

        redacted_netloc = host_port
        if parsed.username:
            redacted_netloc = f"{parsed.username}:***@{host_port}"

        return urlunsplit((parsed.scheme, redacted_netloc, parsed.path, parsed.query, parsed.fragment))
    except Exception:
        return "<redacted>"


def _engine_for(url: str):
    url_l = url.lower()
    connect_args = {}

    if url_l.startswith('sqlite'):
        connect_args = {'check_same_thread': False}
    elif url_l.startswith('postgresql') or url_l.startswith('postgres'):
        # Supabase/Postgres compatibility:
        # force public schema unless explicitly overridden.
        db_schema = (os.getenv('DB_SCHEMA') or 'public').strip() or 'public'
        connect_args = {
            'connect_timeout': 4,
            'options': f'-csearch_path={db_schema}',
        }
    elif url_l.startswith('mysql'):
        connect_args = {'connect_timeout': 4}

    return create_engine(
        url,
        connect_args=connect_args,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_timeout=5,
    )


primary_url, primary_source = _pick_database_url()
fallback_url = (os.getenv('DATABASE_FALLBACK_URL') or '').strip() or None

engine = _engine_for(primary_url)
DATABASE_URL = primary_url
print(f"[db] using {primary_source}: {_redact_url(primary_url)}")

# Wait for primary DB to be ready, otherwise fallback to auxiliary DB only if explicitly configured.
retries = int(os.getenv('DB_CONNECT_RETRIES', '5'))
while retries > 0:
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql('SELECT 1')
        break
    except SQLAlchemyError as err:
        retries -= 1
        print(f"Database connection failed, retrying in 3 seconds... ({retries} attempts left)")
        if retries == 0:
            if fallback_url and fallback_url != primary_url:
                print("Primary database unavailable, trying auxiliary database...")
                try:
                    fallback_engine = _engine_for(fallback_url)
                    with fallback_engine.connect() as conn:
                        conn.exec_driver_sql('SELECT 1')
                    engine = fallback_engine
                    DATABASE_URL = fallback_url
                    print("Using auxiliary database connection.")
                except SQLAlchemyError as fallback_err:
                    print(
                        "Auxiliary database probe failed; continuing startup without DB validation. "
                        f"primary_error={err} fallback_error={fallback_err}"
                    )
            else:
                print(
                    "No auxiliary database configured; continuing startup without DB validation. "
                    f"last_error={err}"
                )
            break
        time.sleep(3)

SessionLocal = sessionmaker(bind=engine)
