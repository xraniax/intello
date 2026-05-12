# Use Case Diagram: Generate Summary

> **Architecture**: MAP/REDUCE | **Paths**: Async (Celery) + Streaming (SSE) | **Resilience**: Intelligent Fallback

## Overview

This diagram shows the organized flow for generating AI-powered study summaries with highlighted strong features.

---

## Organized Mermaid Diagram

```mermaid
flowchart TB
    subgraph Actors
        U[👤 Student]
        AI[🤖 Ollama AI Engine]
        DB[(🗄️ PostgreSQL)]
    end

    subgraph Core["🟡 CORE WORKFLOW (Mandatory)"]
        direction TB
        UC1["UC1: Generate Summary"]
        UC2["UC2: Validate Documents"]
        UC3["UC3: Retrieve Chunks"]
        UC4["UC4: REDUCE Synthesis"]
        UC5["UC5: Persist Result"]
        
        UC1 -.->|<<include>>| UC2
        UC1 -.->|<<include>>| UC3
        UC3 -.->|<<include>>| UC4
        UC4 -.->|<<include>>| UC5
    end

    subgraph Smart["🟢 SMART FEATURES (Conditional)"]
        direction TB
        UC6["UC6: MAP Stage<br/>Parallel Summarization"]
        UC7["UC7: Adaptive<br/>Context Sizing"]
        
        MAP_NOTE[">30K chars trigger"]
        ADAPT_NOTE["Dynamic VRAM allocation"]
        
        UC6 --> MAP_NOTE
        UC7 --> ADAPT_NOTE
    end

    subgraph Stream["🔵 REAL-TIME STREAMING (Optional)"]
        direction TB
        UC8["UC8: Stream Progress"]
        UC9["UC9: Live Token Streaming"]
        
        STREAM_NOTE["• Progress markers<br/>• Client disconnect tolerance<br/>• 10min timeout"]
        UC8 --> STREAM_NOTE
    end

    subgraph Resilience["🔴 RESILIENCE & FALLBACK"]
        direction TB
        UC10["UC10: Fallback Generation"]
        UC11["UC11: Error Handling"]
        
        FALLBACK_NOTE["• 8K truncated context<br/>• Synchronous backup<br/>• Zero data loss"]
        UC10 --> FALLBACK_NOTE
    end

    subgraph UserActions["🟠 USER ACTIONS"]
        UC_SELECT["Select Source Documents"]
        UC_CONFIG["Configure Options"]
        UC_VIEW["View Summary"]
    end

    ' Flow connections
    U --> UC_SELECT
    U --> UC_CONFIG
    UC_SELECT -.->|precedes| UC1
    UC_CONFIG -.->|precedes| UC1
    
    UC6 -.->|<<extend>>| UC3
    UC7 -.->|<<extend>>| UC4
    UC8 -.->|<<extend>>| UC1
    UC9 -.->|<<extend>>| UC4
    UC10 -.->|<<extend>>| UC4
    UC11 -.->|<<extend>>| UC1
    
    UC5 -.->|precedes| UC_VIEW
    U --> UC_VIEW

    ' System interactions
    UC4 --> AI
    UC6 --> AI
    UC10 --> AI
    
    UC1 --> DB
    UC3 --> DB
    UC5 --> DB
```

---

## Organized by Feature Zones

### 🟡 Core Workflow (Mandatory)
| UC | Use Case | Description | DB/AI |
|---|----------|-------------|-------|
| **UC1** | **Generate Summary** | Main entry point | Creates placeholder |
| **UC2** | **Validate Documents** | Check COMPLETED status, reject FAILED/EMPTY | — |
| **UC3** | **Retrieve Chunks** | Sequential retrieval from engine | Reads `chunks` table |
| **UC4** | **REDUCE Synthesis** | Final LLM generation via Ollama | **Invokes AI** |
| **UC5** | **Persist Result** | Save to `ai_generated_content`, mark COMPLETED | Writes result |

### 🟢 Smart Features (Auto-triggered)
| UC | Feature | Trigger | Highlight |
|---|---------|---------|-----------|
| **UC6** | **MAP Stage** | `total_chars > 30,000` | **Parallel processing** (2x concurrency, 90s timeout/chunk, 80 max chunks) |
| **UC7** | **Adaptive Context** | REDUCE stage | **Dynamic VRAM allocation** (2048-32768 tokens based on prompt length) |

### 🔵 Real-Time Streaming (Optional Path)
| UC | Feature | Highlight |
|---|---------|-----------|
| **UC8** | **Stream Progress** | `[PROGRESS] map N/M` markers keep connection alive |
| **UC9** | **Live Token Streaming** | SSE chunks stream as Ollama generates |

**Key Streaming Strengths:**
- Client disconnect tolerance (engine continues)
- 10-minute timeout for large documents
- Immediate first-token feedback

### 🔴 Resilience & Fallback (Failure Recovery)
| UC | Feature | Highlight |
|---|---------|-----------|
| **UC10** | **Fallback Generation** | **Zero-downtime recovery**: 8K truncated context, synchronous backup |
| **UC11** | **Error Handling** | Marks FAILED, triggers admin alerts |

---

## Strong Features Highlighted

### 1. **MAP/REDUCE Architecture**
```
┌─────────────────────────────────────────────────────────────┐
│  MAP STAGE (Conditional)                                    │
│  • Parallel chunk summarization                             │
│  • 2x concurrency (configurable)                            │
│  • 90s timeout per chunk                                    │
│  • Max 80 chunks (SUMMARY_MAX_CHUNKS)                       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  REDUCE STAGE (Always)                                      │
│  • Synthesizes final summary                                │
│  • 5 structured sections:                                     │
│    Overview → Key Concepts → Detailed Explanation           │
│    → Examples → Key Terms                                   │
│  • Adaptive context window (1 token ≈ 3 chars)              │
└─────────────────────────────────────────────────────────────┘
```

### 2. **Dual Path Execution**
| Aspect | Async (Celery) | Streaming (SSE) |
|--------|---------------|-----------------|
| Endpoint | `POST /generate` | `POST /generate/stream` |
| Persistence | Immediate on completion | On client poll/recovery |
| Progress | Polling job status | Real-time markers |
| Timeout | 5 minutes | 10 minutes |
| Best for | Large batch jobs | Interactive experience |

### 3. **Intelligent Fallback**
```
Primary Path (Python Engine)
         │
         ▼ fails
┌─────────────────┐
│ Fallback Path   │
│ • 8K context    │
│ • Sync generate │
│ • No data loss │
└─────────────────┘
         │
         ▼ fails
┌─────────────────┐
│ Error Handler   │
│ • Mark FAILED   │
│ • Admin alert   │
└─────────────────┘
```

### 4. **5 Summary Modes**
| Mode | Target Use Case |
|------|-----------------|
| `key_concepts` | Quick revision |
| `concise_summary` | Balanced study |
| `detailed_explanation` | Deep learning |
| `exam_ready_notes` | Test prep |
| `teach_me_mode` | Beginner tutoring |

---

## Event Flow (Chronological)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INITIATION                                  │
│  [Select Docs] → [Configure: mode/difficulty/language]                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      BACKEND PROCESSING (Node.js)                        │
│  Validate Docs → Create Placeholder (PENDING_JOB) → Forward to Engine   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        ENGINE PROCESSING (Python)                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐               │
│  │ MAP Stage?  │───→│ REDUCE Stage│───→│  Return     │               │
│  │ (>30K chars)│    │ (synthesize)│    │  Result     │               │
│  └─────────────┘    └─────────────┘    └─────────────┘               │
│       │                                                │               │
│       ▼                                                ▼               │
│  Parallel chunks                                   Fallback?           │
│  (if needed)                                       (on failure)        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      PERSISTENCE & COMPLETION                            │
│  Update materials.ai_generated_content → Mark COMPLETED → Update subject │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Database Operations

| Operation | Table | Columns | Timing |
|-----------|-------|---------|--------|
| Create placeholder | `materials` | `id`, `user_id`, `subject_id`, `type='summary'`, `status='PENDING_JOB'` | Step 1 |
| Update processing | `materials` | `status='PROCESSING'`, `job_id`, `started_at` | Step 2 |
| Write result | `materials` | `ai_generated_content`, `status='COMPLETED'`, `processed_at`, `completed_at` | Final |
| Read chunks | `chunks` (engine) | `content`, `document_id` | During generation |
| Touch subject | `subjects` | `last_activity_at=NOW()` | Post-completion |

---

## Reference Implementation

| Component | File Path |
|-----------|-----------|
| Backend Controller | `backend/src/controllers/material.controller.js:116-175` |
| Backend Service | `backend/src/services/material.service.js:497-590, 430-495` |
| Material Model | `backend/src/models/material.model.js:24-31` |
| Engine Routes | `engine/services/routes/generation.py:23-139` |
| Summary Pipeline | `engine/services/summary_pipeline.py:1-789` |
| Celery Tasks | `engine/tasks.py:622-741` |

---

*Generated for Cognify Platform Architecture Documentation*

---

## Use Case Specifications

### UC-1: Generate Summary (Main)
| Attribute | Description |
|-----------|-------------|
| **Use Case ID** | UC-1 |
| **Name** | Generate Summary |
| **Actor** | Student (Primary) |
| **Description** | Generates an AI-powered summary from selected source documents |
| **Preconditions** | User is authenticated; Source documents exist and are processed |
| **Postconditions** | Summary material created and persisted; Subject activity updated |

### Included Use Cases (Mandatory)

| ID | Use Case | Description | Trigger |
|----|----------|-------------|---------|
| UC-1.1 | **Validate Source Documents** | Verify documents are COMPLETED, not FAILED/EMPTY | Always |
| UC-1.2 | **Create Material Placeholder** | Insert `materials` record with `PENDING_JOB` status | Always |
| UC-1.3 | **Retrieve Document Chunks** | Fetch chunks from engine's `chunks` table sequentially | Always |
| UC-1.4 | **Execute REDUCE Stage** | Synthesize final summary via Ollama LLM | Always |
| UC-1.5 | **Persist Summary Result** | Update `materials` with `ai_generated_content`, mark `COMPLETED` | Always |

### Extended Use Cases (Conditional)

| ID | Use Case | Condition | Description |
|----|----------|-----------|-------------|
| UC-1.6 | **Execute MAP Stage** | `total_chars > 30,000` | Parallel chunk summarization to fit context window |
| UC-1.7 | **Stream Progress Markers** | Streaming path selected | Yield `[PROGRESS] map N/M` SSE events |
| UC-1.8 | **Apply Fallback Generation** | Primary path fails | Synchronous generation with truncated context |
| UC-1.9 | **Handle Generation Failure** | All paths fail | Record error, mark FAILED, trigger alert |

### User-Facing Use Cases

| ID | Use Case | Actor | Description |
|----|----------|-------|-------------|
| UC-2 | **Select Source Documents** | Student | Choose 1+ documents from subject workspace |
| UC-3 | **Configure Summary Options** | Student | Set `summary_mode`, `difficulty`, `language`, `topic` |
| UC-4 | **View Generated Summary** | Student | Display persisted summary with sections |

---

## Summary Modes Supported

| Mode | Description |
|------|-------------|
| `key_concepts` | Bullet-point essentials only |
| `concise_summary` | Balanced compression |
| `detailed_explanation` | Comprehensive with reasoning |
| `exam_ready_notes` | Structured revision format |
| `teach_me_mode` | Tutor-style with analogies |

---

## Database Entities

```
┌─────────────────────────────────────────────────────────────┐
│  MATERIALS (Backend)                                         │
├─────────────────────────────────────────────────────────────┤
│  id (PK)                │  ai_generated_content (JSONB)    │
│  user_id (FK)           │  status                          │
│  subject_id (FK)        │  job_id                          │
│  title                  │  started_at / completed_at       │
│  type = 'summary'       │  processed_at                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  CHUNKS (Engine)                                             │
├─────────────────────────────────────────────────────────────┤
│  id (PK)                │  content (TEXT)                  │
│  document_id (FK)       │  embedding (vector)              │
└─────────────────────────────────────────────────────────────┘
```

---

## Event Flow (Ordered)

```
[User] ──► Select Documents ──► Configure Options ──► Trigger Generation
                                                              │
                                                              ▼
[Backend] ◄── Validate Docs ◄── Create Placeholder ◄── Forward to Engine
                                                              │
                                                              ▼
[Engine] ──► Retrieve Chunks ──► [MAP?] ──► REDUCE ──► Return Result
                               (if >30K)     │
                                              ▼
[Backend] ──► Persist Result ──► Update Subject Activity ──► [User Views]
```

---

## Files Referenced

| Component | Path |
|-----------|------|
| Backend Controller | `backend/src/controllers/material.controller.js:116-126` |
| Backend Service | `backend/src/services/material.service.js:497-590` |
| Backend Routes | `backend/src/routes/material.routes.js:21-22` |
| Backend Model | `backend/src/models/material.model.js:24-31` |
| Engine Routes | `engine/services/routes/generation.py:23-139` |
| Summary Pipeline | `engine/services/summary_pipeline.py:1-789` |
| Celery Tasks | `engine/tasks.py:622-741` |

---

*Generated for Cognify Platform Audit*
