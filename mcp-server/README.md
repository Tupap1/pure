# 🤖 PURE OS — Servidor MCP (Model Context Protocol)

El **Servidor MCP de PURE OS** es una extensión del protocolo abierto [Model Context Protocol](https://modelcontextprotocol.io/) desarrollada sobre **Node.js 22 LTS** con el SDK oficial `@modelcontextprotocol/sdk`.

Su propósito principal es permitir que **Agentes de Inteligencia Artificial** (Claude Online, Antigravity, Gemini, Cursor, ChatGPT, etc.) puedan inspeccionar, sincronizar e ingestar información académica del usuario (matrículas de doble ingeniería, asignaturas, temarios y horarios) tanto en local como desde la nube.

---

## ⚡ Modos de Transporte Dual (Stdio + HTTP/SSE)

El servidor soporta dos modos de transporte simultáneos:

### 1. Transporte `stdio` (Local / Desktop Tools)
Ideal para CLI o agentes que se comunican vía estándar de entrada/salida (`stdin`/`stdout`).
- **Comando de Ejecución**: `node dist-mcp/index.js`
- **Contexto**: Subprocesos locales en IDEs o herramientas como Antigravity CLI.

### 2. Transporte `express` HTTP/SSE (Cloud Agents & Webhooks)
Ideal para agentes que residen en la nube (ej. Claude Web / Cloud) que se conectan vía Server-Sent Events (SSE).
- **Flag de Activación**: `node dist-mcp/index.js --http` (o variable de entorno `MCP_PORT=3001`).
- **Endpoint SSE**: `GET http://0.0.0.0:3001/sse`
- **Endpoint POST Message**: `POST http://0.0.0.0:3001/message`
- **CORS Configurado**: `cors({ origin: '*' })` habilitado para integraciones a través de Cloudflare Tunnels o proxies.

---

## 🛠️ Catálogo Completo de Herramientas MCP

Las cuatro primeras herramientas del dominio académico se documentan a continuación. El catálogo completo, de **34 herramientas**, está más abajo en "Catálogo de Herramientas (34 tools)":

### 1. `get_academic_overview`
Retorna el resumen académico global del estudiante, incluyendo horas de tiempo libre neto disponible, universidades configuradas con sus promedios (GPA) y alertas urgentes.

- **Firma / Esquema**:
  ```json
  {
    "name": "get_academic_overview",
    "description": "Retorna el resumen académico global, tiempo libre neto, promedios por carrera y alertas urgentes.",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  }
  ```
- **Respuesta de Ejemplo**:
  ```json
  {
    "status": "success",
    "data": {
      "netFreeTimeHours": 45.0,
      "universities": [
        { "name": "Universidad de Antioquia - Ingeniería Aeroespacial", "currentGPA": 4.5, "modality": "presencial" },
        { "name": "Universidad de Cartagena - Ingeniería de Software (A Distancia)", "currentGPA": 4.6, "modality": "virtual" }
      ],
      "activeSynergies": 4,
      "urgentDeliverables": 0
    }
  }
  ```

---

### 2. `ingest_academic_enrollment`
Procesa e ingesta la estructura completa de la matrícula del estudiante. El parámetro `raw_text` debe ser un string JSON con los arrays `universities`, `professors`, `subjects` y `schedules` (convención `day_of_week`: 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado, 7=Domingo; `periodicity`: 'semanal' | 'sabado_a' | 'sabado_b').

- **Firma / Esquema**:
  ```json
  {
    "name": "ingest_academic_enrollment",
    "description": "Procesa e ingesta la matrícula del estudiante. raw_text debe ser un string JSON con { universities, professors, subjects, schedules }.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "raw_text": {
          "type": "string",
          "description": "String JSON con { universities, professors, subjects, schedules }. Convención day_of_week: 1=Lunes..7=Domingo. periodicity: 'semanal' | 'sabado_a' | 'sabado_b'."
        }
      },
      "required": ["raw_text"]
    }
  }
  ```
- **Ejemplo de Entrada (`raw_text`)**:
  ```json
  {
    "universities": [{ "id": "u1", "name": "Universidad de Antioquia" }],
    "professors": [{ "id": "p1", "university_id": "u1", "name": "Dra. Curie", "email": "curie@udea.edu.co" }],
    "subjects": [{ "id": "s1", "university_id": "u1", "professor_id": "p1", "name": "Cálculo Multivariable", "credits": 4 }],
    "schedules": [{ "id": "sch1", "subject_id": "s1", "day_of_week": 6, "start_time": "08:00", "end_time": "10:00", "classroom": "Aula 2-209", "periodicity": "sabado_a" }]
  }
  ```
- **Entidades Ingestadas**:
  - **2 Instituciones**: UdeA (#0ea5e9) y UdeC (#6366f1).
  - **5 Docentes**: Coordinación Aeroespacial UdeA, Javier Gómez, Carlos Cáceres, Atilano Arrieta, Armando Acosta.
  - **13 Asignaturas**: *Vivamos la Universidad, Geometría Vectorial, Cálculo Diferencial, Química General, Introducción a la Ingeniería Aeroespacial, Programación C++, Física I, Base de Datos II, Ecuaciones Diferenciales, Desarrollo Web, Ingeniería de Software B1, Ciencia de Datos I, Inglés VI*.
  - **17 Bloques Horarios**: Asignación exacta de días (1 a 6), horas (ej. `09:00` - `11:00`) y aulas físicas/virtuales (ej. *Aula 2-305*, *LAB 3-103*, *Sábado A • Aula A304*, *Sábado B • F215 Lab Redes A*).

---

### 3. `parse_and_ingest_syllabus`
Recibe un texto plano o PDF de un plan de estudios (Syllabus) de una asignatura y lo convierte en un árbol jerárquico de unidades y temas.

- **Firma / Esquema**:
  ```json
  {
    "name": "parse_and_ingest_syllabus",
    "description": "Recibe un texto/PDF de temario y lo convierte en árbol jerárquico de ejes temáticos para la asignatura.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "subject_id": { "type": "string", "description": "ID de la asignatura objetivo" },
        "raw_text": { "type": "string", "description": "Texto plano del temario o plan de estudios" }
      },
      "required": ["subject_id", "raw_text"]
    }
  }
  ```

---

### 4. `find_cross_subject_synergies`
Escanea los temarios de las asignaturas de Ingeniería Aeroespacial y de Ingeniería de Software para encontrar coincidencias conceptuales (ej. *Operaciones Matriciales* o *Ecuaciones Diferenciales*) y calcular el descuento en horas de estudio DME.

- **Firma / Esquema**:
  ```json
  {
    "name": "find_cross_subject_synergies",
    "description": "Escanea temarios de Ingeniería Aeroespacial e Ingeniería de Software y devuelve coincidencias temáticas para fusionar estudio.",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  }
  ```

---

## 🚀 Guía de Uso para Agentes de IA

### Conexión desde Claude Desktop / Antigravity / Cursor (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "pure-mcp": {
      "command": "node",
      "args": ["C:/Proyectos/Pure/mcp-server/dist-mcp/index.js"]
    }
  }
}
```

### Conexión HTTP/SSE desde Agentes Cloud via Cloudflare Tunnel:
```bash
# 1. Iniciar el servidor MCP en modo HTTP en el puerto 3001
npx tsx mcp-server/index.ts --http

# 2. Exponer el puerto 3001 mediante Cloudflare Tunnel
npx cloudflared tunnel --url http://localhost:3001
```

URL de SSE para configurar en el cliente agente:
`https://<tu-subdominio-tu-tunnel>.trycloudflare.com/sse`

---

## 🎯 Catálogo de Herramientas (34 tools)

El servidor expone **34 herramientas MCP** divididas en dos grupos:

### Grupo 1: Dominio Académico (20 tools)
Manejo de matrículas, universidades, docentes, asignaturas, horarios, entregas, temarios, sinergias y métricas DME. Documentadas en `mcp-server/README.md` (líneas actuales) bajo "Catálogo Completo de Herramientas MCP" (tools 1–4).

Esquema de respuesta:
```json
{ "status": "success", "message"?: "...", "data"?: unknown }
{ "status": "error", "code": "ERROR_CODE", "message": "Descripción" }
```

### Grupo 2: Módulo de Ejecución (14 tools) — US1–US9, US-B1–US-B5, US-T1–US-T2, US-F1–US-F5

#### 5. `manage_tandas` — Sesiones de foco: temporizador (10 a 180 minutos) o cronómetro (US1, US-T1, US-T2, US-F1, US-F4)
| Acción | `data` | Respuesta |
|---|---|---|
| `start` | `kind?` (`temporizador` \| `cronometro`, temporizador por defecto), `planned_minutes?` (10–180, default 10; solo temporizador: con `cronometro` → `DATOS_INVALIDOS`), `objective_id?`, `subject_id?`, `topic_id?`, `deliverable_id?`, `task_id?`, `routine_slot_id?` | `{ tanda, ends_at }` (`ends_at: null` en el cronómetro) \| `TANDA_EN_CURSO` \| `OBJETIVO_ARCHIVADO` \| `NO_ENCONTRADO` |
| `finish` | `id` | Tanda completada (idempotente) \| `TANDA_NO_TERMINADA` (temporizador antes de tiempo) \| `CRONOMETRO_MUY_CORTO` (cronómetro con menos de 60 s) |
| `interrupt` | `id`, `interrupt_reason` (1–140) | Tanda interrumpida \| `RAZON_REQUERIDA` |
| `current` | — | `{ tanda \| null, seconds_left \| null, elapsed_seconds \| null, server_now }` (`seconds_left` en el temporizador, `elapsed_seconds` en el cronómetro) |
| `read` | `from?`, `to?` (YYYY-MM-DD), `subject_id?`, `objective_id?` | `{ tandas[], por_dia }` (`por_dia` incluye `completadas`, `unidades`, `interrumpidas` y `minutos`; un cronómetro que cruza la medianoche se reparte entre los días locales que abarca) |
| `update` | `id` + (`subject_id` \| `topic_id` \| `deliverable_id` \| `task_id` \| `objective_id` \| `interrupt_reason` \| `mode`) | Tanda con `edited_after_lock` si aplica |
| `log_late` | `subject_id`, `started_at`, `ended_at` (ISO, hoy local, `started_at` hasta 6h atrás, duración 10–60 min, sin solapes), `topic_id?`, `task_id?` | Tanda `completada` con `late_logged: true` (máx. 3/día local) \| `REGISTRO_TARDIO_INVALIDO` \| `LIMITE_REGISTRO_TARDIO` |
| `correct` | `id`, `ended_at` (ISO), `reason` (1–140) | Tanda con `corrected: true`, `corrected_at`, `original_ended_at` y `original_minutes` \| `CORRECCION_INVALIDA` |

`log_late` y `correct` son las **dos únicas acciones del módulo que aceptan instantes del cliente**: dos excepciones deliberadas y acotadas al Principio III de la Constitución (todo lo demás sale del reloj del servidor). Ninguna está en la lista blanca de `app/api/execution/route.ts`: solo un agente de IA puede dispararlas.
- `log_late` cubre el caso de "olvidé darle iniciar": registra una sesión ya estudiada, dentro de cotas estrictas, y se cuenta aparte en el reporte (`registros_tardios`), nunca para maquillarlo.
- `correct` cubre el cronómetro olvidado y **solo acorta**: en una sesión cerrada el `ended_at` nuevo debe ser anterior al registrado y al menos 1 minuto posterior al inicio; en un cronómetro en curso lo cierra como `completada` con un fin entre inicio + 1 minuto y ahora; un temporizador en curso no se corrige (se usa `interrupt`). Fuera de esas cotas responde `CORRECCION_INVALIDA` y no cambia nada. Conserva el original y se cuenta en el reporte (`correcciones`).

#### 6. `manage_daily_checks` — Registro de hábitos (US3)
| Acción | `data` | Respuesta |
|---|---|---|
| `set` | `habit_id`, `status` (cumplido/fallado/na), `date?`, `note?` (≤ 200) | Registro (upsert) \| `DIA_CERRADO` \| `HABITO_INACTIVO` |
| `read` | `from?`, `to?` | `{ dias: [{ date, checks[], evaluacion }] }` |

#### 7. `manage_program` — Programa semanal (Foundational)
| Acción | `data` | Respuesta |
|---|---|---|
| `init` | `starts_on` (lunes), `weeks: [{ min_tandas_dia, phase }]` | Semanas `pw-01…` \| `NO_ES_LUNES` \| `PROGRAMA_EXISTENTE` |
| `read` | — | `{ weeks[], current_week, habits[] }` |
| `update_week` | `id`, `min_tandas_dia?`, `phase?` | La semana \| `SEMANA_EN_CURSO` |
| `upsert_habit` | `id`, `label`, `started_on`, `days_of_week?`, `target_days?` | El hábito |
| `retire_habit` | `id`, `retired_on` | El hábito |

#### 8. `manage_routine_slots` — Disparadores si-entonces (US2)
| Acción | `data` | Respuesta |
|---|---|---|
| `create` / `update` | `id?`, `days_of_week`, `cue_kind`, `cue_text`, `action_text`, `anchor_time?`, `schedule_id?`, `subject_id?`, `habit_id?`, `kind`, `periodicity?`, `is_active?` | El disparador \| `SOBRE_ESPECIFICACION` |
| `read` | `id?` | Disparadores (con `huerfano: true` si es `tras_clase` sin horario) |
| `delete` | `id` | — |
| `respond` | `routine_slot_id`, `outcome` (hecho/no) | El outcome de hoy (idempotente) |
| `rehearse` | `routine_slot_id`, `program_week_id?` | `{ ya_ensayado: boolean }` |

#### 9. `get_today` — Vista de hoy (US1–US3)
Parámetro `data?`: `{ at? }` (ISO, solo lectura). Respuesta:
```json
{
  "server_now": "ISO string",
  "date": "YYYY-MM-DD",
  "week": { "number": N, "total": N, "phase": "string" } | null,
  "running_tanda": { "id", "subject_id", "kind": "temporizador" | "cronometro", "objective_id", "started_at", "ends_at" | null, "seconds_left" | null, "elapsed_seconds" | null } | null,
  "trigger": { "id", "cue_text", "action_text", "kind", "subject?" } | null,
  "pending_checks": [{ "habit_id", "label" }],
  "tandas_today": number,
  "unidades_hoy": number,
  "day_fulfilled": boolean | null,
  "evaluacion_dia": { "tandas_completadas", "min_requerido", "cumplio_tandas", "cumplio_habitos", "day_fulfilled" } | null,
  "foco_semana_minutos": number,
  "foco_12_semanas": [{ "date", "minutos", "nivel": 0 | 1 | 2 | 3 | 4 }],
  "frase_del_dia": { "text", "translation", "source" } | null
}
```
`foco_semana_minutos` (de lunes a hoy) y `foco_12_semanas` (últimas 12 semanas) salen de la misma agregación que `get_focus_summary`. `frase_del_dia` es una frase latina por día local (rotación determinista sobre las frases activas de `manage_quotes`) o `null` si no hay ninguna activa.

#### 10. `get_compliance_report` — Cumplimiento semanal (US6, US-T2)
Parámetro `data?`: `{ from?, to?, program_week_id? }`. Respuesta: `dias[]` con `evaluacion_dia` (tandas_completadas, min_requerido, cumplio_tandas, cumplio_habitos, day_fulfilled), `days_fulfilled`, `aperturas_plan: { libres_usadas, con_razon, total, razones[] }` (solo aperturas de semana, no planeación), hábitos como fracción (se omiten los que no tienen días activos en el rango), tandas por materia, disparadores respondidos, razones de interrupción, `dias_cumplidos_totales`, horizonte, `registros_tardios: { total, minutos }` (tandas `log_late` en el rango; `{ total: 0, minutos: 0 }` si no hubo ninguna) y `correcciones: { total, minutos_recortados }` (sesiones corregidas con `manage_tandas:correct`, contadas por la semana local de `corrected_at`; `{ total: 0, minutos_recortados: 0 }` si no hubo ninguna). El texto del reporte semanal agrega la línea `Correcciones: N (M min recortados)` solo cuando N > 0.

#### 11. `get_grade_projection` — Proyección de notas (US5)
Parámetro `data?`: `{ subject_id? }`. Respuesta:
```json
{
  "materias": [{
    "subject_id", "name",
    "projection": { "declaredWeight", "gradedWeight", "awaitingGradeWeight",
                    "remainingWeight", "currentAverage", "consolidated",
                    "neededToPass", "neededForTarget", "ceiling" },
    "flags": ["ciega" | "pesos_inconsistentes" | "entregado_sin_nota" | ...]
  }],
  "alertas": [{ "kind": "abandonada" | "ciega", "subject_id", "detalle" }]
}
```

#### 12. `manage_weekly_report` — Reporte de cumplimiento (US6)
| Acción | `data` | Respuesta |
|---|---|---|
| `set_partner` | `name`, `email`, `consented_at` (ISO) | El destinatario vigente \| `CONSENTIMIENTO_REQUERIDO` |
| `read_partner` | — | Destinatario vigente \| null |
| `preview` | `program_week_id?` | `{ payload, verdict, text }` sin congelar |
| `set_note` | `program_week_id`, `note` (≤ 400) | El reporte \| `VENTANA_CERRADA` |
| `send` | `program_week_id` | El reporte (claim atómico) \| `YA_ENVIADO` |
| `read` | `program_week_id?` | El/los reportes con `status`, `attempts`, `last_error` |
| `run_tick` | — | `{ frozen, sent, failed, notified }` — idempotente |

#### 13. `manage_tasks` — Tareas de N tandas (US8)
Acciones: `create`, `read`, `update`, `delete`, `today`. Parámetro: `id?`, `title` (3–120), `subject_id`, `estimated_tandas` (1–3), `status?`, `scheduled_date?`. Más de 3 tandas → `PARTIR_TAREA`. `today` devuelve tareas con `scheduled_date = hoy`.

#### 14. `plan_week` — Planeación de la semana (US8–US9–B1)
| Acción | `data` | Respuesta |
|---|---|---|
| `preview` | `program_week_id?` (resuelve sin id) | `{ semana_pasada, entregas_14_dias, intenciones, disparadores, reparto_sugerido }` |
| `set_intentions` | `program_week_id`, `items: [{ subject_id, strength (0–10), reason? }]` | Las intenciones \| `RAZON_REQUERIDA` |
| `open_view` | `program_week_id?` (resuelve sin id), `reason?` | `{ allowed, needs_reason, opens_this_week, surface: 'planeacion' \| 'semana' }` \| `RAZON_REQUERIDA` |

Sin `program_week_id`, la semana se resuelve así: si hoy es domingo con una que empieza mañana, esa; si no, la que contiene hoy; si no, la próxima que empieza; si no hay, `NO_ENCONTRADO`. Si la semana indicada no existe, `NO_ENCONTRADO`. Una semana que todavía no ha empezado es `surface='planeacion'`: sin compuerta, sin pedir razón, sin contar en aperturas del plan.

#### 15. `manage_friction` — Fricción del teléfono (US-B5)
| Acción | `data` | Respuesta |
|---|---|---|
| `enable` | `measure_key` | La medida habilitada \| `LIMITE_FRICCION` |
| `disable` | `measure_key` | La medida con `ya_deshabilitada` (si ya estaba deshabilitada o nunca existió: `ya_deshabilitada: true` y sin cambios) |
| `verify` | `measure_key` | La medida verificada \| `NO_ENCONTRADO` |
| `rate` | `score` (0–10), `program_week_id?` (semana en curso por defecto) | La calificación \| `NO_ENCONTRADO` \| `FECHA_FUTURA` |
| `read` | — | `{ activas: [{ measure_key, started_on, verified_at, confirmada }], total_activas, limite: 2, irritacion_semana_actual: 0-10 \| null }` |

Medidas: `sin_biometria`, `clave_larga`, `escala_grises`, `redes_fuera_home`, `app_desinstalada`. Máximo 2 simultáneas. Calificación semanal; dos semanas consecutivas ≥7 retiran automáticamente la más recientemente habilitada.

#### 16. `manage_objectives` — Objetivos de foco (US-F2)
Objetivos propios (LeetCode, Inglés, Proyecto personal) a los que se ligan las sesiones con `manage_tandas:start { objective_id }`. No se borran: se archivan. Web: las cuatro acciones.

| Acción | `data` | Respuesta |
|---|---|---|
| `create` | `name` (1–60, único entre los activos sin distinguir mayúsculas ni espacios en los extremos), `subject_id?`, `weekly_target_minutes?` (entero 1–10080) | El objetivo \| `OBJETIVO_DUPLICADO` \| `NO_ENCONTRADO` (materia) |
| `read` | `include_archived?` (false por defecto) | `{ objetivos[] }` ordenados por nombre |
| `update` | `id`, `name?`, `subject_id?` (`null` la quita), `weekly_target_minutes?` (`null` la quita) | El objetivo \| `OBJETIVO_ARCHIVADO` \| `OBJETIVO_DUPLICADO` \| `NO_ENCONTRADO` |
| `archive` | `id` | El objetivo (idempotente: archivar dos veces no es un error) |

Una sesión de un objetivo **sin materia** suma minutos de foco pero no cuenta para el mínimo diario (salvo que la sesión tenga materia, tema, tarea o entrega propios); un objetivo con materia sí cuenta. Las sesiones de un objetivo archivado siguen sumando, pero ya no se puede empezar una nueva con él.

#### 17. `get_focus_summary` — Tiempo enfocado (US-F3)
Solo lectura. Parámetro `data?`: `{ weeks? (1–53, 52 por defecto), objective_id? \| subject_id? (no ambos: `DATOS_INVALIDOS`), at? }` (`at` solo para pruebas). El mismo resultado que `GET /api/execution/focus`. Suman las sesiones completadas e interrumpidas (las en curso no); un cronómetro que cruza la medianoche se reparte entre los días locales que abarca. Respuesta:
```json
{
  "rango": { "desde": "YYYY-MM-DD", "hasta": "YYYY-MM-DD", "semanas": 52 },
  "dias": [{ "date": "YYYY-MM-DD", "minutos": 0, "nivel": 0 }],
  "semanas": [{ "lunes": "YYYY-MM-DD", "minutos": 0 }],
  "total_semana": 0,
  "por_objetivo": [{ "tipo": "objetivo" | "materia" | "sin_objetivo", "id", "nombre", "minutos", "meta": number | null, "archivado": boolean }]
}
```
`nivel`: 0 sin foco, 1 de 1 a 30 minutos, 2 de 31 a 90, 3 de 91 a 180 y 4 con más de 180. `dias` trae un 0 explícito en los días vacíos. `por_objetivo` es de la semana actual y **no** lo afecta el filtro (que sí acota `dias`, `semanas` y `total_semana`): cada sesión cae en una sola fila (su objetivo; si no tiene, su materia; si no, "Sin objetivo") y los objetivos activos con meta aparecen aunque sumen 0.

#### 18. `manage_quotes` — Frase del día (US-F5, solo MCP)
Frases latinas que Hoy muestra una por día (`get_today.frase_del_dia`). Entran **solo por MCP**: ninguna acción está en la lista blanca de la web. Una frase tiene `text` (1–300), `translation?` (hasta 300) y `source?` (hasta 120).

| Acción | `data` | Respuesta |
|---|---|---|
| `create` | `text`, `translation?`, `source?` | La frase; idempotente: si ya existe devuelve la existente |
| `create_many` | `frases: [{ text, translation?, source? }]` (1–200) | `{ creadas, omitidas }`; todo o nada (una frase inválida rechaza el lote entero con `DATOS_INVALIDOS`) e idempotente |
| `read` | `include_inactive?` (false por defecto) | `{ frases[] }` ordenadas por `id` |
| `update` | `id`, `text?`, `translation?`, `source?`, `active?` | La frase (cambiar `text` no cambia el `id`) \| `NO_ENCONTRADO` |
| `deactivate` | `id` | La frase con `active: false` (idempotente); sale de la rotación \| `NO_ENCONTRADO` |

La comparación de duplicados ignora mayúsculas y espacios en los extremos del texto latino (el `id` es `frase-` + 16 hex del SHA-256 del texto normalizado). La carga inicial se hace una sola vez, con `create_many` y el contenido de `specs/004-foco-cronometro/frases.json` (50 frases): `{ creadas: 50, omitidas: 0 }`; repetirla da `{ creadas: 0, omitidas: 50 }`. La rotación es determinista por fecha local sobre las frases activas ordenadas por `id`: el mismo día da la misma frase y en N días seguidos sale cada una una vez.

---

## Códigos de Error Comunes

| Código | Significado |
|---|---|
| `DATOS_INVALIDOS` | Validación Zod fallida |
| `SOBRE_ESPECIFICACION` | Claves no permitidas (ej. `duration` en un disparador) |
| `NO_ENCONTRADO` | ID inexistente |
| `FECHA_FUTURA` | Fecha posterior a hoy |
| `LIMITE_FRICCION` | Ya hay 2 medidas de fricción habilitadas |
| `TANDA_EN_CURSO` | Ya hay una sesión activa |
| `TANDA_NO_TERMINADA` | `finish` antes de tiempo (usar `interrupt`) |
| `RAZON_REQUERIDA` | Falta motivación |
| `DIA_CERRADO` | Intento después de las 03:00 del día siguiente |
| `HABITO_INACTIVO` | El hábito no aplica hoy |
| `NO_ES_LUNES` | La semana no empieza en lunes |
| `PROGRAMA_EXISTENTE` | Ya existe un programa |
| `SEMANA_EN_CURSO` | No se puede editar una semana en curso |
| `CONSENTIMIENTO_REQUERIDO` | `set_partner` sin `consented_at` |
| `SIN_PARTNER` | Sin destinatario para enviar reporte |
| `REPORTE_NO_CONGELADO` | El reporte aún no está congelado |
| `VENTANA_CERRADA` | `set_note` después de `note_deadline` |
| `YA_ENVIADO` | El reporte ya se envió |
| `PARTIR_TAREA` | Tarea con > 3 tandas |
| `REGISTRO_TARDIO_INVALIDO` | `log_late` viola día local, ventana de 6h, duración 10–60 min o se solapa con otra tanda |
| `LIMITE_REGISTRO_TARDIO` | Ya hay 3 registros tardíos hoy (día local) |
| `CRONOMETRO_MUY_CORTO` | `finish` de un cronómetro con menos de 60 s transcurridos (usar `interrupt`) |
| `OBJETIVO_DUPLICADO` | Ya hay un objetivo activo con ese nombre (sin distinguir mayúsculas ni espacios en los extremos) |
| `OBJETIVO_ARCHIVADO` | Empezar una sesión con un objetivo archivado, o editar uno archivado |
| `CORRECCION_INVALIDA` | `correct` viola las cotas: solo acorta, el fin nuevo debe quedar entre inicio + 1 minuto y el registrado (o ahora, en un cronómetro en curso), y un temporizador en curso no se corrige |
