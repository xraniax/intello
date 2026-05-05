# Cognify - Global Use Case Diagram

## System Overview

Cognify is an AI-powered educational platform that helps students learn more effectively through intelligent document processing, personalized study materials, and interactive learning features.

## Use Case Diagram (PlantUML Format)

```plantuml
@startuml Cognify_Global_UseCase
!define ABSTRACT abstract
skinparam backgroundColor #FEFEFE
skinparam actorBackgroundColor #DDDDDD
skinparam actorBorderColor #000000
skinparam usecaseBackgroundColor #DDEBF7
skinparam usecasteBorderColor #0066CC

left to right direction

' Actors
actor Student
actor Admin
actor ExternalSystem as "External\nSystem\n(OAuth/Drive)"

' System
rectangle Cognify {
  
  ' Authentication & Profile Management
  usecase UC1 as "Register/Login\n(Email, OAuth)"
  usecase UC2 as "Manage Profile\nSettings"
  usecase UC3 as "Manage Authentication\nTokens (JWT)"
  
  ' Document/Material Management
  usecase UC4 as "Upload\nDocuments"
  usecase UC5 as "Process\nDocuments\n(OCR, Extract)"
  usecase UC6 as "Create Study\nMaterials"
  usecase UC7 as "Organize Materials\nby Subject"
  usecase UC8 as "Delete/Archive\nMaterials"
  
  ' Learning Features
  usecase UC9 as "Create Quiz\nfrom Material"
  usecase UC10 as "Take Quiz"
  usecase UC11 as "View Quiz\nResults/Analytics"
  usecase UC12 as "Generate Study\nGuides/Notes"
  usecase UC13 as "Chat with\nAI Assistant"
  
  ' Exam Management
  usecase UC14 as "Create Exam"
  usecase UC15 as "Take Exam"
  usecase UC16 as "Grade Exam"
  usecase UC17 as "View Exam\nAnalytics"
  
  ' Administration
  usecase UC18 as "Manage Users"
  usecase UC19 as "View System\nAnalytics"
  usecase UC20 as "Configure\nSystem Settings"
  
  ' AI Engine Services
  usecase UC21 as "Generate Vector\nEmbeddings"
  usecase UC22 as "Retrieve Relevant\nContent (RAG)"
  usecase UC23 as "Generate AI\nResponses"
  usecase UC24 as "Score Quiz/Exam"
  usecase UC25 as "Process Background\nTasks (Celery)"
  
  ' External Integration
  usecase UC26 as "Google Drive\nIntegration"
  usecase UC27 as "OAuth\nAuthentication"
}

' Student Connections
Student --> UC1
Student --> UC2
Student --> UC4
Student --> UC7
Student --> UC9
Student --> UC10
Student --> UC11
Student --> UC12
Student --> UC13
Student --> UC14
Student --> UC15
Student --> UC17

' Admin Connections
Admin --> UC1
Admin --> UC2
Admin --> UC18
Admin --> UC19
Admin --> UC20

' External System Connections
ExternalSystem --> UC26
ExternalSystem --> UC27

' Internal Service Dependencies (RAG Pipeline)
UC4 --> UC5 : "triggers"
UC5 --> UC21 : "sends doc to"
UC21 --> UC22 : "stores embeddings"
UC6 --> UC22 : "uses"
UC22 --> UC23 : "retrieves context"
UC23 --> UC13 : "provides responses"
UC23 --> UC12 : "generates materials"
UC9 --> UC24 : "triggers"
UC10 --> UC24 : "triggers"
UC15 --> UC24 : "triggers"
UC14 --> UC25 : "background task"
UC6 --> UC25 : "background task"
UC5 --> UC25 : "background task"

' Admin Oversight
UC19 -.-> UC10 : "monitors"
UC19 -.-> UC15 : "monitors"
UC19 -.-> UC13 : "monitors"

' Authentication Check
UC6 -.-> UC3 : "requires"
UC13 -.-> UC3 : "requires"
UC15 -.-> UC3 : "requires"

@enduml
```

## System Components Breakdown

### 1. **Frontend (React + Vite)**
- **Actors**: Student, Admin
- **Responsibilities**: UI/UX, form handling, real-time updates
- **Key Pages**: Dashboard, Material Upload, Quiz Interface, Analytics, Admin Panel

### 2. **Backend (Node.js/Express)**
- **Actors**: Students, Admins, External Systems (OAuth, Google Drive)
- **Responsibilities**: 
  - REST API endpoints
  - User authentication & authorization
  - Metadata management
  - Session handling
  - File access control
- **Key Routes**:
  - `/api/auth` - Authentication & Profile
  - `/api/materials` - Document management
  - `/api/subjects` - Subject organization
  - `/api/quiz` - Quiz management
  - `/api/exams` - Exam management
  - `/api/analytics` - User analytics
  - `/api/chat` - Chat interface
  - `/api/admin` - Admin functions

### 3. **AI Engine (Python/FastAPI)**
- **Responsibilities**: 
  - Document processing (OCR, text extraction)
  - Vector embeddings generation
  - RAG (Retrieval-Augmented Generation) pipeline
  - Quiz generation & scoring
  - AI response generation
- **External Dependencies**:
  - **Ollama**: Local LLM & embedding model
  - **Redis**: Task queue broker for Celery
  - **PostgreSQL + pgvector**: Vector database
  - **Celery**: Background task processing

### 4. **Database (PostgreSQL + pgvector)**
- **Data Models**: Users, Materials, Subjects, Quizzes, Exams, Analytics, Embeddings
- **Features**: Role-based access (Student, Admin), Vector search capabilities

## Key Use Case Flows

### A. Document Processing & Study Material Generation
```
1. Student uploads document
2. Backend validates and stores metadata
3. Engine processes document (extract text via OCR)
4. Engine generates embeddings (vectors)
5. Embeddings stored in pgvector
6. Student can now create quiz/study guides from processed material
```

### B. AI Chat & Knowledge Retrieval
```
1. Student asks question in chat
2. Backend receives query
3. Engine retrieves relevant content (semantic search with embeddings)
4. Engine generates AI response with retrieved context (RAG)
5. Response sent to student
```

### C. Quiz/Exam Workflow
```
1. Student creates quiz from study material
2. System generates questions (background task via Celery)
3. Student takes quiz
4. Engine scores responses
5. Results and analytics generated
6. Student views performance analytics
```

### D. Authentication & Authorization
```
1. Student registers/logs in (JWT-based)
2. Email or OAuth (Google/GitHub)
3. Backend verifies credentials
4. JWT token issued
5. Token required for all subsequent API calls
6. Role-based access control enforced (Student vs Admin)
```

## Key Features by Role

### **Student**
- ✅ Upload documents (PDF, images)
- ✅ Organize materials by subject
- ✅ Generate AI-powered study guides
- ✅ Create & take quizzes
- ✅ Create & take exams
- ✅ Chat with AI assistant
- ✅ View performance analytics
- ✅ Manage profile settings

### **Admin**
- ✅ User account management
- ✅ System-wide analytics
- ✅ Configuration settings
- ✅ Role-based access control
- ✅ System health monitoring

### **External Systems**
- ✅ Google OAuth login
- ✅ GitHub OAuth login
- ✅ Google Drive integration (document upload)

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React, Vite, JavaScript |
| **Backend API** | Node.js, Express.js, Passport.js |
| **Authentication** | JWT, OAuth 2.0 (Google/GitHub), bcrypt |
| **Database** | PostgreSQL, pgvector (vector search) |
| **AI Engine** | Python, FastAPI, Ollama |
| **LLM Models** | qwen2.5:3b (generation), nomic-embed-text (embeddings) |
| **Task Queue** | Celery, Redis |
| **File Storage** | Mounted volumes (Docker), local filesystem |
| **Security** | Helmet.js, CORS, rate limiting, input sanitization |
| **Orchestration** | Docker Compose |

## Data Flow Diagram

```
┌─────────────┐
│   Student   │
└──────┬──────┘
       │
       ▼
┌──────────────────┐      ┌──────────────┐
│  React Frontend  │◄────►│   Express    │
│  (Port 3000)     │      │  Backend     │
└──────┬───────────┘      │  (Port 5000) │
       │                  └──────┬───────┘
       │                         │
       └─────────────┬───────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
    ┌──────┐  ┌──────────┐  ┌──────────────┐
    │  JWT │  │PostgreSQL│  │  FastAPI     │
    │ Auth │  │ (Metadata│  │  Engine      │
    └──────┘  │Embeddings)  │ (Port 8000)  │
              └──────────┘  └──────┬───────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
                  ┌────┐      ┌────────┐     ┌──────┐
                  │    │      │ Celery │     │Ollama│
                  │Redis      │(Tasks) │     │(LLM) │
                  └────┘      └────────┘     └──────┘
```

---

**Last Updated**: May 2, 2026  
**Project**: Cognify - AI-Powered Educational Platform
