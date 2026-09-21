# Implementation Plan: Tandas de duración variable y registro tardío

**Branch**: `003-tandas-variables` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-tandas-variables/spec.md`

## Summary

Tres ajustes al Módulo de Ejecución de la 001 y la 002, que resuelven un incidente de producción
donde una tanda de 1 hora no se guardó ([research.md](./research.md)):

- **US-T3**: la pantalla captura y muestra errores de `start` (servidor o red), y muestra la hora de
  inicio devuelta por el servidor mientras la tanda corre. Un `start` rechazado deja línea en el log.
- **US-T1**: `manage_tandas.start` acepta `planned_minutes` entre 10 y 60. Agrega `CHECK` en migración.
  El mínimo diario se compara contra "unidades" (`floor(actual_minutes / 10)` con piso 1), no filas.
  La pantalla Hoy ofrece 10, 25, 40 y 60 minutos.
- **US-T2**: `manage_tandas.log_late` registra sesiones olvidadas dentro de 6 horas, máximo 3 por
  día, todas marcadas `late_logged: true` y visible en el reporte. Nace completada, sin `running_lock`.
  No entra en la lista blanca de la web (Principio I: única entrada MCP de instantes del cliente,
  acotada y visible).

Enfoque técnico:

- Cada regla vive en funciones TypeScript compartidas por el MCP y la web (Principio I).
- Dos migraciones solo-Postgres (`013` y `014`), sin plpgsql (Principio III). El ejecutor lleva las
  versiones aplicadas en `schema_migrations`, así que cada una corre una sola vez: la `014` además
  es idempotente por su `IF NOT EXISTS`, y la `013` no puede serlo porque `ADD CONSTRAINT` no
  admite esa cláusula en Postgres.
- Las unidades son un concepto derivado en TypeScript; la UI sigue diciendo "tandas" porque una
  unidad es la tanda de 10 minutos de siempre.
- Sin pantallas ni gráficas nuevas; sin cambios a la web fuera de `TodayDashboard` y `useToday`.

## Technical Context

**Language/Version**: TypeScript 5.5 sobre Node 22 (Docker). Next.js 14.2 + React 18 para la web;
servidor MCP con `@modelcontextprotocol/sdk` 1.30.

**Primary Dependencies**: las existentes (`pg`, `zod` 4, `@modelcontextprotocol/sdk`). Ninguna nueva.

**Storage**: PostgreSQL 16 con dos migraciones nuevas: `013_tandas_duracion_variable.sql` (CHECK) y
`014_tanda_registro_tardio.sql` (columna `late_logged`). Los tests usan pg-mem 3.

**Testing**:
- Vitest 2 con `environment: 'node'`, `createTestDb()` y `vi.setSystemTime`.
- 24 escenarios con test nombrado `US-Tn-ASm` (Principio II, TDD obligatorio).
- Test de trazabilidad (`spec-traceability.test.ts`) con tabla que verifica cobertura.

**Target Platform**: la misma de la 001. Docker Compose en el servidor de casa.

**Project Type**: aplicación web (Next.js) + servidor MCP (Node) con `lib/` compartido.

**Constraints**:
- SQL compatible con pg-mem: sin plpgsql, sin `AT TIME ZONE` y sin índices parciales.
- Zona horaria `PURE_TZ` resuelta en TypeScript.
- Ningún instante sale del cliente, excepto `log_late` (única excepción documentada).

## Constitution Check

| Principio | Cómo lo cumple este plan | Estado |
|---|---|---|
| I. Una sola vía de datos | `tandaUnits` es función pura de dominio, llamada desde compliance, today, tandas y handlers. `logLateTanda` delega en `lib/execution/tandas.ts`. El registro tardío entra solo por MCP, no por web. `start` rechazado se registra en el mismo handler que usan ambos caminos. | PASS |
| II. Test-First | 24 escenarios con test `US-Tn-ASm`, nombrados y trazables. Red, green, refactor. Test de trazabilidad verifica 24 escenarios en spec. | PASS |
| III. Paridad pruebas/producción | Migraciones `013` y `014` sin plpgsql y sin `AT TIME ZONE`; el ejecutor las aplica una sola vez (`schema_migrations`). Zonas y agregados en TypeScript. Todo instante del servidor. `log_late` es la única excepción: acepta instantes del cliente, acotada a hoy local, 6 horas atrás, máx 3/día, marca visible. | PASS |
| IV. Verificación empírica | [quickstart.md](./quickstart.md): `/health`, MCP real, tanda de 60 min desde app, log_late cuarta rechazada. | PASS |
| V. Sobriedad y datos verificables | Sin pantallas nuevas. Pie dice "N de M tandas" (UI para "unidades"), no números ocultos. Reporte muestra `registros_tardios`. | PASS |
| VI. Seguridad | Sin secretos nuevos. Try/catch en handlers. `log_late` no en lista blanca de web. | PASS |

**Excepción documentada del Principio III**: `log_late` es la única herramienta que acepta instantes
del cliente (`started_at`, `ended_at`). Está acotada por regla de negocio (mismo día local, ≤6 horas
atrás, máx 3 registros/día), validada en `logLateTanda`, y visible en el reporte con `registros_tardios`
y la marca `late_logged` en la tanda. No generaliza a `start` ni a ningún otro camino. Existen pruebas
específicas para cada límite (US-T2-AS2 a AS6, AS9).

## Project Structure

### Documentation (this feature)

```text
specs/003-tandas-variables/
├── spec.md
├── plan.md               # este archivo
├── research.md
├── data-model.md         # cambios en tanda, concepto unidad, payload
├── quickstart.md         # matriz de tests y validación
├── contracts/
│   └── mcp-tools.md      # delta sobre 001 y 002
└── tasks.md              # /speckit-tasks
```

### Source Code (repository root)

```text
db/migrations/
├── 013_tandas_duracion_variable.sql       # US-T1: CHECK de planned_minutes
└── 014_tanda_registro_tardio.sql          # US-T2: columna late_logged

lib/
├── execution/
│   ├── constants.ts                       # US-T1: TANDA_MINUTES_{MIN,MAX,DEFAULT}, OPTIONS
│   ├── tandas.ts                          # US-T1: planned_minutes 10-60 · US-T2: logLateTanda
│   ├── today-view.ts                      # US-T3: describeStartFailure, formatLocalTime
│   ├── today.ts                           # US-T1: unidades_hoy en TodayPayload
│   ├── compliance.ts                      # US-T1: unidades en ComplianceResult
│   ├── tick.ts                            # US-T1: tandaEndBody con actual_minutes
│   ├── handlers.ts                        # US-T3: log de start rechazado · US-T2: log_late
│   └── time.ts                            # sin cambios; ya existía para PURE_TZ
├── domain/execution.ts                    # US-T1: función pura tandaUnits
├── db/execution-pg.ts                     # US-T2: late_logged en TandaRecord, INSERT
└── validations/schemas.ts                 # US-T1: rango 10-60 por constantes · US-T2: schemas

components/dashboards/TodayDashboard.tsx   # US-T3: captura errores y hora de inicio
lib/hooks/useToday.ts                      # US-T3: callAction captura fallo de red

mcp-server/
├── index.ts                               # descripciones de manage_tandas, nuevos parámetros
└── tools-handler.ts                       # US-T2: log_late no entra en lista blanca

__tests__/
├── domain/
│   ├── today-view.test.ts                 # US-T3-AS1 a AS3, US-T1-AS10, US-T1-AS11
│   └── execution-day.test.ts              # US-T1-AS4 (unidades); ajustes para US-T1
├── mcp/
│   ├── execution-tandas-start-log.test.ts # US-T3-AS4 (nuevo)
│   ├── execution-tandas-variables.test.ts # US-T1-AS1, AS2, AS3, AS5, AS6, AS7, AS8 (nuevo)
│   ├── execution-push.test.ts             # US-T1-AS9 (aviso de fin con actual_minutes)
│   └── execution-tandas-registro-tardio.test.ts # US-T2-AS1..AS7, AS9 (nuevo)
├── build/
│   ├── spec-traceability.test.ts          # entrada 003 al final
│   └── schema-type-consistency.test.ts    # sin cambios; tandas es solo-Postgres
└── helpers/test-db.ts                     # sin cambios; tandas ya existen

api/execution/route.ts                     # sin cambios; ALLOWED_ACTIONS no incluye log_late
```

**Structure Decision**: Los tres servicios que calculan unidades (`today.ts`, `compliance.ts`,
`tandas.ts` para el resumen por día) importan la función pura `tandaUnits` de `lib/domain/execution.ts`,
que no tiene zona horaria. El log del servidor y la captura de errores van en `handlers.ts` y `useToday.ts`
respectivamente. No se toca la web fuera de `TodayDashboard` y `useToday`.

## Entrega

| Bloque | Historias | Archivos de test |
|---|---|---|
| 1 | Foundational + US-T3 | `execution-tandas-start-log.test.ts`, `today-view.test.ts` US-T3-AS1..AS3 |
| 2 | US-T1 | `execution-tandas-variables.test.ts`, `execution-push.test.ts`, `today-view.test.ts` US-T1-AS10..11 |
| 3 | US-T2 | `execution-tandas-registro-tardio.test.ts` |
| Cierre | Trazabilidad | `spec-traceability.test.ts` con entrada 003 |

Una sola rama. `main` recibe PR cuando `npm run test:all` esté en verde, al final.

## Complexity Tracking

Excepción documentada: `log_late` es la única herramienta que acepta instantes del cliente. Justificación:
una tanda olvidada es un caso de uso real (se olvida dar iniciar en la app), el caso de inventar tandas
es distinto (se requeriría intención) y hoy no se puede registrar una sesión larga sin dividirla en
tandas de 10 minutos inventadas. La acción está acotada: hoy local, ≤6 horas atrás, máx 3/día, marca
visible `late_logged`. No entra en la lista blanca de la web, así que el camino normal es inicial.
Alternativa descartada: no permitir registro tardío; costo: no hay forma de recuperar una sesión olvidada.

