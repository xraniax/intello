# Cognify Engine Architecture

The Cognify Engine is a Python-based FastAPI service responsible for the heavy computational tasks of the platform, including document processing, RAG (Retrieval-Augmented Generation), and AI-driven study material generation.

## Architectural Components

The engine is organized into several key modules and services:

1.  **API Layer (`services/api.py`, `main.py`)**: Defines the endpoint structure for external communication.
2.  **Processing Services (`services/`)**:
    - `document_processor.py`: Orchestrates the raw document-to-knowledge pipeline.
    - `preprocessing.py`: Handles file extraction, cleaning, and normalization.
    - `embeddings.py`: Interfaces with **Ollama** to generate vector embeddings.
    - `generation.py`: Manages the LLM generation logic for study materials and quizzes.
    - `retrieval.py`: Handles semantic search and chunk retrieval from the vector database.
3.  **Background Tasks (`tasks.py`, `celery_app.py`)**: Uses **Celery** with **Redis** to offload long-running tasks from the main API thread.
4.  **Database Layer (`models.py`, `database.py`)**: Uses SQLAlchemy for ORM mapping and `pgvector` for vector storage/retrieval.
5.  **Core Utilities (`core/`)**: Includes normalization and shared logic used across the engine.

## The RAG Pipeline

Cognify's core value proposition is built around a robust RAG pipeline:

1.  **Ingestion**: User uploads a document (PDF/Image).
2.  **Preprocessing**: Text is extracted, cleaned, and split into manageable chunks.
3.  **Embedding**: Chunks are converted into 768-dimensional vectors using the configured Ollama model.
4.  **Storage**: Chunks and their embeddings are stored in PostgreSQL/pgvector.
5.  **Retrieval**: When generating materials, relevant chunks are retrieved based on the user's topic.
6.  **Generation**: The LLM uses the retrieved chunks as context to generate high-quality study aids.

## External Dependencies

- **Ollama**: Essential for running local LLMs and embedding models.
- **Redis**: Acts as the message broker for Celery tasks.
- **PostgreSQL (+pgvector)**: Stores relational data and vector embeddings.

## Error Handling & Diagnostics

- The engine includes a diagnostic pipeline (`services/diagnostics.py`) that runs on startup to ensure all dependencies (especially Ollama and GPU) are reachable and healthy.
- Comprehensive logging is used across all services to aid in debugging complex generation flows.
