# Contrato — Cambios en las herramientas MCP (003)

Complementa `specs/001-modulo-ejecucion/contracts/mcp-tools.md` y
`specs/002-ejecucion-ajustes/contracts/mcp-tools.md`: los códigos de error y la forma de respuesta
de la 001 y la 002 siguen vigentes, y aquí solo van las diferencias. Los tests verifican `code` y no
`message`, salvo en US-T2-AS2 y US-T2-AS3 donde se verifica explícitamente `REGISTRO_TARDIO_INVALIDO`
y `LIMITE_REGISTRO_TARDIO`.

La web (`app/api/execution/route.ts`) no cambia. `log_late` **no entra en la lista blanca** de
`ALLOWED_ACTIONS` (Principio I: el registro tardío es solo MCP).

## Códigos de error nuevos

| Código | Cuándo | Aplicación |
|---|---|---|
| `REGISTRO_TARDIO_INVALIDO` | `manage_tandas:log_late` cuando la entrada viola una regla de negocio (día, ventana, duración, solapamiento). Ver [data-model.md](../data-model.md). | Nuevo |
| `LIMITE_REGISTRO_TARDIO` | `manage_tandas:log_late` cuando ya hay 3 registros tardíos hoy. | Nuevo |

Códigos ampliados de la 001:
- `DATOS_INVALIDOS` cuando `planned_minutes` está fuera de [10, 60] en `manage_tandas:start`.

## `manage_tandas.start` (US-T1)

| Parámetro | Cambio |
|---|---|
| `planned_minutes?` | Rango nuevo 10–60 (antes 5–25). Por defecto sigue siendo 10. |

Validación:
- Si se envía un valor fuera de [10, 60]: `DATOS_INVALIDOS`, no se crea nada.
- Zod toma `TANDA_MINUTES_MIN` y `TANDA_MINUTES_MAX` de `lib/execution/constants.ts`.

Devolución: sin cambios en la forma. El cliente es responsable de pasar `planned_minutes` a la pantalla para que este pueda mostrarlo.

## `manage_tandas.read` (US-T1)

Resumen por día agrega:

```ts
{
  // ya existían:
  fecha: "YYYY-MM-DD";
  completadas: number;
  interrumpidas: number;
  interrumpidas_minutos: number;
  minutos: number;
  
  // nuevo (US-T1):
  unidades: number;  // suma de unidades de tandas completadas
}
```

Si no hay tandas completadas en el día, `unidades: 0`.

## `manage_tandas.log_late` (US-T2) — nueva acción

| Parámetro | Tipo | Descripción |
|---|---|---|
| `subject_id` | TEXT | Materia a la que corresponde la sesión. |
| `started_at` | ISO 8601 | Hora local de inicio (cliente). |
| `ended_at` | ISO 8601 | Hora local de fin (cliente). |
| `topic_id?` | TEXT | Tema de la materia (opcional). |
| `task_id?` | TEXT | Entrega o tarea (opcional). |

Devolución (si tiene éxito):

```ts
{
  id: string;
  status: "completada";
  subject_id: string;
  started_at: ISO 8601;
  ended_at: ISO 8601;
  planned_minutes: number;   // igual a actual_minutes: en un registro tardío no hubo plan, hubo una sesión (la columna es NOT NULL)
  actual_minutes: number;
  late_logged: true;
  created_at: ISO 8601;
  // campos de la 001
  topic_id?: string;
  task_id?: string;
  running_lock: null;
  locked_at: ISO 8601 | null;
  interrupted_at: null;
  reason: null;
}
```

Errores:
- `DATOS_INVALIDOS`: Schema Zod inválido (parámetros faltantes, tipo incorrecto, etc.).
- `REGISTRO_TARDIO_INVALIDO`: 
  - Día local de `started_at` o `ended_at` distinto al de ahora.
  - `started_at` más de 6 horas antes de ahora.
  - `ended_at` posterior a ahora o no posterior a `started_at`.
  - Duración fuera de 10–60 minutos.
  - Solapamiento con otra tanda del mismo día (una en curso ocupa `[started_at, ahora]`).
- `LIMITE_REGISTRO_TARDIO`: Ya hay 3 registros tardíos hoy.

Schema Zod:

```ts
TandaLogLateSchema = z.object({
  subject_id: z.string().min(1),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  topic_id: z.string().optional(),
  task_id: z.string().optional(),
}).strict();

ExecutionErrorCode = z.enum([
  // ... códigos existentes ...
  'REGISTRO_TARDIO_INVALIDO',
  'LIMITE_REGISTRO_TARDIO',
]);
```

## `get_today` (US-T1)

Agrega:

```ts
{
  // ... campos existentes (de la 001 y la 002) ...
  
  // nuevo (US-T1):
  evaluacion_dia: {
    tandas_completadas: number;  // filas (sin cambio de terminología UI)
    unidades_completadas: number; // suma de unidades (lo que se compara contra mínimo)
    min_requerido: number;
    cumplio_tandas: boolean;
    cumplio_habitos: boolean;
    day_fulfilled: boolean;
  } | null;  // null fuera del programa
}
```

## `get_compliance_report` (US-T1, US-T2)

Resumen diario agrega (en cada elemento de `dias[]`):

```ts
evaluacion_dia: {
  tandas_completadas: number;
  unidades_completadas: number;
  min_requerido: number;
  cumplio_tandas: boolean;
  cumplio_habitos: boolean;
  day_fulfilled: boolean;
} | null;  // null para días fuera del programa
```

Resumen de semana agrega (US-T2):

```ts
registros_tardios: {
  total: number;    // conteo de tandas con late_logged=true en el rango
  minutos: number;  // suma de actual_minutes de las tardías
}; // nunca null; { total: 0, minutos: 0 } si no hay
```

## `manage_weekly_report` (US-T2)

Payload congelado y de `preview` agrega:

```ts
registros_tardios: {
  total: number;
  minutos: number;
}; // igual que en get_compliance_report
```

## Lista blanca de la web

`app/api/execution/route.ts` en `ALLOWED_ACTIONS` no incluye `'log_late'`. Cualquier intento de
llamarla desde la PWA es rechazado con 403 (Principio I y FR-T15).

## Conteo de herramientas

Se mantiene en 31 (no hay herramienta nueva; `log_late` es una acción de `manage_tandas`).

