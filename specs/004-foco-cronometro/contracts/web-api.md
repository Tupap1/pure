# Contrato web — delta de la 004

Base: `specs/001-modulo-ejecucion/contracts/web-api.md`. La web no tiene autenticación propia
(Cloudflare Access delante, Principio VI). La lista blanca de `app/api/execution/route.ts` es la
única barrera.

## `POST /api/execution`: `ALLOWED_ACTIONS`

| Herramienta | Antes | Después |
|---|---|---|
| `manage_tandas` | `start, finish, interrupt, current, update` | Sin cambios. **`correct` y `log_late` no entran** (US-F4-AS9) |
| `manage_objectives` | — | `create, read, update, archive` (US-F2-AS11) |
| `manage_quotes` | — | **No entra** (US-F5-AS6) |

`start` desde la web acepta `kind` y `objective_id` con el mismo esquema que el MCP.

## `GET /api/execution/focus` (nueva)

- Query: `weeks?` (1..53), `objective_id?` y `subject_id?`. No se aceptan instantes: `at` se ignora
  en la web.
- `export const dynamic = 'force-dynamic'`. try/catch:
  - `400` con el `ExecutionResult` de error;
  - `500` con `{ status: 'error', message: 'Error interno del servidor' }`, sin detalles internos.
- Delega en `handleGetFocusSummary`, igual que la herramienta MCP `get_focus_summary`.

## `GET /api/execution/today`

Sin cambios de ruta. El payload crece según [mcp-tools.md](./mcp-tools.md) § `get_today`.

## Hooks del cliente

- `useToday` expone `start({ kind, planned_minutes?, objective_id? })` y, para el cronómetro,
  `elapsedSeconds` calculado con el mismo `clockOffset`.
- `useObjectives` (nuevo): `read`, `create`, `update` y `archive` contra `/api/execution`.
- `useFocusSummary(weeks, filtro)` (nuevo): `GET /api/execution/focus`. Se refresca al montar y al
  volver a la pestaña, como `useToday`.
