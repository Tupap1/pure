# Contrato — Rutas web del Módulo de Ejecución

Las rutas son delgadas: validan, llaman a los mismos handlers que el MCP
(`lib/execution/handlers.ts`) y devuelven su resultado. Todas envuelven la lógica en try/catch,
igual que `app/api/sync/route.ts`, y responden con el contrato `{ status, code?, message?, data? }`.

**Seguridad.** Las rutas no tienen autenticación propia; la tiene todo el sitio vía Cloudflare
Access (Constitución VI, FR-031). Por eso ninguna ruta web expone el correo del destinatario
(FR-025).

## `GET /api/execution/today`

- Declara `export const dynamic = 'force-dynamic'`: en Next 14, un GET sin `Request` puede quedar
  cacheado como estático.
- 200 → `data` de `get_today` (ver [mcp-tools.md](./mcp-tools.md#get_today-us1us3)).
- 500 → `{ status: 'error', message }`.

## `POST /api/execution`

Cuerpo: `{ tool, action, data }`. **Lista blanca**:

| `tool` | Acciones permitidas desde la web |
|---|---|
| `manage_tandas` | `start`, `finish`, `interrupt`, `current`, `update` |
| `manage_daily_checks` | `set` |
| `manage_routine_slots` | `respond` |
| `manage_weekly_report` | `set_note` |
| `plan_week` (US9) | `open_view` |

- Una combinación fuera de la lista → 400 con `{ status: 'error', code: 'DATOS_INVALIDOS' }`.
- Un handler que devuelve `status: 'error'` → 400 con el mismo cuerpo (conserva `code`).
- Una excepción no controlada → 500, sin detalles internos.
- Nunca se aceptan campos de tiempo del cliente; el handler los rechaza.

## `GET /api/execution/report` (US6)

Devuelve el reporte de la semana en curso o el recién congelado:

```ts
{ program_week_id, week_number, status, verdict, frozen_at, note_deadline,
  user_note, partner_name /* NUNCA el correo */, payload_resumen: {
    days_fulfilled, habits: [{ label, cumplidos, total }], en_riesgo: string[], late_edits } }
```

## `GET /api/push/public-key` (US7)

`{ key: VAPID_PUBLIC_KEY }`. La clave se entrega en tiempo de ejecución, sin hornearla en el
build.

## `POST /api/push/subscribe` y `DELETE /api/push/subscribe` (US7)

- `POST`, cuerpo `PushSubscription.toJSON()`. Zod valida `endpoint` (URL https) y
  `keys.p256dh`/`keys.auth`. Hace upsert con `id = sha256(endpoint)` y responde 200.
- `DELETE`, cuerpo `{ endpoint }`. Borra la suscripción y responde 200.

## `POST /api/push/test` (US7)

Envía un aviso de prueba a todas las suscripciones con el mismo `Pusher` que el tick. Devuelve
`{ sent, removed }`.
