import os
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()


def build_database_url() -> str:
    """Return DATABASE_URL, with support for legacy DB_* variables."""
    direct_url = os.getenv("DATABASE_URL", "").strip()
    if direct_url:
        # Some providers still expose postgres://; SQLAlchemy expects postgresql://.
        if direct_url.startswith("postgres://"):
            direct_url = direct_url.replace("postgres://", "postgresql://", 1)
        return direct_url

    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "resolvent_billing_dev")
    db_user = quote_plus(os.getenv("DB_USER", "postgres"))
    db_password = quote_plus(os.getenv("DB_PASSWORD", ""))

    credentials = db_user if not db_password else f"{db_user}:{db_password}"
    return f"postgresql+psycopg2://{credentials}@{db_host}:{db_port}/{db_name}"


DATABASE_URL = build_database_url()

engine_options = {
    "pool_pre_ping": True,
    "pool_recycle": 300,
}

# Helpful if a local SQLite URL is temporarily used for development.
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
