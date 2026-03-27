import sys
import os
from sqlalchemy import text

# Add engine to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import database
import models

def init_db():
    print("Initialising database...")
    engine = database.engine
    
    # 1. Enable pgvector
    with engine.connect() as conn:
        print("Enabling pgvector extension...")
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    
    # 2. Create tables
    print("Creating tables (documents, chunks)...")
    models.Base.metadata.create_all(bind=engine)
    print("Database initialisation complete.")

if __name__ == "__main__":
    init_db()
