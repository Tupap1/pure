---

description: "Lista de tareas de los ajustes del Módulo de Ejecución — TDD obligatorio (override de PURE OS)"
---

# Tasks: Ajustes del Módulo de Ejecución

**Input**: Design documents from `/specs/002-ejecucion-ajustes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (mcp-tools.md, notifications.md), quickstart.md

**Tests**: MANDATORY. Lo exige el Principio II de la Constitución de PURE OS (Test-First, NO
NEGOCIABLE). Cada escenario de aceptación no manual `US-Bn-ASm` de spec.md se convierte en un test
nombrado por su ID. Cada historia empieza con sus tareas de test (RED), que DEBEN fallar por la razón
esperada antes de la implementación (GREEN), y termina con una verificación empírica (Principio IV).
Los escenarios que ya pasan con el código actual se marcan **[regresión]**: nacen en verde a
propósito y el commit RED lo dice.

**Organization**: tareas agrupadas por historia, para implementar y probar cada una por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US-B1…US-B5)
- La descripción empieza con el tipo de tarea:
  - `TEST`: tests en rojo;
  - `IMPL`: implementación hasta verde;
  - `VERIFY`: verificación empírica (Principio IV);
  - `MANUAL`: paso que hace una persona o el agente del servidor.

## Path Conventions (PURE OS)

- Dominio puro: `lib/domain/`. Servicios y handlers compartidos por la web y el MCP: `lib/execution/`.
- Repositorio Postgres: `lib/db/execution-pg.ts`. Validación Zod: `lib/validations/schemas.ts`.
- Migraciones: `db/migrations/NNN_nombre.sql`. Deben correr en pg-mem (Principio III).
- MCP: cada tool se registra en `TOOLS_LIST` y con `mcpServer.tool(...)` en `mcp-server/index.ts`, y su
  handler se re-exporta en `mcp-server/tools-handler.ts`.
- Tests: `__tests__/`. Las pruebas contra base usan `createTestDb()` y `harness.reset()` de
  `__tests__/helpers/test-db.ts`; el tiempo se controla con `vi.setSystemTime` y se restaura con
  `vi.useRealTimers()` en `afterEach`.
- Horas de los tests en UTC. Bogotá es UTC−5: el domingo 13 a las 15:00 es `2026-09-13T20:00:00Z`, y
  el domingo 20 a las 19:05 es `2026-09-21T00:05:00Z`.
- Programa de prueba: `handleManageProgram('init', { starts_on: '2026-09-14', weeks: [...] })`.
  Universidad y materia: `handleManageUniversities('create', { id: 'uni-1', name: 'UdeA' })` y
  `handleManageSubjects('create', { id: 'sub-1', university_id: 'uni-1', name: 'Cálculo' })`, desde
  `mcp-server/tools-handler.ts`.
- Títulos de test entre comillas simples, sin comillas simples adentro, y sin citar IDs de la 001
  (`USn-ASm`): el test de trazabilidad los leería como citas de la otra spec.
- Los scripts de Spec Kit en Windows se corren con `PYTHONUTF8=1`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: línea base

- [X] T001 Confirmar la rama `002-ejecucion-ajustes`, creada desde `main` en `bcc5304`, y la línea base: `npm run test:all` en verde antes de tocar código (package.json)
- [X] T002 Commit de los artefactos de Spec Kit de la 002 y de la enmienda 1.0.1 de la constitución, una vez que Andres apruebe la spec: `docs(002): spec, plan y tareas de los ajustes del Módulo de Ejecución` (specs/002-ejecucion-ajustes/, .specify/memory/constitution.md). Lo hace el orquestador

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: trazabilidad de la 002 antes de cualquier historia

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase

- [X] T003 TEST Generalizar __tests__/build/spec-traceability.test.ts a una tabla de specs:
  - `{ feature: '001', spec: 'specs/001-modulo-ejecucion/spec.md', idRe: /US\d+-AS\d+/ }` y `{ feature: '002', spec: 'specs/002-ejecucion-ajustes/spec.md', idRe: /US-B\d+-AS\d+/ }`;
  - por cada spec, un `describe('[NNN] Trazabilidad spec -> tests …')` con los tres `it` de hoy (sanity, ningún escenario sin test, ningún ID inventado). Los IDs salen de las líneas con el ID en negrita (`**ID**`), excluyendo las que dicen `[manual]`, y las citas se buscan con el patrón de esa spec;
  - sanity de la 002: 34 IDs y `US-B4-AS8` excluido. La de la 001 no cambia (US4-AS1 y US4-AS2 excluidos);
  - correr `npx vitest run __tests__/build/spec-traceability.test.ts`: la parte 002 DEBE fallar (RED), con los 34 IDs sin test, y la 001 seguir en verde.
- [X] T004 Crear los placeholders `it.todo('US-Bn-ASm · <resumen>')` de los 34 escenarios no manuales, cada archivo con `describe('[002] US-Bn — <historia>')`:
  - __tests__/mcp/execution-planning-week.test.ts: US-B1-AS1…AS10;
  - __tests__/mcp/execution-tandas-olvidada.test.ts: US-B2-AS1…AS3;
  - __tests__/mcp/execution-day-breakdown.test.ts: US-B4-AS1…AS7;
  - __tests__/mcp/execution-plan-openings.test.ts: US-B3-AS1…AS5;
  - __tests__/mcp/execution-friction.test.ts: US-B5-AS1…AS9;
  - T003 queda en verde y `npm run test:all` también. Commit: `test(002): trazabilidad por spec y placeholders de los 34 escenarios`.

**Checkpoint**: la trazabilidad de la 002 está en verde con `it.todo`.

---

## Phase 3: User Story B1 - Planear la semana que todavía no empieza (Priority: P1) 🎯 MVP

**Goal**: la planeación y el ensayo resuelven la semana con el respaldo nuevo (FR-B01, FR-B02);
cualquier semana explícita manda (FR-B03); la vista de la semana acepta semana y no gasta aperturas
en planeación (FR-B04, FR-B05); la vista previa del reporte no cambia (FR-B06).

**Independent Test**: con un programa desde el lunes 14, mover el reloj al sábado 12, domingo 13,
martes 15, domingo 20 y después de la última semana, y comprobar la semana que resuelve cada acción.

### Tests for User Story B1 (MANDATORY — RED antes de implementar) ⚠️

- [X] T005 [US-B1] TEST Convertir los `it.todo` en tests reales en __tests__/mcp/execution-planning-week.test.ts (pg-mem; programa de 3 semanas con `min_tandas_dia` 1, 3 y 6):
  - US-B1-AS1 [regresión]: a `2026-09-13T20:00:00Z`, `handlePlanWeek('preview', {})` → `data.program_week_id === 'pw-01'`;
  - US-B1-AS2 [regresión]: a `2026-09-15T15:00:00Z` → `pw-01`;
  - US-B1-AS3 [regresión]: a `2026-09-20T20:00:00Z` → `pw-02`;
  - US-B1-AS4: a `2026-09-12T20:00:00Z`, `preview {}` → `pw-01`. Con un disparador creado por `handleManageRoutineSlots('create', { days_of_week: [1], cue_kind: 'hora', cue_text: 'son las 7 am', action_text: 'abro el cuaderno', anchor_time: '07:00' })`, `rehearse { routine_slot_id }` → `success`, y repetirlo con `program_week_id: 'pw-01'` → `ya_ensayado: true`;
  - US-B1-AS5: a `2026-10-05T15:00:00Z`, después de la semana 3, `preview {}` → `code: 'NO_ENCONTRADO'` y `message` que coincide con `/programa ya terminó/i`. Sin programa (sin `init`) → `NO_ENCONTRADO` con `/no hay un programa/i`;
  - US-B1-AS6: a `2026-09-15T15:00:00Z`, `preview { program_week_id: 'pw-03' }` → `pw-03` [regresión]. Con `program_week_id: 'pw-99'`, `preview`, `open_view` y `rehearse` → `NO_ENCONTRADO`;
  - US-B1-AS7: a `2026-09-13T20:00:00Z`, con universidad y materia `sub-1` creadas, `set_intentions { program_week_id: 'pw-01', items: [{ subject_id: 'sub-1', strength: 8 }] }` → `success`. Con `pw-99` → `NO_ENCONTRADO`;
  - US-B1-AS8: a `2026-09-13T20:00:00Z`, dos veces `open_view { program_week_id: 'pw-01' }` sin razón → `success`, `surface: 'planeacion'` y `needs_reason: false`. A `2026-09-15T15:00:00Z`, dos veces `open_view {}` → `surface: 'semana'`, `needs_reason: false` y `opens_this_week` 1 y luego 2;
  - US-B1-AS9: a `2026-09-12T20:00:00Z`, `open_view {}` → `program_week_id: 'pw-01'` y `surface: 'planeacion'`. A `2026-09-20T20:00:00Z`, `open_view {}` → `pw-01` y `surface: 'semana'`;
  - US-B1-AS10 [regresión]: a `2026-09-13T20:00:00Z`, `handleManageWeeklyReport('preview', {})` → `NO_ENCONTRADO`; a `2026-09-15T15:00:00Z` → `success` con `payload.program_week_id === 'pw-01'`;
  - correr el archivo y confirmar que AS4 a AS9 fallan por la razón esperada (sin respaldo, mensaje distinto, `DATOS_INVALIDOS` por clave no reconocida o por FK, o falta `surface`) y no por un import roto. Commit: `test(002): US-B1 escenarios en rojo (resolución de semana y aperturas de planeación)`, con el cuerpo diciendo que AS1, AS2, AS3 y AS10 nacen en verde como regresión.

### Implementation for User Story B1

- [X] T006 [US-B1] IMPL Funciones puras exportadas en lib/execution/program.ts, sin base de datos:
  - `type WeekResolution = { ok: true; week: ProgramWeekRecord } | { ok: false; reason: 'sin_programa' | 'programa_terminado' }`;
  - `resolvePlanningWeek(weeks, todayKey)`: (1) si `isoDayOfWeekForDateKey(todayKey) === 7` (de `lib/domain/execution.ts`) y hay una semana con `starts_on === addDays(todayKey, 1)`, esa; (2) `findCurrentWeek(weeks, todayKey)`; (3) la de menor `starts_on` con `starts_on > todayKey`; (4) `weeks.length === 0 ? 'sin_programa' : 'programa_terminado'`;
  - `resolveViewWeek(weeks, todayKey)`: los pasos 2 a 4;
  - `weekHasStarted(week, todayKey)`: `week.starts_on <= todayKey`;
  - `weekNotFoundMessage(reason, verbo: 'planear' | 'ver')` con los textos literales de contracts/mcp-tools.md: "No hay un programa creado: no hay semana para planear." y "El programa ya terminó: no quedan semanas por planear." (y sus versiones con "ver").
- [X] T007 [US-B1] IMPL `rehearseRoutineSlot` en lib/execution/routine.ts:
  - con `program_week_id`, `fetchProgramWeeksFromDb(id)`; si no existe → `NO_ENCONTRADO` ("No existe la semana X.");
  - sin id, `resolvePlanningWeek(weeks, localParts(now).dateKey)`; si `!ok` → `NO_ENCONTRADO` con `weekNotFoundMessage(reason, 'planear')`;
  - `resolveRehearsalWeekId` se elimina; su único otro uso (lib/execution/planning.ts) se reemplaza en T008.
- [X] T008 [US-B1] IMPL lib/execution/planning.ts:
  - `resolveTargetAndPastWeek` devuelve un resultado discriminado: id inexistente → `NO_ENCONTRADO` ("No existe la semana X."); sin id → `resolvePlanningWeek` y `weekNotFoundMessage(reason, 'planear')`. `previewPlanWeek` propaga el error;
  - `setIntentions`: antes de validar razones, `fetchProgramWeeksFromDb(input.program_week_id)`; si no existe → `NO_ENCONTRADO` sin guardar nada;
  - `openPlanView(input: { reason?: string; program_week_id?: string }, now)`: la semana sale del id (o `NO_ENCONTRADO`) o de `resolveViewWeek` (con `weekNotFoundMessage(reason, 'ver')`). Si `!weekHasStarted(week, todayKey)`, guardar `{ id: `${week.id}:planeacion-${n}`, surface: 'planeacion', was_gated: false, reason: null }`, con `n` = aperturas `planeacion` previas de esa semana + 1, sin compuerta. Si la semana ya empezó, la compuerta de hoy sin cambios con `surface: 'semana'`. La respuesta agrega `program_week_id` y `surface`; `opens_this_week` cuenta solo las aperturas `semana` de esa semana;
  - actualizar el comentario de `openPlanView` y el de `handlePlanWeek` en lib/execution/handlers.ts: "open_view siempre mira la semana en curso" deja de ser cierto.
- [X] T009 [P] [US-B1] IMPL `PlanWeekOpenViewSchema` en lib/validations/schemas.ts: agregar `program_week_id: z.string().min(1).optional()`, manteniendo `.strict()`.
- [X] T010 [US-B1] IMPL Descripciones en mcp-server/index.ts, tanto en `TOOLS_LIST` como en `mcpServer.tool('plan_week', …)`:
  - `preview` sin `program_week_id`: domingo → la semana que arranca mañana; si no, la que contiene hoy; si no, la próxima; si no, `NO_ENCONTRADO`;
  - `open_view: { program_week_id?, reason? }`, con la apertura de planeación sin compuerta;
  - en `manage_routine_slots`, si la descripción de `rehearse` menciona "la semana en curso, o la siguiente si es domingo", reemplazarla por la misma resolución;
  - GREEN: `npx vitest run __tests__/mcp/execution-planning-week.test.ts __tests__/mcp/execution-planning.test.ts __tests__/mcp/plan-views.test.ts __tests__/mcp/execution-routine.test.ts` y después `npm run test:all` en verde. Commit: `feat(002): US-B1 resolución de semana para planear y aperturas de planeación`.
- [X] T011 [US-B1] VERIFY Lo hace el orquestador: `npm run mcp:start:http` en local, `curl http://localhost:3001/health`, y las llamadas 1, 3, 4 y 5 de quickstart.md (US-B1). Luego la vista de la semana en la web (`npm run dev`) a 375 px y en escritorio, sin errores de consola (specs/002-ejecucion-ajustes/quickstart.md)

### Correcciones que salieron de la verificación de US-B1 (T011)

La vista de la semana llama a `open_view` dos veces al montar en desarrollo (`useWeekView` en
lib/hooks/usePlanWeek.ts, con React StrictMode). Las dos llamadas calculan el mismo id ordinal y la
segunda choca con la clave primaria de `plan_views`, así que responde 400. Pasa igual con las
aperturas `semana` de la 001 y con las de planeación.

- [X] T043 [US-B1] TEST En __tests__/mcp/execution-planning-week.test.ts, un test sin ID de escenario: dos `open_view {}` simultáneos (`Promise.all`) sobre la semana en curso (`2026-09-15T15:00:00Z`) devuelven `success` los dos con `opens_this_week: 1`, y una tercera apertura, ya en serie, devuelve `opens_this_week: 2`. Lo mismo con dos `open_view { program_week_id: 'pw-01' }` simultáneos el domingo 13, que devuelven `success` y `surface: 'planeacion'`. Hoy la segunda llamada falla con `DATOS_INVALIDOS` (RED).
- [X] T044 [US-B1] IMPL `savePlanViewToDb` en lib/db/execution-pg.ts con `ON CONFLICT (id) DO NOTHING RETURNING *`, que devuelve la fila o `null`. `openPlanView` en lib/execution/planning.ts trata `null` como la misma apertura hecha en simultáneo: responde éxito con los mismos valores calculados, sin error y sin volver a contar.

**Checkpoint**: US-B1 funciona sola.

---

## Phase 4: User Story B2 - La tanda olvidada no bloquea el sistema (Priority: P1)

**Goal**: fijar con tests que una tanda vencida nunca impide empezar otra y que no hay cierre por hora
del día (FR-B07, FR-B08). No hay tarea IMPL: Andres decidió no cambiar comportamiento.

**Independent Test**: empezar una tanda, mover el reloj 2 h y empezar otra; correr el tick dos
veces; empezar a las 22:25 y ver que termina por tiempo.

### Tests for User Story B2 (caracterización, RED por mutación) ⚠️

- [X] T012 [P] [US-B2] TEST Convertir los `it.todo` en tests reales en __tests__/mcp/execution-tandas-olvidada.test.ts:
  - US-B2-AS1: `handleManageTandas('start', {})` a `2026-09-14T15:00:00Z`; `start {}` a `2026-09-14T17:00:00Z` → `success`. En `handleManageTandas('read', {})`, la anterior tiene `status: 'completada'`, `actual_minutes: 10`, `running_lock: null` y `ended_at` igual a `2026-09-14T15:10:00.000Z`, y la nueva `status: 'en_curso'`;
  - US-B2-AS2: `start {}` a `15:00:00Z`; a `15:10:01Z`, `runExecutionTick(new Date(), { mailer: { send: async () => {} }, pusher })` con un fake de `Pusher` que guarda las llamadas (patrón `makeFakePusher` de __tests__/mcp/execution-push.test.ts) → tanda `completada` y un aviso con `tag: 'tanda'`. Segunda corrida a `15:10:25Z` → mismo `ended_at` y sigue habiendo un solo aviso;
  - US-B2-AS3: `start {}` a `2026-09-15T03:25:00Z` (lunes 14, 22:25 en Bogotá). A `03:31:00Z` corre el tick y `manage_tandas current` sigue devolviendo la tanda en curso con `seconds_left > 0`. A `03:35:01Z` corre el tick → `completada` con `local_date: '2026-09-14'`, y `handleGetToday()` a `03:36:00Z` → `tandas_today: 1`;
  - estos tests nacen en verde porque no hay implementación. El RED se demuestra por mutación: comentar temporalmente `await finalizeElapsed(now);` en `startTanda` (lib/execution/tandas.ts), ver fallar US-B2-AS1 con `TANDA_EN_CURSO`, restaurar la línea y confirmar con `git diff --exit-code lib/execution/tandas.ts`. Commit: `test(002): US-B2 la tanda olvidada no bloquea (regresión)`, con la mutación y su resultado en el cuerpo.
- [X] T013 [US-B2] VERIFY `npm run test:all` en verde. No hay validación en producción, porque no cambia comportamiento (specs/002-ejecucion-ajustes/quickstart.md)

**Checkpoint**: US-B1 y US-B2 funcionan por separado. Fin del bloque 1: PR a `main`.

---

## Phase 5: User Story B4 - Un día solo se cumple si hice las tandas mínimas (Priority: P2)

**Goal**: la evaluación desglosada del día en `get_today` y `get_compliance_report` (FR-B12 a
FR-B14), y sin hábitos de 0 días activos en las fracciones (FR-B15).

**Independent Test**: con la semana 2 (mínimo 3), combinar tandas y hábitos y leer el desglose.

### Tests for User Story B4 (MANDATORY — RED antes de implementar) ⚠️

- [X] T014 [US-B4] TEST Convertir los `it.todo` en tests reales en __tests__/mcp/execution-day-breakdown.test.ts:
  - preparación: programa de 3 semanas con mínimos 1, 3 y 6; hábitos `h-a` y `h-b` con `started_on: '2026-09-14'`; día de prueba martes 22 (semana 2). Las tandas se completan encadenando `start` y avanzando el reloj 10 min 1 s (la última se cierra con `current`), empezando en `2026-09-22T15:00:00Z`. Los hábitos se marcan con `handleManageDailyChecks('set', { habit_id, status })` ese mismo día;
  - US-B4-AS1: 2 tandas y `h-a`, `h-b` cumplidos → `handleGetToday()` devuelve `evaluacion_dia` igual a `{ tandas_completadas: 2, min_requerido: 3, cumplio_tandas: false, cumplio_habitos: true, day_fulfilled: false }`, y `handleGetComplianceReport({ from: '2026-09-22', to: '2026-09-22' })` devuelve lo mismo en `dias[0].evaluacion_dia`;
  - US-B4-AS2: 3 tandas, `h-a` en `fallado` y `h-b` cumplido → `{ tandas_completadas: 3, min_requerido: 3, cumplio_tandas: true, cumplio_habitos: false, day_fulfilled: false }`;
  - US-B4-AS3: 3 tandas, `h-a` cumplido y `h-b` sin registro → `cumplio_habitos: false` y `day_fulfilled: false`;
  - US-B4-AS4: además un hábito `h-gym` con `days_of_week: [1, 4, 5, 6]`; el martes 22, con 3 tandas y `h-a` y `h-b` cumplidos → `cumplio_habitos: true` y `day_fulfilled: true`;
  - US-B4-AS5: a `2026-09-12T20:00:00Z`, `get_today` → `evaluacion_dia === null`, y `get_compliance_report { from: '2026-09-12', to: '2026-09-12' }` → `dias[0].evaluacion_dia === null`;
  - US-B4-AS6 [regresión]: `buildTodayFooterView` (lib/execution/today-view.ts), con una entrada que además trae `evaluacion_dia`, devuelve solo las claves `checks`, `tandasLine` y `dayFulfilledLine`, y ningún texto contiene "mínimo" ni "faltan";
  - US-B4-AS7: hábito `h-gym` con `started_on: '2026-09-28'` → `get_compliance_report { program_week_id: 'pw-01' }` no lo trae en `habitos`. Tras `runExecutionTick` a `2026-09-21T00:05:00Z`, el `payload.habits` de pw-01 tampoco;
  - confirmar el RED de todos salvo AS6. Commit: `test(002): US-B4 escenarios en rojo (desglose del día)`.

### Implementation for User Story B4

- [X] T015 [US-B4] IMPL En lib/domain/execution.ts, `export interface DayBreakdown { tandas_completadas: number; min_requerido: number; cumplio_tandas: boolean; cumplio_habitos: boolean; day_fulfilled: boolean }` y `export function describeDay(input: EvaluateDayInput): DayBreakdown | null`: llama a `evaluateDay` y traduce `tandasOk`, `habitsOk` y `fulfilled`, sin duplicar la regla. `evaluateDay` no cambia.
- [X] T016 [US-B4] IMPL En lib/execution/today.ts, `TodayPayload.evaluacion_dia: DayBreakdown | null` con `describeDay` sobre la misma entrada que hoy; `day_fulfilled` sale de ese desglose, con el mismo valor de antes.
- [X] T017 [US-B4] IMPL En lib/execution/compliance.ts, `ComplianceDay.evaluacion_dia` con `describeDay` (se conserva `evaluacion`), y `habitos` omite los hábitos con `total === 0`.
- [X] T018 [US-B4] IMPL Descripciones de `get_today` y `get_compliance_report` en mcp-server/index.ts (`TOOLS_LIST` y `mcpServer.tool`): `evaluacion_dia` y la omisión de hábitos sin días activos. GREEN con los tests de la fase y `npm run test:all`. Commit: `feat(002): US-B4 evaluación desglosada del día`.
- [X] T019 [US-B4] VERIFY Lo hace el orquestador: pasos 1, 2 y 4 de quickstart.md (US-B4) en local, y Hoy a 375 px y en escritorio sin mínimo ni faltantes y sin errores de consola. US-B4-AS8 `[manual]` quedó verificado el 2026-09-12 (specs/002-ejecucion-ajustes/quickstart.md)

**Checkpoint**: US-B4 funciona sola.

---

## Phase 6: User Story B3 - Ver cuántas veces abrí el plan (Priority: P2)

**Goal**: `aperturas_plan` en el reporte de cumplimiento (FR-B09) y su total en el reporte congelado
y el correo (FR-B10), sin pantalla nueva (FR-B11). Depende de US-B1, por las aperturas de planeación.

**Independent Test**: tres aperturas en una semana (la tercera con razón), el cumplimiento de esa
semana y su reporte congelado.

### Tests for User Story B3 (MANDATORY — RED antes de implementar) ⚠️

- [X] T020 [US-B3] TEST Convertir los `it.todo` en tests reales en __tests__/mcp/execution-plan-openings.test.ts (programa de 2 semanas):
  - US-B3-AS1: a `2026-09-15T15:00:00Z`, dos veces `open_view {}` y luego `open_view { reason: 'reviso antes del parcial' }` → `handleGetComplianceReport({ program_week_id: 'pw-01' })` devuelve `aperturas_plan` igual a `{ libres_usadas: 2, con_razon: 1, total: 3, razones: ['reviso antes del parcial'] }`;
  - US-B3-AS2: sin aperturas → `{ libres_usadas: 0, con_razon: 0, total: 0, razones: [] }`, nunca `null` ni ausente;
  - US-B3-AS3: `open_view {}` a `2026-09-14T15:00:00Z` y a `2026-09-21T15:00:00Z` → a `2026-09-21T16:00:00Z`, `get_compliance_report { from: '2026-09-14', to: '2026-09-20' }` → `total: 1`;
  - US-B3-AS4: a `2026-09-13T20:00:00Z`, dos veces `open_view { program_week_id: 'pw-01' }` → `get_compliance_report { from: '2026-09-13', to: '2026-09-20' }` → `total: 0`;
  - US-B3-AS5: las 3 aperturas de AS1; `runExecutionTick` a `2026-09-21T00:05:00Z` → `handleManageWeeklyReport('read', { program_week_id: 'pw-01' })` devuelve `payload.aperturas_plan` igual a `{ total: 3, con_razon: 1, libres_usadas: 2 }`, sin `plan_openings`, y `renderReportText(payload)` contiene `Aperturas del plan: 3 (1 con razón)`;
  - sin ID, `it('compatibilidad: un payload congelado con plan_openings conserva su línea')`: `renderReportText` de un payload con `plan_openings: 1` y sin `aperturas_plan` contiene `Aperturas del plan: 1` (nace en verde);
  - ajustar US9-AS1 en __tests__/mcp/plan-views.test.ts (línea 88): `payload.plan_openings` pasa a ser `payload.aperturas_plan` igual a `{ total: 3, con_razon: 1, libres_usadas: 2 }`;
  - confirmar el RED. Commit: `test(002): US-B3 escenarios en rojo (aperturas del plan)`.

### Implementation for User Story B3

- [X] T021 [US-B3] IMPL `fetchAllPlanViewsFromDb(): Promise<PlanViewRecord[]>` en lib/db/execution-pg.ts, con `SELECT * FROM plan_views ORDER BY viewed_at ASC`.
- [X] T022 [US-B3] IMPL En lib/execution/compliance.ts:
  - exportar la función pura `summarizePlanOpenings(views: PlanViewRecord[], from: string, to: string, cutoff: Date)`, que devuelve `{ libres_usadas: number; con_razon: number; total: number; razones: string[] }`: solo `surface === 'semana'`, `localParts(viewed_at).dateKey` dentro de `[from, to]` y `new Date(viewed_at) <= cutoff`. `razones` son las de las aperturas `was_gated` con `reason` no vacía, en orden de `viewed_at`;
  - `getCompliance` suma `fetchAllPlanViewsFromDb()` a su `Promise.all` y agrega `aperturas_plan` a `ComplianceResult`.
- [X] T023 [US-B3] IMPL En lib/execution/report.ts:
  - `BuildReportPayloadInput` agrega `aperturas_plan?: { total: number; con_razon: number; libres_usadas: number }` y marca `plan_openings` como `@deprecated`, solo para payloads congelados antes de la 002;
  - `renderReportText` escribe `Aperturas del plan: {total}`, más ` ({con_razon} con razón)` si `con_razon > 0`. Sin `aperturas_plan` pero con `plan_openings`, la línea anterior (contracts/notifications.md).
- [X] T024 [US-B3] IMPL `freezeOneWeek` en lib/execution/tick.ts y `assembleReportInput` en lib/execution/handlers.ts:
  - `aperturas_plan: { total, con_razon, libres_usadas }` tomado de `compliance.aperturas_plan`;
  - dejar de escribir `plan_openings`, quitar `countGatedPlanOpenings` de ambos imports y eliminarla de lib/execution/planning.ts.
- [X] T025 [US-B3] IMPL Descripción de `get_compliance_report` en mcp-server/index.ts (`TOOLS_LIST` y `mcpServer.tool`) con `aperturas_plan`. GREEN con los tests de la fase, __tests__/mcp/plan-views.test.ts, __tests__/mcp/weekly-report.test.ts y `npm run test:all`. Commit: `feat(002): US-B3 aperturas del plan en el cumplimiento y el reporte`.
- [ ] T026 [US-B3] VERIFY Lo hace el orquestador: `get_compliance_report` con aperturas en local (quickstart.md, US-B3, paso 1). El paso 2 se valida en producción tras el congelamiento del domingo 20 (specs/002-ejecucion-ajustes/quickstart.md) — **Local verificado el 2026-09-13; falta el paso 2 en producción, tras el congelamiento del domingo 20.**

**Checkpoint**: US-B3 y US-B4 funcionan. Fin del bloque 2: PR a `main` y despliegue antes del domingo
2026-09-20 a las 19:00.

---

## Phase 7: User Story B5 - Registrar la fricción del teléfono y sacarla cuando me irrita (Priority: P3)

**Goal**: `manage_friction` con el límite de 2 (FR-B16 a FR-B19 y FR-B22), el retiro por irritación en
el tick (FR-B20), la mención en el reporte (FR-B21) y sin bloquear nada (FR-B23).

**Independent Test**: dos medidas, una tercera rechazada, verificación, dos semanas seguidas con 7 u
8, el tick dos veces y el reporte congelado.

### Tests for User Story B5 (MANDATORY — RED antes de implementar) ⚠️

- [X] T027 [P] [US-B5] TEST Migración en __tests__/db/friction-schema.test.ts (pg-mem):
  - `012_friction.sql` corre y crea `friction_measures` y `friction_ratings`;
  - `enabled_slot` admite varias filas con `NULL` y rechaza, con un `INSERT` simple de una fila nueva, una segunda fila con `'a'` (código `23505`, con `enabled_slot` en el mensaje). Esa violación no se provoca con `INSERT … ON CONFLICT … DO UPDATE`, que corrompe el índice de pg-mem (research.md, R-B08);
  - el reclamo condicionado (`UPDATE … WHERE id = $1 AND enabled_slot IS NULL AND NOT EXISTS (SELECT 1 FROM friction_measures f2 WHERE f2.enabled_slot = $slot) RETURNING *`) devuelve 0 filas, sin error, cuando el slot está ocupado, y 1 fila cuando está libre;
  - `score` rechaza 11 por el CHECK, y la FK de `friction_ratings.program_week_id` rechaza una semana inexistente;
  - `reset()` deja las dos tablas vacías.
- [X] T028 [P] [US-B5] TEST Esquemas en __tests__/validations/friction-schemas.test.ts:
  - `FrictionMeasureSchema` acepta `sin_biometria`, `clave_larga`, `escala_grises`, `redes_fuera_home` y `app_desinstalada`, y rechaza `celular_afuera` y las claves extra;
  - `FrictionRateSchema` acepta `score` entero de 0 a 10 con `program_week_id` opcional, y rechaza 11, -1, 7.5 y las claves extra.
- [X] T029 [US-B5] TEST Convertir los `it.todo` en tests reales en __tests__/mcp/execution-friction.test.ts (programa de 3 semanas; `handleManageFriction` desde lib/execution/handlers.ts):
  - US-B5-AS1: habilitar `sin_biometria` y `escala_grises` → `read` con `total_activas: 2`. `enable { measure_key: 'clave_larga' }` → `code: 'LIMITE_FRICCION'` y `message` que coincide con `/estrés/` y con `/vale 0/`;
  - US-B5-AS2: `enable { measure_key: 'celular_afuera' }` → `DATOS_INVALIDOS`;
  - US-B5-AS3: una medida habilitada sin verificar → `read` con `confirmada: false`. `verify` → `read` con `confirmada: true` y `verified_at` presente. `verify` de una medida no habilitada → `NO_ENCONTRADO`;
  - US-B5-AS4: `disable` → la medida queda sin `enabled_slot`, con `drop_reason: 'manual'`, y `read.total_activas` baja. Repetir `disable` → `ya_deshabilitada: true` con el mismo `disabled_at`. `enable` de una ya habilitada → `ya_habilitada: true` con el mismo `started_on`;
  - US-B5-AS5: a `2026-09-21T15:00:00Z`, `rate { score: 8 }` y después `rate { score: 6 }` → una sola calificación de pw-02, con `score: 6`. `rate { score: 11 }` → `DATOS_INVALIDOS`, y `rate { score: 5, program_week_id: 'pw-03' }` → `FECHA_FUTURA`;
  - US-B5-AS6: `enable sin_biometria` a `2026-09-14T15:00:00Z`, `enable escala_grises` a `2026-09-21T15:00:00Z`, `rate { score: 7 }` a `2026-09-26T15:00:00Z` (semana 2) y `rate { score: 8 }` a `2026-09-28T15:00:00Z` (semana 3). `runExecutionTick` con fakes a `2026-09-28T15:01:00Z` → `escala_grises` deshabilitada con `drop_reason: 'irritacion'`, `sin_biometria` sigue habilitada y ningún aviso del fake menciona fricción. Segunda corrida a `15:02:00Z` → mismo `disabled_at` y `sin_biometria` sigue habilitada;
  - US-B5-AS7: con dos medidas habilitadas, calificaciones 8 en pw-01, 6 en pw-02 y 8 en pw-03, cada una hecha dentro de su semana → tras el tick no se retira ninguna;
  - US-B5-AS8: se repite la preparación de AS6 y se corre `runExecutionTick` a `2026-10-05T00:05:00Z` (domingo 4 de octubre, 19:05) → el `payload.friccion_retiradas` de pw-03 contiene `{ measure_key: 'escala_grises', fecha: '2026-09-28' }`, y `renderReportText` contiene `Fricción: se retiró "escala de grises" por irritación.`;
  - US-B5-AS9: dos habilitadas y `rate { score: 5 }` en la semana en curso → `read` con `total_activas: 2`, `limite: 2` e `irritacion_semana_actual: 5`. Sin calificación → `irritacion_semana_actual: null`.
- [X] T030 [US-B5] TEST Ajustar __tests__/mcp/all-tools.test.ts:28-29 y __tests__/mcp/mcp-crud-tools.test.ts:26-27 a 31 herramientas, con `toContain('manage_friction')`. Confirmar el RED de T027 a T030. Commit: `test(002): US-B5 escenarios en rojo (fricción del teléfono)`.

### Implementation for User Story B5

- [X] T031 [US-B5] IMPL Migración db/migrations/012_friction.sql con el SQL literal de data-model.md: `enabled_slot TEXT UNIQUE` ("'a' | 'b' mientras está habilitada; NULL si no (máximo 2)") y `score INT NOT NULL CHECK (score BETWEEN 0 AND 10)`. En __tests__/helpers/test-db.ts, agregar `'friction_ratings'` y `'friction_measures'` al principio de la lista de `reset()`.
- [X] T032 [P] [US-B5] IMPL Esquemas y constantes:
  - en lib/validations/schemas.ts, `FRICTION_MEASURE_KEYS` con las 5 claves, `FrictionMeasureSchema = z.object({ measure_key: z.enum(FRICTION_MEASURE_KEYS) }).strict()`, `FrictionRateSchema = z.object({ score: z.number().int().min(0).max(10), program_week_id: z.string().min(1).optional() }).strict()` y `'LIMITE_FRICCION'` en `ExecutionErrorCode`;
  - en lib/execution/constants.ts, `FRICTION_MAX_ENABLED = 2`, `FRICTION_SLOTS = ['a', 'b'] as const`, `FRICTION_IRRITATION_THRESHOLD = 7` y `FRICTION_LIMIT_MESSAGE` con el texto literal de contracts/mcp-tools.md.
- [X] T033 [US-B5] IMPL Repositorio en lib/db/execution-pg.ts:
  - tipos `FrictionMeasureRecord` y `FrictionRatingRecord`;
  - `fetchFrictionMeasuresFromDb(id?)`;
  - `ensureFrictionMeasureRowInDb(id)`: `INSERT INTO friction_measures (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`. Nunca toca `enabled_slot`;
  - `claimFrictionSlotInDb(id, slot, startedOn, now)`: `UPDATE friction_measures SET enabled_slot = $2, started_on = $3, enabled_at = $4, verified_at = NULL, disabled_at = NULL, drop_reason = NULL WHERE id = $1 AND enabled_slot IS NULL AND NOT EXISTS (SELECT 1 FROM friction_measures f2 WHERE f2.enabled_slot = $2) RETURNING *`; devuelve la fila o `null`. **Prohibido** habilitar con `INSERT … ON CONFLICT (id) DO UPDATE SET enabled_slot = …`: si choca con `enabled_slot`, corrompe el índice de pg-mem (research.md, R-B08);
  - `disableFrictionMeasureInDb(id, reason, now, client?)`: `UPDATE … SET enabled_slot = NULL, disabled_at = $, drop_reason = $ WHERE id = $1 AND enabled_slot IS NOT NULL RETURNING *`;
  - `verifyFrictionMeasureInDb(id, now)`: `UPDATE … SET verified_at = $ WHERE id = $1 AND enabled_slot IS NOT NULL RETURNING *`;
  - `fetchFrictionRatingsFromDb(id?)`;
  - `saveFrictionRatingToDb({ program_week_id, score, rated_at })`: `ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score, rated_at = EXCLUDED.rated_at`, conservando `drop_applied_at` y `dropped_measure_id`;
  - `claimIrritationDropInDb(ratingId, measureId | null, now, client)`: `UPDATE … SET drop_applied_at = $, dropped_measure_id = $ WHERE id = $1 AND drop_applied_at IS NULL RETURNING *`.
- [X] T034 [US-B5] IMPL Servicio lib/execution/friction.ts:
  - `enableFriction(key, now)`, en cuatro pasos:
    1. `ensureFrictionMeasureRowInDb(key)`;
    2. si la fila ya tiene `enabled_slot`, éxito con `ya_habilitada: true` y sin cambios;
    3. para cada slot de `FRICTION_SLOTS` (`'a'` y luego `'b'`), `claimFrictionSlotInDb(key, slot, localParts(now).dateKey, now)`. Si devuelve fila, éxito con `ya_habilitada: false`. Si lanza una violación de UNIQUE sobre `enabled_slot` (código `23505` con `enabled_slot` en el mensaje o el detalle, que solo pasa con dos habilitaciones simultáneas en Postgres real), se trata como slot ocupado y se sigue con el siguiente. Cualquier otro error se relanza;
    4. si no quedó ningún slot, `LIMITE_FRICCION` con `FRICTION_LIMIT_MESSAGE`;
  - `disableFriction(key, now)`: si no estaba habilitada, éxito con `ya_deshabilitada: true`;
  - `verifyFriction(key, now)`: `NO_ENCONTRADO` si no está habilitada;
  - `rateFriction({ score, program_week_id }, now)`: la semana sale del id o de la que contiene hoy; `NO_ENCONTRADO` si no hay; `FECHA_FUTURA` si `starts_on > hoy`;
  - `readFriction(now)`: `confirmada = verified_at != null && verified_at >= enabled_at`;
  - `applyIrritationDrops(now)`: recorre los pares de semanas consecutivas por `week_number`. Si las dos calificaciones son ≥ `FRICTION_IRRITATION_THRESHOLD` y la posterior no tiene `drop_applied_at`, dentro de `withExecutionTransaction`: `claimIrritationDropInDb` con la habilitada de mayor `enabled_at` (o `null`) y, si el claim devolvió fila y había medida, `disableFrictionMeasureInDb(id, 'irritacion', now, client)`. Devuelve cuántas retiró y registra `[execution-tick] fricción retirada por irritación: <clave>` solo cuando retira;
  - `listIrritationDropsInRange(from, to, cutoff)`: `[{ measure_key, fecha }]` de las medidas con `drop_reason = 'irritacion'`, `localParts(disabled_at).dateKey` dentro de `[from, to]` y `disabled_at <= cutoff`.
- [X] T035 [US-B5] IMPL Integración:
  - en lib/execution/handlers.ts, `export type ManageFrictionAction = 'enable' | 'disable' | 'verify' | 'rate' | 'read'` y `handleManageFriction(action, data?, now = new Date())`, con el mismo try/catch y la misma forma de error que los demás handlers;
  - en mcp-server/tools-handler.ts, re-exportar `handleManageFriction`;
  - en lib/execution/tick.ts, `await applyIrritationDrops(now)` después del bloque de `finalizeElapsed` y antes de `revertStuckSendingToFrozenInDb` y `freezeDueWeeks`, sin cambiar `TickResult`. En `freezeOneWeek`, `friccion_retiradas: await listIrritationDropsInRange(from, to, cutoff)`;
  - en `assembleReportInput` (lib/execution/handlers.ts), lo mismo con el corte de la vista previa;
  - en lib/execution/report.ts, `friccion_retiradas?: { measure_key: string; fecha: string }[]` en `BuildReportPayloadInput`. `renderReportText` agrega `Fricción: se retiró "{etiqueta}" por irritación.` por cada elemento, después de la línea de aperturas, con las etiquetas de contracts/notifications.md.
- [X] T036 [US-B5] IMPL Registro en mcp-server/index.ts:
  - `manage_friction` en `TOOLS_LIST`, con la descripción y el `inputSchema` de contracts/mcp-tools.md (`action` enum `['enable', 'disable', 'verify', 'rate', 'read']`);
  - `mcpServer.tool('manage_friction', …, { action: z.enum([...]), data: z.any().optional() }, …)`, igual que `plan_week`;
  - no tocar app/api/execution/route.ts;
  - GREEN con los tests de la fase y `npm run test:all`. Commit: `feat(002): US-B5 fricción del teléfono con límite de 2 y retiro por irritación`.
- [ ] T037 [US-B5] VERIFY Lo hace el orquestador, en local: `npm run db:migrate` contra la base local, `npm run mcp:start:http`, `curl http://localhost:3001/health`, `tools/list` con 31 herramientas y `manage_friction read`. En producción, tras desplegar, quickstart.md US-B5 (specs/002-ejecucion-ajustes/quickstart.md) — **Local verificado el 2026-09-13 (migración 012, 31 herramientas, límite de 2, verify, rate y disable); falta la validación en producción tras desplegar.**

**Checkpoint**: las cinco historias funcionan. Fin del bloque 3: PR a `main`.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: documentación, cierre y pasos fuera de esta máquina

- [X] T038 [P] Documentación:
  - mcp-server/instructions.md: la resolución de la semana para planear, la apertura de planeación sin compuerta, y en `manage_friction` que Pure solo registra, el máximo de 2, el retiro por irritación y que `celular_afuera` es un hábito;
  - mcp-server/README.md: catálogo de 31 herramientas, sección de `manage_friction` y `plan_week`, `get_today` y `get_compliance_report` actualizados;
  - CLAUDE.md, sección "Execution Module": tablas `friction_measures` y `friction_ratings`.
- [X] T039 [P] Nota "Actualizado por la 002" al principio de specs/001-modulo-ejecucion/contracts/mcp-tools.md, con enlace a specs/002-ejecucion-ajustes/contracts/mcp-tools.md para `plan_week`, `rehearse`, `get_today`, `get_compliance_report` y el payload del reporte, sin reescribir la 001.
- [ ] T040 VERIFY Cierre: `npm run test:all` en verde, `/speckit-converge` sin tareas pendientes y quickstart.md completo (specs/002-ejecucion-ajustes/quickstart.md)
- [ ] T041 MANUAL Desplegar cada bloque en el servidor con el procedimiento de docs/despliegue-modulo-ejecucion.md: el bloque 2 antes del domingo 20 a las 19:00, y el bloque 3 con `docker compose exec pure-mcp npm run db:migrate`. Lo ejecuta el agente del servidor, porque esta máquina no tiene acceso a él
- [ ] T042 MANUAL Andres habilita desde el asistente solo las medidas de fricción que de verdad tenga puestas en el teléfono y las verifica (quickstart.md US-B5, pasos 3 y 4): solo él sabe cuáles tiene

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)**: bloquea todas las historias.
- **US-B1 (Phase 3)**: depende de Foundational.
- **US-B2 (Phase 4)**: depende solo de Foundational; agrega un único archivo de test.
- **US-B4 (Phase 5)**: depende de Foundational.
- **US-B3 (Phase 6)**: depende de US-B1 (US-B3-AS4 usa la apertura de planeación). Comparte
  `compliance.ts` y `mcp-server/index.ts` con US-B4, así que va después.
- **US-B5 (Phase 7)**: depende de US-B3 y US-B4, porque toca `report.ts`, `tick.ts`, `handlers.ts`,
  `schemas.ts` e `index.ts`.
- **Polish (Phase 8)**: al final.

### Within Each User Story

- TEST (commit RED) → IMPL (commit GREEN) → VERIFY.
- US-B2 no tiene IMPL: su RED se demuestra por mutación (research.md, R-B05).

### Parallel Opportunities

- T009 [P] junto al resto de US-B1 (solo toca `schemas.ts`).
- T012 [P]: US-B2 solo agrega su archivo de test.
- T027 y T028 [P]: migración y esquemas de fricción en archivos de test distintos.
- T038 y T039 [P]: documentación.
- Las historias se implementan en serie: comparten archivos y, en paralelo, los tests en rojo de una
  harían fallar la puerta `npm run test:all` de la otra.

---

## Parallel Example: User Story B5

```bash
# Tests de estructura y de esquemas de US-B5 a la vez:
Task: "TEST migración 012 en __tests__/db/friction-schema.test.ts"
Task: "TEST esquemas de fricción en __tests__/validations/friction-schemas.test.ts"
```

---

## Ejecución por agentes

El orquestador (Claude) lanza un agente por fila, en orden, y audita cada entrega antes de lanzar la
siguiente. Todos corren con el modelo barato (Haiku). Si una auditoría encuentra que el trabajo no
alcanza, se le reporta a Andres y se propone escalar esa fila, en vez de subir de modelo en silencio.

| Agente | Tareas | Archivos que puede tocar | Entrega |
|---|---|---|---|
| A · Trazabilidad y regresión | T003, T004, T012 | __tests__/build/spec-traceability.test.ts; los 5 archivos de test nuevos de la matriz (solo placeholders en T004); __tests__/mcp/execution-tandas-olvidada.test.ts; lib/execution/tandas.ts solo para la mutación temporal, que debe quedar revertida | 2 commits de test, `test:all` en verde |
| B · Semana a planear | T005–T010 | __tests__/mcp/execution-planning-week.test.ts; lib/execution/program.ts, routine.ts y planning.ts; lib/execution/handlers.ts (solo el comentario de `handlePlanWeek`); lib/validations/schemas.ts (solo `PlanWeekOpenViewSchema`); mcp-server/index.ts (solo `plan_week` y la descripción de `rehearse`) | RED + GREEN |
| C · Desglose y aperturas | T014–T018, después T020–T025 | __tests__/mcp/execution-day-breakdown.test.ts y execution-plan-openings.test.ts; __tests__/mcp/plan-views.test.ts (solo US9-AS1); lib/domain/execution.ts; lib/execution/today.ts, compliance.ts, report.ts, tick.ts, handlers.ts (solo `assembleReportInput`) y planning.ts (solo quitar `countGatedPlanOpenings`); lib/db/execution-pg.ts (solo `fetchAllPlanViewsFromDb`); mcp-server/index.ts (solo `get_today` y `get_compliance_report`) | 2 RED + 2 GREEN |
| D · Fricción | T027–T036 | db/migrations/012_friction.sql; __tests__/helpers/test-db.ts; __tests__/db/friction-schema.test.ts, __tests__/validations/friction-schemas.test.ts y __tests__/mcp/execution-friction.test.ts; __tests__/mcp/all-tools.test.ts y mcp-crud-tools.test.ts (solo el conteo y el nombre); lib/validations/schemas.ts; lib/execution/constants.ts, friction.ts, handlers.ts, tick.ts y report.ts; lib/db/execution-pg.ts; mcp-server/tools-handler.ts e index.ts | RED + GREEN |
| E · Documentación | T038, T039 | mcp-server/instructions.md, mcp-server/README.md, CLAUDE.md, specs/001-modulo-ejecucion/contracts/mcp-tools.md | 1 commit `docs(002)` |
| Orquestador | T001, T002, T011, T013, T019, T026, T037, T040 | — | Auditoría de cada entrega |

La auditoría de cada agente revisa cinco cosas:

1. el commit RED existe antes del GREEN, y la salida del RED muestra la razón esperada;
2. los escenarios marcados [regresión] se declaran en el commit RED;
3. `npm run test:all` está en verde en el commit GREEN;
4. el diff se limita a los archivos de su fila;
5. cada test hace lo que dice su escenario en spec.md.

---

## Implementation Strategy

### MVP First (bloque 1)

1. Setup y Foundational.
2. US-B1 y US-B2.
3. **STOP and VALIDATE**: T011 y T013, y luego un PR a `main`. No hay urgencia de desplegar: el
   domingo 13 la planeación ya funciona en producción.

### Incremental Delivery

1. Bloque 2: US-B4 y US-B3 → PR → despliegue antes del domingo 2026-09-20 a las 19:00, que es cuando
   se congela el primer reporte.
2. Bloque 3: US-B5 → PR → despliegue con `npm run db:migrate` en `pure-mcp`.
3. Cada bloque suma valor sin romper los anteriores.

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- Commits en la rama:
  - uno RED (`test(002): …`) y uno GREEN (`feat(002): …`) por historia;
  - en español, con un cuerpo que explique el porqué, y sin trailer `Co-Authored-By`;
  - cada agente hace `git add` solo de los archivos de su fila, nunca `git add -A`;
  - `main` solo recibe la rama con `npm run test:all` en verde.
- Verificar que cada test falla antes de implementar, por la razón esperada y no por un import roto.
- Nada de esta feature cambia la web: si una tarea parece exigir tocar `app/` o `components/`, se
  detiene y se consulta al orquestador.
