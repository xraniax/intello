import os
import requests
import json

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/")
TAGS_URL = f"{OLLAMA_BASE_URL}/api/tags"
GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"
OLLAMA_GENERATION_MODEL = os.getenv("OLLAMA_GENERATION_MODEL", "qwen2.5:7b")

def check_ollama():
    print(f"Checking Ollama at: {OLLAMA_BASE_URL} (Model: {OLLAMA_GENERATION_MODEL})")
    
    # 1. Check tags
    try:
        print(f"Fetching tags from {TAGS_URL}...")
        response = requests.get(TAGS_URL, timeout=5)
        if response.status_code == 200:
            models = response.json().get("models", [])
            print(f"SUCCESS: Reachable. Found {len(models)} models:")
            for m in models:
                print(f" - {m['name']}")
        else:
            print(f"FAILURE: {TAGS_URL} returned {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"ERROR reaching {TAGS_URL}: {e}")

    # 2. Check generate endpoint with a simple request
    payload = {
        "model": OLLAMA_GENERATION_MODEL,
        "prompt": "hi",
        "stream": False
    }
    try:
        print(f"\nTesting generate endpoint {GENERATE_URL} with model '{OLLAMA_GENERATION_MODEL}'...")
        response = requests.post(GENERATE_URL, json=payload, timeout=10)
        if response.status_code == 200:
            print("SUCCESS: Generate endpoint works!")
        else:
            print(f"FAILURE: {GENERATE_URL} returned {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"ERROR reaching {GENERATE_URL}: {e}")

if __name__ == "__main__":
    check_ollama()
