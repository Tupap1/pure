# Contrato MCP — delta de la 004

Base: los contratos de `specs/001-modulo-ejecucion/contracts/`, `specs/002-ejecucion-ajustes/contracts/`
y `specs/003-tandas-variables/contracts/`. Aquí solo se describe lo que cambia o es nuevo. Todas las
respuestas siguen la forma `ExecutionResult`:
- `{ status: 'success', data }`;
- `{ status: 'error', code, message }`.

Los esquemas Zod son `.strict()`: una clave no reconocida da `DATOS_INVALIDOS`.

## `manage_tandas` (cambios)

Acciones: `start | finish | interrupt | current | read | update | log_late | correct`.

### `start`
```
{ kind?: 'temporizador' | 'cronometro'          // 'temporizador' por defecto
  planned_minutes?: int 10..180                 // solo temporizador; 10 por defecto
  objective_id?: string
  subject_id?, topic_id?, deliverable_id?, task_id?, routine_slot_id? }
```
- Cronómetro con `planned_minutes` → `DATOS_INVALIDOS` (US-F1-AS1).
- Temporizador con 9, 181 o un número no entero → `DATOS_INVALIDOS` (US-F1-AS3).
- `objective_id` inexistente → `NO_ENCONTRADO`; archivado → `OBJETIVO_ARCHIVADO` (US-F2-AS3).
- Ya hay una sesión en curso (de cualquier tipo) → `TANDA_EN_CURSO` (US-F1-AS7).
- Devuelve `{ tanda, ends_at: string | null }`, con `ends_at = null` en el cronómetro.
- `started_at` y `ended_at` del cliente siguen rechazados (regresión de la 003).

### `finish`
`{ id }`.
- Temporizador: sin cambios (exige el tiempo planeado, con 30 s de margen).
- Cronómetro: con 60 s o más transcurridos, cierra como `completada` con
  `actual_minutes = floor(elapsed / 60 s)`. Con menos → `CRONOMETRO_MUY_CORTO` y sigue en curso
  (US-F1-AS4/AS5).
- Si el cierre ocurre después de `locked_at`, queda `edited_after_lock = true` (US-F1-AS11).

### `interrupt`
Sin cambios de forma. En un cronómetro también se marca `edited_after_lock` si es después de
`locked_at`.

### `current`
`{ tanda | null, seconds_left: number | null, elapsed_seconds: number | null, server_now }`.
- Temporizador: `seconds_left` numérico.
- Cronómetro: `seconds_left = null` y `elapsed_seconds` numérico.

### `read`
`{ from?, to?, subject_id?, objective_id? }`.
- Devuelve las tandas cuyo tramo cae en el rango (un cronómetro repartido aparece si alguno de sus
  tramos cae en él).
- `por_dia[]` = `{ date, completadas, unidades, interrumpidas, minutos }` según `tallyDay`
  ([data-model.md](../data-model.md)).

### `update`
Agrega `objective_id?: string` (debe existir; puede ser un objetivo archivado, porque reclasificar
una sesión vieja hacia un objetivo archivado es legítimo). Sigue sin aceptar tiempos (US-F2-AS10).

### `correct` (nueva, solo MCP)
`{ id: string, ended_at: ISO 8601, reason: string 1..140 }`.

| Situación | Cota de `ended_at` | Resultado |
|---|---|---|
| Sesión cerrada (completada o interrumpida) | `started_at + 60 s ≤ ended_at < ended_at registrado` | Conserva su estado. `actual_minutes = floor((ended_at − started_at) / 60 s)` |
| Cronómetro en curso | `started_at + 60 s ≤ ended_at ≤ now` | Queda `completada` y libera `running_lock` |
| Temporizador en curso | — | `CORRECCION_INVALIDA` |

- Fuera de cota → `CORRECCION_INVALIDA` y nada cambia (US-F4-AS3).
- `reason` vacía o de más de 140 caracteres → `DATOS_INVALIDOS` (US-F4-AS6). Inexistente →
  `NO_ENCONTRADO`.
- Efectos: `corrected = true`, `corrected_at = now`, `correction_reason = reason`.
  `original_ended_at` y `original_minutes` solo se escriben si estaban nulos; en un cronómetro en
  curso, el original es `now` y sus minutos hasta `now` (US-F4-AS1/AS4).
- Disponible siempre, sin importar `locked_at` (US-F4-AS5). No toca `edited_after_lock`, salvo al
  **cerrar** un cronómetro en curso después de su `locked_at` (US-F1-AS11).
- Excepción documentada al Principio III (plan.md, Complexity Tracking).

## `get_today` (cambios)

Agrega los campos de [data-model.md](../data-model.md) § "Cambios en payloads":
- en `running_tanda`: `kind`, `objective_id` y `elapsed_seconds`;
- en el payload: `foco_semana_minutos`, `foco_12_semanas` y `frase_del_dia`.

`unidades_hoy` y `evaluacion_dia` salen de `tallyDay`.

## `get_compliance_report` y `manage_weekly_report` (cambios)

El resultado y el payload congelado agregan `correcciones: { total, minutos_recortados }`.
- Se cuentan por la semana local de `corrected_at`.
- Siempre vienen presentes, con `{ total: 0, minutos_recortados: 0 }` si no hubo ninguna
  (US-F4-AS8).
- El texto del reporte agrega la línea `Correcciones: N (M min recortados)` solo cuando N > 0,
  igual que la de registros tardíos.

## `manage_objectives` (nueva)

Acciones: `create | read | update | archive`. Web: las cuatro.

| Acción | `data` | Devuelve / errores |
|---|---|---|
| `create` | `{ name: 1..60, subject_id?: string, weekly_target_minutes?: int 1..10080 }` | El objetivo. `OBJETIVO_DUPLICADO`, `NO_ENCONTRADO` (materia), `DATOS_INVALIDOS` |
| `read` | `{ include_archived?: boolean }` (false por defecto) | `{ objetivos[] }`, ordenados por nombre |
| `update` | `{ id, name?, subject_id?: string \| null, weekly_target_minutes?: int \| null }` | Mismas validaciones que `create`. Archivado → `OBJETIVO_ARCHIVADO` |
| `archive` | `{ id }` | Idempotente: archivar dos veces no es un error |

## `get_focus_summary` (nueva)

`data?: { weeks?: int 1..53 (52 por defecto), objective_id?: string, subject_id?: string, at?: ISO }`.
- `objective_id` y `subject_id` juntos → `DATOS_INVALIDOS`.
- `at` es solo para pruebas, igual que en `get_today`.
- Devuelve `FocusSummary` ([data-model.md](../data-model.md)).
- La web lo obtiene por `GET /api/execution/focus` con el mismo handler (US-F3-AS9).

## `manage_quotes` (nueva, solo MCP)

Acciones: `create | create_many | read | update | deactivate`. Ninguna está en la web
(US-F5-AS6).

| Acción | `data` | Notas |
|---|---|---|
| `create` | `{ text: 1..300, translation?: ..300, source?: ..120 }` | Idempotente por texto normalizado: devuelve la existente |
| `create_many` | `{ frases: [{ text, translation?, source? }] }` (1..200) | Todo o nada. Devuelve `{ creadas, omitidas }` (US-F5-AS1/AS2) |
| `read` | `{ include_inactive?: boolean }` | Ordenadas por `id` |
| `update` | `{ id, text?, translation?, source?, active? }` | Cambiar `text` no cambia el `id` |
| `deactivate` | `{ id }` | `active = false` (US-F5-AS5) |

La carga inicial se hace una vez, desde el asistente, con el contenido de
`specs/004-foco-cronometro/frases.json` en `create_many`.
