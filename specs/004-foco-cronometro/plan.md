# Implementation Plan: Foco — temporizador, cronómetro, objetivos y mapa de calor

**Branch**: `004-foco-cronometro` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-foco-cronometro/spec.md`

## Summary

Andres quiere registrar su tiempo enfocado real y verlo por semana y por día. Se **extienden las
tandas**; no se crea una entidad paralela.

- **US-F1**: la tanda gana un tipo.
  - El temporizador acepta de 10 a 180 min.
  - El cronómetro no tiene fin previsto, no se cierra solo, no avisa, vale `floor(min/10)`
    unidades y se reparte por medianoche local.
- **US-F2**: tabla `objetivos` (nombre, materia y meta opcionales, archivables). La regla
  `countsTowardMinimum` decide qué sesiones cumplen el mínimo diario.
- **US-F3**:
  - `getFocusSummary` agrega minutos enfocados por día, semana y objetivo;
  - un mapa de calor hecho a mano: 12 semanas en Hoy y 52 en Command Center, en lugar del
    `StudyHeatmap` de 28 días.
- **US-F4**: `manage_tandas:correct`, solo por MCP. Acorta una sesión o cierra un cronómetro
  olvidado, conserva el original y queda visible en el reporte.
- **US-F5**: tabla `frases`, cargada solo por MCP (`manage_quotes`, con `create_many` idempotente).
  Rotación determinista por fecha y una línea en Hoy. Amparada por la constitución 1.1.0.

Enfoque técnico:

- Una sola regla de unidades y minutos por día. `lib/domain/focus.ts:tallyDay` reemplaza los
  tres cálculos que hoy viven por separado en `today.ts`, `compliance.ts` y
  `tandas.ts:readTandas` (R7).
- Dos migraciones solo de Postgres (`015`, `016`), idempotentes y probadas contra pg-mem en vivo.
  El CHECK de la `016` es seguro frente a NULL, porque pg-mem y Postgres difieren ahí (R2).
- Toda la zona horaria se resuelve en TypeScript: `splitByLocalDay` en `time.ts` (R6).
- Toda la lógica de UI vive en funciones puras (`today-view.ts`, `focus-heatmap.ts`), que se
  prueban en el entorno `node`.

## Technical Context

**Language/Version**: TypeScript 5.5 sobre Node 22. Next.js 14.2 + React 18 para la web; servidor
MCP con `@modelcontextprotocol/sdk`.

**Primary Dependencies**: las existentes (`pg`, `zod`, `@modelcontextprotocol/sdk`, `crypto` de
Node para el id de las frases). **Ninguna nueva**: el mapa de calor no usa librería de gráficos
(R11).

**Storage**: PostgreSQL 16.
- `015_objetivos_frases.sql` crea las tablas `objetivos` y `frases`.
- `016_tandas_cronometro.sql` agrega a `tandas` las columnas `kind`, `objective_id` y las de
  corrección, hace `planned_minutes` anulable y reemplaza el CHECK.

Los tests usan pg-mem 3.

**Testing**:
- Vitest con `environment: 'node'`, `createTestDb()` y `vi.setSystemTime`.
- 48 escenarios no manuales, cada uno con su test `US-Fn-ASm` (TDD: rojo verificado antes del
  verde).
- Se reescriben los tests de US-T1-AS3 y US-T1-AS11, citando también US-F1-AS3 y US-F1-AS8.

**Target Platform**: la misma de la 001. Docker Compose en el servidor de casa, PWA en iPhone.

**Project Type**: aplicación web (Next.js) + servidor MCP (Node) con `lib/` compartido.

**Performance Goals**: el resumen de 52 semanas en menos de 1 s con un año de datos (SC-F03).
Se calcula en memoria sobre `fetchTandasFromDb()`, del orden de miles de filas.

**Constraints**:
- SQL compatible con pg-mem: sin plpgsql, sin `AT TIME ZONE`, sin índices parciales, y CHECK con
  `IS [NOT] NULL` explícito.
- `PURE_TZ` se resuelve en TypeScript.
- Ningún instante sale del cliente, salvo `log_late` (003) y `correct` (esta feature).

**Scale/Scope**: un usuario. Del orden de 5 a 20 sesiones por día.

## Constitution Check

*GATE: debe pasar antes de la Fase 0 y volver a comprobarse después de la Fase 1.*

| Principio | Cómo lo cumple este plan | Estado |
|---|---|---|
| I. Una sola vía de datos | `handleManageObjectives`, `handleGetFocusSummary`, `handleManageQuotes` y `handleManageTandas:correct` viven en `lib/execution/handlers.ts` y los consumen el MCP y la web. Las frases y los objetivos entran por herramientas MCP. Las migraciones no siembran nada y `frases.json` se carga con `create_many`. | PASS |
| II. Test-First | 48 escenarios con test `US-F*` nombrado y trazable. RED verificado antes de cada GREEN, con commit `test(004)` y luego `feat(004)`. La lógica de UI se extrae a funciones puras. Entrada 004 en `spec-traceability.test.ts`. | PASS |
| III. Paridad pruebas/producción | Migraciones `015`/`016` probadas en vivo contra pg-mem, idempotentes. CHECK seguro frente a NULL (R2). Unicidad condicional con columna anulable + UNIQUE (R3). Zona horaria y agregados en TypeScript (R6/R7). Las divergencias conocidas (nombre de la restricción, `RETURNING` con `DO NOTHING`) se rodean en TypeScript (R3/R4). Instantes del servidor, salvo una excepción documentada (Complexity Tracking). | PASS (con excepción documentada) |
| IV. Verificación empírica | [quickstart.md](./quickstart.md): `/health`, llamadas MCP reales por historia, web a 375 px y en escritorio sin errores de consola, carga real de las 50 frases. | PASS |
| V. Sobriedad y datos verificables | Mapa con 5 niveles fijos y leyenda en cifras, sin rachas, sin glow, sin librería. La tabla por objetivo da cifras ("3 h 10 m · 5 h"), sin barras. La frase del día usa la única excepción de la constitución 1.1.0. Hoy no muestra metas ni faltantes (R10). | PASS |
| VI. Seguridad | Rutas nuevas con try/catch y errores sin detalles internos. `correct` y `manage_quotes` fuera de la lista blanca. Ningún secreto en artefactos: el quickstart pide no pegar el token. | PASS |

**Re-check tras la Fase 1** (data-model y contratos escritos): sin cambios, todo PASS. La única
desviación es `correct` (abajo).

## Project Structure

### Documentation (this feature)

```text
specs/004-foco-cronometro/
├── spec.md
├── plan.md               # este archivo
├── research.md           # R1–R11 (incluye las pruebas en vivo con pg-mem)
├── data-model.md         # migraciones 015/016, conceptos derivados, payloads
├── quickstart.md         # matriz de tests y validación por historia
├── frases.json           # 50 frases latinas (dato, se carga por MCP)
├── contracts/
│   ├── mcp-tools.md      # delta: manage_tandas, get_today, reportes + 3 herramientas nuevas
│   └── web-api.md        # lista blanca, GET /api/execution/focus, hooks
├── checklists/
│   └── requirements.md
└── tasks.md              # /speckit-tasks
```

### Source Code (repository root)

```text
db/migrations/
├── 015_objetivos_frases.sql               # US-F2/US-F5: tablas nuevas
└── 016_tandas_cronometro.sql              # US-F1/US-F2/US-F4: columnas y CHECK de tandas

lib/
├── domain/
│   ├── focus.ts                           # NUEVO: sessionUnits, countsTowardMinimum, sessionShares,
│   │                                      #   tallyDay, heatLevel, quoteOfDay, dayNumber
│   ├── focus-heatmap.ts                   # NUEVO: rejilla de semanas, celdas futuras, leyenda
│   └── execution.ts                       # tandaUnits se conserva (temporizador)
├── execution/
│   ├── constants.ts                       # TANDA_MINUTES_MAX 180, LATE_LOG_{MIN,MAX}_MINUTES, nuevas
│   ├── time.ts                            # splitByLocalDay
│   ├── tandas.ts                          # kind, objective_id, finish del cronómetro, correct,
│   │                                      #   finalizeElapsed ignora el cronómetro, readTandas→tallyDay
│   ├── objectives.ts                      # NUEVO: servicio de objetivos
│   ├── quotes.ts                          # NUEVO: servicio de frases
│   ├── focus.ts                           # NUEVO: getFocusSummary
│   ├── today.ts                           # running_tanda.kind/elapsed, foco_*, frase_del_dia, tallyDay
│   ├── compliance.ts                      # tallyDay, correcciones
│   ├── report.ts                          # correcciones en el payload y el texto
│   ├── today-view.ts                      # opciones de duración, campo libre, elapsed, selector, frase
│   └── handlers.ts                        # handlers nuevos + correct
├── db/execution-pg.ts                     # TandaRecord + objetivos/frases (fetch/save)
├── validations/schemas.ts                 # esquemas Zod nuevos y ampliados, códigos de error
└── hooks/
    ├── useToday.ts                        # start({kind, ...}), elapsedSeconds
    ├── useObjectives.ts                   # NUEVO
    └── useFocusSummary.ts                 # NUEVO

app/api/execution/
├── route.ts                               # ALLOWED_ACTIONS + manage_objectives
└── focus/route.ts                         # NUEVO: GET resumen de foco

components/
├── ui/FocusHeatmap.tsx                    # NUEVO (reemplaza StudyHeatmap.tsx)
└── dashboards/
    ├── TodayDashboard.tsx                 # modo, campo libre, selector, cronómetro, franja de foco, frase
    └── CommandCenter.tsx                  # FocusHeatmap 52 semanas + tabla por objetivo

app/globals.css                            # tokens --heat-0..--heat-4 (claro y oscuro)

mcp-server/
├── index.ts                               # descriptores y mcpServer.tool de las 3 herramientas nuevas
├── tools-handler.ts                       # despacho de las nuevas
└── instructions.md / README.md            # catálogo

__tests__/  (ver la matriz en quickstart.md)
└── helpers/test-db.ts                     # reset() + objetivos, frases
```

Se eliminan si quedan sin uso: `components/ui/StudyHeatmap.tsx`, `lib/domain/study-heatmap.ts` y
`__tests__/domain/study-heatmap.test.ts`. La mención en `README.md` se actualiza.

**Structure Decision**: las reglas puras (unidades, mínimo, tramos, niveles, frase) viven en
`lib/domain/focus.ts`, sin zona horaria. El reparto por día (`splitByLocalDay`) vive en
`lib/execution/time.ts`, que es el único lugar que conoce `PURE_TZ`, y se inyecta en
`tallyDay`. Los servicios (`today.ts`, `compliance.ts`, `tandas.ts`, `focus.ts`) solo traen datos y
llaman a esas funciones.

## Complexity Tracking

| Desviación | Por qué hace falta | Alternativa más simple descartada y por qué |
|---|---|---|
| `manage_tandas:correct` acepta un instante del cliente (`ended_at`), en contra del Principio III ("ninguna ruta ni herramienta acepta marcas de tiempo del cliente") | Andres eligió un cronómetro **sin tope**. Sin una forma de corregirlo, un olvido de 8 horas quedaría como 8 horas de estudio para siempre. La corrección es la red que hace aceptable esa decisión. | (a) **Tope automático**: lo descartó Andres. (b) **Corregir con una duración en minutos en vez de un instante**: es la misma excepción con otra forma, y además peor, porque el instante se valida contra `started_at` y `now`. (c) **Interrumpir y registrar tarde**: `log_late` solo cubre el mismo día y 6 horas atrás, y crearía una segunda fila. |
| Acotación de la excepción | Solo **acorta** (o cierra un cronómetro en curso en un instante ya pasado): nunca alarga ni crea sesiones (FR-T15 sigue vigente). Exige razón, conserva el original, marca `corrected`, guarda `corrected_at` del servidor y cuenta en `correcciones` del reporte. Es solo MCP. | — |

## Entrega

| Bloque | Contenido | Paquete y modelo |
|---|---|---|
| 1. Fundación | Migraciones 015/016, `TandaRecord`, repositorios de objetivos y frases, esquemas Zod y códigos de error, constantes, `reset()` del arnés, `splitByLocalDay`, `lib/domain/focus.ts` (puro) | P1 Datos (Haiku) + P2 Dominio (Sonnet), archivos disjuntos |
| 2. US-F1 + US-F2 | Sesiones con tipo, finish/finalize del cronómetro, objetivos, migración de los tres cálculos a `tallyDay` | P2 (Sonnet) para `tandas/today/compliance/checks`; P3 (Sonnet) para `objectives.ts` y handlers |
| 3. US-F4 | `correct`, `correcciones` en el reporte | P2 (Sonnet) |
| 4. US-F3 | `getFocusSummary`, ruta GET, herramienta MCP | P3 (Sonnet) |
| 5. US-F5 | `quotes.ts`, `manage_quotes`, `frase_del_dia` | P3 (Sonnet) |
| 6. UI | `today-view.ts`, `focus-heatmap.ts`, hooks, TodayDashboard, CommandCenter, FocusHeatmap, tokens | P4 UI (Sonnet) |
| Cierre | Trazabilidad 004, catálogo MCP, README/instructions, quickstart en vivo, carga de frases | Claude audita; la carga real la hace Claude por MCP |

Una sola rama. Los commits van en español, sin trailer `Co-Authored-By`. `main` recibe el PR cuando
`npm run test:all` esté en verde y el quickstart validado.
