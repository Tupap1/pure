# Quickstart — Ajustes del Módulo de Ejecución (002)

Guía para validar la feature de punta a punta (Constitución, Principio IV). La forma de cada
respuesta está en [contracts/mcp-tools.md](./contracts/mcp-tools.md) y las reglas en
[data-model.md](./data-model.md).

## Requisitos

- Rama `002-ejecucion-ajustes` con `npm run test:all` en verde.
- En local: el servidor MCP levantado con `npm run mcp:start:http` y
  `curl http://localhost:3001/health` respondiendo.
- En producción:
  - desplegar con `docker compose up -d --build pure-web pure-mcp`;
  - desde US-B5, aplicar la migración `012` con
    `docker compose exec pure-mcp npm run db:migrate`.

## Matriz de pruebas

| Archivo de test | Cubre | Fase |
|---|---|---|
| `__tests__/build/spec-traceability.test.ts` | SC-B06: tabla de specs 001 y 002 | Foundational |
| `__tests__/mcp/execution-planning-week.test.ts` | US-B1-AS1…AS10 | US-B1 |
| `__tests__/mcp/execution-tandas-olvidada.test.ts` | US-B2-AS1…AS3 | US-B2 |
| `__tests__/mcp/execution-plan-openings.test.ts` | US-B3-AS1…AS5, y la compatibilidad con `plan_openings` | US-B3 |
| `__tests__/mcp/plan-views.test.ts` (de la 001) | US9-AS1 ajustado a `aperturas_plan` | US-B3 |
| `__tests__/mcp/execution-day-breakdown.test.ts` | US-B4-AS1…AS7 | US-B4 |
| `__tests__/db/friction-schema.test.ts` | Migración `012` en pg-mem, `enabled_slot` UNIQUE y CHECK de `score` | US-B5 |
| `__tests__/validations/friction-schemas.test.ts` | Claves permitidas, rango de `score` y `.strict()` | US-B5 |
| `__tests__/mcp/execution-friction.test.ts` | US-B5-AS1…AS9 | US-B5 |
| `__tests__/mcp/all-tools.test.ts` y `__tests__/mcp/mcp-crud-tools.test.ts` (de la 001) | 31 herramientas | US-B5 |

US-B4-AS8 es `[manual]` y se valida en la sección de US-B4.

## Validación en producción, por historia

Las llamadas van por el conector MCP (Claude Web o una sesión de Claude Code). Solo escriben datos
las que lo indican.

### US-B1

1. Cualquier día antes del lunes 14: `plan_week preview {}` → `program_week_id: "pw-01"`. Antes de
   la 002, el sábado 12 devolvía `NO_ENCONTRADO`.
2. El domingo 13, incluso antes de desplegar: `plan_week preview {}` → `pw-01`.
3. `plan_week preview { "program_week_id": "pw-99" }` → `NO_ENCONTRADO`.
4. **Escribe una apertura de planeación**: `plan_week open_view { "program_week_id": "pw-02" }`
   antes del lunes 21 → `surface: "planeacion"` y `needs_reason: false`. Después,
   `get_compliance_report { "program_week_id": "pw-02" }` no la cuenta.
5. `manage_weekly_report preview {}` antes del lunes 14 → `NO_ENCONTRADO`, igual que antes.
6. Web, a 375 px y en escritorio y sin errores de consola: antes del lunes 14, la vista de la semana
   abre la semana 1 sin pedir razón, y el asistente del domingo carga.

### US-B2

Nada que validar en producción, porque no cambia el comportamiento. Basta la matriz y la constancia
de la mutación en el cuerpo del commit (research.md, R-B05).

### US-B3

1. Tras abrir la vista de la semana: `get_compliance_report { "program_week_id": "pw-01" }` →
   `aperturas_plan` con los conteos.
2. Tras el congelamiento del domingo 20: `manage_weekly_report read { "program_week_id": "pw-01" }`
   → `payload.aperturas_plan.total`, y el correo trae la línea "Aperturas del plan".

### US-B4

1. `get_today` → `evaluacion_dia`, que es `null` antes del lunes 14.
2. `get_compliance_report { "from": "2026-09-14", "to": "2026-09-20" }` → `dias[].evaluacion_dia`,
   y `habitos` sin "Gym en la mañana".
3. **US-B4-AS8 `[manual]`**: `manage_program read` → hábito `gym` con label "Gym en la mañana",
   `started_on` 2026-09-28, `days_of_week` `[1, 4, 5, 6]` y `target_days` 66.
   **Verificado el 2026-09-12**: creado por MCP, con `created_at` 2026-09-12T20:33:28Z.
4. Web, a 375 px y en escritorio: Hoy no muestra el mínimo ni las tandas que faltan.

### US-B5

1. `docker compose exec pure-mcp npm run db:migrate` aplica la `012`.
2. `tools/list` trae 31 herramientas y `manage_friction read` → `total_activas: 0`, `limite: 2`.
3. **Escribe datos reales, solo con las medidas que Andres tenga puestas en el teléfono**:
   `manage_friction enable { "measure_key": … }` hasta 2; una tercera → `LIMITE_FRICCION`.
4. `manage_friction verify { "measure_key": … }` → `confirmada: true` en `read`.
5. El domingo, `manage_friction rate { "score": … }` → aparece en `irritacion_semana_actual`.

## Cierre

`npm run test:all` en verde, `/speckit-analyze` sin hallazgos críticos, `/speckit-converge` sin
tareas pendientes y la validación de arriba registrada en el PR.
