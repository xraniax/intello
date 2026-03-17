import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_generate_summary():
    payload = {
        "content": "This is a test content about quantum physics.",
        "task_type": "summary"
    }
    response = client.post("/generate", json=payload)
    assert response.status_code == 200
    assert "Summary" in response.json()["result"]

def test_process_document_text_only():
    data = {
        "content": "Manual text entry",
        "task_type": "upload"
    }
    response = client.post("/process-document", data=data)
    assert response.status_code == 200
    assert response.json()["data"]["extracted_text"] == "Manual text entry"

def test_process_document_empty():
    data = {
        "content": "",
        "task_type": "upload"
    }
    response = client.post("/process-document", data=data)
    assert response.status_code == 400
    assert "No content" in response.json()["message"]
