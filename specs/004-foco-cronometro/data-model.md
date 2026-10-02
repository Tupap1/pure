# Data Model: 004 Foco

**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

Todas las tablas de este documento son solo de Postgres (Módulo de Ejecución). No van a Dexie ni a
`schema-type-consistency.test.ts`. Las migraciones solo crean estructura: ninguna siembra datos
(Principio I).

## Migración `015_objetivos_frases.sql`

Va primero porque `tandas.objective_id` (016) referencia `objetivos`.

### `objetivos`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | `TEXT PRIMARY KEY` | `objetivo-<uuid>`, lo genera el servidor |
| `name` | `TEXT NOT NULL` | 1–60 caracteres tras `trim()` (Zod) |
| `active_name_key` | `TEXT UNIQUE` | `lower(trim(name))` si está activo, `NULL` si está archivado (R3) |
| `subject_id` | `TEXT REFERENCES subjects(id) ON DELETE SET NULL` | opcional |
| `weekly_target_minutes` | `INT` | `CHECK (weekly_target_minutes IS NULL OR weekly_target_minutes BETWEEN 1 AND 10080)` |
| `archived` | `BOOLEAN NOT NULL DEFAULT FALSE` | |
| `archived_at` | `TIMESTAMPTZ` | hora del servidor al archivar |
| `created_at` | `TIMESTAMPTZ DEFAULT NOW()` | |

- Índice: `idx_objetivos_subject (subject_id)`.
- No se borran: `archive` pone `archived = TRUE`, `archived_at = now` y `active_name_key = NULL`.
  No hay acción para desarchivar en esta feature.
- **Invariante**: `archived = FALSE ⇔ active_name_key IS NOT NULL`. Lo mantiene el servicio, con un
  test que lo fija.

### `frases`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | `TEXT PRIMARY KEY` | `frase-` + 16 hex del SHA-256 de `lower(trim(text))` (R4) |
| `text` | `TEXT NOT NULL` | latín, 1–300 |
| `translation` | `TEXT` | opcional, hasta 300 |
| `source` | `TEXT` | opcional, hasta 120 |
| `active` | `BOOLEAN NOT NULL DEFAULT TRUE` | |
| `created_at` | `TIMESTAMPTZ DEFAULT NOW()` | |

## Migración `016_tandas_cronometro.sql`

Sobre `tandas` (008 + 013 + 014). Todo es idempotente (`ADD COLUMN IF NOT EXISTS`,
`DROP CONSTRAINT IF EXISTS` + `ADD`) porque el arnés corre las migraciones dos veces.

| Cambio | Detalle |
|---|---|
| `ALTER COLUMN planned_minutes DROP NOT NULL` | Admite NULL en el cronómetro (R1). El `DEFAULT 10` se mantiene. |
| `kind TEXT NOT NULL DEFAULT 'temporizador'` | Las filas existentes quedan como temporizador. |
| `objective_id TEXT REFERENCES objetivos(id) ON DELETE SET NULL` | + `idx_tandas_objective (objective_id)`. |
| `corrected BOOLEAN NOT NULL DEFAULT FALSE` | |
| `corrected_at TIMESTAMPTZ` | Hora del servidor de la **última** corrección; el reporte cuenta por ella. |
| `original_ended_at TIMESTAMPTZ` | Fin antes de la **primera** corrección. En un cronómetro en curso, la hora del servidor en que se corrigió. |
| `original_minutes INT` | Minutos antes de la primera corrección. |
| `correction_reason TEXT` | La razón de la última corrección, 1–140. |
| `DROP CONSTRAINT IF EXISTS tandas_planned_minutes_rango` | La de la 013. |
| `ADD CONSTRAINT tandas_tipo_duracion` | `CHECK ((kind = 'temporizador' AND planned_minutes IS NOT NULL AND planned_minutes BETWEEN 10 AND 180) OR (kind = 'cronometro' AND planned_minutes IS NULL))` (R2). |
| `ADD CONSTRAINT tandas_correccion_completa` | `CHECK (corrected = FALSE OR (corrected_at IS NOT NULL AND original_ended_at IS NOT NULL AND original_minutes IS NOT NULL AND correction_reason IS NOT NULL))` |

`mode` **no** se reutiliza: sigue siendo la clasificación libre de `update` (001).

### `TandaRecord` (`lib/db/execution-pg.ts`)

Agrega `kind: 'temporizador' | 'cronometro'`, `objective_id?`, `corrected`, `corrected_at?`,
`original_ended_at?`, `original_minutes?` y `correction_reason?`. `planned_minutes` pasa a
`number | null`. `saveTandaToDb` incluye las columnas nuevas en el INSERT y en el
`ON CONFLICT DO UPDATE`. `kind`, `local_date`, `started_at` y `planned_minutes` no se actualizan
nunca en un conflicto, igual que hoy.

### `__tests__/helpers/test-db.ts`

`reset()` agrega `objetivos` y `frases` a su lista, **después** de `tandas` (primero las hijas).

## Estados y transiciones de una sesión

```
                start(kind)
                    │
                    ▼
               ┌─────────┐   finish (temporizador: tiempo cumplido ±30 s;
               │en_curso │           cronómetro: ≥ 1 min)                 ┌───────────┐
               │         │──────────────────────────────────────────────▶│completada │
               │         │   finalizeElapsed (solo temporizador)          │           │
               │         │──────────────────────────────────────────────▶│           │
               │         │   correct (solo cronómetro) ──────────────────▶│ corrected │
               │         │   interrupt (razón)        ┌─────────────┐     └───────────┘
               │         │───────────────────────────▶│interrumpida │          │
               └─────────┘                            └─────────────┘          │
                                                            │ correct (acorta) │ correct (acorta)
                                                            ▼                  ▼
                                                     (mismo estado, corrected = TRUE)
```

- `correct` sobre un **temporizador en curso** → `CORRECCION_INVALIDA`.
- `correct` sobre una sesión cerrada conserva su estado, recalcula `actual_minutes` y
  `ended_at`, y no toca `edited_after_lock`.
- Un cronómetro que se cierra (finish, interrupt o correct) después de su `locked_at` queda con
  `edited_after_lock = TRUE` (US-F1-AS11).

## Conceptos derivados (no almacenados)

### Tramo por día (`DayShare`)

`{ date: 'YYYY-MM-DD', minutes: number }`.

- Un temporizador, o cualquier sesión sin `ended_at`, produce un solo tramo `{ local_date,
  actual_minutes ?? 0 }`.
- Un cronómetro cerrado produce `splitByLocalDay(started_at, ended_at)`, con minutos acumulados con
  piso (R6). La suma de sus tramos es `actual_minutes`.

### Unidad

`sessionUnits(kind, minutes)`:
- `temporizador` → `max(1, floor(minutes / 10))`, que es la `tandaUnits` de la 003;
- `cronometro` → `floor(minutes / 10)`.

En un cronómetro repartido, `minutes` son los del tramo de ese día.

### Cuenta para el mínimo

`countsTowardMinimum(t, objetivo)`:
- `false` solo si se cumplen las tres: `t.objective_id` está puesto, `objetivo.subject_id` es nulo,
  y `t.subject_id`, `t.topic_id`, `t.task_id` y `t.deliverable_id` son todos nulos;
- `true` en cualquier otro caso, incluida una tanda sin ningún vínculo (regresión US-F2-AS7);
- si el objetivo no existe (referencia anulada), se trata como sin objetivo.

### Recuento del día (`tallyDay`)

Para una `dateKey`, sobre los tramos de ese día:

| Campo | Regla |
|---|---|
| `completadas` | Filas `completada` con un tramo ese día que cuentan para el mínimo |
| `unidades` | Σ `sessionUnits(kind, minutos_del_tramo)` de esas mismas filas |
| `interrumpidas` | Filas `interrumpida` con tramo ese día |
| `minutos_foco` | Σ minutos de los tramos `completada` + `interrumpida`, cuenten o no para el mínimo |

`completadas` y `unidades` alimentan `evaluateDay` (sin cambios en su firma) en `today.ts`,
`compliance.ts` y `readTandas().por_dia`. `por_dia.minutos` pasa a ser `minutos_foco`.

### Resumen de foco (`FocusSummary`)

| Campo | Contenido |
|---|---|
| `rango` | `{ desde, hasta, semanas }`. `desde` es el lunes de hace `semanas − 1` semanas; `hasta` es hoy (local). |
| `dias[]` | `{ date, minutos, nivel }` para cada día del rango, con 0 explícito. |
| `semanas[]` | `{ lunes, minutos }`. |
| `total_semana` | Minutos de lunes a hoy de la semana actual. |
| `por_objetivo[]` | Semana actual, **sin filtro**: `{ tipo: 'objetivo' \| 'materia' \| 'sin_objetivo', id, nombre, minutos, meta \| null, archivado }`. |

- El filtro (`objective_id` o `subject_id`) afecta a `dias`, `semanas` y `total_semana`.
- Cada sesión cae en una sola fila de `por_objetivo`: su objetivo; si no tiene, su materia; si no,
  "Sin objetivo" (FR-F16).
- Los objetivos activos con meta aparecen aunque sumen 0.
- Los nombres de materia salen de `fetchSubjectsFromDb()` (`lib/db/repository-pg.ts:207`).

### Nivel del mapa

`heatLevel(m)`:

| Minutos | Nivel |
|---|---|
| 0 | 0 |
| 1–30 | 1 |
| 31–90 | 2 |
| 91–180 | 3 |
| > 180 | 4 |

### Frase del día

`quoteOfDay(dateKey, frases)` devuelve `{ text, translation, source } | null`. Toma las activas
ordenadas por `id` y usa el índice `dayNumber(dateKey) mod N` (R5). Con 0 activas devuelve `null`.

## Cambios en payloads existentes

| Payload | Cambio |
|---|---|
| `TodayPayload.running_tanda` | + `kind`, `objective_id`, `elapsed_seconds`. `ends_at` y `seconds_left` pasan a `string \| null` y `number \| null` (null en el cronómetro). |
| `TodayPayload.tandas_today` | Pasa a contar solo las sesiones completadas que cumplen la regla del mínimo (`tallyDay.completadas`): una sesión de un objetivo sin materia no aparece en "N tandas hoy". Sus minutos sí están en `foco_semana_minutos`. |
| `TodayPayload` | + `foco_semana_minutos: number`, `foco_12_semanas: { date, minutos, nivel }[]` y `frase_del_dia: { text, translation, source } \| null`. |
| `ComplianceResult` y payload del reporte semanal | + `correcciones: { total, minutos_recortados }`, contadas por la semana local de `corrected_at`, con ceros explícitos. `minutos_recortados` = Σ (`original_minutes` − `actual_minutes`). |
| `readTandas().por_dia[]` | `unidades` y `completadas` según `tallyDay`; `minutos` = `minutos_foco`. |

## Constantes (`lib/execution/constants.ts`)

| Constante | Valor |
|---|---|
| `TANDA_MINUTES_MAX` | 180 (era 60) |
| `TANDA_MINUTES_MIN` | 10 |
| `TANDA_DURATION_OPTIONS` | `[10, 25, 40, 60]`, sin cambios |
| `LATE_LOG_MIN_MINUTES` | 10 (nueva) |
| `LATE_LOG_MAX_MINUTES` | 60 (nueva) |
| `CRONOMETRO_MIN_FINISH_SECONDS` | 60 |
| `CORRECTION_REASON_MIN` / `CORRECTION_REASON_MAX` | 1 / 140 |
| `OBJECTIVE_NAME_MAX` | 60 |
| `WEEKLY_TARGET_MAX_MINUTES` | 10080 |
| `QUOTE_TEXT_MAX` / `QUOTE_TRANSLATION_MAX` / `QUOTE_SOURCE_MAX` | 300 / 300 / 120 |
| `QUOTE_BATCH_MAX` | 200 (tamaño máximo de `create_many`) |
| `FOCUS_WEEKS_DEFAULT` / `FOCUS_WEEKS_MAX` | 52 / 53 |
| `TODAY_HEATMAP_WEEKS` | 12 |
| `HEAT_LEVEL_BOUNDS` | `[30, 90, 180]` |

`logLateTanda` (`tandas.ts:404`) pasa a usar `LATE_LOG_MIN_MINUTES` y `LATE_LOG_MAX_MINUTES`, así
que subir `TANDA_MINUTES_MAX` no lo cambia (US-T2-AS4 sigue en verde).

## Códigos de error nuevos (`ExecutionErrorCode`)

| Código | Cuándo |
|---|---|
| `CRONOMETRO_MUY_CORTO` | `finish` de un cronómetro con menos de 60 s |
| `OBJETIVO_DUPLICADO` | Nombre normalizado repetido entre los activos |
| `OBJETIVO_ARCHIVADO` | `start` con un objetivo archivado |
| `CORRECCION_INVALIDA` | Fin fuera de cotas, o temporizador en curso |
