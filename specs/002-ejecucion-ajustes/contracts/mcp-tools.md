# Contrato — Cambios en las herramientas MCP (002)

Complementa `specs/001-modulo-ejecucion/contracts/mcp-tools.md`: la forma de respuesta y los
códigos de error de la 001 siguen vigentes, y aquí solo van las diferencias. Los tests verifican
`code` y no `message`, con dos excepciones que son criterio de aceptación: el mensaje de "el
programa ya terminó" (US-B1-AS5) y el que explica el límite de fricción (US-B5-AS1).

La web no cambia: `POST /api/execution` pasa `data` tal cual, así que `open_view` acepta
`program_week_id` también desde ahí. `manage_friction` no entra en la lista blanca de la web.

## Códigos de error

| Código | Cuándo | Estado |
|---|---|---|
| `LIMITE_FRICCION` | `manage_friction:enable` cuando ya hay 2 medidas habilitadas | Nuevo |
| `NO_ENCONTRADO` | Además de lo de la 001: una semana indicada que no existe en `plan_week` (`preview`, `set_intentions`, `open_view`) o en `manage_routine_slots:rehearse`; un programa sin semanas o ya terminado; `manage_friction:verify` sobre una medida no habilitada; `manage_friction:rate` sin semana en curso | Ampliado |
| `FECHA_FUTURA` | Además de lo de la 001: `manage_friction:rate` sobre una semana que todavía no empieza | Ampliado |

## `plan_week` (US-B1)

| Acción | `data` | Devuelve |
|---|---|---|
| `preview` | `program_week_id?` | Lo mismo que en la 001. Sin id, la semana sale de `resolvePlanningWeek`. Con un id que no existe → `NO_ENCONTRADO` |
| `set_intentions` | `program_week_id`, `items[]` | Lo mismo que en la 001. Con un id que no existe → `NO_ENCONTRADO`, antes de guardar nada |
| `open_view` | `program_week_id?`, `reason?` | `{ allowed, needs_reason, opens_this_week, program_week_id, surface: 'semana' \| 'planeacion', disparadores[], tandas_por_dia[] }` |

Mensajes de `NO_ENCONTRADO` cuando no se indica semana y la resolución falla:

- programa sin semanas: "No hay un programa creado: no hay semana para planear." (en `open_view`,
  "…para ver.");
- programa terminado: "El programa ya terminó: no quedan semanas por planear." (en `open_view`,
  "…por ver.").

`open_view`:

- `surface: 'planeacion'` cuando la semana todavía no empieza. No pide razón aunque ya haya
  aperturas, ignora una `reason` enviada, no suma en `opens_this_week` y queda fuera de
  `aperturas_plan`.
- `surface: 'semana'` en los demás casos, con la compuerta de la 001 sin cambios (FR-037).
  `opens_this_week` cuenta solo las aperturas `semana` de esa semana.

Esquema Zod: `PlanWeekOpenViewSchema` agrega `program_week_id: z.string().min(1).optional()` y
sigue siendo `.strict()`.

## `manage_routine_slots:rehearse` (US-B1)

`program_week_id?`. Sin id usa `resolvePlanningWeek`, que reemplaza a "la semana en curso, o la
siguiente si es domingo". Con un id que no existe → `NO_ENCONTRADO`.

## `manage_tandas` (US-B2)

Sin cambios. Queda explícito que no existe el estado `abandonada` ni un cierre por hora del día:
`start` cierra primero la tanda vencida (completada) y crea la nueva en la misma llamada.

## `manage_weekly_report` (US-B1, US-B3, US-B4, US-B5)

- `preview` sin id: sin cambios; usa solo la semana en curso y nunca una futura.
- Payload congelado y de `preview`:
  - `aperturas_plan: { total, con_razon, libres_usadas }` en lugar de `plan_openings`;
  - `habits` sin los hábitos de 0 días activos;
  - `friccion_retiradas: [{ measure_key, fecha }]`, desde US-B5.

## `get_today` (US-B4)

Agrega:

```ts
evaluacion_dia: {
  tandas_completadas: number;
  min_requerido: number;
  cumplio_tandas: boolean;
  cumplio_habitos: boolean;
  day_fulfilled: boolean;
} | null; // null fuera del programa
```

`day_fulfilled` y `tandas_today` se conservan con el mismo valor. La web recibe el campo, pero la
pantalla Hoy no lo muestra (FR-B14).

## `get_compliance_report` (US-B3, US-B4)

- `dias[]` agrega `evaluacion_dia`, con la misma forma que en `get_today`; `evaluacion` se conserva.
- `habitos[]` omite los hábitos con `total = 0` en el rango.
- Agrega:

```ts
aperturas_plan: {
  libres_usadas: number; // surface 'semana' con was_gated = false
  con_razon: number;     // surface 'semana' con was_gated = true
  total: number;
  razones: string[];     // razones de las con_razon, en orden cronológico
}; // 0 y [] si no hay aperturas, nunca null
```

## `manage_friction` (US-B5) — nueva

| Acción | `data` | Devuelve |
|---|---|---|
| `enable` | `measure_key` | La medida habilitada, con `ya_habilitada: boolean` · `LIMITE_FRICCION` |
| `disable` | `measure_key` | La medida, o `null` si nunca existió, con `ya_deshabilitada: boolean`; motivo `manual` |
| `verify` | `measure_key` | La medida con `verified_at` · `NO_ENCONTRADO` si no está habilitada |
| `rate` | `score` (entero 0–10), `program_week_id?` (por defecto, la semana en curso) | La calificación de la semana · `NO_ENCONTRADO` · `FECHA_FUTURA` |
| `read` | — | `{ activas: [{ measure_key, started_on, verified_at, confirmada }], total_activas, limite: 2, irritacion_semana_actual: number \| null }` |

- `measure_key` ∈ `sin_biometria | clave_larga | escala_grises | redes_fuera_home |
  app_desinstalada`. Cualquier otra clave, incluida `celular_afuera`, da `DATOS_INVALIDOS`.
- Esquemas Zod `.strict()`: `FrictionMeasureSchema { measure_key }` y
  `FrictionRateSchema { score, program_week_id? }`.
- Mensaje de `LIMITE_FRICCION`: "Ya hay 2 medidas de fricción habilitadas. El límite existe porque
  la restricción parcial aumenta el estrés reportado y una medida abandonada por irritación vale 0:
  dos sostenibles valen más que cinco abandonadas. Deshabilita una antes de agregar otra."
- La descripción de la herramienta (en `TOOLS_LIST` y en `mcpServer.tool`) enuncia que Pure solo
  registra y no bloquea apps, el límite de 2, la calificación semanal y el retiro automático tras
  dos semanas seguidas con 7 o más.
- No se expone por `/api/execution` (Principio VI).

## Conteo de `TOOLS_LIST`

Pasa de 30 a 31 con `manage_friction`. Hay que actualizar `__tests__/mcp/all-tools.test.ts:28-29` y
`__tests__/mcp/mcp-crud-tools.test.ts:27`.
