# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PURE OS is a local-first academic management web app (Next.js 14 App Router) for a student juggling two concurrent engineering degrees at two universities (UdeA Aeroespacial presencial + UdeC Software a distancia). It computes real net free time, recommends weekly study hours per subject via a Minimum Effective Dose (DME) algorithm, detects schedule overlaps, and tracks cross-degree syllabus synergies. It ships with an MCP (Model Context Protocol) server so AI agents can read/ingest the same academic data.

## Commands

```bash
npm run dev              # Next.js dev server (localhost:3000)
npm run build && npm start   # production build / serve
npm run typecheck        # tsc --noEmit
npm run lint              # next lint
npm run test              # vitest run (all tests)
npm run test:all          # typecheck + vitest run — run this before considering any change done
npm run db:migrate        # runs scripts/migrate.ts against DATABASE_URL

# MCP server (separate process from the Next.js app)
npm run mcp:start         # stdio transport
npm run mcp:start:http    # HTTP/SSE transport on MCP_PORT (default 3001)
```

Run a single test file: `npx vitest run __tests__/algorithms/study-hours-dme.test.ts`. Tests live under `__tests__/`, mirroring the source tree (`algorithms/`, `domain/`, `db/`, `mcp/`, `sync/`, `validations/`, `api/`, `build/`). Vitest uses `environment: 'node'` and the `@/*` alias resolves to the repo root.

**Before declaring any fix/feature done**: run `npm run test:all`, and if you touched the MCP server or an API route, empirically verify the running endpoint (e.g. `curl http://localhost:3001/health`) rather than relying on static analysis alone.

## Architecture

### Two persistence layers, one domain model

The app is local-first: `lib/db/dexie-schema.ts` defines a Dexie (IndexedDB) database (`pureDB`) that the browser reads/writes directly for instant UI response. A parallel PostgreSQL schema (`db/schema.sql`, `db/migrations/`) is the source of truth for the MCP server and cross-device sync, accessed via `lib/db/pg-client.ts` / `lib/db/repository-pg.ts` and mirrored in the browser via `lib/db/repository.ts`.

Sync flow: local writes go through `pureDB` immediately, then get queued in a `syncQueue` Dexie table. `lib/sync/sync-engine.ts` drains that queue by POSTing to `app/api/sync/route.ts`, which writes to Postgres; the same endpoint's GET pulls remote state back into Dexie via `bulkPut`. Conflict resolution is last-write-wins on `updated_at`. See `docs/modules/05-local-first-pwa-sync.md` for the full spec.

The five core entities — universities, professors, subjects, schedules, deliverables, syllabus_topics (+ study_sessions) — are defined identically in both the Postgres schema and the Dexie schema; when adding a field, update both plus `lib/validations/schemas.ts` (Zod) and check `__tests__/build/schema-type-consistency.test.ts`, which exists specifically to catch drift between the two schemas.

### Domain algorithms (`lib/algorithms/`, `lib/domain/`)

- `study-hours-dme.ts` — computes weekly Dosis Mínima Eficaz (DME) study hours per subject from credits, difficulty, grade margin, syllabus synergy discount, and deadline urgency. Formula details are in `README.md` and `docs/modules/02-study-hours-algorithm.md`.
- `conflict-detector.ts` — detects schedule overlaps between classes on the same day (interval intersection).
- `schedule-mobile-transformer.ts` — reshapes the desktop weekly grid into the mobile vertical timeline.
- `lib/domain/subject.ts` — includes the "minimum required grade" calculator referenced from the Deliverables dashboard.

Net free time is always `168h - (class hours + 49h sleep + DME study hours)`.

### MCP server (`mcp-server/`) — a separate app from Next.js

`mcp-server/index.ts` runs its own process (not part of the Next.js build) with dual transport: stdio (local agents/IDEs) and Express-based HTTP/SSE on `MCP_PORT` (cloud agents, e.g. Claude Web, via Cloudflare Tunnel — SSE endpoint `/sse`, message endpoint `/message`, CORS open). `mcp-server/tools-handler.ts` implements the tool handlers; `mcp-server/db-repository.ts` talks to Postgres directly (independent of the Next.js Dexie/sync path); `mcp-server/auth-middleware.ts` validates bearer tokens for the HTTP transport; `mcp-server/health-handler.ts` backs the `/health` endpoint. `mcp-server/instructions.md` and `mcp-server/README.md` document the tool catalog in depth — read those before adding or changing a tool.

**Data rule**: all reads/writes of academic data (universities, subjects, professors, schedules, syllabus, deliverables, DME metrics) must go exclusively through the MCP tool handlers (`ingest_academic_enrollment`, `get_academic_overview`, `parse_and_ingest_syllabus`, `find_cross_subject_synergies`, and the `manage_*` CRUD tools). Never hardcode seed data directly into frontend components or DB helpers — route it through the MCP tool pipeline instead.

### Auth

OAuth 2.0 mock/bridge for Claude Web and other MCP clients lives in `mcp-server/auth-middleware.ts` and the oauth-related tests in `__tests__/mcp/oauth.test.ts` / `auth.test.ts`. This is being hardened toward a real OAuth 2.0 authorization server (RFC 6749: whitelisted `redirect_uri`, `state` for CSRF, PKCE, single-use short-lived auth codes, `Cache-Control: no-store` on token responses, constant-time secret comparison). Treat auth code changes as security-sensitive: wrap HTTP route handlers in try/catch, never hardcode secrets (use `.env`), and check for replay/timing-attack issues.

### UI structure

`components/dashboards/` holds the five main screens (CommandCenter, ScheduleDashboard + MobileScheduleTimeline, DeliverablesDashboard, SyllabusDashboard, ConfigDashboard — the last is tabbed CRUD for universities/subjects/professors and includes buttons to trigger MCP ingestion or reset the local IndexedDB). `components/ui/` holds atomic pieces including the custom SVG visualizations (ProgressRing, DailyLoadStackedBar, StudyHeatmap, SemesterProgressChart). `lib/hooks/usePureData.ts` is the main data-access hook wrapping Dexie; `useSyncEngine.ts` drives the sync loop; `useTheme.ts` handles light/dark.

### Design system

Dark-first "Titanium Cybernetic" aesthetic (deep obsidian `#05080e` backgrounds, Space Grotesk headings, JetBrains Mono reserved strictly for numeric/data values, Cyber Cyan/Orbital Violet/Telemetry Emerald accents by degree/status). Full token values and the anti-pattern ban list (no eyebrows, no decorative badges without numbers, no nested unearned cards, no monospace-as-costume) are in `DESIGN.md`. Product voice/positioning constraints (no marketing slogans, every element must earn its place) are in `PRODUCT.md`. An `impeccable` design-review skill hook runs automatically on UI file edits (see `.claude/settings.local.json`) — expect it to flag anti-pattern violations.

## Deployment

Docker multi-stage build (`Dockerfile` for the Next.js app in `standalone` mode, `Dockerfile.mcp` for the MCP server) orchestrated via `docker-compose.yml`: web app on `3000`, MCP SSE server on `3001`. See `docs/MCP-HTTP-SETUP.md` / `docs/setup/mcp-http-setup.md` for exposing the MCP server remotely via Cloudflare Tunnel.
