# Cognify Testing Strategy

## Framework Decision

Cognify is a polyglot monorepo (Node.js backend, React frontend, Python engine). Rather than forcing a single framework across all runtimes, we intentionally keep the framework that best fits each ecosystem:

| Layer | Framework | Why |
|-------|-----------|-----|
| Backend (Node.js) | **Jest** | Native ESM support via `--experimental-vm-modules`, deep supertest integration, `jest.unstable_mockModule` for ESM mocking, mature ecosystem |
| Frontend (React/Vite) | **Vitest** | First-class Vite plugin, sub-100ms HMR-style reruns, identical Jest API so there's no learning curve, native ESM, faster than Jest for browser-environment tests |
| Engine (Python/FastAPI) | **pytest** | De facto Python standard, pytest-asyncio for async FastAPI handlers, httpx `AsyncClient` for ASGI-level testing without a running server, rich fixture system |
| E2E | **Playwright** | Cross-browser, works with Docker Compose, auto-wait, trace viewer for flaky-test debugging |

Keeping frameworks aligned to their runtimes gives each team member the fastest feedback loop and the richest mocking ecosystem for their language.

---

## Directory Layout

```
cognify/
├── backend/
│   ├── jest.config.js
│   └── src/tests/
│       ├── unit/               # Isolated logic, all I/O mocked
│       │   ├── auth.middleware.test.js
│       │   ├── auth.controller.test.js
│       │   ├── quota.service.test.js
│       │   ├── alert.service.test.js
│       │   ├── user.model.test.js
│       │   └── material.service.test.js
│       ├── integration/        # HTTP layer via supertest, DB mocked at model level
│       │   ├── auth.register.test.js
│       │   ├── auth.login.test.js
│       │   ├── auth.password.test.js
│       │   ├── security.test.js
│       │   └── material.test.js
│       └── utils/
│           ├── mockData.js     # Canonical fake entities
│           └── factories.js    # Builder functions for test data
│
├── frontend/
│   ├── vitest.config.js
│   └── src/tests/
│       ├── unit/               # Pure functions and store logic
│       │   ├── validators.test.js
│       │   ├── format.test.js
│       │   ├── useAuthStore.test.js
│       │   └── useUIStore.test.js
│       ├── components/         # Component render + interaction
│       │   ├── Navbar.test.jsx
│       │   └── FileUpload.test.jsx
│       ├── pages/              # Page-level integration with stores
│       │   └── Upload.test.jsx
│       └── setup.js            # Global vitest setup
│
├── engine/
│   ├── pytest.ini
│   ├── requirements-test.txt
│   └── tests/
│       ├── conftest.py         # Fixtures: app client, mock DB, mock Redis
│       ├── unit/
│       │   ├── test_policies.py
│       │   └── test_schemas.py
│       ├── integration/
│       │   └── test_api_health.py
│       └── security/
│           └── test_prompt_injection.py
│
└── .github/workflows/
    └── ci.yml                  # Runs all test suites on push
```

---

## Testing Pyramid

```
         /\
        /E2E\          < 10 tests — critical happy paths only
       /------\
      / Integ. \       ~30 tests — HTTP routes, DB model contracts
     /----------\
    /    Unit    \     ~80 tests — services, hooks, utilities, models
   /--------------\
```

### Unit tests
- **Scope**: A single function or class method. All external I/O (DB, HTTP, file system) is replaced with Jest/Vitest mocks or pytest monkeypatching.
- **Speed target**: < 5 ms per test, entire suite < 30 s.
- **What to test**: business rules, conditional branches, error paths, return values.
- **What NOT to test**: that a mock was called (that is spy-testing, not behavior-testing).

### Integration tests
- **Scope**: HTTP request → controller → service → **mocked model** → response. The DB is never hit; models are mocked at the module boundary.
- **Speed target**: < 50 ms per test, entire suite < 60 s.
- **What to test**: correct status codes, response shapes, validation error messages, auth guards, error propagation.

### End-to-end tests
- **Scope**: Real browser (Playwright) against a fully running Docker Compose stack.
- **When to run**: nightly CI / pre-release, not on every commit.
- **What to test**: signup → verify → login → upload → quiz → analytics. The minimum path that proves the product works.

---

## Coverage Thresholds

Thresholds are enforced by the CI gate — builds **fail** if coverage drops below:

| Layer | Statements | Branches | Functions | Lines |
|-------|-----------|----------|-----------|-------|
| Backend | 70% | 65% | 70% | 70% |
| Frontend | 65% | 60% | 65% | 65% |
| Engine | 60% | 55% | 60% | 60% |

These are *minimum floors*, not targets. Aim for meaningful coverage of business logic, not 100% line coverage of getters and trivial wrappers.

---

## How to Run Tests

### Backend
```bash
cd backend
npm test                         # all tests
npm test -- --testPathPattern=unit    # unit only
npm test -- --testPathPattern=integration  # integration only
npm run test:coverage            # with HTML coverage report
```

### Frontend
```bash
cd frontend
npm test                         # watch mode (development)
npm run test:run                 # single pass (CI)
npm run test:coverage            # with coverage report
```

### Engine
```bash
cd engine
pip install -r requirements-test.txt
pytest                           # all tests
pytest tests/unit/               # unit only
pytest -v --cov=services --cov-report=html  # with coverage
```

### E2E (requires running stack)
```bash
docker compose up -d
cd frontend
npx playwright test              # headless
npx playwright test --ui         # interactive trace viewer
```

---

## Writing New Tests

### Backend unit test template
```js
// src/tests/unit/my.service.test.js
import { jest } from '@jest/globals';

// 1. Define all module mocks BEFORE any imports
jest.unstable_mockModule('../../models/some.model.js', () => ({
  default: { findById: jest.fn(), create: jest.fn() }
}));

// 2. Dynamic import AFTER mocks
const { default: MyService } = await import('../../services/my.service.js');
const { default: SomeModel } = await import('../../models/some.model.js');

describe('MyService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does X when Y', async () => {
    SomeModel.findById.mockResolvedValue({ id: 1 });
    const result = await MyService.doSomething(1);
    expect(result).toMatchObject({ id: 1 });
  });
});
```

### Frontend unit test template
```jsx
// src/tests/unit/useMyStore.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMyStore } from '../../store/useMyStore';

// Reset Zustand state between tests
beforeEach(() => useMyStore.setState(useMyStore.getInitialState?.() ?? {}));

describe('useMyStore', () => {
  it('updates state correctly', () => {
    const { result } = renderHook(() => useMyStore());
    act(() => result.current.actions.doSomething());
    expect(result.current.data.something).toBe(true);
  });
});
```

### Engine pytest template
```python
# tests/unit/test_my_service.py
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_my_function_success(mock_db):
    with patch("services.my_service.some_dep", new_callable=AsyncMock) as m:
        m.return_value = {"result": "ok"}
        from services.my_service import my_function
        result = await my_function("input")
    assert result["result"] == "ok"
```

---

## Mocking Conventions

### Backend
- **Database**: Mock the `query` function from `db.js` OR mock entire model classes with `jest.unstable_mockModule`.
- **Email service**: Always mock. Never send real emails in tests.
- **Engine HTTP client**: Mock `engineClient` or `axios.post`. Never hit the Python engine from Node tests.
- **JWT_SECRET**: Set `process.env.JWT_SECRET = 'test-secret'` in `tests/setup.js`. Already done.
- **Test auth bypass**: Use `Authorization: Bearer test-bypass-token` in integration tests (works when `NODE_ENV=test`).

### Frontend
- **API calls**: Mock the service modules (e.g., `authService`) with `vi.mock()`.
- **localStorage**: `vi.stubGlobal('localStorage', localStorageMock)` in setup.
- **Zustand stores**: Reset state with `useStore.setState({})` in `beforeEach`.
- **Toast**: Mock `react-hot-toast` to avoid DOM noise.

### Engine
- **PostgreSQL**: Use `pytest-mock` or `monkeypatch` to patch `get_db()`.
- **Redis**: Mock `redis_client.get/set` with `unittest.mock.AsyncMock`.
- **Ollama**: Patch `embeddings.generate_embedding()` to return a fixed vector.
- **OpenAI**: Patch `openai.ChatCompletion.create` / `AsyncOpenAI().chat.completions.create`.

---

## CI Gates

Every pull request must pass:
1. Backend Jest (with coverage thresholds)
2. Frontend Vitest (with coverage thresholds)
3. Engine pytest

E2E tests run on schedule (nightly) and on release branches only.

See `.github/workflows/ci.yml` for the complete pipeline.

---

## Security Testing

Security tests live alongside other tests but are tagged with `@security` (pytest) or described under `security` blocks (Jest/Vitest). They cover:

- **Brute force protection**: 5 failed logins from same IP/UA → tuple locked
- **JWT validation**: expired, tampered, missing, wrong secret
- **RBAC**: non-admin accessing admin routes → 403
- **Input validation**: oversized payloads, SQL-like strings, null bytes in fields
- **Sensitive data**: ensure password hashes, tokens never appear in API responses
- **Secure cookies**: check `httpOnly`, `sameSite` flags where applicable

---

## Flaky Test Policy

- A test that fails in CI more than once without a code change is **flaky** and must be fixed or deleted within one sprint.
- Mark suspected-flaky tests with `// FLAKY: reason` while investigating.
- Never use `setTimeout` in tests — use fake timers (`jest.useFakeTimers()` / `vi.useFakeTimers()`).
- Avoid order-dependent tests. Each test must be independently runnable.
