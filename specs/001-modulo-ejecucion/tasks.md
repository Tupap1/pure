---

description: "Lista de tareas del Módulo de Ejecución — TDD obligatorio (override de PURE OS)"
---

# Tasks: Módulo de Ejecución

**Input**: Design documents from `/specs/001-modulo-ejecucion/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (mcp-tools.md, web-api.md, notifications.md), quickstart.md

**Tests**: MANDATORY. Lo exige el Principio II de la Constitución de PURE OS (Test-First, NO
NEGOCIABLE). Cada escenario de aceptación no manual `USn-ASm` de spec.md se convierte en un test
nombrado por su ID. Cada historia empieza con sus tareas de test (RED), que DEBEN fallar por la
razón esperada antes de su implementación (GREEN), y termina con una verificación empírica
(Principio IV).

**Organization**: tareas agrupadas por historia, para implementar y probar cada una por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1…US9)
- La descripción empieza con el tipo de tarea:
  - `TEST`: tests en rojo;
  - `IMPL`: implementación hasta verde;
  - `VERIFY`: verificación empírica (Principio IV);
  - `MANUAL`: paso que hace Andres.

## Path Conventions (PURE OS)

- Dominio puro: `lib/domain/`. Servicios y handlers compartidos por la web y el MCP: `lib/execution/`.
- Repositorio Postgres: `lib/db/execution-pg.ts`. Validación Zod: `lib/validations/schemas.ts`.
- Migraciones: `db/migrations/NNN_nombre.sql`. Deben correr en pg-mem (Principio III).
- MCP:
  - registrar cada tool en `TOOLS_LIST` y con `mcpServer.tool(...)` en `mcp-server/index.ts`;
  - re-exportar el handler en `mcp-server/tools-handler.ts`.
- Web: `app/`, `app/api/`, `components/`, `lib/hooks/`.
- Tests: `__tests__/`. Las pruebas contra base usan `createTestDb()` de
  `__tests__/helpers/test-db.ts`, y el tiempo se controla con `vi.setSystemTime`.
- Los scripts de Spec Kit en Windows se corren con `PYTHONUTF8=1`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: línea base y configuración compartida

- [X] T001 Confirmar la rama `001-modulo-ejecucion` y la línea base: `npm run test:all` en verde antes de tocar código (package.json)
- [X] T002 [P] Agregar la dependencia `web-push` y en devDependencies `@types/web-push`, con `npm install` (package.json). El correo NO usa `nodemailer`: sale por la API HTTP de ZeptoMail con `fetch`
- [X] T003 [P] Declarar las variables del módulo en .env.example y docker-compose.yml, sin valores secretos:
  - .env.example, sección "Módulo de Ejecución": `PURE_TZ`, `EXECUTION_SCHEDULER=off`, `REPORT_OWNER_NAME`, `PUBLIC_WEB_URL`, `ZEPTOMAIL_TOKEN`, `ZEPTOMAIL_URL`, `REPORT_FROM`, `REPORT_FROM_NAME`, `REPORT_REPLY_TO`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`, todas vacías o con su valor por defecto no secreto;
  - docker-compose.yml, servicio `pure-web`: `PURE_TZ` y `VAPID_*`;
  - docker-compose.yml, servicio `pure-mcp`: `EXECUTION_SCHEDULER=on`, `ZEPTOMAIL_*`, `REPORT_*`, `VAPID_*` y `PUBLIC_WEB_URL`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: la infraestructura que toda historia necesita

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase

- [X] T004 TEST Test de trazabilidad en __tests__/build/spec-traceability.test.ts:
  - leer specs/001-modulo-ejecucion/spec.md y extraer los IDs `US\d+-AS\d+`, excluyendo los marcados `[manual]` (US4-AS1 y US4-AS2);
  - exigir que cada ID aparezca en algún `it(` o `it.todo(` bajo __tests__/;
  - exigir que ningún test cite un ID que no exista en la spec;
  - confirmar que falla (RED) porque todavía no hay tests.
- [X] T005 Crear los placeholders `it.todo('USn-ASm · <resumen>')` para los 59 escenarios no manuales en los archivos de __tests__/ que lista la matriz de specs/001-modulo-ejecucion/quickstart.md:
  - un archivo por fila de la matriz;
  - cada archivo con `describe('[001] USn — <historia>')`;
  - T004 debe quedar en verde sin romper `npm run test:all`.
- [X] T006 [P] TEST Zona horaria en __tests__/domain/execution-time.test.ts (FR-006, US1-AS7):
  - `localParts('2026-09-15T01:30:00Z')` devuelve `{ dateKey: '2026-09-14', dayOfWeek: 1, minutes: 1230 }`;
  - `localDateTimeToInstant('2026-09-15', '03:00')` devuelve `2026-09-15T08:00:00.000Z`;
  - `addDays` y `mondayOf`;
  - un instante `…T04:55:00Z` cae en el día anterior de Bogotá.
- [X] T007 IMPL lib/execution/time.ts y lib/execution/constants.ts:
  - time.ts resuelve `PURE_TZ` (por defecto `America/Bogota`) con `Intl.DateTimeFormat`, igual que lib/integrations/fireflies-sync.ts:14, y exporta `localParts`, `localDateTimeToInstant`, `addDays` y `mondayOf`;
  - constants.ts: `TANDA_MINUTES=10` (rango 5–25), `TRIGGER_WINDOW_MINUTES=240`, `DAY_LOCK_TIME='03:00'`, `REPORT_FREEZE='19:00'`, `REPORT_NOTE_MINUTES=60`, `CUE_TEXT 5–80`, `ACTION_TEXT 5–90`, `INTERRUPT_REASON ≤140`, `USER_NOTE ≤400`, `VERDICT` (≥6/7 cumplida, ≤3/7 fallida, resto parcial) y `REPORT_MAX_ATTEMPTS=3`.
- [X] T008 [P] TEST Esquema en __tests__/db/execution-schema.test.ts con `createTestDb()`:
  - la migración 008 corre en pg-mem;
  - `running_lock TEXT UNIQUE` admite varios NULL y rechaza un segundo `'running'` (FR-004);
  - borrar un `schedules` deja `routine_slots.schedule_id` en NULL;
  - `harness.reset()` vacía las tablas nuevas.
- [X] T009 IMPL db/migrations/008_execution_core.sql y el `reset()` de __tests__/helpers/test-db.ts:
  - usar el SQL exacto de specs/001-modulo-ejecucion/data-model.md: `program_weeks`, `habits`, `daily_checks`, `routine_slots`, `slot_outcomes`, `plan_rehearsals`, `tasks` con `CHECK (estimated_tandas BETWEEN 1 AND 3)` y `tandas` con `running_lock TEXT UNIQUE`;
  - sin plpgsql, sin `AT TIME ZONE` y sin índices parciales;
  - agregar a `reset()` las tablas nuevas hijas primero (`tandas`, `slot_outcomes`, `plan_rehearsals`, `daily_checks`, `tasks`, `routine_slots`, `habits`, `program_weeks`) antes de la lista actual.
- [X] T010 [P] TEST Validación en __tests__/validations/execution-schemas.test.ts:
  - un disparador con una clave extra (`default_tandas`, `duration`, `how`) → `SOBRE_ESPECIFICACION` (FR-009);
  - "`cue_text` 5–80", "`action_text` 5–90";
  - "`anchor_time` obligatorio salvo en `tras_clase`"; "`kind='habito'` exige `habit_id`";
  - "`periodicity ≠ semanal` solo con `days_of_week=[6]`";
  - "`starts_on` es lunes" → `NO_ES_LUNES` (FR-017);
  - "`planned_minutes` 5–25", "`estimated_tandas` 1–3", "`interrupt_reason` 1–140", "`user_note` ≤ 400", "`strength` 0–10", "`note` ≤ 200".
- [X] T011 IMPL Sección "Módulo de Ejecución" en lib/validations/schemas.ts:
  - esquemas Zod estrictos (`.strict()`) para programa, hábito, check, disparador, respuesta, ensayo, tanda (start, interrupt y update sin campos de tiempo), destinatario (`consented_at` obligatorio), nota de reporte, tarea e intención, con las reglas de T010;
  - un helper que traduzca los errores de Zod a `{ status: 'error', code, message }`.
- [X] T012 TEST `manage_program` en __tests__/mcp/execution-program.test.ts (pg-mem):
  - `init` crea `pw-01…pw-10` desde un lunes;
  - rechaza un día que no es lunes (`NO_ES_LUNES`) y un segundo `init` (`PROGRAMA_EXISTENTE`);
  - `update_week` sobre la semana en curso → `SEMANA_EN_CURSO`, y sobre una futura → OK (US3-AS7);
  - `upsert_habit` y `retire_habit`;
  - ninguna migración inserta datos (FR-040).
- [X] T013 IMPL Repositorio lib/db/execution-pg.ts sobre `pgPool` de lib/db/pg-client.ts:
  - patrón `INSERT … ON CONFLICT (id) DO UPDATE` de lib/db/repository-pg.ts;
  - fetch, save y delete de `program_weeks`, `habits`, `daily_checks`, `routine_slots`, `slot_outcomes`, `plan_rehearsals`, `tasks` y `tandas`;
  - transacciones con `pgPool.connect()` + BEGIN/COMMIT.
- [X] T014 IMPL lib/execution/program.ts y el registro de `manage_program`:
  - lib/execution/handlers.ts: esqueleto con el contrato `{ status, code?, message?, data? }` y `handleManageProgram`;
  - re-export en mcp-server/tools-handler.ts;
  - registro en mcp-server/index.ts: `TOOLS_LIST` + `mcpServer.tool(...)` con `action: z.enum([...])` y `data: z.any().optional()`, como manage_study_blocks (:430);
  - conteo esperado en __tests__/mcp/all-tools.test.ts:29 y __tests__/mcp/mcp-crud-tools.test.ts:27: 20 → 21.

**Checkpoint**: base lista; las historias pueden empezar.

---

## Phase 3: User Story 1 - Tanda de 10 minutos en un toque (Priority: P1) 🎯 MVP

**Goal**: empezar una tanda de 10 minutos con un toque desde Hoy; la tanda se completa sola, no se pausa y cortar antes exige una razón.

**Independent Test**:
- Hoy es la primera pantalla.
- Una tanda arranca en un toque, sobrevive a una recarga y se completa sola a los 10 minutos con el teléfono bloqueado.
- No se puede tener una segunda tanda en curso, y no se puede interrumpir sin razón.

### Tests for User Story 1 (MANDATORY — RED antes de implementar) ⚠️

> Convertir los `it.todo` de US1 en tests reales, correr `npx vitest run <archivo>` y confirmar
> que fallan por la razón esperada. Commit: `test(001): US1 escenarios en rojo`.

- [X] T015 [P] [US1] TEST US1-AS1…US1-AS7 en __tests__/mcp/execution-tandas.test.ts (`createTestDb()` + `vi.setSystemTime`):
  - `start` fija `started_at` con el reloj del servidor y `ends_at` a +10 min;
  - un segundo `start` → `TANDA_EN_CURSO`;
  - a +10 min, cualquier operación deja la tanda `completada` con `actual_minutes=10` y `running_lock` NULL;
  - `finish` antes de tiempo → `TANDA_NO_TERMINADA`;
  - `interrupt` sin razón → `RAZON_REQUERIDA`; con razón → `interrumpida` con los minutos reales;
  - `update` después de las 03:00 del día siguiente → `edited_after_lock=true`;
  - un inicio a las 04:55Z tiene `local_date` del día anterior;
  - `start` con `started_at` en `data` → `DATOS_INVALIDOS`;
  - `finish` o `interrupt` con un `id` inexistente → `NO_ENCONTRADO`.
- [X] T016 [P] [US1] TEST US1-AS8 en __tests__/domain/today-view.test.ts:
  - `secondsLeft` usa `server_now` y el offset `server_now − Date.now()` aunque el reloj local esté desfasado ±5 min;
  - `formatCountdown` devuelve `mm:ss`;
  - sin datos del servidor, el modelo expone el estado "sin conexión" con acción de reintento (caso borde de spec.md).
- [X] T017 [P] [US1] TEST US1-AS9 en __tests__/domain/navigation.test.ts:
  - `HOME_TAB === 'hoy'`;
  - `'hoy'` es el primer elemento de `NAV_ITEMS`;
  - los ítems móviles (`mobile !== false`) no incluyen `'config'` (FR-041).
- [X] T018 [P] [US1] TEST Rutas en __tests__/api/execution-routes.test.ts:
  - `POST /api/execution` rechaza con 400 `DATOS_INVALIDOS` lo que está fuera de la lista blanca (por ejemplo `manage_program:init` o `manage_weekly_report:set_partner`);
  - un error del handler devuelve 400 conservando `code`;
  - `GET /api/execution/today` exporta `dynamic = 'force-dynamic'` y devuelve el payload de `get_today`.

### Implementation for User Story 1

- [X] T019 [US1] IMPL lib/execution/tandas.ts: `finalizeElapsed(now)`, `startTanda`, `finishTanda`, `interruptTanda`, `updateTanda`, `readTandas` y `currentTanda`, según las reglas US1 de specs/001-modulo-ejecucion/plan.md:
  - `running_lock='running'` al iniciar y NULL al cerrar;
  - `locked_at` = 03:00 local del día siguiente;
  - `finish` exige transcurrido ≥ planeado − 30 s;
  - `interrupt_reason` 1–140.
- [X] T020 [US1] IMPL `handleManageTandas` en lib/execution/handlers.ts y su registro:
  - `manage_tandas` en mcp-server/index.ts (`TOOLS_LIST` + `mcpServer.tool`);
  - re-export en mcp-server/tools-handler.ts;
  - conteo de `TOOLS_LIST` +1 en los dos tests.
- [X] T021 [US1] IMPL lib/execution/today.ts:
  - `getToday(now)`, en su parte de tanda: `server_now`, `date`, `week`, `running_tanda`, `tandas_today`;
  - `handleGetToday` y registro de `get_today` en mcp-server/index.ts;
  - conteo de `TOOLS_LIST` +1.
- [X] T022 [P] [US1] IMPL lib/execution/today-view.ts: modelo de vista puro (`secondsLeft`, `formatCountdown`, `clockOffset`, estado sin conexión) según specs/001-modulo-ejecucion/contracts/mcp-tools.md (get_today).
- [X] T023 [US1] IMPL Rutas app/api/execution/route.ts y app/api/execution/today/route.ts:
  - POST con la lista blanca de specs/001-modulo-ejecucion/contracts/web-api.md, try/catch y 400/500;
  - GET con `export const dynamic = 'force-dynamic'`.
- [X] T024 [P] [US1] IMPL Navegación (FR-041) en lib/navigation.ts, lib/hooks/useNavigation.tsx, components/layout/BottomNav.tsx y components/layout/Header.tsx:
  - lib/navigation.ts: `'hoy'` como primer `DashboardTab`, con un ícono lucide monocromo; `HOME_TAB`; flag `mobile?: boolean` con `mobile: false` en `config`;
  - lib/hooks/useNavigation.tsx: vista inicial y fallback de `goBack` → `HOME_TAB` (líneas 38 y 48);
  - components/layout/BottomNav.tsx: filtrar por `mobile !== false`; estado activo en gris sutil según DESIGN.md, en lugar del cian de las líneas 30–34;
  - components/layout/Header.tsx: engranaje `md:hidden` de 44 px → `selectTab('config')`.
- [X] T025 [US1] IMPL lib/hooks/useToday.ts, components/dashboards/TodayDashboard.tsx y app/page.tsx:
  - useToday.ts: fetch a /api/execution/today; offset de reloj con `server_now`; refresco en `visibilitychange` y cada 30 s; acciones start, finish, interrupt y tagSubject vía `POST /api/execution`;
  - TodayDashboard.tsx con tanda en curso: timer `mm:ss` en IBM Plex Mono con `tabular-nums`; "hasta las HH:MM"; botón ghost "Interrumpir" con input de razón ≤ 140;
  - TodayDashboard.tsx sin tanda: "Empezar tanda" primario, a un toque;
  - TodayDashboard.tsx al terminar: chips de materia desde `usePureData().subjects`;
  - TodayDashboard.tsx sin conexión: "No hay conexión con Pure" + Reintentar;
  - accesibilidad y estilo: botones ≥ 44 px, `aria-live` una vez por minuto, DESIGN.md;
  - app/page.tsx: `case 'hoy'` y `default` → `<TodayDashboard />`.
- [X] T026 [US1] VERIFY quickstart US1 en specs/001-modulo-ejecucion/quickstart.md:
  - `curl http://localhost:3001/health`;
  - por MCP: `manage_tandas` start, current e interrupt;
  - en el navegador (375×812 y escritorio): Hoy es la primera pantalla; un toque arranca la tanda; el conteo sobrevive a la recarga; la barra móvil no tiene Configuración y el engranaje la abre; la consola no tiene errores.

**Checkpoint**: US1 funciona por sí sola (MVP).

---

## Phase 4: User Story 2 - Un solo disparador vigente (Priority: P1)

**Goal**: Hoy muestra solo el disparador si-entonces que toca ahora, y registra la respuesta.

**Independent Test**: con tres disparadores para hoy a horas distintas, en cada momento aparece solo el vigente, y desaparece al responderlo.

### Tests for User Story 2 (MANDATORY — RED antes de implementar) ⚠️

- [X] T027 [P] [US2] TEST US2-AS1…US2-AS5 y US2-AS10 en __tests__/domain/execution-trigger.test.ts (función pura `resolveCurrentTrigger`):
  - devuelve un solo disparador;
  - gana el ancla más reciente ≤ ahora;
  - excluye los futuros, los ya respondidos hoy y los de más de 240 min;
  - `tras_clase` usa el `end_time` del horario;
  - con ancla `2026-08-01`, un slot `sabado_b` no aparece en sábado A.
- [X] T028 [P] [US2] TEST US2-AS6…US2-AS9 en __tests__/mcp/execution-routine.test.ts (pg-mem):
  - `create` con `default_tandas` → `SOBRE_ESPECIFICACION`;
  - `tras_clase` copia `days_of_week` y `periodicity` del horario;
  - `start` con `routine_slot_id` registra el outcome `hecho`, liga la tanda y hereda `subject_id`;
  - `respond` `no` en un slot de hábito fija el check en `fallado`;
  - `rehearse` dos veces → `ya_ensayado: true`;
  - `read` marca `huerfano` si se borró el horario;
  - `get_today` devuelve ese disparador vigente y solo uno.

### Implementation for User Story 2

- [X] T029 [US2] IMPL `resolveCurrentTrigger` en lib/domain/execution.ts:
  - paridad con `occursOnSabadoVariant` y `getSabadoTypeForDate` (lib/algorithms/conflict-detector.ts:31,73);
  - ancla de la universidad de la materia; si no hay, la primera con alternancia; si no, `DEFAULT_SABADO_A_ANCHOR`;
  - ventana de `TRIGGER_WINDOW_MINUTES`.
- [X] T030 [US2] IMPL lib/execution/routine.ts y el registro de `manage_routine_slots`:
  - create y update estrictos;
  - `respond` idempotente por día;
  - `rehearse` idempotente por semana;
  - efectos sobre checks y tandas;
  - `handleManageRoutineSlots`, registro en mcp-server/index.ts y conteo de `TOOLS_LIST` +1.
- [X] T031 [US2] IMPL Disparador en components/dashboards/TodayDashboard.tsx, lib/execution/today.ts y app/api/execution/route.ts:
  - el disparador vigente en `getToday`;
  - bloque en Hoy: "Si {cue_text}," / "entonces {action_text}."; [Empezar tanda] + [No] para estudio; [Hecho] + [No] para hábito u otro; "Empezar tanda" siempre a un toque;
  - `manage_routine_slots:respond` en la lista blanca.
- [ ] T032 [US2] VERIFY quickstart US2 en specs/001-modulo-ejecucion/quickstart.md: crear tres disparadores de prueba por MCP; en el navegador aparece solo uno y desaparece al responderlo.

**Checkpoint**: US1 y US2 funcionan por separado.

---

## Phase 5: User Story 3 - Hábitos del día y día cumplido (Priority: P1)

**Goal**: registrar los hábitos del día y saber si el día quedó cumplido, sin deuda.

**Independent Test**: con la semana 1 (mínimo 1) y dos hábitos, las combinaciones de registros dan el resultado correcto del día; los checks se cierran a las 03:00; las semanas en curso no se pueden editar.

### Tests for User Story 3 (MANDATORY — RED antes de implementar) ⚠️

- [X] T033 [P] [US3] TEST US3-AS1…US3-AS4 y US3-AS6 en __tests__/domain/execution-day.test.ts (funciones puras `evaluateDay` e `isHabitActive`):
  - día cumplido;
  - un check ausente → no cumplido;
  - `na` no rompe el día;
  - mínimo sin deuda;
  - un hábito antes de su `started_on` no se exige;
  - fuera del programa → `null`.
- [X] T034 [P] [US3] TEST US3-AS5 en __tests__/mcp/execution-checks.test.ts (pg-mem):
  - un check de ayer después de las 03:00 → `DIA_CERRADO`;
  - una fecha futura → `FECHA_FUTURA`;
  - un hábito inactivo → `HABITO_INACTIVO`;
  - upsert idempotente por `${date}:${habit_id}`.
- [X] T035 [P] [US3] TEST US3-AS8 en __tests__/domain/today-view.test.ts:
  - el modelo de vista lista solo los hábitos sin responder;
  - el pie "N tandas hoy" aparece solo con ≥ 1 tanda, y "Día cumplido" cuando aplica;
  - nunca expone el mínimo faltante, los minutos totales, proyecciones ni un selector de modo de trabajo (FR-008, FR-018).

### Implementation for User Story 3

- [X] T036 [US3] IMPL `isHabitActive` y `evaluateDay` en lib/domain/execution.ts.
- [X] T037 [US3] IMPL lib/execution/checks.ts y el registro de `manage_daily_checks`:
  - `setDailyCheck`: se acepta hasta las 03:00 del día siguiente, exige un hábito activo, "`note` ≤ 200";
  - `handleManageDailyChecks`: `set`, y `read` con la evaluación de cada día;
  - registro en mcp-server/index.ts y conteo de `TOOLS_LIST` +1 (total 25);
  - checks pendientes y `day_fulfilled` en `getToday` (lib/execution/today.ts).
- [X] T038 [US3] IMPL Hábitos en components/dashboards/TodayDashboard.tsx y app/api/execution/route.ts:
  - filas de checks Sí/No que desaparecen al responder, y el pie de la pantalla;
  - `manage_daily_checks:set` en la lista blanca.
- [ ] T039 [US3] VERIFY quickstart US3 en specs/001-modulo-ejecucion/quickstart.md.

**Checkpoint**: la pantalla Hoy está completa (US1–US3).

---

## Phase 6: User Story 4 - Pure en el iPhone, detrás de login (Priority: P1)

**Goal**: Pure se instala en el iPhone como app y nadie entra sin autenticarse.

**Independent Test**: instalar desde Safari y abrir como app; sin sesión no se ve nada.

### Tests for User Story 4 (MANDATORY — RED antes de implementar) ⚠️

- [X] T040 [P] [US4] TEST US4-AS3 en __tests__/build/pwa-manifest.test.ts: `app/manifest.ts` devuelve `display: 'standalone'`, `id` y `scope` `'/'`, `background_color` y `theme_color` `'#191919'`, y los íconos de 192 y 512 (+ maskable).

### Implementation for User Story 4

- [X] T041 [US4] IMPL app/manifest.ts, app/apple-icon.tsx, app/icons/[size]/route.tsx y app/layout.tsx:
  - manifest e íconos de 180, 192 y 512 con `ImageResponse` de `next/og`, monocromos según DESIGN.md;
  - en app/layout.tsx, quitar `manifest: '/manifest.json'` y cambiar `viewport.themeColor` de `'#05080e'` a `'#191919'`;
  - borrar public/manifest.json.
  - **Nota posterior**: los íconos se reemplazaron después por PNG estáticos (`app/apple-icon.png` y `public/icons/icon-192.png`, `icon-512.png`, `icon-192-maskable.png`, generados por `scripts/generate-icons.js`) porque `ImageResponse` de `next/og` revienta en Windows con `TypeError: Invalid URL` al usar `path.join` con barras invertidas en una URL `file://`.
- [ ] T042 [US4] MANUAL Andres, en este orden, para el hostname que apunta al servicio `pure-web` de docker-compose.yml:
  - crear la aplicación de Cloudflare Access para pure.btw-one.com (política con su correo, sesión de 30 días);
  - después, crear el hostname del túnel hacia `pure-web:3000`;
  - mcp.btw-one.com queda fuera de Access.
- [ ] T043 [US4] VERIFY US4-AS1 y US4-AS2 [manual] según quickstart US4 en specs/001-modulo-ejecucion/quickstart.md: instalar desde Safari y abrir como app; sin sesión de Access no se ve nada.

**Checkpoint**: todo lo P1 queda listo para el lunes 14.

---

## Phase 7: User Story 5 - Proyección de nota por materia (Priority: P2)

**Goal**: por materia, la nota necesaria, el techo y alertas honestas cuando los datos no alcanzan.

**Independent Test**: Química da 3.33, 5.20 y 4.34; con pesos inconsistentes no se calcula nada.

### Tests for User Story 5 (MANDATORY — RED antes de implementar) ⚠️

- [X] T044 [P] [US5] TEST US5-AS1…US5-AS5 y US5-AS7 en __tests__/domain/grade-projection.test.ts:
  - Química (1.7 al 20%, 80% pendiente, aprobatoria 3.0, meta 4.5) → `consolidated 0.34`, `neededToPass 3.33`, `neededForTarget 5.20` + `meta_inalcanzable`, `ceiling 4.34`;
  - pesos 105% → `pesos_inconsistentes` y cifras `null`;
  - `completado` sin nota → `entregado_sin_nota`;
  - pendiente vencida → `vencido_sin_registrar`;
  - techo < aprobatoria → `materia_perdida`;
  - materia sin evaluaciones → flag `ciega` (FR-027);
  - ampliar __tests__/domain/subject.test.ts: `entregado` con nota cuenta en `calculateWeightedGrade`, y los 3 tests actuales siguen verdes.
- [X] T045 [P] [US5] TEST US5-AS6 en __tests__/mcp/grade-projection-tool.test.ts (pg-mem): `get_grade_projection` eleva a alerta `ciega` la materia sin evaluaciones y marca `abandonada` la que tiene una evaluación en < 7 días y 0 tandas en 7 días.

### Implementation for User Story 5

- [X] T046 [US5] IMPL lib/domain/subject.ts y lib/domain/deliverable.ts:
  - `normalizeDeliverableStatus`: `'completado'` → `'entregado'`; un valor desconocido → `'pendiente'`;
  - `isGradedDeliverable` (estado normalizado ≠ pendiente y `grade` numérico), usado en `calculateWeightedGrade` y en `calculateSubjectGradeProgress` (lib/domain/deliverable.ts:81);
  - `projectSubjectGrade(delivs, { scaleMax, passingGrade, targetGrade }, now)`: necesaria = ceil2 sobre `(puntos*100)/peso`; techo = floor2; flags de FR-027 incluyendo `ciega`;
  - nunca leer `subjects.current_grade`.
- [X] T047 [US5] IMPL `computeAlerts` en lib/domain/execution.ts y `handleGetGradeProjection` en lib/execution/handlers.ts:
  - escala tomada de `universities.scale_max` y `passing_grade`;
  - registro de `get_grade_projection` en mcp-server/index.ts y conteo de `TOOLS_LIST` +1.
- [ ] T048 [US5] VERIFY quickstart US5 en specs/001-modulo-ejecucion/quickstart.md: `get_grade_projection` por MCP sobre Química devuelve 3.33, 5.20 y 4.34, y las alertas de las materias sin evaluaciones.

**Checkpoint**: la proyección está disponible para el reporte.

---

## Phase 8: User Story 6 - Reporte semanal congelado por correo (Priority: P2)

**Goal**: el domingo a las 19:00 el reporte se congela; hay una hora para la nota; a las 20:00 sale un único correo.

**Independent Test**: en una semana simulada, el domingo produce exactamente un correo con los números congelados.

### Tests for User Story 6 (MANDATORY — RED antes de implementar) ⚠️

- [X] T049 [P] [US6] TEST US6-AS5, US6-AS7 y US6-AS10 en __tests__/domain/weekly-report.test.ts:
  - `computeVerdict`: ≥ 6/7 cumplida, ≤ 3/7 fallida, resto parcial;
  - `renderReportText` sin nota incluye "Andrés no dio explicación.";
  - `createZeptoMailer` con `fetch` mockeado: manda la cabecera `Authorization: Zoho-enczapikey ...`, `reply_to` y `track_clicks`/`track_opens` en `false`; con 201 resuelve y con 400 o error de red lanza un error que empieza por el código HTTP;
  - con dos `fallida` seguidas agrega "Segunda semana fallida. Si puedes, llámalo.";
  - el payload trae días x/7, los días acumulados frente al horizonte de 66 (FR-022), hábitos x/7, veredicto, "En riesgo" (perdidas, necesaria ≥ 3.5 con cifra y próxima evaluación, abandonadas, una línea de ciegas) y ediciones tardías;
  - el corte del domingo 19:00 excluye las tandas posteriores.
- [X] T050 [P] [US6] TEST US6-AS1…US6-AS4, US6-AS6, US6-AS8 y US6-AS9 en __tests__/mcp/weekly-report.test.ts (pg-mem + `Mailer` falso + `vi.setSystemTime`):
  - el tick del domingo 19:00 congela, y las tandas posteriores no cambian el payload;
  - `set_note` antes del plazo → OK; después → `VENTANA_CERRADA`; sin reporte congelado → `REPORTE_NO_CONGELADO`;
  - el tick de las 20:00 envía una vez y el segundo no reenvía (claim atómico); `send` sobre uno ya enviado → `YA_ENVIADO`;
  - `run_tick` ejecuta un tick completo y repetirlo no duplica envíos (FR-039);
  - un mailer que falla 3 veces → `fallido` con `last_error`, y el reporte siguiente lo menciona;
  - si arranca el lunes, congela con el corte del domingo y `late=true`;
  - sin destinatario → `SIN_PARTNER`; `set_partner` sin `consented_at` → `CONSENTIMIENTO_REQUERIDO`;
  - si se cambia de destinatario después del congelamiento, el envío usa el vigente al congelar (caso borde de spec.md).
- [X] T051 [P] [US6] TEST US6-AS11 ampliando __tests__/api/execution-routes.test.ts:
  - `GET /api/execution/report` devuelve `partner_name` y nunca el correo del destinatario;
  - `manage_weekly_report:set_note` está en la lista blanca y `set_partner` no.

### Implementation for User Story 6

- [X] T052 [US6] IMPL db/migrations/009_weekly_reports.sql y el `reset()` de __tests__/helpers/test-db.ts:
  - SQL exacto de data-model.md: `accountability_partners` con `active_lock TEXT UNIQUE`, y `weekly_reports` con `payload JSONB` e índice por `status`;
  - agregar `weekly_reports` y `accountability_partners` antes de `program_weeks` en `reset()`.
- [X] T053 [US6] IMPL lib/execution/compliance.ts, lib/domain/execution.ts y lib/execution/report.ts:
  - `getCompliance({ from, to, cutoff })`, incluidos `dias_cumplidos_totales` y `horizonte`;
  - `computeVerdict`;
  - `buildReportPayload` y `renderReportText`, con el formato de specs/001-modulo-ejecucion/contracts/notifications.md.
- [X] T054 [US6] IMPL lib/execution/mailer.ts y lib/execution/tick.ts:
  - mailer.ts: interfaz `Mailer` y `createZeptoMailer()` con `fetch` contra la API HTTP de ZeptoMail, exactamente como lo especifica contracts/notifications.md (cabecera `Zoho-enczapikey`, `reply_to` obligatorio, `textbody`, `track_clicks`/`track_opens` en `false` y éxito solo con 201);
  - tick.ts: `runExecutionTick(now, { mailer, pusher })`:
    1. `finalizeElapsed`;
    2. congela con `note_deadline = max(corte, now) + 60 min`;
    3. claim `UPDATE … SET status='enviando', attempts=attempts+1, last_attempt_at=$now WHERE id=$1 AND status='congelado' RETURNING *`;
    4. backoff de 10 min y como máximo 3 intentos;
    5. un reporte con más de 15 min en `enviando` vuelve a `congelado`.
- [X] T055 [US6] IMPL `handleManageWeeklyReport` y `handleGetComplianceReport` en lib/execution/handlers.ts, con el scheduler en mcp-server/index.ts:
  - acciones de contracts/mcp-tools.md, incluida `run_tick` (FR-039);
  - registro de `manage_weekly_report` y `get_compliance_report`, y conteo de `TOOLS_LIST` +2 (total 28);
  - en `main()`: si `EXECUTION_SCHEDULER === 'on'`, un tick al arrancar y `setInterval(tick, 20_000).unref()`, con guardia anti-solapamiento y logs `[execution-tick]`.
- [X] T056 [US6] IMPL app/api/execution/report/route.ts, app/api/execution/route.ts y components/dashboards/TodayDashboard.tsx:
  - la ruta del reporte, sin el correo del destinatario;
  - `manage_weekly_report:set_note` en la lista blanca;
  - bloque del domingo en Hoy, entre congelamiento y envío: números congelados, textarea ≤ 400 y la advertencia "no dio explicación" si el veredicto es fallida;
  - después del envío: "Enviado HH:MM" o "No se pudo enviar".
- [ ] T057 [US6] VERIFY quickstart US6 en specs/001-modulo-ejecucion/quickstart.md, con el correo real de Andres como destinatario de prueba: con una semana de prueba ya vencida, `run_tick` congela y envía un único correo, y el segundo `run_tick` no reenvía. Revisar también el panel de ZeptoMail: el envío tiene que aparecer entregado, no rebotado.

**Checkpoint**: el reporte queda listo para el domingo 20.

---

## Phase 9: User Story 7 - Avisos en el teléfono (Priority: P3)

**Goal**: aviso de fin de tanda y del reporte; nunca recordatorios del plan.

**Independent Test**: con el teléfono bloqueado, llega "Terminó la tanda" a los 10 minutos, una sola vez.

### Tests for User Story 7 (MANDATORY — RED antes de implementar) ⚠️

- [X] T058 [P] [US7] TEST US7-AS1 en __tests__/api/push-subscribe.test.ts:
  - el POST valida con Zod `endpoint` https y `keys.p256dh`/`keys.auth`, y hace upsert idempotente con `id = sha256(endpoint)`;
  - el DELETE borra;
  - `GET /api/push/public-key` devuelve la clave.
- [X] T059 [P] [US7] TEST US7-AS2…US7-AS5 en __tests__/mcp/execution-push.test.ts (pg-mem + `Pusher` falso y `vi.mock('web-push')`):
  - al finalizar por tiempo se envía un único "Terminó la tanda" y se marca `end_notified_at`;
  - al congelar se avisa con la hora límite (`freeze_notified_at`), y al pasar a `fallido` se avisa del fallo;
  - una respuesta 404/410 borra la suscripción;
  - en un día con disparadores no se emite ningún otro tipo de aviso.

### Implementation for User Story 7

- [X] T060 [US7] IMPL db/migrations/010_push.sql y las rutas app/api/push/public-key/route.ts, app/api/push/subscribe/route.ts y app/api/push/test/route.ts:
  - `push_subscriptions` + `ALTER TABLE … ADD COLUMN IF NOT EXISTS end_notified_at` y `freeze_notified_at`;
  - agregar la tabla a `reset()` en __tests__/helpers/test-db.ts.
- [X] T061 [US7] IMPL lib/execution/push.ts y lib/execution/tick.ts:
  - interfaz `Pusher`; `createWebPusher()` con web-push `setVapidDetails`;
  - `urgency: 'high'`; TTL de 600 para la tanda y 3600 para el resto;
  - sin VAPID → no-op con `warn`;
  - los tres tipos de aviso de contracts/notifications.md dentro del tick.
- [X] T062 [US7] IMPL public/sw.js, lib/hooks/usePushNotifications.ts, components/dashboards/ConfigDashboard.tsx y components/dashboards/TodayDashboard.tsx:
  - sw.js: en `push` siempre `showNotification`; en `notificationclick` enfoca o abre `url`; sin `fetch` ni caché;
  - hook: registro del SW, detección de standalone en iOS, suscripción con gesto;
  - ConfigDashboard: sección "Notificaciones" con los estados no soportado / instalar en inicio / denegado / activar / activo + prueba + desactivar;
  - TodayDashboard: enlace "Avísame al terminar" bajo el timer.
- [ ] T063 [US7] MANUAL Andres: correr `npx web-push generate-vapid-keys` y pegar en .env `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT=mailto:…`.
- [ ] T064 [US7] VERIFY quickstart US7 en specs/001-modulo-ejecucion/quickstart.md, en el iPhone: llega la prueba; con una tanda en curso y el teléfono bloqueado, llega el aviso a los 10:00 (±20 s), una sola vez.

---

## Phase 10: User Story 8 - Planeación del domingo y tareas (Priority: P4)

**Goal**: planear la semana con intenciones, disparadores ensayados y tareas de 1 a 3 tandas.

**Independent Test**: la planeación respeta las intenciones, rechaza tareas grandes y no arrastra deuda.

### Tests for User Story 8 (MANDATORY — RED antes de implementar) ⚠️

- [X] T065 [P] [US8] TEST US8-AS1…US8-AS5 en __tests__/mcp/execution-planning.test.ts (pg-mem):
  - intención < 6 sin razón → `RAZON_REQUERIDA`; con razón, la materia no recibe disparadores sugeridos;
  - `estimated_tandas` 4 → `PARTIR_TAREA`;
  - `manage_tasks today` no arrastra las tareas de ayer;
  - `plan_week preview` trae el reparto de `computeAcademicLoad` (48 h/crédito) con urgencia y proyección aparte, la semana pasada, las entregas de 14 días, las intenciones y los disparadores con su estado de ensayo.

### Implementation for User Story 8

- [X] T066 [US8] IMPL db/migrations/011_execution_planning.sql, lib/execution/planning.ts y el registro de las tools:
  - `intentions` y `plan_views` según data-model.md, y las tablas en `reset()` de __tests__/helpers/test-db.ts;
  - `handleManageTasks` y `handlePlanWeek` en lib/execution/handlers.ts;
  - registro de `manage_tasks` y `plan_week` en mcp-server/index.ts, y conteo de `TOOLS_LIST` +2 (total 30).
- [X] T067 [US8] IMPL components/dashboards/SundayPlanning.tsx y components/ui/SubjectEvaluation.tsx:
  - asistente de 4 pasos al que se entra desde Hoy los domingos;
  - tareas dentro del hub de asignatura;
  - tabla de proyección: promedio evaluado, aporte, peso restante, necesaria para aprobar y para la meta, techo; flags como texto; `STATUS_LABELS` con el estado normalizado; `SubjectHub` pasa la universidad.
  - **Empalme cerrado**: `components/dashboards/TodayDashboard.tsx` ya importa `SundayPlanning` e `isoDayOfWeekForDateKey` (`@/lib/domain/execution`), guarda `showSundayPlanning` en estado y muestra "Planear la semana →" solo cuando `isoDayOfWeekForDateKey(today.date) === 7`, que abre `<SundayPlanning onClose={...} />`.
- [ ] T068 [US8] VERIFY quickstart US8 en specs/001-modulo-ejecucion/quickstart.md: recorrer la planeación del domingo en el navegador y comprobar intenciones, disparadores sugeridos, tareas y la tabla de proyección del hub.

---

## Phase 11: User Story 9 - Semana con compuerta y alertas en la agenda (Priority: P4)

**Goal**: ver la semana de forma deliberada (dos aperturas libres) y ver alertas en Agenda.

**Independent Test**: la tercera apertura de la semana pide razón y queda contada; Agenda muestra las alertas.

### Tests for User Story 9 (MANDATORY — RED antes de implementar) ⚠️

- [X] T069 [P] [US9] TEST US9-AS1…US9-AS3 en __tests__/mcp/plan-views.test.ts (pg-mem):
  - `plan_week open_view` es libre 2 veces por semana;
  - la 3.ª apertura sin razón → `RAZON_REQUERIDA`; con razón queda registrada (`was_gated=true`) y contada en el payload del reporte ("Aperturas del plan: N");
  - la vista de semana devuelve los disparadores con su resultado y las tandas por día;
  - las alertas `abandonada` y `ciega` quedan disponibles para Agenda.

### Implementation for User Story 9

- [X] T070 [US9] IMPL components/dashboards/WeekView.tsx, components/dashboards/DeliverablesDashboard.tsx y lib/execution/report.ts:
  - WeekView: rejilla sin gráficas con los disparadores (hecho/no) y las tandas por día, detrás de la compuerta `open_view`;
  - `plan_week:open_view` en la lista blanca de app/api/execution/route.ts;
  - alertas en Agenda;
  - línea "Aperturas del plan" en el reporte.
- [ ] T071 [US9] VERIFY quickstart US9 en specs/001-modulo-ejecucion/quickstart.md: abrir la vista de la semana tres veces y comprobar la razón pedida, el conteo y las alertas en Agenda.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: documentación, limpieza y verificación final

- [X] T072 [P] Documentación en mcp-server/instructions.md, mcp-server/README.md, CLAUDE.md y docs/README.md:
  - instructions.md: reglas del módulo para agentes (días 1–7, un solo disparador, sin duración en los disparadores, sin tandas retroactivas, sembrar solo por herramientas);
  - README.md del MCP: catálogo de tools;
  - CLAUDE.md: un párrafo del módulo (tablas solo-Postgres, tick, `EXECUTION_SCHEDULER`, Spec Kit con `PYTHONUTF8=1`);
  - docs/README.md: enlaces a specs/ y a .specify/memory/constitution.md.
- [X] T073 Limpieza y refactor con los tests en verde; revisar el diff que `/speckit-implement` agregue a .gitignore y .dockerignore.
- [X] T074 [P] Tests de regresión en __tests__/ para cada bug que aparezca durante la implementación.
  - **Auditoría** (los tres ya tenían su test de regresión; ver el cuerpo del commit que marca
    esta tarea): `tandas_today` contando tandas sin completar; un reporte congelado sin
    destinatario quemando intentos y perdiéndose para siempre; el adaptador de correo enviando
    con `reply_to` vacío y leyendo las variables de entorno al construirse en vez de al enviar.
- [X] T075 Endurecimiento de seguridad (Principio VI) en app/api/execution/ y app/api/push/:
  - rutas nuevas con try/catch y sin detalles internos en los errores;
  - ningún secreto en código ni en artefactos;
  - el correo del destinatario no aparece en ninguna respuesta web.
  - **Auditoría**: `app/api/push/public-key/route.ts` no tenía try/catch (única ruta sin él); ya
    lo tiene. Los catch-all de los 10 handlers de `lib/execution/handlers.ts` devolvían
    `error?.message` crudo, que `app/api/execution/*` reenvía tal cual en su 400 — un fallo
    inesperado (por ejemplo, de Postgres) podía filtrar mensajes internos; ahora cada uno registra
    el error con `console.error` y responde un mensaje neutro fijo, con test de regresión en
    `__tests__/api/execution-routes.test.ts`. FR-025 (correo del destinatario) y ausencia de
    secretos ya cumplían: verificado con `git grep` sobre `app/` y sobre las dos carpetas de rutas.
- [ ] T076 VERIFY cierre con specs/001-modulo-ejecucion/quickstart.md:
  - quickstart completo y `npm run test:all`;
  - despliegue: `docker compose up -d --build pure-web pure-mcp` y luego `docker compose exec pure-mcp npm run db:migrate`;
  - `/speckit-converge`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup y **bloquea todas las historias**.
- **Historias (Phase 3+)**: dependen de Foundational. Van en orden de prioridad, porque comparten `lib/execution/handlers.ts`, `lib/execution/today.ts` y `TodayDashboard.tsx`.
- **Polish**: depende de las historias que se entreguen.

### User Story Dependencies

| Historia | Depende de | Nota |
|---|---|---|
| US1 (P1) | Foundational | MVP |
| US2 (P1) | US1 | Pantalla Hoy y `getToday` |
| US3 (P1) | US1 | Pantalla Hoy y `getToday` |
| US4 (P1) | US1 | Necesita la pantalla que se instala. En paralelo con US2/US3 si hay capacidad (archivos distintos) |
| US5 (P2) | Foundational | Dominio puro + tool. En paralelo con US2–US4 |
| US6 (P2) | US3 (`evaluateDay`) y US5 (alertas y proyección) | |
| US7 (P3) | US6 | `tick.ts` |
| US8 (P4) | US2 (disparadores) y US5 (proyección) | |
| US9 (P4) | US5 (alertas) y US6 (línea del reporte) | |

### Within Each User Story

- TEST → IMPL → VERIFY (Principios II y IV): los tests se escriben y fallan antes de implementar, y la historia no se cierra sin verificación empírica.
- Dominio puro antes que servicios; servicios antes que handlers y rutas; la lógica de UI como función pura en verde antes del componente.
- Cada tarea que registra una tool actualiza el conteo esperado de `TOOLS_LIST` en los dos tests.

### Parallel Opportunities

- Setup: T002 y T003.
- Foundational: T006, T008 y T010 (tests de archivos distintos).
- En cada historia, sus tareas TEST marcadas [P] se escriben en paralelo.
- T022 y T024 dentro de US1.
- US4 y US5 en paralelo con US2 y US3 tras terminar US1.

---

## Parallel Example: User Story 1

```bash
# Tests de US1 en paralelo (RED):
Task: "TEST US1-AS1…US1-AS7 en __tests__/mcp/execution-tandas.test.ts"
Task: "TEST US1-AS8 en __tests__/domain/today-view.test.ts"
Task: "TEST US1-AS9 en __tests__/domain/navigation.test.ts"
Task: "TEST rutas en __tests__/api/execution-routes.test.ts"

# Piezas independientes de la implementación:
Task: "IMPL lib/execution/today-view.ts"
Task: "IMPL navegación FR-041 (lib/navigation.ts, useNavigation, BottomNav, Header)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup) y Phase 2 (Foundational).
2. Phase 3 (US1): la tanda en un toque.
3. **STOP and VALIDATE**: quickstart US1.

### Incremental Delivery (fechas del programa)

1. **Lunes 14 de septiembre**: Setup + Foundational + US1 + US2 + US3 + US4.
   - Antes, Andres siembra por MCP el programa, los hábitos y los 3 disparadores de la semana 1, y hace T042 (Access).
2. **Domingo 20 de septiembre, antes de las 19:00**: US5 + US6, y destinatario registrado con `set_partner`.
3. **Semanas 1–2**: US7 (avisos).
4. **Semana 2 en adelante**: US8 y US9.

Cada historia se entrega sin romper las anteriores (`npm run test:all` en verde).

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- [USn] mapea la tarea a su historia, para trazabilidad.
- RED por la razón esperada (falta la conducta), no por un import roto.
- Commits en la rama:
  - uno RED (`test(001): USn escenarios en rojo`) y uno GREEN (`feat(001): …`) por historia;
  - en español, sin trailer `Co-Authored-By`;
  - `main` solo recibe la rama con todo en verde.
- Marcar `[X]` cada tarea al terminarla.
- Si una tarea contradice la spec o la constitución, detenerse y avisar al rol de planeación. No improvisar.
