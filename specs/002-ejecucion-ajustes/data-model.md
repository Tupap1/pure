# Data Model — Ajustes del Módulo de Ejecución (002)

Parte del modelo de la 001 (`specs/001-modulo-ejecucion/data-model.md`); aquí solo van las
diferencias. Las tablas nuevas son solo-Postgres y su SQL respeta el Principio III: sin plpgsql, sin
`AT TIME ZONE` y sin índices únicos parciales.

## Tablas nuevas (US-B5)

```sql
-- 012_friction.sql — US-B5 (002): medidas de fricción del teléfono y calificación semanal de irritación
CREATE TABLE IF NOT EXISTS friction_measures (
  id TEXT PRIMARY KEY,           -- measure_key
  enabled_slot TEXT UNIQUE,      -- 'a' | 'b' mientras está habilitada; NULL si no (máximo 2)
  started_on TEXT,               -- YYYY-MM-DD (PURE_TZ) de la última habilitación
  enabled_at TIMESTAMPTZ,        -- instante de la última habilitación
  verified_at TIMESTAMPTZ,       -- última verificación; se limpia al volver a habilitar
  disabled_at TIMESTAMPTZ,       -- último retiro
  drop_reason TEXT,              -- 'manual' | 'irritacion'; NULL mientras está habilitada
  created_at TIMESTAMPTZ DEFAULT NOW());

CREATE TABLE IF NOT EXISTS friction_ratings (
  id TEXT PRIMARY KEY,           -- = program_week_id: una calificación por semana
  program_week_id TEXT NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score BETWEEN 0 AND 10),
  rated_at TIMESTAMPTZ NOT NULL,
  drop_applied_at TIMESTAMPTZ,   -- el par (semana anterior, esta) con ambas >= 7 ya se atendió
  dropped_measure_id TEXT,       -- medida que retiró ese par; NULL si no había ninguna habilitada
  created_at TIMESTAMPTZ DEFAULT NOW());
```

En `__tests__/helpers/test-db.ts`, `reset()` agrega `friction_ratings` y `friction_measures` al
principio de la lista, hijas primero: `friction_ratings` referencia a `program_weeks`.

No hay otras migraciones. Las aperturas de planeación usan el valor `planeacion` que la columna
`plan_views.surface` ya admite desde la 001.

## Reglas de validación

| Entidad (tabla) | Reglas |
|---|---|
| Medida de fricción (`friction_measures`) | `id` ∈ `sin_biometria`, `clave_larga`, `escala_grises`, `redes_fuera_home`, `app_desinstalada`, validado en Zod (`celular_afuera` no entra). `enabled_slot` no nulo ⇔ habilitada; el UNIQUE garantiza como máximo 2. Todos los instantes salen del reloj del servidor |
| Calificación de irritación (`friction_ratings`) | `score` entero de 0 a 10 (Zod, con el CHECK como respaldo). Una por semana, con id determinista. La semana tiene que haber empezado (`starts_on ≤ hoy`) |
| Apertura del plan (`plan_views`, sin cambios de estructura) | `surface='semana'` pasa por la compuerta. `surface='planeacion'` cuando la semana todavía no empieza: `was_gated=false`, `reason=NULL` e id `${program_week_id}:planeacion-${n}` |

## Transiciones de estado

```text
Medida:       (sin fila) ──enable──▶ habilitada (enabled_slot 'a'|'b', started_on, enabled_at; verified_at NULL)
              habilitada ──verify──▶ habilitada (verified_at = now)
              habilitada ──disable──▶ deshabilitada (enabled_slot NULL, disabled_at, drop_reason 'manual')
              habilitada ──tick: par de semanas ≥ 7──▶ deshabilitada (drop_reason 'irritacion')
              deshabilitada ──enable──▶ habilitada (se limpian disabled_at, drop_reason y verified_at)
              enable sobre habilitada / disable sobre deshabilitada: sin cambios

Calificación: (sin fila) ──rate──▶ calificada ──rate──▶ calificada (score y rated_at nuevos; conserva drop_applied_at)
              calificada ──tick: esta y la anterior ≥ 7, drop_applied_at NULL──▶ atendida (drop_applied_at, dropped_measure_id)
```

## Valores derivados (en TypeScript, nunca en SQL)

| Valor | Regla |
|---|---|
| Semana a planear | `resolvePlanningWeek` (R-B03): domingo con una semana que empieza mañana → esa; si no, la que contiene hoy; si no, la próxima con `starts_on > hoy`; si no, `sin_programa` o `programa_terminado` |
| Semana a ver | `resolveViewWeek` (R-B03): la misma resolución, sin el paso del domingo |
| Semana empezada | `starts_on ≤ hoy`, en fecha local |
| Desglose del día | `describeDay` (R-B07): `{ tandas_completadas, min_requerido, cumplio_tandas, cumplio_habitos, day_fulfilled }`, o `null` fuera del programa |
| Aperturas del plan | `summarizePlanOpenings` (R-B06): `surface='semana'`, día local de `viewed_at` dentro del rango y `viewed_at ≤ corte` |
| Medida confirmada | `verified_at` no nulo y `verified_at ≥ enabled_at` |
| Medida más reciente | la habilitada con el `enabled_at` mayor |
| Irritación de la semana en curso | `score` de la calificación de la semana que contiene hoy, o `null` |
| Retiros del reporte | `listIrritationDropsInRange` (R-B10): `drop_reason='irritacion'`, día local de `disabled_at` dentro del rango y `disabled_at ≤ corte` |

## Payload del reporte semanal

| Campo | Cambio |
|---|---|
| `aperturas_plan: { total, con_razon, libres_usadas }` | Nuevo (US-B3). Reemplaza a `plan_openings` |
| `plan_openings` | Ya no se escribe. `renderReportText` lo sigue leyendo si un payload congelado antes de la 002 lo trae |
| `habits` | Omite los hábitos sin días activos en la semana (FR-B15) |
| `friccion_retiradas: [{ measure_key, fecha }]` | Nuevo (US-B5). Lista vacía si no hubo retiros; ausente en payloads anteriores a US-B5 |
