---
description: "Lista de tareas de Foco (temporizador, cronómetro, objetivos y mapa de calor) — TDD obligatorio (override de PURE OS)"
---

# Tasks: Foco — temporizador, cronómetro, objetivos y mapa de calor

**Input**: Design documents from `/specs/004-foco-cronometro/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: MANDATORY (Constitución, Principio II).
- Cada escenario no manual `US-Fn-ASm` de spec.md se convierte en un test con su ID en el nombre
  (`it('US-F1-AS4 · …')`).
- Cada tarea `IMPL` va precedida de su tarea `TEST`, que DEBE fallar por la razón esperada (RED
  verificado; un import roto no cuenta) antes de implementar.
- Los escenarios marcados **[regresión]** en spec.md nacen en verde a propósito.
- En la rama se admite un commit `test(004): …` en rojo seguido de su `feat(004): …`. Los commits
  van en español, con un cuerpo que explique el porqué y **sin** trailer `Co-Authored-By`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes).
- Tipos de tarea:
  - `TEST`: tests en rojo;
  - `IMPL`: implementación hasta verde;
  - `VERIFY`: verificación empírica;
  - `MANUAL`: la hace una persona.
- **Paquete** (quién la ejecuta, del plan): **P1** Datos (Haiku) · **P2** Dominio + tandas (Sonnet)
  · **P3** Servicios + MCP (Sonnet) · **P4** UI (Sonnet) · **C** Claude (auditoría y cierre).

## Path Conventions (PURE OS)

- Dominio puro: `lib/domain/`. Servicios compartidos por la web y el MCP: `lib/execution/`.
  Repositorio Postgres: `lib/db/execution-pg.ts`. Zod: `lib/validations/schemas.ts`.
- Migraciones: `db/migrations/NNN_nombre.sql`. Deben correr en pg-mem: sin plpgsql, sin
  `AT TIME ZONE`, sin índices únicos parciales, con todo CHECK sobre columnas anulables escrito con
  `IS [NOT] NULL` explícito (research R2). Además deben ser **idempotentes**, porque el arnés corre
  las migraciones dos veces.
- MCP: una herramienta nueva se registra en **4 sitios**:
  1. el arreglo de descriptores de `mcp-server/index.ts` (~L50–500);
  2. su `mcpServer.tool(...)` (~L700+);
  3. la lista de nombres (~L822);
  4. `mcp-server/tools-handler.ts`.

  `__tests__/mcp/all-tools.test.ts` verifica el catálogo (hoy 31).
- Tests en `__tests__/`. La base de prueba se crea con `createTestDb()` y se limpia con
  `harness.reset()`. El reloj se controla con `vi.setSystemTime`, y `vi.useRealTimers()` va en el
  `afterEach`. Horas en UTC: Bogotá es UTC−5, así que las 23:00 locales del 5-oct son
  `2026-10-06T04:00:00Z`.
- Programa de prueba: `handleManageProgram('init', { starts_on: <lunes>, weeks: [...] })`.
  Universidad y materia con `handleManageUniversities` y `handleManageSubjects`.
- Rutas web en tests: `import { POST } from '@/app/api/execution/route'`, como en
  `__tests__/api/execution-routes.test.ts`.

## Propiedad de archivos (para agentes en paralelo)

| Paquete | Archivos que solo él edita |
|---|---|
| P1 | `db/migrations/015_*`, `016_*`, `lib/db/execution-pg.ts`, `lib/validations/schemas.ts`, `__tests__/helpers/test-db.ts`, `__tests__/db/execution-schema-foco.test.ts`, `__tests__/validations/schemas-foco.test.ts`. Además, en la Fase 2, solo la línea de `logLateTanda` de `tandas.ts` y `lib/execution/constants.ts` |
| P2 | `lib/execution/time.ts`, `lib/domain/focus.ts`, `lib/execution/tandas.ts` (desde la Fase 3), `today.ts`, `compliance.ts`, `checks.ts`, `report.ts`, `tick.ts`, `constants.ts` (desde la Fase 3) y sus tests |
| P3 | `lib/execution/objectives.ts`, `quotes.ts`, `focus.ts`, `handlers.ts`, `app/api/execution/route.ts`, `app/api/execution/focus/route.ts`, `mcp-server/*` y sus tests |
| P4 | `lib/execution/today-view.ts`, `lib/domain/focus-heatmap.ts`, `lib/hooks/*`, `components/**`, `app/globals.css` y `__tests__/domain/today-view.test.ts`, `focus-heatmap.test.ts` |

Si una tarea de un paquete necesita tocar un archivo de otro, se indica en la tarea y se hace
**en serie**, nunca a la vez.

---

## Nota de orden

La entrada de la 004 en `__tests__/build/spec-traceability.test.ts` se agrega al final (**T046**),
igual que en la 003. Agregarla antes dejaría toda la suite en rojo mientras se trabaja cada
historia y, con varios agentes, borraría la señal de qué está roto de verdad. El RED de cada
historia lo da su propio archivo de tests.

---

## Phase 1: Setup

- [ ] T001 C VERIFY — En la rama `004-foco-cronometro`:
      - `npm run test:all` en verde como línea base antes de tocar código; anotar el número de
        tests;
      - confirmar que `specs/004-foco-cronometro/` tiene spec, plan, research, data-model,
        contracts, quickstart y `frases.json`;
      - borrar el comentario "Sync Impact Report" del inicio de `.specify/memory/constitution.md`
        antes del primer commit.

---

## Phase 2: Foundational (bloquea todas las historias)

**Propósito**: estructura de datos, validación y funciones puras. Las pistas A (P1) y B (P2) no
comparten archivos y van en paralelo.

### Pista A — Datos (P1, Haiku)

- [ ] T002 [P] P1 TEST — Crear `__tests__/db/execution-schema-foco.test.ts`, con
      `createTestDb()`, insertando por `harness.pool.query`. Sin IDs de escenario: es
      infraestructura. Casos:
      - `objetivos` existe con las columnas `id, name, active_name_key, subject_id,
        weekly_target_minutes, archived, archived_at, created_at`;
      - `weekly_target_minutes`:
        - rechaza 0 y 10081;
        - acepta NULL, 1 y 10080;
      - `active_name_key`:
        - dos NULL se aceptan;
        - dos `'leetcode'` se rechazan;
      - `frases` existe con `id, text, translation, source, active, created_at`;
      - `tandas` tiene las columnas nuevas `kind, objective_id, corrected, corrected_at,
        original_ended_at, original_minutes, correction_reason`;
      - una fila insertada sin `kind` queda `'temporizador'`;
      - CHECK `tandas_tipo_duracion`:
        - acepta un temporizador de 10 y uno de 180, y un cronómetro con `planned_minutes` NULL;
        - **rechaza** un temporizador de 9, uno de 181 y uno con `planned_minutes` NULL, un
          cronómetro con 30, y `kind = 'otro'`;
      - CHECK `tandas_correccion_completa`:
        - rechaza `corrected = TRUE` sin `corrected_at`, `original_ended_at`, `original_minutes`
          o `correction_reason`;
        - acepta la fila completa;
      - correr `runPostgresMigrations` una segunda vez no falla (idempotencia);
      - repositorio (T004), contra funciones que todavía no existen:
        - `saveTandaToDb` guarda y relee `kind`, `objective_id` y los campos de corrección;
        - al volver a guardarla con otro `actual_minutes`, los campos de corrección persisten y
          `kind`/`planned_minutes` no cambian;
        - `insertObjectiveToDb`/`fetchObjectivesFromDb`/`updateObjectiveInDb` hacen ida y
          vuelta;
        - `insertQuotesInDb` con un id repetido no lanza error y no duplica la fila.
- [ ] T003 P1 IMPL — Crear `db/migrations/015_objetivos_frases.sql` y
      `db/migrations/016_tandas_cronometro.sql` **tal cual** [data-model.md](./data-model.md):
      - `objetivos.weekly_target_minutes` con
        `CHECK (weekly_target_minutes IS NULL OR weekly_target_minutes BETWEEN 1 AND 10080)`;
      - `active_name_key TEXT UNIQUE`;
      - en `016`: `ALTER TABLE tandas ALTER COLUMN planned_minutes DROP NOT NULL`;
        `ADD COLUMN IF NOT EXISTS` de cada columna nueva; `DROP CONSTRAINT IF EXISTS
        tandas_planned_minutes_rango`; `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT
        tandas_tipo_duracion CHECK ((kind = 'temporizador' AND planned_minutes IS NOT NULL AND
        planned_minutes BETWEEN 10 AND 180) OR (kind = 'cronometro' AND planned_minutes IS NULL))`;
        lo mismo para `tandas_correccion_completa`;
      - `CREATE INDEX IF NOT EXISTS idx_objetivos_subject`, `idx_tandas_objective`;
      - cabecera en español que explique la regla "IS NOT NULL explícito" (R2) y por qué la 015 va
        antes;
      - en `__tests__/helpers/test-db.ts`, `reset()` agrega `'objetivos'` y `'frases'`
        **después** de `'tandas'`.

      T002 en verde.
- [ ] T004 P1 IMPL — `lib/db/execution-pg.ts`:
      - `TandaRecord` agrega `kind: 'temporizador' | 'cronometro'`, `objective_id?`,
        `corrected: boolean`, `corrected_at?`, `original_ended_at?`, `original_minutes?` y
        `correction_reason?`; `planned_minutes: number | null`;
      - `saveTandaToDb`:
        - incluye las columnas nuevas en el INSERT;
        - en `ON CONFLICT DO UPDATE` actualiza `objective_id`, `corrected`, `corrected_at`,
          `original_ended_at`, `original_minutes` y `correction_reason`;
        - **nunca** actualiza `kind`, `planned_minutes`, `started_at` ni `local_date`;
        - el default de `planned_minutes` pasa de `?? 10` a respetar `null` cuando
          `kind === 'cronometro'`;
      - nuevos `ObjectiveRecord` + `fetchObjectivesFromDb(id?)`, `insertObjectiveToDb` y
        `updateObjectiveInDb`;
      - nuevos `QuoteRecord` + `fetchQuotesFromDb()`, `insertQuotesInDb(rows, client?)` (con
        `ON CONFLICT (id) DO NOTHING`; **no** confiar en `RETURNING` para contar, R4) y
        `updateQuoteInDb`.

      Los casos de repositorio de T002 en verde.
- [ ] T005 P1 IMPL — `lib/execution/constants.ts`:
      - agregar exactamente: `LATE_LOG_MIN_MINUTES = 10`, `LATE_LOG_MAX_MINUTES = 60`,
        `CRONOMETRO_MIN_FINISH_SECONDS = 60`, `CORRECTION_REASON_MIN = 1`,
        `CORRECTION_REASON_MAX = 140`, `OBJECTIVE_NAME_MAX = 60`,
        `WEEKLY_TARGET_MAX_MINUTES = 10080`, `QUOTE_TEXT_MAX = 300`,
        `QUOTE_TRANSLATION_MAX = 300`, `QUOTE_SOURCE_MAX = 120`, `QUOTE_BATCH_MAX = 200`,
        `FOCUS_WEEKS_DEFAULT = 52`, `FOCUS_WEEKS_MAX = 53`, `TODAY_HEATMAP_WEEKS = 12` y
        `HEAT_LEVEL_BOUNDS = [30, 90, 180] as const`;
      - **no** cambiar todavía `TANDA_MINUTES_MAX` (eso es T013, con su test);
      - en `lib/execution/tandas.ts:404-408` (`logLateTanda`) reemplazar
        `TANDA_MINUTES_MIN/MAX` por `LATE_LOG_MIN_MINUTES/LATE_LOG_MAX_MINUTES`. Es la única línea
        de `tandas.ts` que toca P1.

      `npm run test:all` sigue verde.
- [ ] T005b [P] P1 TEST — Crear `__tests__/validations/schemas-foco.test.ts`, sin IDs de
      escenario (forma, no comportamiento):
      - cada esquema nuevo de T006 es `.strict()` y rechaza una clave desconocida;
      - las cotas exactas:
        - `name` vacío o de 61 caracteres;
        - `weekly_target_minutes` 0 y 10081;
        - `reason` vacía (solo espacios) y de 141 caracteres;
        - `text` de 301, `translation` de 301 y `source` de 121;
        - `frases` vacío y de 201;
        - `weeks` 0 y 54;
      - `FocusSummarySchema` rechaza `objective_id` y `subject_id` juntos;
      - `TandaReadSchema` y `TandaUpdateSchema` aceptan `objective_id`.

      Debe fallar (RED) antes de T006.
- [ ] T006 P1 IMPL — `lib/validations/schemas.ts`:
      - `ExecutionErrorCode` agrega `'CRONOMETRO_MUY_CORTO' | 'OBJETIVO_DUPLICADO' |
        'OBJETIVO_ARCHIVADO' | 'CORRECCION_INVALIDA'`;
      - esquemas nuevos, `.strict()`, según [contracts/mcp-tools.md](./contracts/mcp-tools.md):
        - `TandaCorrectSchema` (`id`, `ended_at` ISO, `reason` 1..140 tras `trim`);
        - `ObjectiveCreateSchema` (`name` 1..60 tras `trim`, `subject_id?`,
          `weekly_target_minutes?` int 1..10080);
        - `ObjectiveUpdateSchema` (lo mismo, todo opcional salvo `id`; `subject_id` y
          `weekly_target_minutes` admiten `null`);
        - `ObjectiveArchiveSchema`, `ObjectiveReadSchema` (`include_archived?`);
        - `FocusSummarySchema` (`weeks?` int 1..53, `objective_id?`, `subject_id?`, `at?`, con un
          refine que rechaza `objective_id` y `subject_id` juntos);
        - `QuoteCreateSchema` (`text` 1..300 tras `trim`, `translation?` ..300, `source?` ..120);
        - `QuoteCreateManySchema` (`frases` 1..200 de `QuoteCreateSchema`);
        - `QuoteUpdateSchema`, `QuoteDeactivateSchema` y `QuoteReadSchema`;
      - `TandaReadSchema` y `TandaUpdateSchema` agregan `objective_id?`;
      - **No tocar todavía `TandaStartSchema`** (T013).

      T005b en verde.

### Pista B — Funciones puras y zona horaria (P2, Sonnet)

- [ ] T007 [P] P2 TEST — En `__tests__/domain/execution-time.test.ts`, agregar tests de
      `splitByLocalDay(startIso, endIso)` con `PURE_TZ` por defecto (Bogotá):
      - mismo día → un tramo;
      - `US-F1-AS10 · 23:00→01:30 local se reparte 60 + 90`;
      - `US-F1-AS10 · lunes 22:00 → miércoles 02:00 se reparte 120 + 1440 + 120`;
      - piso acumulado: 23:00:30 → 00:10:40 da 59 + 11 = 70 (nunca 69);
      - la suma de los tramos siempre es `floor((fin − inicio) / 60 s)`.
- [ ] T008 [P] P2 TEST — Crear `__tests__/domain/focus.test.ts` contra `lib/domain/focus.ts`
      (puro, sin base):
      - `US-F1-AS6 · unidades: cronómetro 45→4, 10→1, 9→0; temporizador 8→1`;
      - `US-F2-AS4 · objetivo sin materia y sin vínculo propio no cuenta: 60 min de foco, 0
        unidades`;
      - `US-F2-AS5 · objetivo con materia cuenta 3 unidades con 30 min`;
      - `US-F2-AS6 · vínculo académico propio cuenta aunque el objetivo no tenga materia`;
      - `US-F2-AS7 · tanda sin ningún vínculo cuenta 1 unidad` [regresión];
      - `US-F3-AS1 · tallyDay suma completadas + interrumpidas en minutos_foco (25 + 12 + 45 = 82)`;
      - `US-F3-AS6 · heatLevel 0,1,30,31,90,91,180,181 → 0,1,1,2,2,3,3,4`;
      - `US-F5-AS3 · quoteOfDay: mismo día, misma frase; días consecutivos distintos; N días, cada
        una una vez; 0 activas → null`.

      `sessionShares` se prueba con un `split` falso inyectado.
- [ ] T009 P2 IMPL — `lib/execution/time.ts`: `splitByLocalDay` según research R6 (recorre las
      medianoches locales con `localParts` y `localDateTimeToInstant(dateKey, '00:00')`; piso
      acumulado). T007 en verde.
- [ ] T010 P2 IMPL — Crear `lib/domain/focus.ts` (sin `Intl`, sin `process.env`) con:
      - `sessionUnits(kind, minutes)`: el temporizador delega en `tandaUnits` de
        `lib/domain/execution.ts`; el cronómetro es `Math.floor(minutes / 10)`;
      - `countsTowardMinimum(t, objetivo | null)`;
      - `sessionShares(t, split)`;
      - `tallyDay(dateKey, tandas, objetivosById, split)` →
        `{ completadas, unidades, interrumpidas, minutos_foco }`;
      - `heatLevel(m)`, usando `HEAT_LEVEL_BOUNDS`;
      - `dayNumber(dateKey)`;
      - `quoteOfDay(dateKey, frases)`.

      Reglas exactas en [data-model.md](./data-model.md) § "Conceptos derivados". T008 en verde.

**Checkpoint**: `npm run test:all` en verde. Fundación lista; commit `feat(004): fundación de
foco…` (tras el RED de T002/T007/T008).

---

## Phase 3: User Story F1 — Temporizador libre y cronómetro (P1) 🎯 MVP

**Goal**: empezar un temporizador de 10 a 180 min o un cronómetro sin fin, desde el MCP y desde
Hoy, con minutos y unidades reales.

**Independent Test**: arrancar un cronómetro, terminarlo a los 45 min y ver 45 min y 4 unidades;
arrancar un temporizador de 45 min y dejar que se cierre solo.

### Tests (RED)

- [ ] T011 [P] [US-F1] P2 TEST — Crear `__tests__/mcp/execution-foco-sesiones.test.ts`, vía
      `handleManageTandas`, `handleGetToday`, `handleGetComplianceReport` y `runExecutionTick`:
      - `US-F1-AS1`: cronómetro en curso, `kind = 'cronometro'`, `planned_minutes = null`,
        `ends_at = null`; con `planned_minutes` → `DATOS_INVALIDOS`;
      - `US-F1-AS2`: tres horas después, `runExecutionTick` con un pusher espía no lo cierra ni
        avisa;
      - `US-F1-AS3`: temporizador de 45 y de 180 aceptados; de 9, de 181 y de 12.5 rechazados con
        `DATOS_INVALIDOS`, sin filas;
      - `US-F1-AS4`: `finish` a los 45 min 40 s da completada con 45;
      - `US-F1-AS5`: `finish` a los 50 s da `CRONOMETRO_MUY_CORTO` y sigue en curso; `interrupt`
        con razón deja interrumpida con 0;
      - `US-F1-AS7`: con un cronómetro en curso, `start` de un temporizador da `TANDA_EN_CURSO`, y
        al revés también;
      - `US-F1-AS10`: con el programa en mínimo 3, un cronómetro de 23:00 a 01:30 da en
        `get_compliance_report` 60 min y 6 unidades el primer día y 90 y 9 el segundo; un
        temporizador de 23:30 a 00:30 cuenta entero (6 unidades) para su día de inicio;
      - `US-F1-AS11`: un cronómetro que empezó el lunes y se termina el martes a las 04:00 queda
        con `edited_after_lock = true`.
- [ ] T012 [P] [US-F1] P2 TEST — En `__tests__/mcp/execution-tandas-variables.test.ts`, reescribir
      los dos tests de `US-T1-AS3`:
      - renombrarlos `US-T1-AS3 · US-F1-AS3 · …`;
      - 9 sigue rechazado;
      - **61 ahora se acepta** y 181 se rechaza.

      Comentario: "La 004 reemplaza la cota superior (spec 004, 'Lo que esta feature reemplaza')".
      Confirmar que `US-T2-AS4` (log_late de 61 rechazado) **sigue en verde**.

### Implementation (GREEN)

- [ ] T013 [US-F1] P2 IMPL — Rango y esquema de `start`:
      - `constants.ts`: `TANDA_MINUTES_MAX = 180` (comentario: FR-F02);
      - `schemas.ts` (P2 la toma en serie, tras terminar P1): `TandaStartSchema` agrega
        `kind?: z.enum(['temporizador','cronometro'])` y `objective_id?`, con `planned_minutes`
        int 10..180, más un `superRefine` que rechaza `planned_minutes` cuando `kind ===
        'cronometro'`.

      T012 y US-F1-AS3 en verde.
- [ ] T014 [US-F1] P2 IMPL — `lib/execution/tandas.ts`:
      - `startTanda`:
        - guarda `kind`;
        - en el cronómetro deja `planned_minutes: null` y devuelve `ends_at: null`;
      - `endsAtMs` devuelve `null` en el cronómetro;
      - `finalizeElapsed` ignora `kind === 'cronometro'` (R8);
      - `finishTanda`:
        - en el cronómetro exige `elapsed >= CRONOMETRO_MIN_FINISH_SECONDS * 1000`; si no,
          `CRONOMETRO_MUY_CORTO`;
        - si no, cierra con `actual_minutes = floor(elapsed / 60 s)`;
      - `finishTanda` e `interruptTanda` marcan `edited_after_lock` en el cronómetro cuando
        `now > locked_at`;
      - `currentTanda` agrega `elapsed_seconds` (el cronómetro numérico, el temporizador `null`) y
        devuelve `seconds_left = null` en el cronómetro;
      - `readTandas`:
        - incluye toda tanda con algún tramo en `[from, to]`, aunque su `local_date` sea anterior;
        - arma `por_dia` con `tallyDay(…, new Map(), splitByLocalDay)`. Por ahora sin objetivos:
          eso es T021;
        - `por_dia.minutos` = `minutos_foco`.
- [ ] T015 [US-F1] P2 IMPL — `lib/execution/today.ts` y `lib/execution/compliance.ts`:
      - reemplazar los cálculos propios de unidades (`today.ts:74`, `compliance.ts:131`) por
        `tallyDay`, con `splitByLocalDay` y un mapa de objetivos vacío;
      - en `compliance.ts`, `evaluateOneDay` usa los tramos del día, no `t.local_date ===
        dateKey`;
      - en `today.ts`, `TodayRunningTanda`:
        - agrega `kind`, `objective_id` y `elapsed_seconds`;
        - `ends_at` y `seconds_left` admiten `null`.

      `lib/execution/checks.ts` hereda el cambio a través de `readTandas().por_dia`. Verificar que
      sus tests siguen verdes. T011 en verde, y toda la suite de la 001–003 también.
- [ ] T016 [US-F1] P3 IMPL — `mcp-server/index.ts`:
      - actualizar la descripción de `manage_tandas` en el descriptor y en `mcpServer.tool`: tipos,
        10–180, cronómetro sin fin, `CRONOMETRO_MUY_CORTO`;
      - actualizar el esquema de `start` en la descripción de `data`.

      `mcp-server/instructions.md`: sección de tandas actualizada.

### UI (P4, en paralelo con T013–T016: archivos disjuntos)

- [ ] T017 [P] [US-F1] P4 TEST — En `__tests__/domain/today-view.test.ts`:
      - reescribir `US-T1-AS11` como `US-T1-AS11 · US-F1-AS8 · …`: los presets siguen siendo
        `[10, 25, 40, 60]` con 10 primaria, y ahora existe el campo libre;
      - agregar `US-F1-AS8`: `parseFreeMinutes('45')` → 45; `'9'`, `'181'`, `'12.5'` y `''` → error
        con mensaje en español;
      - agregar `US-F1-AS9`:
        - `elapsedSeconds(startedAtIso, offsetMs, clientNowMs)` con desfase de reloj;
        - `formatElapsed(3725)` → `'1:02:05'` y `formatElapsed(59)` → `'0:00:59'`;
        - el temporizador sigue usando `secondsLeft` y `formatCountdown`.
- [ ] T018 [US-F1] P4 IMPL — `lib/execution/today-view.ts`:
      - `parseFreeMinutes`, `elapsedSeconds` y `formatElapsed`;
      - el comentario de `tandaDurationOptions` cita FR-F05.

      `lib/hooks/useToday.ts`:
      - `start({ kind, planned_minutes?, objective_id? })`;
      - el tic de 1 s también corre con el cronómetro;
      - expone `elapsedSeconds`.

      `components/dashboards/TodayDashboard.tsx`:
      - un selector segmentado sobrio, Temporizador | Cronómetro (sin ícono tintado, `DESIGN.md`);
      - en temporizador: los 4 botones de siempre (10 primaria) + un campo numérico "Otro (10–180)"
        que muestra el error de `parseFreeMinutes` como una línea de texto;
      - en cronómetro: un botón Empezar;
      - en curso: `h:mm:ss` hacia arriba con "Empezó a las HH:MM" y el botón Terminar (el
        `CRONOMETRO_MUY_CORTO` se muestra con `describeStartFailure`), o la cuenta atrás de siempre
        para el temporizador;
      - el `aria-live` anuncia por minuto, no por segundo.

      T017 en verde.
- [ ] T019 [US-F1] P4 VERIFY — Con `preview_start` sobre el dev server, a 375 px y en escritorio:
      - sin errores de consola;
      - 45 en el campo libre arranca un temporizador de 45;
      - 181 muestra el error;
      - el cronómetro cuenta hacia arriba;
      - captura de pantalla para Andres.

      Si no hay Postgres local, anotar el VERIFY como pendiente para T050 (mismo criterio que la
      003).

**Checkpoint**: US-F1 funcional e independiente. Commit `feat(004): US-F1 …`.

---

## Phase 4: User Story F2 — Objetivos (P1)

**Goal**: objetivos propios con materia y meta opcionales; las sesiones se ligan a ellos y la
regla `countsTowardMinimum` decide el mínimo.

**Independent Test**: crear "LeetCode" (sin materia) y "Algoritmos" (con materia); registrar una
sesión en cada uno; solo la segunda cumple el mínimo.

### Tests (RED)

- [ ] T020 [P] [US-F2] P3 TEST — Crear `__tests__/mcp/execution-foco-objetivos.test.ts`:
      - `US-F2-AS1`: `create` + `read`;
      - `US-F2-AS2`: `" leetcode "` duplicado → `OBJETIVO_DUPLICADO`; materia inexistente →
        `NO_ENCONTRADO`; meta 0, -5 y 10081 → `DATOS_INVALIDOS`; ninguna fila nueva;
      - `US-F2-AS3`: `start` con objetivo activo lo liga; con objetivo archivado →
        `OBJETIVO_ARCHIVADO`; con objetivo inexistente → `NO_ENCONTRADO`; sin filas;
      - `US-F2-AS4` y `US-F2-AS5` integrados: con el programa en mínimo 3, un cronómetro de 60 en
        "Inglés" (sin materia) da en `get_today` `unidades_hoy = 0` y el mínimo sin cumplir; un
        temporizador de 30 en "Algoritmos" (con materia) da 3 y lo cumple;
      - `US-F2-AS8`:
        - `archive` saca el objetivo de `read` por defecto, y con `include_archived` sí aparece;
        - `start` con él → `OBJETIVO_ARCHIVADO`;
        - sus tandas viejas siguen en `readTandas().por_dia.minutos`;
        - `update` de nombre, materia y meta valida igual que `create`;
        - invariante `archived ⇔ active_name_key IS NULL`;
      - `US-F2-AS10`: `manage_tandas:update { objective_id }` reclasifica sin tocar los tiempos y
        marca `edited_after_lock` si es después del cierre;
      - `US-F2-AS8` (casos adicionales):
        - `update` sobre un objetivo archivado → `OBJETIVO_ARCHIVADO`;
        - `manage_tandas:read { objective_id }` filtra por objetivo;
        - `get_today.tandas_today` no cuenta una sesión de un objetivo sin materia (I1: cuenta
          solo las sesiones que cumplen la regla del mínimo);
        - borrar la materia de un objetivo deja `subject_id = NULL`, y sus sesiones dejan de
          contar para el mínimo;
      - `US-F2-AS11`: `POST /api/execution` con `manage_objectives` create/read/update/archive da
        los mismos resultados y errores que el handler.

### Implementation (GREEN)

- [ ] T021 [US-F2] P2 IMPL — `lib/execution/tandas.ts`:
      - `startTanda` valida `objective_id`: inexistente → `NO_ENCONTRADO`; `archived` →
        `OBJETIVO_ARCHIVADO`; se valida antes del INSERT;
      - `updateTanda` acepta `objective_id` (debe existir; puede estar archivado);
      - `readTandas` filtra por `objective_id` si viene;
      - `readTandas`, `today.ts` y `compliance.ts` cargan `fetchObjectivesFromDb()` una vez por
        llamada y pasan el mapa real a `tallyDay`.

      US-F2-AS3, AS4, AS5 y AS10 en verde.
- [ ] T022 [US-F2] P3 IMPL — Crear `lib/execution/objectives.ts`:
      - `createObjective`, `readObjectives`, `updateObjective` y `archiveObjective`;
      - id `objetivo-<uuid>`;
      - `active_name_key = lower(trim(name))`, con comprobación previa en TypeScript y, ante
        cualquier 23505 de la base, `OBJETIVO_DUPLICADO` (R3);
      - `subject_id` se valida con `fetchSubjectsFromDb(id)` → `NO_ENCONTRADO`;
      - `archive` es idempotente y pone `archived_at` con el reloj del servidor;
      - `update` sobre un archivado → `OBJETIVO_ARCHIVADO`.

      `lib/execution/handlers.ts`: `handleManageObjectives(action, data, now)` con try/catch,
      igual que los demás.
- [ ] T023 [US-F2] P3 IMPL — Exponer la herramienta:
      - `app/api/execution/route.ts`: `manage_objectives: ['create','read','update','archive']`
        en `ALLOWED_ACTIONS` y su `case` en `dispatch`;
      - registrar `manage_objectives` en los **4 sitios** de `mcp-server/`;
      - `__tests__/mcp/all-tools.test.ts`: 32 herramientas y `toContain('manage_objectives')`;
      - `mcp-server/instructions.md`: sección de objetivos.

      T020 en verde.

### UI (P4)

- [ ] T024 [P] [US-F2] P4 TEST — En `__tests__/domain/today-view.test.ts`, agregar `US-F2-AS9`:
      `objectiveSelectorOptions(objetivos, materias)` → "Sin objetivo" (valor por defecto),
      luego los activos en orden alfabético (con `localeCompare` 'es'), luego las materias; los
      archivados no aparecen.
- [ ] T025 [US-F2] P4 IMPL — Implementar `objectiveSelectorOptions` en `lib/execution/today-view.ts`.
      Crear `lib/hooks/useObjectives.ts` (read/create/update/archive contra `/api/execution`).

      En `TodayDashboard.tsx`:
      - un `<select>` nativo y sobrio sobre los botones de inicio, con "Sin objetivo" por defecto;
      - empezar sigue siendo un toque (FR-008 de la 001);
      - el valor elegido viaja como `objective_id` o como `subject_id` según el tipo de opción.

      T024 en verde.

**Checkpoint**: US-F1 + US-F2 funcionan. Commit `feat(004): US-F2 …`.

---

## Phase 5: User Story F3 — Tiempo enfocado por semana y mapa de calor (P2)

**Goal**: el resumen de foco (día, semana, objetivo) y el mapa de calor: 12 semanas en Hoy y 52 en
Command Center.

**Independent Test**: con sesiones sembradas en varias semanas, cada cifra de `get_focus_summary`
cuadra a mano y coincide con `GET /api/execution/focus`.

### Tests (RED)

- [ ] T026 [P] [US-F3] P3 TEST — Crear `__tests__/mcp/execution-foco-resumen.test.ts`, vía
      `handleGetFocusSummary` con `at`:
      - `US-F3-AS1`: un día da 82;
      - `US-F3-AS2`: la semana de lunes a domingo excluye el domingo anterior, y un temporizador de
        las 23:50 del domingo cuenta para el domingo;
      - `US-F3-AS3`: 52 semanas dan días del lunes de hace 51 semanas a hoy, sin huecos y con 0
        explícitos;
      - `US-F3-AS4`: las filas por objetivo, materia y "Sin objetivo" suman el total; un objetivo
        con meta y 0 minutos aparece;
      - `US-F3-AS5`: filtro por objetivo; filtro por materia, que incluye objetivos ligados a esa
        materia; los dos filtros juntos → `DATOS_INVALIDOS`;
      - `US-F3-AS7`: una sesión en curso no suma, una corregida suma lo corregido (sembrar la fila
        corregida directo con `saveTandaToDb`) y la de un objetivo archivado suma;
      - `US-F3-AS9`: con `vi.setSystemTime` y el handler llamado **sin** `at` (la ruta ignora
        `at`), `GET` de `@/app/api/execution/focus/route` devuelve lo mismo que el handler para el
        mismo `weeks` y filtro; también comprobar `dynamic === 'force-dynamic'`;
      - `US-F3-AS11`: un cronómetro de domingo 23:00 a lunes 01:00 da 60 y 60, cada uno en su
        semana, y un resumen que empieza el lunes incluye los 60 del lunes.
- [ ] T027 [P] [US-F3] P4 TEST — Crear `__tests__/domain/focus-heatmap.test.ts`, con
      `US-F3-AS8`:
      - `buildHeatmapGrid(dias, weeks, todayKey)` → columnas = semanas de lunes a domingo y filas
        L…D;
      - 12 y 52 semanas;
      - los días futuros de la semana en curso quedan con `nivel: null`;
      - las etiquetas de mes salen solo en la primera columna de cada mes.

      Agregar también un test de `formatFocusMinutes(400)` → `'6 h 40 m'` y `(45)` → `'45 m'`, sin
      ID de escenario.

### Implementation (GREEN)

- [ ] T028 [US-F3] P3 IMPL — Crear `lib/execution/focus.ts` con `getFocusSummary(input, now)`
      según [data-model.md](./data-model.md) § "Resumen de foco":
      - `fetchTandasFromDb`, `fetchObjectivesFromDb` y `fetchSubjectsFromDb` una vez cada uno;
      - tramos con `splitByLocalDay`;
      - `heatLevel` por día;
      - `por_objetivo` de la semana actual sin filtro, con una fila por sesión según FR-F16;
      - exportar `focusDays(tandas, objetivosById, from, to, filtro?)`, que devuelve
        `{ date, minutos, nivel }[]`. `getFocusSummary` la usa y `today.ts` la reutiliza en T029b.

      Agregar a `lib/execution/handlers.ts` `handleGetFocusSummary(data, now)` (con `at` como en
      `handleGetToday`). Crear `app/api/execution/focus/route.ts`:
      - GET con `dynamic = 'force-dynamic'`;
      - lee `weeks`, `objective_id` y `subject_id` de la query e **ignora** `at`;
      - try/catch con 400 y 500, sin detalles internos.

      Registrar `get_focus_summary` en los **4 sitios** de `mcp-server/`. `all-tools.test.ts` pasa
      a 33. T026 en verde.
- [ ] T029a [US-F3] P3 TEST — En `__tests__/mcp/execution-foco-resumen.test.ts` (en serie,
      después de T028), test `US-F3-AS2 · get_today.foco_semana_minutos coincide con
      get_focus_summary.total_semana` y `foco_12_semanas` tiene 84 días, o menos si la semana en
      curso no terminó, con el mismo `nivel`. Debe fallar (RED).
- [ ] T029b [US-F3] P2 IMPL — `lib/execution/today.ts` agrega `foco_semana_minutos` (lunes a hoy)
      y `foco_12_semanas` (`{ date, minutos, nivel }[]`) con `focusDays` de
      `lib/execution/focus.ts` (T028), sin duplicar la agregación. Se hace en serie después de
      T029a. T029a en verde.
- [ ] T030 [US-F3] P4 IMPL — Crear `lib/domain/focus-heatmap.ts` (`buildHeatmapGrid`,
      `formatFocusMinutes`, `buildFocusStripView` para Hoy, solo con total y rejilla, **sin meta
      ni faltantes**, R10). T027 en verde.

      `app/globals.css`:
      - tokens `--heat-0 … --heat-4` en claro y oscuro: escala secuencial sobre el verde synergy
        de `DESIGN.md` (`#529e72` oscuro / `#448361` claro);
      - nivel 0 = superficie neutra con borde fino;
      - sin sombras ni glow.
- [ ] T031 [US-F3] P4 IMPL — Crear `components/ui/FocusHeatmap.tsx`:
      - rejilla CSS de celdas de 10–12 px con `title`/`aria-label` "5 oct · 45 min";
      - leyenda con las cifras de los niveles ("0 · 1–30 · 31–90 · 91–180 · >180 min");
      - con 52 semanas, contenedor con `overflow-x-auto` sin desbordar la página;
      - números en IBM Plex Mono y texto en Plex Sans;
      - sin rachas ni "días activos".

      Crear `lib/hooks/useFocusSummary.ts`, que hace `GET /api/execution/focus` y refresca al
      montar y al volver visible.
- [ ] T032 [US-F3] P4 IMPL — `components/dashboards/TodayDashboard.tsx`: franja de foco bajo la
      zona de inicio, con "Esta semana · 6 h 40 m" + `FocusHeatmap` de 12 semanas desde
      `today.foco_12_semanas`, sin pedido extra.

      `components/dashboards/CommandCenter.tsx`:
      - reemplazar `StudyHeatmap` y `computeStudyHeatmap` (L34–38, L306) por `FocusHeatmap` de 52
        semanas con `useFocusSummary`;
      - un `<select>` de filtro por objetivo o materia;
      - debajo, una tabla "Objetivo · Esta semana · Meta" desde `por_objetivo` (cifras con
        `formatFocusMinutes`, sin barras);
      - si `usePureData().studySessions` queda sin uso en CommandCenter, quitarlo de la
        desestructuración.
- [ ] T033 [US-F3] P4 IMPL — Retirar `components/ui/StudyHeatmap.tsx`, `lib/domain/study-heatmap.ts`
      y `__tests__/domain/study-heatmap.test.ts`, si `grep` confirma que no quedan usos. Actualizar
      la mención en `README.md`.
- [ ] T034 [US-F3] P4 MANUAL/VERIFY — `US-F3-AS10` (manual). Con `preview_start`, a 375 px y en
      escritorio:
      - Command Center muestra el mapa de 52 semanas en lugar del de 28 días;
      - se desplaza horizontalmente sin desbordar la página;
      - la leyenda va en cifras, sin rachas ni glow, y el filtro funciona;
      - Hoy muestra el total semanal y 12 semanas, sin meta ni "te faltan";
      - sin errores de consola;
      - capturas para Andres.

      El hook `impeccable` revisa los archivos de UI.

**Checkpoint**: commit `feat(004): US-F3 …`.

---

## Phase 6: User Story F4 — Corregir un cronómetro olvidado (P2)

**Goal**: `manage_tandas:correct`, solo por MCP, que solo acorta, deja constancia y es visible en
el reporte.

**Independent Test**: un cronómetro de 8 h corregido a 70 min muestra minutos, unidades, marca y
`correcciones` en el reporte; alargar falla.

### Tests (RED)

- [ ] T035 [P] [US-F4] P2 TEST — Crear `__tests__/mcp/execution-foco-correccion.test.ts`:
      - `US-F4-AS1`: un cronómetro en curso desde las 14:00 se corrige a las 22:00 con fin 15:10 →
        70 min, `corrected`, `original_ended_at` 22:00, `original_minutes` 480, sin
        `running_lock`;
      - `US-F4-AS2`: una sesión cerrada de 14:00 a 18:00 corregida a 15:00 → 60, conserva el
        original y el estado;
      - `US-F4-AS3`: un fin posterior al registrado (o a ahora, si está en curso), o anterior a
        inicio + 60 s → `CORRECCION_INVALIDA` y nada cambia;
      - `US-F4-AS4`: una segunda corrección conserva el original de la primera;
      - `US-F4-AS5`: corregir dos semanas después se acepta;
      - `US-F4-AS6`: sin razón o con 141 caracteres → `DATOS_INVALIDOS`; un temporizador en curso
        → `CORRECCION_INVALIDA`;
      - `US-F4-AS7`: un día con mínimo 3 y un cronómetro de 480 corregido a 20 → 2 unidades, no
        cumple;
      - `US-F4-AS8`: `get_compliance_report` y el payload del reporte semanal traen
        `correcciones { total: 2, minutos_recortados: 440 }` en la semana en que se corrigió, y
        `{ 0, 0 }` en una semana sin correcciones;
      - `US-F4-AS9`: `POST /api/execution { tool: 'manage_tandas', action: 'correct' }` → 400 por
        la lista blanca.

### Implementation (GREEN)

- [ ] T036 [US-F4] P2 IMPL — En `lib/execution/tandas.ts`, `correctTanda({ id, ended_at, reason },
      now)` según [contracts/mcp-tools.md](./contracts/mcp-tools.md) § `correct`:
      - cotas;
      - `original_*` solo si son nulos;
      - `corrected_at = now`;
      - en un cronómetro en curso: `completada`, `running_lock = null`, y `edited_after_lock` si
        `now > locked_at`.

      Comentario de cabecera equivalente al de `logLateTanda`: segunda excepción acotada al
      Principio III, referencia a `plan.md` § Complexity Tracking.
- [ ] T037 [US-F4] P2 IMPL — `lib/execution/compliance.ts`: `correcciones: { total,
      minutos_recortados }`, con las tandas `corrected` cuyo `localParts(corrected_at).dateKey`
      cae en `[from, to]` y `minutos_recortados = Σ (original_minutes − actual_minutes)`; nunca
      ausente.

      `lib/execution/tick.ts:145`, donde se arma el payload **congelado** del reporte: agregar
      `correcciones: compliance.correcciones`, junto a `registros_tardios`.

      `lib/execution/report.ts`:
      - el campo `correcciones` en el payload;
      - la línea `Correcciones: N (M min recortados)` solo si N > 0, igual que `registros_tardios`
        (L218).
- [ ] T038 [US-F4] P3 IMPL — `lib/execution/handlers.ts`:
      - `case 'correct'` en `handleManageTandas` con `TandaCorrectSchema`;
      - en `handlers.ts:416`, donde se arma el payload de vista previa del reporte, agregar
        `correcciones: compliance.correcciones` junto a `registros_tardios`. **No** se agrega a `ALLOWED_ACTIONS`. `mcp-server/index.ts`:
      `'correct'` en el enum de `manage_tandas` (descriptor y `mcpServer.tool`) y en la
      descripción. `instructions.md`: cuándo usarla (cronómetro olvidado) y que solo acorta. T035
      en verde.

**Checkpoint**: commit `feat(004): US-F4 …`.

---

## Phase 7: User Story F5 — Frase del día (P3)

**Goal**: frases latinas cargadas solo por MCP, que rotan por fecha y ocupan una línea en Hoy.

**Independent Test**: cargar `frases.json` dos veces (50 y luego 0 creadas); `get_today` repite la
misma frase el mismo día.

### Tests (RED)

- [ ] T039 [P] [US-F5] P3 TEST — Crear `__tests__/mcp/execution-foco-frases.test.ts`:
      - `US-F5-AS1`: `create_many` con el contenido real de `specs/004-foco-cronometro/frases.json`
        (leído con `fs`) → `{ creadas: 50, omitidas: 0 }`; repetirlo → `{ 0, 50 }`; una variante
        con mayúsculas o espacios distintos se omite; `create` individual de una frase ya
        existente devuelve la existente sin duplicar;
      - `US-F5-AS2`: un lote con una frase sin texto, con un texto de 301, una traducción de 301 o
        una fuente de 121 → `DATOS_INVALIDOS` y 0 filas;
      - `US-F5-AS4`: sin frases activas, `get_today.frase_del_dia === null`;
      - `US-F5-AS5`: `deactivate` la saca de la rotación (en N − 1 días no aparece);
      - `US-F5-AS6`: `POST /api/execution` con `manage_quotes` create, create_many, update y
        deactivate → 400.

### Implementation (GREEN)

- [ ] T040 [US-F5] P3 IMPL — Crear `lib/execution/quotes.ts`:
      - id `frase-` + 16 hex de `sha256(lower(trim(text)))` con `crypto` (R4);
      - `createQuote` idempotente;
      - `createManyQuotes`: valida todo con Zod, lee los ids existentes, calcula en TypeScript
        cuáles son nuevos e inserta en `withExecutionTransaction`; devuelve `{ creadas,
        omitidas }`;
      - `readQuotes`, `updateQuote` y `deactivateQuote`.

      `lib/execution/handlers.ts`: `handleManageQuotes`, que no va a `ALLOWED_ACTIONS`. Registrar
      `manage_quotes` en los **4 sitios** de `mcp-server/`. `all-tools.test.ts` pasa a 34.
      `instructions.md`: catálogo y cómo cargar `frases.json`.
- [ ] T041 [US-F5] P2 IMPL — `lib/execution/today.ts`: `frase_del_dia = quoteOfDay(dateKey,
      frasesActivas)`, con `fetchQuotesFromDb` y la forma `{ text, translation, source } | null`.
      Se hace en serie después de T040. T039 en verde. P3, en serie: actualizar la descripción
      de `get_today` en `mcp-server/index.ts` (descriptor y `mcpServer.tool`) con
      `running_tanda.kind`/`elapsed_seconds`, `foco_semana_minutos`, `foco_12_semanas` y
      `frase_del_dia`.

### UI (P4)

- [ ] T042 [P] [US-F5] P4 TEST — En `__tests__/domain/today-view.test.ts`, agregar `US-F5-AS7`:
      - `quoteLineView(frase)` → `{ latin, detail }`, con `detail = 'traducción · fuente'`;
      - sin traducción → `detail = fuente`;
      - sin ninguna de las dos → `detail = null`;
      - `quoteLineView(null)` → `null`.
- [ ] T043 [US-F5] P4 IMPL — Implementar `quoteLineView` en `today-view.ts`. En
      `TodayDashboard.tsx`:
      - el latín va en cursiva (`<p lang="la">`) y debajo `detail` en texto secundario;
      - sin ícono, sin animación, sin color de acento (constitución 1.1.0);
      - si es `null` no se renderiza nada, ni contenedor vacío.

      T042 en verde.

**Checkpoint**: commit `feat(004): US-F5 …`.

---

## Phase 8: Polish & cierre

- [ ] T044 [P] P3 IMPL — `mcp-server/README.md` y `mcp-server/instructions.md`: catálogo final
      (34 herramientas), con `correct` y `log_late` como las dos excepciones acotadas al
      Principio III.

      `README.md` raíz: sección breve de Foco (cronómetro, objetivos, mapa).

      `CLAUDE.md`: en "Execution Module", agregar `objetivos` y `frases` a la lista de tablas solo
      de Postgres.
- [ ] T045 P2 VERIFY — Recorrer con `grep` que no quede ningún cálculo de unidades fuera de
      `lib/domain/focus.ts`: en `lib/` no debe haber más llamadas a `tandaUnits(` que la de
      `sessionUnits`. Que `TANDA_MINUTES_MAX` ya no se use en `logLateTanda`.
- [ ] T046 C TEST — `__tests__/build/spec-traceability.test.ts`:
      - agregar la entrada `{ feature: '004', spec: specs/004-foco-cronometro/spec.md, idRe:
        /US-F\d+-AS\d+/, manualExclusions: new Set(['US-F3-AS10']), expectedCount: 48 }`;
      - agregar su `describe('[004] …')`, igual que el de la 003.

      Verde solo si los 48 escenarios tienen test y ningún test cita un ID inexistente.
- [ ] T047 C VERIFY — `npm run test:all`, `npm run lint` y `npm run build` en verde. Comparar el
      número de tests con la línea base de T001.
- [ ] T048 C VERIFY — Auditoría contra la spec (`/speckit-converge`). Cada FR-F01..FR-F27 tiene
      código y test, y `tasks.md` queda marcado.
- [ ] T049 C VERIFY — Servidor MCP local:
      - `npm run mcp:start:http`;
      - `curl http://localhost:3001/health`;
      - las llamadas reales de [quickstart.md](./quickstart.md) por historia (US-F2 → F1 → F3 → F4
        → F5);
      - **SC-F03**: con un año de sesiones sembradas (un script en el scratchpad, en una base
        local o de pruebas, nunca en producción), `GET /api/execution/focus` responde en menos
        de 1 s; anotar el tiempo medido.

      Si no hay Postgres en la máquina de desarrollo, se hace en el servidor tras T051.
- [ ] T050 C VERIFY — Web con `preview_start` a 375 px y en escritorio. Repetir T019 y T034 si
      quedaron pendientes, sin errores de consola, con capturas.
- [ ] T051 MANUAL — Despliegue (lo confirma Andres antes de ejecutarlo, porque es una acción
      hacia afuera):
      - `docker compose up -d --build pure-web pure-mcp`;
      - `docker compose exec pure-mcp npm run db:migrate` (obligatorio: `pure-mcp` no migra solo;
        sin él, la `015` y la `016` no existen);
      - comprobar `/health`.
- [ ] T052 C VERIFY — Carga real de las frases. Con el conector MCP de producción, que ya expone
      `manage_quotes` tras T051:
      - `manage_quotes:create_many` con el contenido de `specs/004-foco-cronometro/frases.json` →
        `{ creadas: 50, omitidas: 0 }`;
      - `get_today` muestra la frase del día;
      - repetir la carga → `{ creadas: 0, omitidas: 50 }`.

      Opcional y a pedido de Andres: crear sus objetivos reales (p. ej. LeetCode) con
      `manage_objectives:create`.

---

## Dependencies & Execution Order

```text
T001
 └─ Fase 2: Pista A (T002→T003→T004, T005, T005b→T006)  ∥  Pista B (T007, T008 → T009, T010)
     └─ Fase 3 US-F1: T011, T012 (RED) → T013 → T014 → T015 ; T016 (P3) ; T017→T018→T019 (P4)
         └─ Fase 4 US-F2: T020 (RED) → T021 (P2) ∥ T022→T023 (P3) ; T024→T025 (P4)
             ├─ Fase 5 US-F3: T026, T027 (RED) → T028 (P3) → T029a (P3) → T029b (P2) ; T030→T031→T032→T033→T034 (P4)
             ├─ Fase 6 US-F4: T035 (RED) → T036 → T037 (P2) ; T038 (P3, tras T036)
             └─ Fase 7 US-F5: T039 (RED) → T040 (P3) → T041 (P2) ; T042→T043 (P4)
                 └─ Fase 8: T044, T045 → T046 → T047 → T048 → T049/T050 → T051 → T052
```

- **US-F1** depende solo de la Fundación. Es el MVP.
- **US-F2** depende de US-F1: `startTanda` ya debe aceptar `kind`, y `tallyDay` ya debe estar
  conectado.
- **US-F3, US-F4 y US-F5** dependen de US-F2 (objetivos en el resumen y en la regla del mínimo),
  pero **no entre sí**. Se pueden repartir en paralelo respetando la propiedad de archivos. Hay dos
  excepciones:
  - `today.ts` (T029b, T041) y `handlers.ts` (T028, T038, T040) reciben cambios de varias
    historias: esas tareas van **en serie** dentro de su paquete;
  - `mcp-server/index.ts` lo edita solo P3, una tarea a la vez.

## Parallel Example

```text
# Fundación: dos agentes a la vez, sin archivos en común
P1 (Haiku):  T002 → T003 → T004 → T005 → T005b → T006
P2 (Sonnet): T007 + T008 (RED) → T009 → T010

# Tras US-F2: tres frentes
P2 (Sonnet): T035 → T036 → T037          (US-F4 servicio)
P3 (Sonnet): T026 → T028 → T038 → T039 → T040   (US-F3 resumen, F4 wiring, F5 frases)
P4 (Sonnet): T027 → T030 → T031 → T032 → T033 → T042 → T043   (mapa y frase en la UI)
```

## Implementation Strategy

1. **MVP = Fundación + US-F1**: el cronómetro y el temporizador libre ya registran minutos reales y
   unidades correctas. Es desplegable solo.
2. **+ US-F2**: los objetivos y la regla del mínimo. Con esto el registro de LeetCode ya es útil.
3. **+ US-F3**: el mapa de calor y los totales. Es lo que Andres pidió ver.
4. **+ US-F4**: la red de seguridad del cronómetro sin tope. Conviene que llegue antes del primer
   uso real prolongado.
5. **+ US-F5**: la frase del día.
6. **Cierre**: trazabilidad, verificación en vivo, despliegue con migración y carga de frases.

Cada checkpoint deja `npm run test:all` en verde y un commit `feat(004): …`. `main` recibe el PR
al final.
