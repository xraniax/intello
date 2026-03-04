# Backend Service

This service provides REST endpoints and renders views using Express.
The code is located under `src/` in a layered, maintainable structure.

## Quick start

```bash
cd backend
npm install
npm run dev   # starts nodemon on src/server.js
```

### Structure overview

```
backend/
  src/
    config/          # configuration helpers
    controllers/     # request handlers
    middleware/      # custom express middleware
    models/          # database layer
    routes/          # express routers
    utils/           # shared utilities
    app.js           # express app configuration
    server.js        # entry point that boots the app
    db.js            # postgres pool
  uploads/           # file uploads (ignored by git)
  public/            # static assets
  views/             # EJS templates
  package.json
  Dockerfile

## Authentication

Users are stored in the `users` table (see `db/init.sql`).
Passwords are hashed with bcrypt and JSON web tokens (JWTs) are returned on
signup/signin.  Tokens must be included using an `Authorization: Bearer …`
header.  A middleware helpers are available in `src/middleware/auth.js`:

* `authenticate` – verifies the token and populates `req.user`.
* `requireRole(role)` – ensures the authenticated user has the given role
  (e.g. `admin`).

Example protected endpoint: `/api/auth/admin-only`.

Make sure to set the `JWT_SECRET` environment variable in production.
```
