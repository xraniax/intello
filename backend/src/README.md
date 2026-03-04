# Backend Source

This directory contains the server-side code organized into logical layers:

- **config/** – configuration helpers (e.g. Multer storage, environment, etc.)
- **controllers/** – request handlers implementing business logic
- **routes/** – express routers mounting controller actions
- **models/** – database access or ORM models
- **middleware/** – custom Express middleware functions
- **utils/** – shared utility functions

The entry point for the application is `src/server.js`, which boots the Express app defined in `src/app.js`.
