from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_generate_success():
    response = client.post("/generate", json={
        "content": "Some test context materials",
        "task_type": "summary"
    })
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_generate_invalid_task_type():
    response = client.post("/generate", json={
        "content": "Some test context materials",
        "task_type": "unsupported_type"
    })
    assert response.status_code == 422
    data = response.json()
    assert data["code"] == "VALIDATION_ERROR"
    assert "task_type" in data["errors"]

def test_generate_empty_content():
    response = client.post("/generate", json={
        "content": "",
        "task_type": "quiz"
    })
    assert response.status_code == 422
    assert "content" in response.json()["errors"]

def test_chat_success():
    response = client.post("/chat", json={
        "context": "Context docs here",
        "question": "What does it mean?"
    })
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_chat_empty_question():
    response = client.post("/chat", json={
        "context": "Context docs here",
        "question": ""
    })
    assert response.status_code == 422
    assert "question" in response.json()["errors"]
