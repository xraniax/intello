try:
    from .processor import process_subject
except ImportError:
    from processor import process_subject

# Pick a real subject_id from your DB
SUBJECT_ID = 1
TOPIC = None  # or a string like "graphs"

if __name__ == "__main__":
    print(f"Testing processor for subject_id={SUBJECT_ID}, topic={TOPIC}")

    result = process_subject(SUBJECT_ID, topic=TOPIC)

    print("\nTotal documents processed:", len(result.get("documents", [])))
    print("Total chunks:", result.get("total_chunks"))
    if result.get("errors"):
        print("Errors:", result["errors"])

    # Preview first chunk of first document
    if result.get("documents"):
        first_doc = result["documents"][0]
        chunks = first_doc.get("chunks") or []
        if chunks:
            content = chunks[0].get("content") or ""
            print("\nFirst chunk of first document:\n")
            print(content[:300])
        if first_doc.get("error"):
            print("\nDocument error:", first_doc["error"])