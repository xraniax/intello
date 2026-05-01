# Cognify Backend Architecture

The Cognify Backend is a Node.js/Express application that serves as the central orchestration layer for the platform. It manages user authentication, stores metadata, and interfaces with the AI Engine for heavy-duty processing.

## Core Architectural Layers

1.  **Routes (`src/routes/`)**: Define the API surface area. Grouped by domain (auth, materials, subjects, etc.).
2.  **Middlewares (`src/middlewares/`)**: Reusable logic for request validation, authentication checks (Passport.js), and error handling.
3.  **Controllers (`src/controllers/`)**: Handle the request-response lifecycle. They extract data from requests and call the appropriate service.
4.  **Services (`src/services/`)**: Contain the core business logic. Services are responsible for data manipulation and external API calls (e.g., calling the Engine).
5.  **Models (`src/models/`)**: Abstract the database interactions.

## Key Workflows

### Authentication
- Uses **Passport.js** for handling session-based authentication and OAuth (Google).
- Sessions are stored temporarily to maintain user state during the OAuth flow.

### Document/Material Management
- The backend manages the metadata for subjects and materials.
- When a material is created or updated, the backend often delegates the actual processing (OCR, embedding, generation) to the **Engine Service**.

### Engine Interaction
- The backend communicates with the Engine via HTTP requests (REST API).
- Long-running tasks (like material generation) are tracked using `job_id` mappings between the Backend and Engine.

## Database
- Uses a PostgreSQL database (accessible via `db.js`).
- Migrations are managed in the `migrations/` directory.

## Error Handling
- A global `errorHandler` middleware catches and formats all errors to ensure a consistent API response structure.
