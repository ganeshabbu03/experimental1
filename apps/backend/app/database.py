from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import SQLAlchemyError
import os
import time
from dotenv import load_dotenv

# Load env from apps/backend/.env
load_dotenv()

Base = declarative_base()


def _engine_for(url: str):
    url_l = url.lower()
    connect_args = {}

    if url_l.startswith('sqlite'):
        connect_args = {'check_same_thread': False}
    elif url_l.startswith('postgresql') or url_l.startswith('postgres'):
        connect_args = {'connect_timeout': 4}
    elif url_l.startswith('mysql'):
        connect_args = {'connect_timeout': 4}

    return create_engine(
        url,
        connect_args=connect_args,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_timeout=5,
    )


primary_url = os.getenv('DATABASE_URL', 'sqlite:///./deexen_demo.db')
fallback_url = (os.getenv('DATABASE_FALLBACK_URL') or '').strip() or None

engine = _engine_for(primary_url)
DATABASE_URL = primary_url

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
