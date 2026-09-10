import contextvars
import os
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy import Column, ForeignKey, Integer, create_engine, event
from sqlalchemy.orm import (
    Session,
    declarative_base,
    declared_attr,
    sessionmaker,
    with_loader_criteria,
)

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

# The desktop app (Electron + local SQLite, see backend/desktop_entry.py) relies
# on `ON DELETE CASCADE` / `ON DELETE SET NULL` foreign keys that already exist
# in the schema for the Postgres deploy. SQLite implements foreign keys but has
# them OFF by default per-connection -- without this, deletes that Postgres
# cascades correctly would silently leave orphaned rows on SQLite instead. This
# is a no-op on Postgres (the listener is only registered for the sqlite
# dialect), so the web deploy is unaffected.
if engine.dialect.name == "sqlite":

    @event.listens_for(engine, "connect")
    def _sqlite_enable_foreign_keys(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


# --- Multi-tenancy: automatic per-request tenant scoping --------------------
#
# `current_tenant_id` is set once per request (see the auth middleware in
# main.py) to the authenticated user's numeric `User.id`. Every ORM query
# issued through a Session made from `SessionLocal` during that request is
# then automatically narrowed to rows owned by that tenant, via the
# `do_orm_execute` listener below. This covers `db.query(...)` calls,
# joined/lazy relationship loads (e.g. `dealer.bills`), and any future bulk
# `.update()`/`.delete()` call -- all without needing a manual
# `.filter(Model.owner_id == ...)` at every one of the ~60 API endpoints,
# which would be easy to miss on a new endpoint and would silently leak
# data across tenants.
#
# This mechanism does NOT cover INSERTs. Every `models.X(...)` construction
# site must set `owner_id` explicitly from the authenticated tenant, never
# from request-body data. `owner_id` is declared NOT NULL at the database
# level specifically so a missed insert site fails loudly (a DB error)
# instead of silently leaking a tenant-less row.
current_tenant_id: contextvars.ContextVar = contextvars.ContextVar(
    "current_tenant_id", default=None
)


class TenantScoped:
    """Mixin for models that hold per-tenant business data. Models inherit
    from this in addition to `Base` (e.g. `class Customer(Base,
    TenantScoped):`), which gives them a shared `owner_id` column (FK to
    users.id) via `declared_attr` below.

    This has to be a real mapped column on the mixin, not just a marker
    class -- `with_loader_criteria(TenantScoped, lambda cls: cls.owner_id
    == ..., ...)` further down evaluates that lambda directly against
    `TenantScoped` itself once (during SQLAlchemy's internal lambda
    analysis/caching), so `TenantScoped.owner_id` has to already resolve
    to something, not raise AttributeError. This mirrors SQLAlchemy's own
    documented pattern for exactly this feature (see "Adding Global WHERE
    Criteria" in the SQLAlchemy ORM docs).

    Per-tenant uniqueness for the two settings tables (LoyaltySettings,
    AISettings) is enforced by a `CREATE UNIQUE INDEX` in the migration in
    main.py, not by a per-model column flag here -- a `declared_attr`
    can't easily vary `unique=True` for only some subclasses.
    """

    @declared_attr
    def owner_id(cls):
        return Column(Integer, ForeignKey("users.id"), nullable=False, index=True)


@event.listens_for(Session, "do_orm_execute")
def _apply_tenant_scope(execute_state):
    """Transparently AND a `owner_id == current tenant` clause onto every
    SELECT/UPDATE/DELETE against a TenantScoped model, for the lifetime of
    the current request. No-ops when no tenant is set (e.g. the public
    /signup and /login endpoints, or the startup migration, which run
    outside any request's tenant context)."""
    if not (execute_state.is_select or execute_state.is_update or execute_state.is_delete):
        return
    tenant_id = current_tenant_id.get()
    if tenant_id is None:
        return
    execute_state.statement = execute_state.statement.options(
        with_loader_criteria(
            TenantScoped,
            lambda cls: cls.owner_id == tenant_id,
            include_aliases=True,
        )
    )
