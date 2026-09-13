# Implementation Plan: Ajustes del Módulo de Ejecución

**Branch**: `002-ejecucion-ajustes` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-ejecucion-ajustes/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Cinco ajustes sobre el Módulo de Ejecución de la 001, reencuadrados después de verificar sus causas
raíz contra el código ([research.md](./research.md), R-B01):

- **US-B1**: la resolución de la semana en `plan_week` y en el ensayo gana un respaldo para los días
  fuera del programa. `open_view` acepta una semana explícita y registra como planeación, sin
  compuerta, la apertura de una semana que todavía no empieza.
- **US-B2**: sin cambio de código. Tres tests de regresión fijan que una tanda vencida nunca bloquea
  y que no hay cierre por hora del día.
- **US-B3**: `get_compliance_report` expone las aperturas del plan, y el reporte congelado guarda su
  total.
- **US-B4**: `get_today` y `get_compliance_report` exponen la evaluación desglosada del día. Los
  hábitos sin días activos salen de las fracciones.
- **US-B5**: herramienta nueva `manage_friction`, con dos tablas (migración `012`), un límite atómico
  de 2 medidas y un retiro idempotente por irritación dentro del tick.

Enfoque técnico:

- Cada regla nueva vive en funciones TypeScript compartidas por el MCP y la web (Principio I); nada
  de lógica en SQL.
- Solo US-B5 trae migración. US-B1 reutiliza `plan_views.surface = 'planeacion'`, que ya existía.
- Los cambios de forma son aditivos (`evaluacion_dia`, `aperturas_plan`, y `program_week_id` y
  `surface` en `open_view`), salvo `plan_openings`: se reemplaza antes de que exista el primer
  reporte congelado y se sigue leyendo por compatibilidad.

## Technical Context

**Language/Version**: TypeScript 5.5 sobre Node 22 (Docker). Next.js 14.2 + React 18 para la web;
servidor MCP con `@modelcontextprotocol/sdk` 1.30.

**Primary Dependencies**: las existentes (`pg`, `zod` 4, `@modelcontextprotocol/sdk`). Ninguna nueva.

**Storage**: PostgreSQL 16, con una migración nueva, `012_friction.sql` (solo-Postgres). Los tests
usan pg-mem 3 vía `__tests__/helpers/test-db.ts`, que corre las migraciones reales.

**Testing**:
- Vitest 2 con `environment: 'node'`, `createTestDb()` y `vi.setSystemTime`.
- Fakes de `Mailer` y `Pusher`, con el patrón de `__tests__/mcp/execution-push.test.ts`.
- Test de trazabilidad con una tabla de specs (R-B02).
- US-B2 con tests de caracterización y verificación por mutación (R-B05).

**Target Platform**: la misma de la 001. Docker Compose (`pure-web`, `pure-mcp`, `pure-db`) en el
servidor de casa, detrás de Cloudflare Tunnel y Access; iPhone como PWA y navegadores de
escritorio.

**Project Type**: aplicación web (Next.js) + servidor MCP (Node) en el mismo repositorio, con `lib/`
compartido.

**Performance Goals**: sin metas nuevas. `get_compliance_report` y el tick agregan una lectura
completa de `plan_views` y de las tablas de fricción; con el volumen de un usuario (unas pocas
aperturas por semana y 5 medidas posibles) es despreciable. El tick sigue corriendo cada 20 s.

**Constraints**:
- SQL compatible con pg-mem: sin plpgsql, sin `AT TIME ZONE` y sin índices únicos parciales. El
  límite de 2 medidas usa columna nula + UNIQUE (`enabled_slot`).
- Zona horaria `PURE_TZ` resuelta en TypeScript (`lib/execution/time.ts`).
- Ningún instante sale del cliente.
- Sin pantallas ni gráficas nuevas. La pantalla Hoy sigue sin mostrar el mínimo ni las tandas que
  faltan (FR-018 de la 001).
- El payload del reporte tiene que tener su forma nueva en producción antes del domingo 2026-09-20
  a las 19:00 (R-B12).

**Scale/Scope**:
- 5 historias, 23 requisitos FR-B y 35 escenarios (34 automatizados y 1 manual).
- 1 migración y 1 herramienta MCP nueva (de 30 a 31).
- 16 archivos de producción tocados, 2 de ellos nuevos; 7 archivos de test nuevos y 4 ajustados.

**Observability**:
- El retiro por irritación deja constancia en `friction_ratings.drop_applied_at`,
  `friction_ratings.dropped_measure_id` y `friction_measures.drop_reason`.
- El tick lo registra con el prefijo `[execution-tick]` solo cuando retira una medida.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple este plan | Estado |
|---|---|---|
| I. Una sola vía de datos | `resolvePlanningWeek` decide la semana del `preview` y del ensayo, y reemplaza por dentro a `resolveRehearsalWeekId`. `describeDay` envuelve a `evaluateDay`. `summarizePlanOpenings` y `listIrritationDropsInRange` alimentan por igual el congelamiento y la vista previa. `manage_friction` delega en `lib/execution/friction.ts`. Las medidas y las calificaciones entran solo por MCP | PASS |
| II. Test-First | 34 escenarios con test nombrado `US-Bn-ASm`, placeholders `it.todo` en Foundational y trazabilidad por tabla de specs. Cada historia tiene su commit RED antes del GREEN. US-B2 no tiene implementación, así que su RED se demuestra por mutación (R-B05). Los escenarios que ya pasan con el código actual se marcan como regresión en tasks.md | PASS |
| III. Paridad pruebas/producción | `012` sin plpgsql, sin `AT TIME ZONE` y sin índices parciales. `enabled_slot TEXT UNIQUE` sigue el patrón de `running_lock`, y el CHECK de rango sigue el de `tasks.estimated_tandas`. Fechas locales en TypeScript e instantes del servidor | PASS |
| IV. Verificación empírica | [quickstart.md](./quickstart.md): `/health`, llamadas MCP por historia, y Hoy y la vista de la semana a 375 px y en escritorio | PASS |
| V. Sobriedad y datos verificables | Sin pantallas ni gráficas nuevas. Hoy sigue sin mínimo ni faltantes (FR-B14). Aperturas y fricción se leen como cifras y líneas de texto | PASS |
| VI. Seguridad | `manage_friction` no entra en la lista blanca de la web. Sin secretos nuevos. Los handlers conservan su try/catch y responden sin detalles internos | PASS |

La constitución pasó a la versión 1.0.1 (PATCH del 2026-09-12): IDs de escenario únicos en todo el
repositorio, con `US-Bn-ASm` para la 002.

**Re-check post-diseño (tras research, data-model y contracts):** PASS. El diseño no agrega SQL con
lógica, índices parciales, tiempos del cliente, datos sembrados ni superficie web nueva.

## Project Structure

### Documentation (this feature)

```text
specs/002-ejecucion-ajustes/
├── spec.md
├── plan.md               # este archivo
├── research.md           # R-B01…R-B12
├── data-model.md         # tablas de fricción, valores derivados y payload del reporte
├── quickstart.md         # matriz de pruebas y validación en producción
├── contracts/
│   ├── mcp-tools.md      # plan_week, rehearse, get_today, get_compliance_report, manage_weekly_report, manage_friction
│   └── notifications.md  # cambios en el texto del correo; sin avisos nuevos
├── checklists/
│   └── requirements.md
└── tasks.md              # /speckit-tasks
```

### Source Code (repository root)

```text
db/migrations/
└── 012_friction.sql                        # US-B5 (nuevo)

lib/
├── domain/execution.ts                     # US-B4: describeDay
├── db/execution-pg.ts                      # US-B3: fetchAllPlanViewsFromDb · US-B5: repositorio de fricción
├── validations/schemas.ts                  # US-B1: PlanWeekOpenViewSchema · US-B5: esquemas de fricción y LIMITE_FRICCION
└── execution/
    ├── program.ts                          # US-B1: resolvePlanningWeek y resolveViewWeek
    ├── routine.ts                          # US-B1: rehearse con la resolución nueva
    ├── planning.ts                         # US-B1: preview, set_intentions y open_view · US-B3: se elimina countGatedPlanOpenings
    ├── compliance.ts                       # US-B3: aperturas_plan · US-B4: evaluacion_dia y hábitos sin días activos
    ├── today.ts                            # US-B4: evaluacion_dia
    ├── report.ts                           # US-B3: aperturas_plan · US-B5: friccion_retiradas
    ├── tick.ts                             # US-B3: payload · US-B5: applyIrritationDrops antes de congelar
    ├── handlers.ts                         # US-B3: preview del reporte · US-B5: handleManageFriction
    ├── constants.ts                        # US-B5: límite, umbral y slots
    └── friction.ts                         # US-B5 (nuevo)

mcp-server/
├── index.ts                                # descripciones de plan_week, manage_routine_slots, get_today y get_compliance_report · US-B5: manage_friction
├── tools-handler.ts                        # US-B5: re-export del handler
├── instructions.md                         # reglas nuevas para el agente
└── README.md                               # catálogo con 31 herramientas

__tests__/
├── helpers/test-db.ts                      # US-B5: tablas nuevas en reset()
├── build/spec-traceability.test.ts         # tabla de specs 001 y 002
├── mcp/execution-planning-week.test.ts     # US-B1 (nuevo)
├── mcp/execution-tandas-olvidada.test.ts   # US-B2 (nuevo)
├── mcp/execution-plan-openings.test.ts     # US-B3 (nuevo)
├── mcp/plan-views.test.ts                  # US9-AS1 ajustado a aperturas_plan (US-B3)
├── mcp/execution-day-breakdown.test.ts     # US-B4 (nuevo)
├── db/friction-schema.test.ts              # US-B5 (nuevo)
├── validations/friction-schemas.test.ts    # US-B5 (nuevo)
├── mcp/execution-friction.test.ts          # US-B5 (nuevo)
├── mcp/all-tools.test.ts                   # 31 herramientas
└── mcp/mcp-crud-tools.test.ts              # 31 herramientas
```

**Structure Decision**: se conserva la estructura de la 001 (web + MCP con `lib/` compartido). Las
funciones puras nuevas que necesitan la zona horaria van en los servicios que ya importan
`lib/execution/time.ts` (`program.ts` y `compliance.ts`), para no crear una dependencia de
`lib/domain` hacia `lib/execution`. La única regla nueva sin zona horaria, `describeDay`, va en
`lib/domain/execution.ts`. La web no cambia.

## Entrega

| Bloque | Historias | Cuándo |
|---|---|---|
| 1 | Foundational, US-B1 y US-B2 | Sin urgencia: el domingo 13 la planeación ya funciona en producción |
| 2 | US-B3 y US-B4 | En producción antes del domingo 2026-09-20 a las 19:00 |
| 3 | US-B5 | Cuando haya aire; exige `docker compose exec pure-mcp npm run db:migrate` |

Una sola rama. `main` recibe un PR por bloque, cada uno con `npm run test:all` en verde.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
