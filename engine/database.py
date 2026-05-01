import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


load_dotenv()

_raw_url = os.getenv("DATABASE_URL")
if not _raw_url:
    raise RuntimeError(
        "DATABASE_URL is not set. Cannot start without a database connection.\n"
        "  Local:   set DATABASE_URL in engine/.env.docker\n"
        "  Staging: use docker-compose.staging.yml with --env-file .env.staging"
    )

# SQLAlchemy with psycopg2 requires the postgresql+psycopg2:// scheme.
if _raw_url.startswith("postgres://"):
    DATABASE_URL = _raw_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif _raw_url.startswith("postgresql://"):
    DATABASE_URL = _raw_url.replace("postgresql://", "postgresql+psycopg2://", 1)
else:
    DATABASE_URL = _raw_url

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
