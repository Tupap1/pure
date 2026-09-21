---
description: "Lista de tareas de las tandas de duración variable y el registro tardío — TDD obligatorio (override de PURE OS)"
---

# Tasks: Tandas de duración variable y registro tardío

**Input**: Design documents from `/specs/003-tandas-variables/`

**Prerequisites**: spec.md, research.md

**Tests**: MANDATORY (Constitución, Principio II). Cada escenario `US-Tn-ASm` de spec.md se
convierte en un test nombrado con su ID. Cada historia empieza por sus tareas de test (RED), que
DEBEN fallar por la razón esperada antes de la implementación (GREEN). Los escenarios marcados
**[regresión]** en spec.md nacen en verde a propósito.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes).
- `TEST` tests en rojo · `IMPL` implementación hasta verde · `VERIFY` verificación empírica.

## Path Conventions (PURE OS)

- Dominio puro: `lib/domain/`. Servicios compartidos web+MCP: `lib/execution/`. Repositorio
  Postgres: `lib/db/execution-pg.ts`. Zod: `lib/validations/schemas.ts`. Migraciones:
  `db/migrations/NNN_nombre.sql` (deben correr en pg-mem: sin plpgsql, sin `AT TIME ZONE`, sin
  índices únicos parciales). MCP: `mcp-server/index.ts`.
- Tests en `__tests__/`; base de prueba con `createTestDb()` / `harness.reset()` de
  `__tests__/helpers/test-db.ts`; el reloj con `vi.setSystemTime` y `vi.useRealTimers()` en
  `afterEach`. Horas en UTC: Bogotá es UTC−5 (las 15:00 locales del 21-sep son
  `2026-09-21T20:00:00Z`).
- Programa de prueba: `handleManageProgram('init', { starts_on: '2026-09-14', weeks: [...] })`;
  universidad y materia con `handleManageUniversities`/`handleManageSubjects`.

---

## Nota de orden

La entrada de la 003 en `__tests__/build/spec-traceability.test.ts` se agrega al final (**T024**),
no al principio: agregarla antes dejaría toda la suite en rojo mientras se trabaja cada historia,
y con varios agentes trabajando en paralelo eso borra la señal de qué está roto de verdad. El RED
de cada historia lo da su propio archivo de tests.

---

## Historia US-T3 — Que un inicio fallido no pase inadvertido (P1)

**Meta**: ningún `start` puede fallar en silencio. Dos frentes sin archivos en común.

### Frente A — la pantalla (`lib/hooks/useToday.ts`, `components/dashboards/TodayDashboard.tsx`, `lib/execution/today-view.ts`)

- [ ] **T002** [P] [US-T3] TEST — En `__tests__/domain/today-view.test.ts` (o un archivo nuevo del
      mismo directorio), escribir `US-T3-AS1`, `US-T3-AS2` y `US-T3-AS3` contra funciones puras
      nuevas de `lib/execution/today-view.ts`:
      - `describeStartFailure(result)` → mensaje a mostrar a partir de la respuesta de `start`
        (`{ status: 'error', code, message }` → el `message` del servidor; `null`/excepción →
        "No se pudo empezar la tanda. Revisa la conexión e inténtalo otra vez.").
      - `formatStartedAt(iso)` → la hora local `HH:MM` de inicio, para el texto "Empezó a las …".
- [ ] **T003** [US-T3] IMPL — Implementar esas funciones puras y usarlas:
      - `lib/hooks/useToday.ts`: `callAction` debe capturar el fallo de red y devolver un
        `{ status: 'error', code: 'SIN_CONEXION', message }` en vez de dejar la promesa rechazada.
      - `components/dashboards/TodayDashboard.tsx`: `handleStart` guarda el error en estado y lo
        muestra bajo el botón; el error se limpia al siguiente intento exitoso. La tarjeta de la
        tanda en curso muestra "Empezó a las HH:MM" junto a la cuenta regresiva.
      - Respetar `DESIGN.md`: el error es una línea de texto, no una tarjeta anidada ni un badge.

### Frente B — el log del servidor (`lib/execution/handlers.ts`)

- [ ] **T004** [P] [US-T3] TEST — `__tests__/mcp/execution-tandas-start-log.test.ts`: `US-T3-AS4`
      espía `console.warn` (o `console.error`) y comprueba que un `start` rechazado —tanto por Zod
      (`DATOS_INVALIDOS`) como por regla de negocio (`TANDA_EN_CURSO`)— deja una línea con el
      código y el motivo.
- [ ] **T005** [US-T3] IMPL — En `handleManageTandas`, registrar todo resultado `status: 'error'`
      de `start` con `console.warn('[execution] start rechazado:', code, message)`. Solo `start`:
      no convertir el resto del módulo en un log de errores.

- [ ] **T006** [US-T3] VERIFY — `npm run test:all` en verde y revisión visual de la pantalla Hoy
      (error visible al forzar un rechazo; hora de inicio visible con una tanda en curso).

---

## Historia US-T1 — Tandas de duración variable, hasta 60 minutos (P1)

### Bloque A — dominio, servicios, migración y MCP

- [ ] **T007** [US-T1] TEST — `__tests__/mcp/execution-tandas-variables.test.ts` (contra base) con
      `US-T1-AS1`, `US-T1-AS2`, `US-T1-AS3`, `US-T1-AS5`, `US-T1-AS6`, `US-T1-AS7`, `US-T1-AS8`.
      `US-T1-AS4` (unidades) y `US-T1-AS9` (texto del aviso) van en
      `__tests__/domain/execution-day.test.ts` y `__tests__/mcp/execution-push.test.ts`
      respectivamente, junto a sus pares.
- [ ] **T008** [US-T1] IMPL — Migración `db/migrations/013_tandas_duracion_variable.sql`:
      `ALTER TABLE tandas ADD CONSTRAINT tandas_planned_minutes_rango CHECK (planned_minutes
      BETWEEN 10 AND 60);` Debe ser reejecutable (envolver en el patrón que ya usan las migraciones
      del repo para no fallar si la restricción existe) y debe correr en pg-mem. Ninguna fila de
      producción la viola (research.md).
- [ ] **T009** [US-T1] IMPL — `lib/execution/constants.ts`: `TANDA_MINUTES_MIN = 10`,
      `TANDA_MINUTES_MAX = 60`, `TANDA_MINUTES_DEFAULT = 10` (sin cambio), nuevo
      `TANDA_UNIT_MINUTES = 10` y `TANDA_DURATION_OPTIONS = [10, 25, 40, 60]`. Actualizar el
      comentario: el rango ya no es "para el asistente de IA".
- [ ] **T010** [US-T1] IMPL — `lib/domain/execution.ts`: función pura
      `tandaUnits(actualMinutes: number | null | undefined): number` =
      `Math.max(1, Math.floor((actualMinutes ?? 0) / TANDA_UNIT_MINUTES))`. `EvaluateDayInput`
      cambia `completedTandas` por el par `completedTandas` (filas) + `completedUnits` (unidades);
      `evaluateDay` compara `completedUnits >= minTandasDia`; `DayBreakdown` gana
      `unidades_completadas`.
- [ ] **T011** [US-T1] IMPL — Propagar unidades en los servicios:
      - `lib/execution/tandas.ts`: `TandaDayResumen` gana `unidades`; `readTandas` las suma con
        `tandaUnits` sobre las completadas.
      - `lib/execution/today.ts`: calcular filas y unidades del día y pasar ambas a
        `evaluateDay`/`describeDay`; `TodayPayload` gana `unidades_hoy`.
      - `lib/execution/compliance.ts`: `evaluateOneDay` calcula ambas.
      - `lib/execution/tick.ts`: `tandaEndBody` usa `tanda.actual_minutes ?? tanda.planned_minutes`
        en vez del literal "10 minutos".
- [ ] **T012** [US-T1] IMPL — `lib/validations/schemas.ts` toma el rango nuevo por constantes (no
      hay número literal que cambiar) y `mcp-server/index.ts` actualiza la descripción de
      `manage_tandas`: `planned_minutes? (10-60, 10 por defecto)`.

### Bloque B — la pantalla (después del bloque A)

- [ ] **T013** [US-T1] TEST — `US-T1-AS10` y `US-T1-AS11` en `__tests__/domain/today-view.test.ts`:
      `buildTodayFooterView` con unidades y mínimo, y `tandaDurationOptions()`.
- [ ] **T014** [US-T1] IMPL — `lib/execution/today-view.ts`: el pie dice `"{unidades} de {min}
      tandas"` cuando hay semana del programa, y `"{filas} tanda(s) hoy"` cuando no.
      `components/dashboards/TodayDashboard.tsx`: cuatro botones 10 / 25 / 40 / 60 que llaman a
      `handleStart(undefined, minutos)`; el de 10 es el primario y los otros tres secundarios.
      `lib/hooks/useToday.ts`: `start` acepta `planned_minutes`.
- [ ] **T015** [US-T1] VERIFY — `npm run test:all` en verde; arrancar el dev server y comprobar en
      el navegador que una tanda de 60 minutos arranca, muestra su hora de inicio y su cuenta
      regresiva.

---

## Historia US-T2 — Registro tardío acotado y visible (P2)

- [ ] **T016** [US-T2] TEST — `__tests__/mcp/execution-tandas-registro-tardio.test.ts` con
      `US-T2-AS1` … `US-T2-AS7` y `US-T2-AS9`; `US-T2-AS8` en el archivo del reporte semanal, junto
      a sus pares.
- [ ] **T017** [US-T2] IMPL — Migración `db/migrations/014_tanda_registro_tardio.sql`:
      `ALTER TABLE tandas ADD COLUMN IF NOT EXISTS late_logged BOOLEAN NOT NULL DEFAULT FALSE;`
- [ ] **T018** [US-T2] IMPL — `lib/db/execution-pg.ts`: `late_logged` en `TandaRecord`, en el
      `INSERT` (columna, `$n` y `DO UPDATE SET`) y en el mapeo por defecto (`?? false`).
- [ ] **T019** [US-T2] IMPL — `lib/validations/schemas.ts`: `TandaLogLateSchema` `.strict()` con
      `subject_id` (obligatorio), `started_at`, `ended_at` (ISO), `topic_id?`, `task_id?`; agregar
      `REGISTRO_TARDIO_INVALIDO` y `LIMITE_REGISTRO_TARDIO` a `ExecutionErrorCode`.
- [ ] **T020** [US-T2] IMPL — `lib/execution/tandas.ts`: `logLateTanda(input, now)` con, en este
      orden: validación de día local (`localParts`), ventana de 6 horas, `ended_at` ≤ ahora y
      posterior a `started_at`, duración 10–60, solapamiento contra las tandas del día (una tanda
      `en_curso` ocupa `[started_at, now]`), límite de 3 `late_logged` del día. Crea la fila
      `status: 'completada'`, `running_lock: null`, `late_logged: true`, `actual_minutes` como
      diferencia redondeada hacia abajo, `locked_at` con la misma regla que `startTanda`.
      Constantes nuevas en `constants.ts`: `LATE_LOG_MAX_HOURS_BACK = 6`, `LATE_LOG_MAX_PER_DAY = 3`.
- [ ] **T021** [US-T2] IMPL — `lib/execution/handlers.ts`: `'log_late'` en `ManageTandasAction` y en
      el `switch`. `mcp-server/index.ts`: documentar la acción en la descripción de `manage_tandas`,
      dejando claro que es la única excepción a "sin tandas retroactivas" y que queda marcada.
      **No** agregarla a `ALLOWED_ACTIONS` de `app/api/execution/route.ts` (FR-T15).
- [ ] **T022** [US-T2] IMPL — `lib/execution/compliance.ts` expone
      `registros_tardios: { total, minutos }` en `ComplianceResult`; `lib/execution/report.ts` lo
      recibe en `BuildReportPayloadInput` (opcional, por los payloads ya congelados) y lo muestra en
      el texto del reporte; `lib/execution/tick.ts` lo pasa al construir el payload.
- [ ] **T023** [US-T2] VERIFY — `npm run test:all` en verde y un `log_late` real contra el servidor
      MCP levantado en local, comprobando que la tanda queda marcada y que el cuarto del día se
      rechaza.

---

## Cierre

- [ ] **T024** TEST+VERIFY — En `__tests__/build/spec-traceability.test.ts`, agregar al arreglo
      `SPECS` la entrada de la 003: `feature: '003'`, `spec: specs/003-tandas-variables/spec.md`,
      `idRe: /US-T\d+-AS\d+/`, `manualExclusions: new Set([])`, `expectedCount: 24`. Con las tres
      historias terminadas debe pasar en verde: si falla, señala qué escenario quedó sin test o qué
      test cita un ID que no existe. Luego `npm run test:all` completo y `npm run lint`.
- [ ] **T025** MANUAL — Desplegar: el `pure-mcp` no corre migraciones. Después del despliegue hay
      que ejecutar `docker compose exec pure-mcp npm run db:migrate` (CLAUDE.md) o las migraciones
      013 y 014 no existirán para el MCP.
