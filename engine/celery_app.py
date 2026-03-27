import os
from celery import Celery
from dotenv import load_dotenv

# Load env vars from the root .env file (shared with Docker)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

broker_url = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
result_backend = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/0")

celery_app = Celery(
    "cognify_engine",
    broker=broker_url,
    backend=result_backend,
    include=["tasks"]
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    
    # Production Hardening
    worker_concurrency=int(os.getenv("CELERY_CONCURRENCY", "2")),
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_time_limit=300, # 5 minutes max per task
    task_soft_time_limit=240, # 4 minutes soft limit for cleanup
)

if __name__ == "__main__":
    celery_app.start()
