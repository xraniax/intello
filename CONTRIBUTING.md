# Contributing to Cognify

Thank you for your interest in contributing to Cognify! This document provides guidelines and instructions for contributing to the project.

## Development Workflow

### 1. Branching Strategy
- **`main`**: The stable branch. Do not commit directly to `main`.
- **Feature Branches**: Create a new branch for every feature or bug fix (e.g., `feature/awesome-feature` or `fix/broken-thing`).
- **Pull Requests**: submit a PR targetting `main`. Ensure your PR includes a clear description of the changes and a link to any relevant issues.

### 2. Local Environment Setup

#### Prerequisites
- Docker & Docker Compose
- Node.js (v18+)
- Python (3.10+)

#### Quick Start
```bash
# Clone the repository
git clone https://github.com/your-org/cognify.git
cd cognify

# Initialize environment variables
cp .env.example .env
# Follow instructions in backend and engine directories to setup their respective .env files

# Start the services using Docker
docker-compose up --build
```

### 3. Coding Standards

Cognify follows strict coding standards to maintain code quality and consistency across its multi-language codebase.

- **Frontend (React)**: Follow the [Frontend Architecture Guidelines](frontend/ARCHITECTURE.md).
- **Backend (Node.js)**: Follow the [Backend Architecture Guidelines](backend/ARCHITECTURE.md).
- **Engine (Python)**: Follow the [Engine Architecture Guidelines](engine/ARCHITECTURE.md).

Specific linting and formatting rules:
- **JavaScript/TypeScript**: ESLint + Prettier.
- **Python**: Black + Flake8 + isort.

### 4. Commits and Documentation
- Use descriptive commit messages (e.g., `feat: add Google Drive fallback storage`).
- Keep documentation up-to-date. If you change an API or a core component, update the relevant `ARCHITECTURE.md` or `README.md`.

### 5. Testing
Before submitting a PR, ensure all tests pass.
```bash
# Root tests
npm test

# Specialized tests
cd backend && npm test
cd engine && pytest
```
Refer to [TESTING.md](TESTING.md) for more details on the testing strategy.

## Questions?
If you have any questions or need clarification, please open an issue or contact the maintainers.
