# Cognify Frontend Architecture

The Cognify Frontend is a React-based single-page application (SPA) centered on providing a highly interactive and responsive AI study experience. It follows a modular, layer-based architecture to ensure scalability and ease of maintenance.

## Core Architectural Layers

1.  **UI Components (`src/components/`, `src/pages/`)**: Pure view layer. Focuses on rendering and user interaction.
2.  **Business Logic Hooks (`src/hooks/`)**: Contain the functional logic of the application. They coordinate between the UI and the service/state layers.
3.  **Service Layer (`src/services/`)**: The sole entry point for external data. Services handle API calls and data normalization.
4.  **Global Store (`src/store/`)**: Uses **Zustand** for lightweight, predictable global state management.
5.  **Features (`src/features/`)**: High-level modules that group related components, hooks, and services into cohesive units (e.g., `generation`, `quiz`).

---

## Strict Architectural Rules

This section outlines the strict rules governing the Cognify AI study assistant. Adhering to these rules is critical for maintaining separation of concerns and preventing technical debt.

## 1. Strict Layering
Data and logic must flow in a single direction:
**UI Component → Business Logic Hook → Domain Service → Global Store → UI Component**

### Rules:
- **Hooks MUST NOT import UI components**: Components stay in the view layer.
- **Services MUST NOT have internal React state**: Use global stores (Zustand) or local hook state.
- **Global Store MUST NOT be mutated directly**: Components must use strict, named actions (e.g., `setExpectedFlashcards`) provided by the store.

## 2. Service Layer Boundaries
Services are the sole interface between the application and external systems (API, PDF Browser API, etc.).

- **MaterialService**: Handles all material life-cycles, AI generation, and synchronization.
- **ExportService**: Handles clean-room isolations and PDF generation strategies.
- **SubjectService**: Dedicated exclusively to subject organization and management.

## 3. UI Resilience & Error Handling
- **Async Safety**: Every async call originating from a hook or service MUST be wrapped in a `try/catch` at the point of UI interaction.
- **User Feedback**: Errors must not be silent. Use `react-hot-toast` or system alerts to inform the user of failures (e.g., "Failed to generate material").

## 4. State Namespacing
As the global store grows, metadata MUST be namespaced to prevent key collisions and logical confusion:
- `generation`: System-critical settings (counts, difficulty, job status).
- `ui`: Transient visual state (collapsed sections, localMasteredCount).

## 5. Lifecycle Hygiene
- **Cleanup**: Components/Hooks that register listeners or persistent metadata MUST implement cleanup logic (e.g., `clearMaterialMetadata(id)`) upon unmount or deletion to prevent memory leaks.
