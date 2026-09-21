# Data Model — Tandas de duración variable y registro tardío (003)

Parte del modelo de la 001 y la 002 (`specs/001-modulo-ejecucion/data-model.md` y
`specs/002-ejecucion-ajustes/data-model.md`); aquí solo van las diferencias. Las migraciones
respetan el Principio III: sin plpgsql, sin `AT TIME ZONE` y sin índices únicos parciales.

## Migraciones nuevas

```sql
-- 013_tandas_duracion_variable.sql — US-T1: restricción de rango
ALTER TABLE tandas
ADD CONSTRAINT tandas_planned_minutes_rango
CHECK (planned_minutes BETWEEN 10 AND 60);

-- 014_tanda_registro_tardio.sql — US-T2: marca de registro tardío
ALTER TABLE tandas
ADD COLUMN IF NOT EXISTS late_logged BOOLEAN NOT NULL DEFAULT FALSE;
```

Ambas reeejecutables: envueltas en el patrón de `DO` / `EXCEPTION` que usan otras migraciones
del repo (no reintentarán si la restricción o columna ya existe). La migración `013` no requiere
normalización: todas las 6 tandas de producción tienen `planned_minutes = 10` (research.md).

En `__tests__/helpers/test-db.ts`, `reset()` ejecuta las migraciones reales, así que no hay que
tocar nada aparte.

## Cambios en la entidad `tanda`

| Campo | Cambio |
|---|---|
| `planned_minutes` | Rango pasa de 5–25 (constantes) a 10–60 (constantes + CHECK en BD). Por defecto sigue siendo 10 (FR-T02). |
| `late_logged` | Nuevo. `BOOLEAN NOT NULL DEFAULT FALSE`. Verdadero solo para tandas creadas por `log_late`. |
| Otros campos | Sin cambios. `actual_minutes` sigue siendo lo que dura la tanda en realidad. `status` sigue siendo 'en_curso', 'completada', 'interrumpida', 'huérfana'. |

## Concepto derivado: unidad

No se almacena. Se calcula así:

```
unidad(tanda) = max(1, floor(actual_minutes / 10))
```

- Solo aplica a tandas **completadas** (status='completada'). Las interrumpidas no aportan unidades.
- Una tanda de 60 min = 6 unidades; de 25 = 2; de 10 = 1; de 8 = 1 (piso).
- Es la moneda con la que se mide el mínimo diario (`min_tandas_dia`), reemplazando el conteo de filas.
- En la UI se dice "tandas" porque una unidad es exactamente la tanda de 10 minutos, y así no se
  introduce nueva terminología.
- Implementada como función pura TypeScript en `lib/domain/execution.ts:tandaUnits()`.

## Transiciones de estado (sin cambios)

```text
Tanda normal:    (no existe) ──start──▶ en_curso ──finish/timeout──▶ completada
Tanda tardía:    (no existe) ──log_late──▶ completada (directamente, sin en_curso)
```

Una tanda tardía (`late_logged=true`):
- Nace en estado 'completada' con `running_lock: NULL` (nunca estuvo en curso).
- No interfiere con una tanda en curso, salvo por validación de solapamiento (US-T2-AS5).
- Una tanda en curso ocupa el tramo `[started_at, ahora]` para el solapamiento.
- Cuenta para el mínimo del día con la misma regla de unidades.

## Campos nuevos en las respuestas MCP

| Respuesta | Cambio |
|---|---|
| `manage_tandas.read` (resumen por día) | Agrega `unidades`: suma de unidades de las tandas completadas. Se devuelve junto a `completadas` (filas), `interrumpidas` e `interrumpidas_minutos`. |
| `get_today` | Agrega `evaluacion_dia.unidades_completadas` (sum de unidades del día local). |
| `get_compliance_report` (resumen diario) | Agrega `evaluacion_dia.unidades_completadas` por día. |
| `get_compliance_report` (resumen de semana) | Agrega `registros_tardios: { total, minutos }` donde total es el conteo de tandas con `late_logged=true` en el rango, y minutos es su suma de `actual_minutes`. Si no hay, `{ total: 0, minutos: 0 }`. |
| `manage_weekly_report` (payload congelado y preview) | Agrega `registros_tardios: { total, minutos }` en la misma forma. |

## Validaciones

| Entidad (tabla) | Regla |
|---|---|
| `tanda` | `planned_minutes` ∈ [10, 60]. Validado en Zod `TandaStartSchema` y por `CHECK` en BD (Principio III). |
| `tanda` (registro tardío) | Campo `late_logged` manejado por la BD; no se acepta en entrada. `log_late` siempre lo pone en true. |
| Registro tardío (`log_late`) | `subject_id` obligatorio. `started_at` e `ended_at` en ISO 8601. `topic_id` y `task_id` opcionales. Validado en Zod `TandaLogLateSchema` `.strict()`. |

## Reglas de negocio: `log_late`

Entrada: `{ subject_id, started_at, ended_at, topic_id?, task_id? }`

Rechaza con `REGISTRO_TARDIO_INVALIDO` si:
- `started_at` o `ended_at` caen en un día local distinto al del servidor (mismo `PURE_TZ`).
- `started_at` es más de 6 horas antes de ahora.
- `ended_at` es posterior a la hora del servidor o no es posterior a `started_at`.
- La duración es < 10 o > 60 minutos.
- Se solapa con otra tanda del mismo día. Una tanda en curso ocupa `[started_at, ahora]`.

Rechaza con `LIMITE_REGISTRO_TARDIO` si:
- Ya hay 3 tandas con `late_logged=true` en ese día local.

Si pasa validación, crea una tanda:
- `status: 'completada'`
- `actual_minutes: floor((ended_at - started_at) / 1000 / 60)` (redondeado hacia abajo)
- `running_lock: NULL`
- `late_logged: true`
- `locked_at` según la regla de la 001 (con `actual_minutes`; si cumple margen de 30 s, se marca como lograda)
- Fecha y hora de inicio y fin toman los valores del cliente (únicas excepciones al Principio III)

Límites y ventanas en constantes:
- `LATE_LOG_MAX_HOURS_BACK = 6`
- `LATE_LOG_MAX_PER_DAY = 3`
- `TANDA_MINUTES_MIN = 10`, `TANDA_MINUTES_MAX = 60`

