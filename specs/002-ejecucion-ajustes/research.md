# Research — Ajustes del Módulo de Ejecución (002)

Cada decisión cita la evidencia que la sostiene. Las verificaciones se hicieron el 2026-09-12 sobre
`main` (`bcc5304`), con una sonda temporal en pg-mem (6 de 6 en verde, borrada después) y con
lecturas del servidor MCP de producción que no escriben datos.

## R-B01 · Verificación de las causas raíz

- **Decisión**: reencuadrar las historias según lo que el código hace de verdad antes de
  especificarlas.
- **Evidencia**:

| Afirmación de la historia | Evidencia | Resultado |
|---|---|---|
| El domingo 13 `plan_week preview` falla | `resolveRehearsalWeekId` (`lib/execution/routine.ts:174`) toma mañana cuando `dayOfWeek === 7`, y `localParts` usa días ISO (`lib/execution/time.ts:26`). Sonda: domingo 13 → pw-01, domingo 20 → pw-02, sábado 12 → `NO_ENCONTRADO`. Producción: `plan_week preview {}` el sábado 12 → `NO_ENCONTRADO`; con `pw-01` explícito → éxito con los datos reales | Falso para el domingo, cierto para el sábado |
| `open_view` no sirve antes de que empiece la semana | `PlanWeekOpenViewSchema` es `.strict()` y solo admite `reason` (`lib/validations/schemas.ts:693`); `openPlanView` busca la semana que contiene hoy (`lib/execution/planning.ts:351`). Sonda: sin id → `NO_ENCONTRADO`; con id → `DATOS_INVALIDOS` | Cierto |
| Una tanda huérfana bloquea `start` para siempre | `startTanda` llama `finalizeElapsed(now)` antes del INSERT (`lib/execution/tandas.ts:90`); `saveTandaToDb` escribe `running_lock = EXCLUDED.running_lock` (`lib/db/execution-pg.ts:476`); el tick corre cada 20 s (`mcp-server/index.ts:1379`) y `EXECUTION_SCHEDULER` está en `on` por defecto (`docker-compose.yml:51`). No hay índice parcial (es `running_lock TEXT UNIQUE`) ni ningún cierre de las 22:30 en el repositorio. Sonda: con una tanda de hace 2 h, `start` la completa (10 min, lock NULL) y crea la nueva | Falso |
| El día podría cumplirse solo con los hábitos | `evaluateDay` exige `completedTandas >= minTandasDia` y todos los hábitos activos en `cumplido` o `na` (`lib/domain/execution.ts:223`); US3-AS1 y US3-AS2 lo prueban | Falso: falta el desglose |
| `get_compliance_report` no expone las aperturas | `getCompliance` no lee `plan_views`; el reporte guarda `plan_openings` con solo las aperturas que pasaron por la compuerta (`lib/execution/planning.ts:394`) | Cierto |

- **Alternativas consideradas**: implementar las historias tal como estaban escritas. Se descartó
  porque US-B2 habría agregado un estado sin uso y un cierre que corta tandas legítimas, y la regla
  literal de US-B1 rompía todos los domingos desde el 20.

## R-B02 · Espacio de IDs y trazabilidad

- **Decisión**: los escenarios de la 002 usan IDs `US-Bn-ASm`. La constitución se enmienda en PATCH
  (1.0.1), y `__tests__/build/spec-traceability.test.ts` pasa a recorrer una tabla de specs, cada
  una con su patrón: `US\d+-AS\d+` para la 001 y `US-B\d+-AS\d+` para la 002.
- **Razón**: el patrón de la 001 no encuentra coincidencia dentro de `US-B1-AS1`, porque después
  de `US` viene un guion y no un dígito. Así ningún test de una feature cuenta como cobertura de la
  otra. Si la 002 hubiera usado `USn-ASm`, un test `US1-AS1` de la 001 cubriría en silencio el
  escenario homónimo de la 002.
- **Alternativas consideradas**: numerar US10–US14 dentro de la spec 001, que mezcla una feature
  ya mergeada con otra nueva; un segundo archivo de trazabilidad, que duplica el parser.

## R-B03 · Resolución de la semana

- **Decisión**: dos funciones puras exportadas en `lib/execution/program.ts`, junto a
  `findCurrentWeek`:
  - `resolvePlanningWeek(weeks, todayKey)`: si hoy es domingo y hay una semana que empieza mañana,
    esa; si no, la que contiene hoy; si no, la próxima con `starts_on > hoy`; y si no queda ninguna,
    `{ ok: false, reason: 'sin_programa' | 'programa_terminado' }`. La usan `plan_week:preview` y
    `manage_routine_slots:rehearse`: `resolveRehearsalWeekId` (`lib/execution/routine.ts`) se
    reescribe sobre ella.
  - `resolveViewWeek(weeks, todayKey)`: la misma resolución sin el paso del domingo. La usa
    `plan_week:open_view`.
  - Con `program_week_id` explícito no se resuelve nada: se busca esa semana y, si no existe,
    `NO_ENCONTRADO`.
- **Razón**: Principio I, porque una sola función decide qué semana se planea. La vista de la
  semana muestra la semana que se está viviendo y no debe saltar a la siguiente el domingo
  (Clarifications).
- **Alternativas consideradas**: una sola función con una bandera `sundayJump`, que funcionaría
  pero oculta la diferencia detrás de un booleano; resolver en SQL, que el Principio III prohíbe.

## R-B04 · Aperturas de planeación

- **Decisión**: abrir una semana cuyo `starts_on` es posterior a hoy guarda la fila en `plan_views`
  con `surface='planeacion'`, `was_gated=false`, `reason=NULL` e id
  `${program_week_id}:planeacion-${n}`. La compuerta sigue contando solo `surface='semana'`, que es
  lo que ya hace `fetchPlanViewsFromDb(week.id, 'semana')`.
- **Razón**: el valor `planeacion` ya está en el modelo de la 001 y nunca se usó, así que no hace
  falta migración. El prefijo distinto evita chocar con los ids ordinales `view-N` de la compuerta.
- **Alternativas consideradas**: una columna nueva `is_planning`, que exige una migración sin
  necesidad; no registrar la apertura, que borra la huella de la planeación.

## R-B05 · US-B2 como regresión

- **Decisión**: tres tests de caracterización, sin tarea de implementación. Como nacen en verde, el
  RED se demuestra con una mutación temporal: al quitar la llamada a `finalizeElapsed` de
  `startTanda`, US-B2-AS1 tiene que fallar. La mutación se revierte y se deja constancia en el cuerpo
  del commit.
- **Razón**: Andres decidió no cambiar el comportamiento (Clarifications). Su valor está en impedir
  que un cambio futuro reintroduzca el bloqueo o agregue un cierre por hora del día.
- **Alternativas consideradas**:
  - estado `abandonada` cuando la tanda se observa más de 60 min después de empezar: solo ocurre si
    el tick estuvo caído, y Andres lo descartó;
  - cierre a las 22:30: corta tandas empezadas entre las 22:05 y las 22:30 y contradice US1-AS7.

## R-B06 · Conteo de aperturas

- **Decisión**: `getCompliance` calcula `aperturas_plan` con `summarizePlanOpenings(views, from, to,
  cutoff)`, una función pura exportada en `lib/execution/compliance.ts`:
  - solo cuenta `surface='semana'`, con el día local de `viewed_at` dentro de `[from, to]` y
    `viewed_at ≤ cutoff`;
  - `libres_usadas` son las que no pasaron por la compuerta, `con_razon` las que sí, y `total` la
    suma;
  - `razones` son las razones de las `con_razon`, en orden cronológico.

  El payload del reporte guarda `aperturas_plan: { total, con_razon, libres_usadas }` a partir de
  ese mismo cálculo, porque el tick y el `preview` ya llaman a `getCompliance` con el rango de la
  semana y su corte. `countGatedPlanOpenings` deja de usarse y se elimina.
- **Razón**: `get_compliance_report` recibe rangos arbitrarios, así que el criterio natural es la
  fecha, y el reporte semanal usa el mismo cálculo con su propio rango (Principio I). Todavía no hay
  reportes congelados (el primero es el domingo 20 a las 19:00), así que el cambio de forma no
  rompe datos guardados. Aun así, `renderReportText` sigue mostrando `plan_openings` si un payload
  anterior lo trae.
- **Alternativas consideradas**: contar por `program_week_id`, que no sirve para rangos y sumaría
  aperturas a semanas ya congeladas; conservar `plan_openings` junto a `aperturas_plan`, que deja un
  dato duplicado con dos significados.

## R-B07 · Desglose del día

- **Decisión**: `describeDay(input: EvaluateDayInput): DayBreakdown | null` en
  `lib/domain/execution.ts` envuelve a `evaluateDay`, sin reemplazarla, y devuelve
  `{ tandas_completadas, min_requerido, cumplio_tandas, cumplio_habitos, day_fulfilled }`.
  `get_today` agrega `evaluacion_dia`, y cada día de `get_compliance_report` también. Se conservan
  `day_fulfilled`, `tandas_today` y `dias[].evaluacion`.
- **Razón**: una sola regla (Principio I) y campos aditivos, para no romper la web ni los tests de
  la 001, que leen `tandasOk` y `fulfilled` (`__tests__/domain/execution-day.test.ts`). FR-018 queda
  protegido porque `buildTodayFooterView` (`lib/execution/today-view.ts:65`) solo recibe tres
  claves.
- **Hábitos sin días activos**: `getCompliance` omite de `habitos` los que tienen `total = 0`. El
  motivo es concreto: el hábito `gym`, creado el 2026-09-12 y que empieza el 28, habría salido como
  "Gym en la mañana: 0/0" en los reportes de las semanas 1 y 2.
- **Alternativas consideradas**: cambiar la forma de `DayEvaluation`, que rompe tests y
  consumidores de la 001; calcular el desglose en el handler, que duplica la regla.

## R-B08 · Límite de 2 medidas de fricción

- **Decisión**: `friction_measures.enabled_slot TEXT UNIQUE` vale `'a'` o `'b'` mientras la medida
  está habilitada y `NULL` si no. `enable` hace dos pasos:
  1. asegura la fila de la medida con `INSERT … ON CONFLICT (id) DO NOTHING`, que nunca toca
     `enabled_slot`;
  2. reclama un slot con un UPDATE condicionado, primero `'a'` y después `'b'`:
     `UPDATE … SET enabled_slot = $slot, … WHERE id = $1 AND enabled_slot IS NULL AND NOT EXISTS
     (SELECT 1 FROM friction_measures f2 WHERE f2.enabled_slot = $slot) RETURNING *`.

  Si ninguno de los dos devuelve fila, responde `LIMITE_FRICCION`. Una violación de UNIQUE (`23505`
  sobre `enabled_slot`) en el paso 2 solo puede venir de dos habilitaciones simultáneas en Postgres
  real, y se trata como slot ocupado.
- **Evidencia (sonda en pg-mem, 2026-09-12)**: un `INSERT … ON CONFLICT (id) DO UPDATE` sobre una
  medida nueva que choca con `enabled_slot` falla con `23505`, pero deja corrupto el índice de
  pg-mem: después, `UPDATE … WHERE enabled_slot IS NOT NULL` no encuentra la fila y el slot queda
  ocupado para siempre. En cambio, el UPDATE condicionado con `NOT EXISTS`, el `DO NOTHING` y los
  INSERT o UPDATE simples que fallan dejan el estado intacto.
- **Razón**: la unicidad sigue en la base (columna nula + `UNIQUE`, Principio III, igual que
  `running_lock`), así que la base arbitra la concurrencia real, y el camino normal nunca depende de
  una sentencia fallida, que en pg-mem rompería la paridad entre pruebas y producción.
- **Alternativas consideradas**: el upsert con reintento ante la violación, que era el diseño
  inicial y corrompe pg-mem; contar las habilitadas y después insertar sin respaldo en la base, que
  deja una carrera entre dispositivos; un índice único parcial, que está prohibido; un CHECK con
  subconsulta, que ni Postgres ni pg-mem soportan.

## R-B09 · Retiro por irritación

- **Decisión**: `applyIrritationDrops(now)` en `lib/execution/friction.ts`, que `runExecutionTick`
  llama después de cerrar tandas y antes de congelar semanas:
  - recorre los pares de semanas consecutivas por `week_number`;
  - si las dos calificaciones son ≥ 7 y la de la semana posterior no tiene `drop_applied_at`, abre
    una transacción (`withExecutionTransaction`);
  - dentro de la transacción marca el par con un UPDATE condicionado a `drop_applied_at IS NULL`
    (claim atómico) y deshabilita la medida con el `enabled_at` más reciente (`enabled_slot = NULL`,
    `disabled_at = now`, `drop_reason = 'irritacion'`);
  - si no hay medidas habilitadas, igual marca el par, con `dropped_measure_id = NULL`;
  - no cambia `TickResult`.
- **Razón**: FR-039 de la 001 (repetible sin efectos duplicados) y FR-B20. El par solo se marca
  cuando cumple la condición, así que recalificar a 7 o más un par que no la cumplía lo vuelve a
  evaluar. Correr antes del congelamiento hace que un retiro previo al corte entre en el reporte de
  esa semana. `enabled_at` desempata dos medidas con el mismo `started_on`.
- **Alternativas consideradas**:
  - aplicar el retiro dentro de `rate`: Andres pidió que lo haga el proceso programado;
  - marcar cada par evaluado aunque no cumpla: bloquearía las recalificaciones;
  - extender `TickResult`: rompe tests que comparan su forma completa sin aportar nada, porque el
    retiro ya se ve con `manage_friction:read` y en el reporte.

## R-B10 · Fricción en el reporte

- **Decisión**: `listIrritationDropsInRange(from, to, cutoff)` en `lib/execution/friction.ts`
  devuelve `[{ measure_key, fecha }]` para las medidas con `drop_reason = 'irritacion'` cuyo
  `disabled_at` cae (día local) dentro del rango y antes del corte. `freezeOneWeek`
  (`lib/execution/tick.ts`) y `assembleReportInput` (`lib/execution/handlers.ts`) la llaman y guardan
  `friccion_retiradas` en el payload; `renderReportText` agrega una línea por medida.
- **Razón**: una sola función para el congelamiento y la vista previa (Principio I).

## R-B11 · Superficie de `manage_friction`

- **Decisión**: una herramienta MCP nueva con el patrón `action` + `data`, con la que el catálogo
  pasa de 30 a 31. No se agrega a la lista blanca de `app/api/execution/route.ts`.
- **Razón**: no hay pantalla (FR-B11 y FR-040 de la 001), y la lista blanca es la única barrera de
  la web (Principio VI).
- **Alternativas consideradas**: acciones dentro de `manage_program`, que mezcla el programa con el
  teléfono; una ruta web, que no tendría consumidor.

## R-B12 · Despliegue

- **Decisión**:
  - US-B1 y US-B2 no requieren un despliegue urgente, porque el domingo 13 la planeación ya
    funciona en producción.
  - US-B3 y US-B4 cambian el payload del reporte, así que tienen que estar en producción antes del
    domingo 20 a las 19:00.
  - US-B5 trae la migración `012`, que se aplica con
    `docker compose exec pure-mcp npm run db:migrate`.
- **Razón**: el contenedor `pure-mcp` no corre migraciones al arrancar (CLAUDE.md), y el almacén de
  OAuth degrada a memoria en silencio si falta una migración.
