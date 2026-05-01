import json

def _extract_json_payload(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("{") and cleaned.endswith("}"):
        return cleaned

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return ""
    return cleaned[start : end + 1]

raw = """Based on the image provided, here is the extracted text:

{
"answer": "The uploaded material covers a range of tasks...",
"cited_ids": [16, 20, 22, 19, 18],
"confidence": 0.75
}

Hope this helps!"""

# Simulate the fallback block
fallback_answer = "An error occurred while generating the answer."
if raw.strip():
    try:
        extracted = _extract_json_payload(raw)
        parsed = json.loads(extracted)
        if "answer" in parsed:
            fallback_answer = str(parsed.get("answer", "")).strip()
        else:
            fallback_answer = raw.strip()
    except Exception as e:
        print(f"Exception triggered: {e}")
        fallback_answer = raw.strip()

print("FINAL FALLBACK ANSWER:")
print(fallback_answer)
