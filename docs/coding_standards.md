# Cognify Coding Standards

This document defines the coding standards and best practices for the Cognify project. Adhering to these standards ensures consistency, readability, and maintainability across our multi-language codebase.

## 1. General Principles

- **Clarity over Cleverness**: Write code that is easy to understand. Avoid obscure language features or overly complex logic.
- **Fail Fast**: Validate inputs and handle errors early. Use clear, descriptive error messages.
- **Don't Repeat Yourself (DRY)**: Abstract reusable logic into utilities or services, but avoid premature abstraction.
- **Documentation**: Keep comments and `ARCHITECTURE.md` files updated as you change core logic or APIs.

---

## 2. JavaScript / TypeScript (Frontend & Backend)

### Monorepo Tooling
This project uses **npm workspaces** to manage the `frontend` and `backend` packages from a single root.
- Install all dependencies from root: `npm install`
- Run lint across all workspaces: `npm run lint`
- Run tests across all workspaces: `npm run test`
- Format all files: `npm run format`

### Linting & Formatting
- **ESLint**: v9 flat config. Root config at [`eslint.config.js`](../eslint.config.js). Each workspace extends it with domain-specific rules.
- **Prettier**: Shared config at [`.prettierrc`](../.prettierrc). Run `npm run format` from root or per-workspace.
- **Environment**: Use `.env` files for configuration. Never commit secrets.

### Naming Conventions
- **Variables & Functions**: `camelCase` (e.g., `const userData = await userService.getUser(userId)`).
- **Classes & Components**: `PascalCase` (e.g., `class MaterialService`, `function MasteredCounter()`).
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;`).
- **Files**: `kebab-case` or specialized suffixes (e.g., `user.controller.js`, `auth.routes.js`).

### Best Practices
- **Async/Await**: Use `try/catch` blocks for all async operations.
- **Optional Chaining**: Use `?.` to safely access nested properties.
- **Destructuring**: Prefer destructuring for props and objects.

---

## 3. Python (Engine)

### Tooling
- **Formatting**: Black.
- **Linting**: Flake8.
- **Imports**: isort.
- **Typing**: Use Pydantic models for data validation and Type Hints for function signatures.

### Naming Conventions
- **Variables & Functions**: `snake_case` (e.g., `def process_document(file_path):`).
- **Classes**: `PascalCase` (e.g., `class DocumentProcessor:`).
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_CHUNK_SIZE = 1500`).
- **Internal/Private**: Prefix with a single underscore (e.g., `_save_to_temp()`).

### Best Practices
- **Type Hints**: Always use type hints for function arguments and return types.
- **Docstrings**: Use Google-style or ReST docstrings for public functions and classes.
- **Logging**: Use the standard `logging` module. Avoid `print()` statements in production code.

---

## 4. Database (PostgreSQL)

- **Naming**: Use `snake_case` for table and column names.
- **Migrations**: Every schema change must be accompanied by a migration file.
- **Queries**: Use parameterized queries or ORM methods to prevent SQL injection.

---

## 5. Security

- **Secrets**: Use environment variables for all sensitive information (API keys, DB credentials).
- **Input Validation**: Sanitize and validate all user inputs at the API boundary.
- **Rate Limiting**: Ensure APIs are protected against brute-force or DoS attacks (already implemented in Backend via `rateLimiter.middleware.js`).
