# Contrato — Herramientas MCP del Módulo de Ejecución

Cada herramienta se declara en **dos lugares** de `mcp-server/index.ts`: en `TOOLS_LIST` y en
`mcpServer.tool(name, descripción, { action: z.enum([...]), data: z.any().optional() }, …)`, igual
que `manage_study_blocks`. La validación real ocurre dentro del handler, con esquemas Zod
estrictos. Los handlers viven en `lib/execution/handlers.ts` y `mcp-server/tools-handler.ts` los
re-exporta.

Las descripciones van en español y enuncian las reglas que el agente debe respetar: días de 1 a 7,
un solo disparador, sin duración en los disparadores, sin tandas retroactivas y datos cargados
solo por herramientas.

## Respuesta

```ts
// Éxito
{ status: 'success', message?: string, data?: unknown }
// Error — el campo `code` es nuevo y aditivo; los tests verifican `code`, no `message`
{ status: 'error', code: ErrorCode, message: string }
```

| Código | Cuándo |
|---|---|
| `DATOS_INVALIDOS` | Zod rechaza la entrada (formato o rango) |
| `SOBRE_ESPECIFICACION` | Un disparador trae claves no permitidas (duración, tandas, método…) |
| `NO_ENCONTRADO` | El `id` no existe |
| `TANDA_EN_CURSO` | Ya hay una tanda en curso, o se intenta editar una en curso |
| `TANDA_NO_TERMINADA` | `finish` antes de cumplirse el tiempo (usar `interrupt`) |
| `RAZON_REQUERIDA` | `interrupt` sin razón; intención < 6 sin razón; 3.ª apertura sin razón |
| `DIA_CERRADO` | Registrar un hábito después de las 03:00 del día siguiente |
| `FECHA_FUTURA` | Registrar un hábito en una fecha futura |
| `HABITO_INACTIVO` | Registrar un hábito que no está activo ese día |
| `NO_ES_LUNES` | Una semana del programa que no empieza en lunes |
| `PROGRAMA_EXISTENTE` | `init` cuando ya hay semanas creadas |
| `SEMANA_EN_CURSO` | Editar una semana ya iniciada |
| `CONSENTIMIENTO_REQUERIDO` | `set_partner` sin `consented_at` |
| `SIN_PARTNER` | Enviar un reporte sin destinatario vigente |
| `REPORTE_NO_CONGELADO` | `set_note` o `send` sobre una semana sin reporte congelado |
| `VENTANA_CERRADA` | `set_note` después de `note_deadline` |
| `YA_ENVIADO` | `send` sobre un reporte ya enviado |
| `PARTIR_TAREA` | Tarea con más de 3 tandas |

## Herramientas

### `manage_tandas` (US1)

| Acción | `data` | Devuelve |
|---|---|---|
| `start` | `subject_id?`, `topic_id?`, `deliverable_id?`, `task_id?`, `routine_slot_id?`, `planned_minutes?` (5–25, por defecto 10) | `{ tanda, ends_at }` · `TANDA_EN_CURSO` |
| `finish` | `id` | Tanda completada (idempotente) · `TANDA_NO_TERMINADA` |
| `interrupt` | `id`, `interrupt_reason` (1–140) | Tanda interrumpida, o la completada si el tiempo ya se había cumplido · `RAZON_REQUERIDA` |
| `current` | — | `{ tanda \| null, seconds_left \| null, server_now }` |
| `read` | `from?`, `to?` (YYYY-MM-DD), `subject_id?` | `{ tandas[], por_dia: [{ date, completadas, interrumpidas, minutos }] }` |
| `update` | `id` + (`subject_id` \| `topic_id` \| `deliverable_id` \| `task_id` \| `mode` \| `interrupt_reason`) | Tanda (con `edited_after_lock` si aplica) · `TANDA_EN_CURSO` · `DATOS_INVALIDOS` si trae tiempos |

No existe ninguna acción que registre tandas pasadas ni que acepte `started_at` o `ended_at`.

### `manage_daily_checks` (US3)

| Acción | `data` | Devuelve |
|---|---|---|
| `set` | `habit_id`, `status` (cumplido/fallado/na), `date?` (hoy por defecto), `value?`, `note?` (≤ 200) | El registro (upsert por `${date}:${habit_id}`) · `DIA_CERRADO` · `FECHA_FUTURA` · `HABITO_INACTIVO` |
| `read` | `from?`, `to?` | `{ dias: [{ date, week_number, checks[], evaluacion: { tandasOk, habitsOk, fulfilled } \| null }] }` |

### `manage_program` (fundacional)

| Acción | `data` | Devuelve |
|---|---|---|
| `init` | `starts_on` (lunes), `weeks: [{ min_tandas_dia (0–12), phase }]` | Semanas `pw-01…` · `NO_ES_LUNES` · `PROGRAMA_EXISTENTE` |
| `read` | — | `{ weeks[], current_week, habits[] }` |
| `update_week` | `id`, `min_tandas_dia?`, `phase?` | La semana · `SEMANA_EN_CURSO` |
| `upsert_habit` | `id`, `label`, `started_on`, `days_of_week?`, `target_days?` | El hábito |
| `retire_habit` | `id`, `retired_on` | El hábito |

### `manage_routine_slots` (US2)

| Acción | `data` | Devuelve |
|---|---|---|
| `create` / `update` | `id?` (update), `days_of_week`, `cue_kind`, `cue_text`, `action_text`, `anchor_time?`, `schedule_id?`, `subject_id?`, `habit_id?`, `kind`, `periodicity?`, `is_active?` | El disparador · `SOBRE_ESPECIFICACION` · `DATOS_INVALIDOS` |
| `read` | `id?` | Disparadores (con `huerfano: true` si es `tras_clase` sin horario) |
| `delete` | `id` | — |
| `respond` | `routine_slot_id`, `outcome` (hecho/no) | El outcome de hoy (idempotente: si ya había respuesta, la devuelve con `ya_respondido: true`); en un slot de hábito también fija el check |
| `rehearse` | `routine_slot_id`, `program_week_id?` (la semana en curso, o la siguiente si es domingo) | `{ ya_ensayado: boolean }` |

### `get_today` (US1–US3)

`data?`: `{ at? }` (ISO; solo lectura, para pruebas o consulta). Devuelve:

```ts
{
  server_now: string;              // ISO del servidor
  date: string;                    // YYYY-MM-DD local
  week: { number: number; total: number; phase: string } | null;
  running_tanda: { id; subject?; started_at; ends_at; seconds_left } | null;
  trigger: { id; cue_text; action_text; kind; subject? } | null;   // NUNCA una lista
  pending_checks: { habit_id; label }[];
  tandas_today: number;
  day_fulfilled: boolean | null;
}
```

### `get_compliance_report` (US6)

`data?`: `{ from?, to?, program_week_id? }`. Devuelve los días con su evaluación,
`days_fulfilled`, los hábitos como `{ id, label, cumplidos, total }`, las tandas (completadas,
interrumpidas y `por_materia: [{ subject_id, name, count, minutes }]`), los disparadores (`hecho`,
`no`, `sin_respuesta`), `razones_interrupcion[]`, `ediciones_tardias`, `dias_cumplidos_totales` y
`horizonte`.

### `get_grade_projection` (US5)

`data?`: `{ subject_id? }`. Devuelve:

```ts
{
  materias: [{
    subject_id, name,
    projection: { declaredWeight, gradedWeight, awaitingGradeWeight, remainingWeight,
                  currentAverage, consolidated, neededToPass, neededForTarget, ceiling },
    flags: ('ciega' | 'pesos_inconsistentes' | 'entregado_sin_nota'
            | 'vencido_sin_registrar' | 'meta_inalcanzable' | 'materia_perdida')[]
  }],
  alertas: [{ kind: 'abandonada' | 'ciega', subject_id, detalle }]
}
```

### `manage_weekly_report` (US6)

| Acción | `data` | Devuelve |
|---|---|---|
| `set_partner` | `name`, `email`, `consented_at` (ISO) | El destinatario vigente (desactiva el anterior) · `CONSENTIMIENTO_REQUERIDO` |
| `read_partner` | — | El destinatario vigente o `null` |
| `preview` | `program_week_id?` | `{ payload, verdict, text }` sin congelar |
| `set_note` | `program_week_id`, `note` (≤ 400) | El reporte · `REPORTE_NO_CONGELADO` · `VENTANA_CERRADA` |
| `send` | `program_week_id` | El reporte (envío manual con claim atómico) · `REPORTE_NO_CONGELADO` · `YA_ENVIADO` |
| `read` | `program_week_id?` | El reporte o los reportes, con `status`, `attempts`, `last_error` |
| `run_tick` | — | Ejecuta `runExecutionTick(new Date())` una vez y devuelve `{ frozen, sent, failed, notified }`. Es idempotente: repetirla no reenvía. Cubre el disparador externo que exige FR-039 y es lo que usa el quickstart para forzar el congelamiento |

### `manage_tasks` (US8)

`create` / `read` / `update` / `delete` / `today`. `data`: `id?`, `title` (3–120), `subject_id`,
`deliverable_id?`, `topic_id?`, `estimated_tandas` (1–3), `status?`, `scheduled_date?`. Más de 3
tandas → `PARTIR_TAREA`. `today` devuelve las tareas con `scheduled_date` = hoy y
`status='pendiente'`; las de ayer no se arrastran.

### `plan_week` (US8–US9)

| Acción | `data` | Devuelve |
|---|---|---|
| `preview` | `program_week_id?` | `{ semana_pasada, entregas_14_dias[], flags_proyeccion[], intenciones[], disparadores[] (con ensayado), reparto_sugerido[] }` |
| `set_intentions` | `program_week_id`, `items: [{ subject_id, strength (0–10), reason? }]` | Las intenciones · `RAZON_REQUERIDA` si `strength` < 6 sin razón |
| `open_view` | `reason?` | `{ allowed, needs_reason, opens_this_week }` · `RAZON_REQUERIDA` desde la 3.ª apertura sin razón |

## Conteo de `TOOLS_LIST`

20 hoy → 25 tras US1–US3 (`manage_tandas`, `manage_daily_checks`, `manage_program`,
`manage_routine_slots`, `get_today`) → 28 tras US5–US6 (`get_grade_projection`,
`get_compliance_report`, `manage_weekly_report`) → 30 tras US8 (`manage_tasks`, `plan_week`).

Hay que actualizar `__tests__/mcp/all-tools.test.ts:29` y `__tests__/mcp/mcp-crud-tools.test.ts:27`.
