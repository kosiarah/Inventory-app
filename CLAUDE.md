# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install dependencies (first time only)
npm start          # start server at http://localhost:3000
node server.js     # equivalent to npm start
```

There are no tests or linting configured.

## Architecture

Single-page app with two source files:

- **`server.js`** — Express REST API + static file serving. All backend logic lives here.
- **`public/index.html`** — Entire frontend: HTML structure, CSS (CSS custom properties, dark theme), and vanilla JS (no framework, no build step).

### Database

Uses `sql.js`, which runs SQLite entirely in memory (loaded from `inventory.db` on startup). Every write operation calls `saveDb()` to flush the full database back to disk as a binary file. There is no connection pool — a single global `db` object is shared across all requests.

Three helper wrappers abstract the sql.js statement API: `dbAll` (multiple rows), `dbGet` (first row or null), `dbRun` (mutation + save).

### API

All endpoints are under `/api` and return `{ success: true, data: ... }` or `{ success: false, error: "..." }`.

- `GET /api/inventory` — supports `search`, `vendor`, `sort`, `order` query params. Sort column is validated against an allowlist to prevent SQL injection; sort direction is similarly restricted.
- `GET /api/inventory/:id`
- `POST /api/inventory` — creates item, returns the inserted row via `SELECT MAX(id)`
- `PUT /api/inventory/:id` — full replace
- `PATCH /api/inventory/:id` — partial update (any subset of `stock`, `quantity`, `price`, `vendor`)
- `DELETE /api/inventory/:id`
- `GET /api/stats` — aggregate totals (items, units, value, vendors)
- `GET /api/vendors` — distinct vendor list for the filter dropdown

### Frontend state

The JS in `index.html` maintains three module-level variables: `editingId` (null or item id), `deleteTargetId`, and `allItems` (the last fetched array). Every mutation reloads the full item list and stats from the server. The sidebar form toggles between "new item" and "edit" mode by checking `editingId`.

Low-stock threshold is hardcoded at quantity ≤ 5 (highlights row red + shows LOW badge).
