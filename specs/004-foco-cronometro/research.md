# Research: 004 Foco — temporizador, cronómetro, objetivos y mapa de calor

**Fecha**: 2026-10-02 · **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Cada decisión de este documento se tomó contra el código real de la rama (heredado de la 003) y,
cuando toca SQL, contra pg-mem 3 con un script en vivo, no por suposición.

## R1 — ¿pg-mem soporta `ALTER COLUMN planned_minutes DROP NOT NULL`?

- **Decision**: sí. El cronómetro guarda `planned_minutes = NULL`.
- **Evidencia**: el script ejecutó `ALTER TABLE tandas ALTER COLUMN planned_minutes DROP NOT NULL`
  dos veces seguidas sin error (es idempotente, que hace falta porque el arnés corre las migraciones
  dos veces; ver el comentario de la `013`). Después se insertó una fila con `NULL`.
- **Alternatives considered**: `planned_minutes = 0` como centinela para el cronómetro. Se descartó
  porque obliga a cada lector a recordar que 0 significa "sin plan", y `endsAtMs` calcularía un fin
  igual al inicio.

## R2 — El CHECK por tipo debe ser seguro frente a NULL (divergencia pg-mem / Postgres)

- **Decision**: la restricción se escribe así:
  ```
  CHECK ((kind = 'temporizador' AND planned_minutes IS NOT NULL AND planned_minutes BETWEEN 10 AND 180)
      OR (kind = 'cronometro' AND planned_minutes IS NULL))
  ```
  Se llama `tandas_tipo_duracion` y reemplaza a `tandas_planned_minutes_rango` (013).
- **Evidencia**: con la versión ingenua (sin `IS NOT NULL`), un temporizador con `planned_minutes`
  NULL **falló en pg-mem**. En Postgres real pasaría: la primera rama da NULL, la segunda FALSE y
  `NULL OR FALSE = NULL`, y un CHECK que da NULL se acepta. Los tests habrían pasado mientras
  producción aceptaba filas inválidas. Es justo lo que prohíbe el Principio III. Con
  `IS NOT NULL` explícito, las dos ramas son FALSE en ambos motores y la fila se rechaza en los dos.
  El script comprobó que la restricción rechaza un cronómetro con 30, un temporizador con 181, un
  temporizador con NULL y `kind = 'otro'`, y que acepta un temporizador con 180 y un cronómetro con
  NULL.
- **Regla general** que queda para las migraciones 015 y 016: todo CHECK con columnas anulables
  lleva `IS [NOT] NULL` explícito, de modo que nunca dependa de que NULL cuente como aceptado.

## R3 — Unicidad del nombre de objetivo entre activos

- **Decision**: columna `active_name_key TEXT UNIQUE`, con el nombre normalizado
  (`trim().toLowerCase()`) mientras el objetivo está activo, y `NULL` cuando se archiva. Es el
  patrón que exige la constitución ("columna nula + UNIQUE", sin índices parciales). El servicio
  **comprueba antes** en TypeScript y responde `OBJETIVO_DUPLICADO`. La restricción de la base es
  la red de seguridad.
- **Evidencia (divergencia)**: pg-mem acepta varios NULL en una columna UNIQUE, igual que Postgres.
  Pero al violarla reporta el nombre de la restricción como `objetivos_pkey`, no como la columna.
  Por eso no se puede distinguir la causa por el nombre de la restricción, como sí hace
  `isRunningLockViolation`. El id del objetivo es un UUID del servidor, así que cualquier 23505 al
  insertar o actualizar un objetivo se traduce a `OBJETIVO_DUPLICADO`.
- **Alternatives considered**: solo la comprobación en TypeScript, sin restricción. Se descartó
  porque una doble pulsación desde la web y el MCP a la vez podría colar un duplicado.

## R4 — Carga idempotente de frases (`create_many`)

- **Decision**: el id de cada frase es determinista, `frase-` + los primeros 16 hex del SHA-256 del
  texto latino normalizado (`trim().toLowerCase()`). `create_many` valida todo el lote con Zod
  (todo o nada), lee los ids existentes, calcula en TypeScript cuáles son nuevos e inserta solo
  esos dentro de `withExecutionTransaction`. Mantiene `ON CONFLICT (id) DO NOTHING` como red de
  seguridad. Las cifras `creadas` y `omitidas` salen de esa diferencia en TypeScript.
- **Evidencia (divergencia)**: en pg-mem, `INSERT … ON CONFLICT (id) DO NOTHING RETURNING id`
  **devolvió la fila** aunque hubo conflicto. Postgres real no devuelve ninguna. Contar con
  `RETURNING` daría cifras distintas en los tests y en producción.
- **Alternatives considered**: UNIQUE sobre el texto. Se descartó porque no resuelve el conteo y
  duplica la normalización entre SQL y TypeScript.

## R5 — Rotación de la frase del día

- **Decision**: con las frases activas ordenadas por `id`, el índice del día es
  `dayNumber(dateKey) mod N`. `dayNumber` es el número de días desde 1970-01-01, calculado con
  aritmética de calendario UTC sobre la `dateKey` local (mismo patrón que
  `isoDayOfWeekForDateKey`).
- **Rationale**: un hash de la fecha podría repetir la misma frase dos días seguidos. El módulo
  garantiza tres cosas que pide US-F5-AS3: mismo día, misma frase; días consecutivos, frases
  distintas (N ≥ 2); y en N días consecutivos sale cada frase una vez. Los ids deterministas (R4)
  hacen el orden estable entre despliegues. Desactivar una frase cambia N y reordena la rotación;
  es aceptable, la spec no exige continuidad tras una desactivación.

## R6 — Reparto del cronómetro por medianoche local (FR-F14a)

- **Decision**: se agrega una función `splitByLocalDay(startIso, endIso)` a `lib/execution/time.ts`.
  Recorre las medianoches locales entre el inicio y el fin, usando `localParts` y
  `localDateTimeToInstant(dateKey, '00:00')`, y devuelve `[{ date, minutes }]`. Los minutos de cada
  tramo son **acumulados con piso**: `floor((límite_k − inicio)/60 s) − floor((límite_{k−1} −
  inicio)/60 s)`. Así la suma de los tramos es exactamente `floor((fin − inicio)/60 s)`, igual a
  `actual_minutes`, sin pérdidas por redondear cada tramo por separado.
- **Rationale**: si se redondeara cada tramo por separado, una sesión de 23:00:30 a 00:10:40 (70
  min) se partiría en 59 + 10 = 69. El acumulado da 59 + 11 = 70.
- **Dónde se usa**: solo con `kind = 'cronometro'` y `ended_at` no nulo. El temporizador devuelve
  siempre un único tramo `{ date: local_date, minutes: actual_minutes }`.
- **Lectura**: `fetchTandasFromDb()` ya trae todas las tandas y el filtrado se hace en TypeScript
  (Principio III). El agregador incluye cualquier sesión cuyo tramo caiga en el rango pedido,
  aunque su `local_date` sea anterior al inicio del rango (US-F3-AS11).

## R7 — Una sola regla de unidades y minutos por día

- **Decision**: se crea un módulo puro, `lib/domain/focus.ts`, con estas funciones:
  - `sessionUnits(kind, minutes)`;
  - `countsTowardMinimum(tanda, objetivo)`;
  - `sessionShares(tanda, split)`;
  - `tallyDay(dateKey, tandas, objetivosById, split)`, que devuelve `{ completadas, unidades,
    interrumpidas, minutos_foco }`.

  `tandaUnits` de `lib/domain/execution.ts` se conserva para el temporizador, porque la usan los
  tests de la 003; `sessionUnits` delega en ella. Hoy hay **tres** sitios que calculan unidades por
  su cuenta: `today.ts:74`, `compliance.ts:131` y `tandas.ts:273` (`readTandas().por_dia`, del que
  depende `checks.ts:113`). Los tres pasan a llamar a `tallyDay`. Ese era el riesgo de divergencia
  de esta feature.
- **Rationale**: FR-F04 y FR-F13 exigen una única función. Si se deja un sitio sin migrar, Hoy y
  el reporte dirían cosas distintas del mismo día.
- **Detalle**: `tandas_completadas` cuenta las filas completadas con algún tramo ese día. Un
  cronómetro repartido aparece como 1 completada en cada día que toca, con las unidades de su
  tramo. Se documenta en el data-model.

## R8 — El cronómetro y el tic

- **Decision**: `finalizeElapsed` filtra `kind = 'cronometro'` antes de comparar tiempos. El aviso
  "Terminó la tanda" de `tick.ts:337` solo se envía para lo que `finalizeElapsed` cierra, así que el
  cronómetro queda sin aviso sin tocar `tick.ts` más que en el texto de `tandaEndBody`. `endsAtMs`
  y `currentTanda` devuelven `null` en `ends_at` y `seconds_left` para el cronómetro, y agregan
  `elapsed_seconds`.

## R9 — Superficie web y MCP

- **Decision**:
  - `manage_objectives` (create/read/update/archive) entra en `ALLOWED_ACTIONS`.
  - `manage_quotes` y `manage_tandas:correct` **no** entran.
  - El resumen de foco tiene una ruta GET propia, `app/api/execution/focus/route.ts` (con
    `dynamic = 'force-dynamic'` y try/catch, igual que `today/route.ts`), y la herramienta MCP
    `get_focus_summary`. Las dos delegan en `handleGetFocusSummary`.
- **Registro MCP**: una herramienta nueva se agrega en **cuatro** sitios de `mcp-server/`:
  1. el arreglo de descriptores (~L50–500 de `index.ts`);
  2. el `mcpServer.tool(...)` del transporte HTTP (~L700+);
  3. la lista de nombres (~L822);
  4. `tools-handler.ts`.

  `__tests__/mcp/all-tools.test.ts` verifica el catálogo.

## R10 — Conflicto con FR-018 de la 001

- **Hallazgo**: FR-018 (001) dice "La pantalla de inicio NO DEBE mostrar minutos totales", y
  `buildTodayFooterView` lo documenta. Andres pidió explícitamente el total semanal y el mapa en
  Hoy.
- **Decision**: la spec 004 lo declara como reemplazo parcial. Hoy muestra el total de minutos
  enfocados de la semana y el mapa de 12 semanas, en un modelo de vista propio
  (`buildFocusStripView`), no en el pie. El pie (US3-AS8) no cambia. Hoy sigue sin mostrar metas,
  minutos faltantes ni avance contra la meta; eso vive solo en Command Center.

## R11 — Mapa de calor sin librería

- **Decision**: rejilla CSS hecha a mano (`components/ui/FocusHeatmap.tsx`), igual que los demás
  gráficos del repo (no hay librería de gráficos en `package.json`). La lógica (niveles, rejilla,
  días futuros vacíos, etiquetas) vive en `lib/domain/focus-heatmap.ts`, que se puede probar en
  `node`. Los colores son 5 tonos de una escala secuencial sobre el verde synergy de `DESIGN.md`,
  definidos como tokens CSS en `app/globals.css` (claro y oscuro), sin sombras ni glow.
- **Rationale**: 52 × 7 = 364 celdas son triviales para el DOM. Agregar una librería por un solo
  gráfico choca con "cada elemento se gana su lugar".
