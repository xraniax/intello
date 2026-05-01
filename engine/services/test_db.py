import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import engine

try:
    with engine.connect() as conn:
        print("✅ Connected to database!")
except Exception as e:
    print("❌ Connection failed:", e)