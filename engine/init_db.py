#!/usr/bin/env python3
"""
Create engine tables (documents, chunks) if they do not exist.

Run inside the engine container (WORKDIR /app):

    python init_db.py

Requires: DATABASE_URL set in the environment (engine/.env.docker or shell).
`subjects` must already exist (from db/init.sql) because documents.subject_id FK references it.
"""
from database import Base, engine

# Import models so they register on Base.metadata before create_all
import models  # noqa: F401


def main() -> None:
    Base.metadata.create_all(bind=engine)
    print("OK: Base.metadata.create_all(bind=engine) finished.")


if __name__ == "__main__":
    main()
