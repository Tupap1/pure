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

El servidor expone **4 herramientas (tools)** principales:

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

## 🎯 Catálogo de Herramientas (30 tools)

El servidor expone **30 herramientas MCP** divididas en dos grupos:

### Grupo 1: Dominio Académico (20 tools)
Manejo de matrículas, universidades, docentes, asignaturas, horarios, entregas, temarios, sinergias y métricas DME. Documentadas en `mcp-server/README.md` (líneas actuales) bajo "Catálogo Completo de Herramientas MCP" (tools 1–4).

Esquema de respuesta:
```json
{ "status": "success", "message"?: "...", "data"?: unknown }
{ "status": "error", "code": "ERROR_CODE", "message": "Descripción" }
```

### Grupo 2: Módulo de Ejecución (10 tools) — US1–US9

#### 5. `manage_tandas` — Sesiones de 10 minutos (US1)
| Acción | `data` | Respuesta |
|---|---|---|
| `start` | `subject_id?`, `planned_minutes?` (5–25, default 10) | `{ tanda, ends_at }` \| `TANDA_EN_CURSO` |
| `finish` | `id` | Tanda completada (idempotente) \| `TANDA_NO_TERMINADA` |
| `interrupt` | `id`, `interrupt_reason` (1–140) | Tanda interrumpida \| `RAZON_REQUERIDA` |
| `current` | — | `{ tanda \| null, seconds_left \| null, server_now }` |
| `read` | `from?`, `to?` (YYYY-MM-DD), `subject_id?` | `{ tandas[], por_dia }` |
| `update` | `id` + (`subject_id` \| `interrupt_reason` \| `mode`) | Tanda con `edited_after_lock` si aplica |

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
  "running_tanda": { "id", "subject?", "started_at", "ends_at", "seconds_left" } | null,
  "trigger": { "id", "cue_text", "action_text", "kind", "subject?" } | null,
  "pending_checks": [{ "habit_id", "label" }],
  "tandas_today": number,
  "day_fulfilled": boolean | null
}
```

#### 10. `get_compliance_report` — Cumplimiento semanal (US6)
Parámetro `data?`: `{ from?, to?, program_week_id? }`. Respuesta: días evaluados, `days_fulfilled`, hábitos, tandas por materia, disparadores respondidos, razones de interrupción, `dias_cumplidos_totales` y horizonte.

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

#### 14. `plan_week` — Planeación de la semana (US8–US9)
| Acción | `data` | Respuesta |
|---|---|---|
| `preview` | `program_week_id?` | `{ semana_pasada, entregas_14_dias, intenciones, disparadores, reparto_sugerido }` |
| `set_intentions` | `program_week_id`, `items: [{ subject_id, strength (0–10), reason? }]` | Las intenciones \| `RAZON_REQUERIDA` |
| `open_view` | `reason?` | `{ allowed, needs_reason, opens_this_week }` \| `RAZON_REQUERIDA` |

---

## Códigos de Error Comunes

| Código | Significado |
|---|---|
| `DATOS_INVALIDOS` | Validación Zod fallida |
| `SOBRE_ESPECIFICACION` | Claves no permitidas (ej. `duration` en un disparador) |
| `NO_ENCONTRADO` | ID inexistente |
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
