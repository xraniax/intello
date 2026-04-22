#!/usr/bin/env python3
"""End-to-end ingestion smoke test for Cognify engine.

Usage:
    python scripts/test_ingestion.py --file path/to/sample.pdf --user-id <uuid> --subject-id <uuid>
    python scripts/test_ingestion.py --file path/to/sample.pdf --user-id <uuid> --subject-id <uuid> --topic algebra
"""

import argparse
import os
import sys
from typing import Optional

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ENGINE_ROOT = os.path.join(REPO_ROOT, "engine")
if ENGINE_ROOT not in sys.path:
    sys.path.insert(0, ENGINE_ROOT)

from database import SessionLocal  # noqa: E402
from services.ingestion import ingest_file  # noqa: E402
from services.retrieval import retrieve_chunks_by_topic  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Cognify ingestion pipeline test")
    parser.add_argument("--file", required=True, help="Path to a PDF/image file")
    parser.add_argument("--user-id", required=True, help="User UUID")
    parser.add_argument("--subject-id", required=True, help="Subject UUID")
    parser.add_argument("--topic", default=None, help="Optional topic for retrieval")
    parser.add_argument("--top-k", type=int, default=5, help="Top-k retrieval")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not os.path.isfile(args.file):
        print(f"ERROR: File not found: {args.file}")
        return 1

    db = SessionLocal()
    try:
        print("[1/4] Running ingestion...")
        result = ingest_file(
            db,
            file_path=args.file,
            user_id=args.user_id,
            subject_id=args.subject_id,
            original_filename=os.path.basename(args.file),
            source_uri=args.file,
            request_id="test-ingestion",
        )
        print("Ingestion result:")
        print(result)

        subject_id = result.get("subject_id")
        if not subject_id:
            print("ERROR: No subject_id returned from ingestion")
            return 1

        print("[2/4] Verifying chunks inserted...")
        inserted = int(result.get("chunks") or 0)
        print(f"Inserted chunks: {inserted}")
        if inserted <= 0:
            print("ERROR: No chunks inserted")
            return 1

        print("[3/4] Running retrieval query...")
        chunks = retrieve_chunks_by_topic(db, subject_id, args.topic, args.top_k)
        print(f"Retrieved {len(chunks)} chunk(s)")

        print("[4/4] Previewing retrieved content...")
        for idx, chunk in enumerate(chunks[: min(3, len(chunks))], start=1):
            content = (chunk.content or "").strip().replace("\n", " ")
            print(f"  {idx}. chunk_id={chunk.id} doc_id={chunk.document_id} text='{content[:140]}'")

        print("OK: ingestion + retrieval pipeline is working")
        return 0
    except Exception as e:
        print(f"ERROR: ingestion test failed: {e}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
