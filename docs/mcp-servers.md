# Pure MCP Server Documentation (`pure-mcp-server`)

## Overview

The **Pure MCP Server** (`pure-mcp-server`) is a remote Model Context Protocol (MCP) server built with Node.js, Express, and `@modelcontextprotocol/sdk`. It provides bidirectional integration between Claude (and other MCP clients) and Pure's multi-university academic management ecosystem.

- **Protocol Version:** `2024-11-05`
- **Supported Transports:**
  1. **Streamable HTTP Transport (JSON-RPC 2.0):** `POST /mcp` (or `POST /`)
  2. **Server-Sent Events (SSE):** `GET /sse` and `POST /message`
  3. **Standard I/O (Stdio):** `npx tsx mcp-server/index.ts`
- **OAuth Discovery:** RFC 8414 & RFC 7591 Dynamic Client Registration at `/.well-known/oauth-authorization-server`

---

## Exposed Tools

### 1. `get_academic_overview`
- **Description:** Retorna el resumen académico global, tiempo libre neto, promedios por carrera y alertas urgentes.
- **Parameters:** None (`{}`)
- **Returns:** Global academic overview with universities, current GPAs, net free time hours, and urgent deliverables.

### 2. `ingest_academic_enrollment`
- **Description:** Procesa e ingesta la matrícula real del estudiante (materias, créditos, grupos y horarios con aulas asignadas). Debe pasarse el texto o JSON de la matrícula en `raw_text`.
- **Parameters:**
  - `raw_text` (*string*, **REQUIRED**): Texto plano completo o JSON estructurado de las materias, horarios y aulas.
- **Returns:** Status and summary of parsed subjects and schedules.

### 3. `parse_and_ingest_syllabus`
- **Description:** Recibe un texto/PDF de temario y lo convierte en árbol jerárquico de ejes temáticos para la asignatura.
- **Parameters:**
  - `subject_id` (*string*, **REQUIRED**): ID de la asignatura (e.g. `sub-geom`).
  - `raw_text` (*string*, **REQUIRED**): Texto plano del temario o plan de estudios.

### 4. `find_cross_subject_synergies`
- **Description:** Escanea temarios de distintas asignaturas y carreras y devuelve coincidencias temáticas para fusionar estudio.
- **Parameters:** None (`{}`)

### 5. `manage_universities`
- **Description:** Operaciones CRUD sobre Universidades (crear, leer, actualizar, eliminar).
- **Parameters:**
  - `action` (*string*, **REQUIRED**): `create` | `read` | `update` | `delete`
  - `data` (*object*): Datos de la universidad (`id`, `name`, `modality`, `scale_min`, `scale_max`, `passing_grade`, `color`).

### 6. `manage_professors`
- **Description:** Operaciones CRUD sobre Profesores (crear, leer, actualizar, eliminar).
- **Parameters:**
  - `action` (*string*, **REQUIRED**): `create` | `read` | `update` | `delete`
  - `data` (*object*): Datos del profesor (`id`, `university_id`, `name`, `email`, `office_hours`, `notes`).

### 7. `manage_subjects`
- **Description:** Operaciones CRUD sobre Asignaturas / Materias.
- **Parameters:**
  - `action` (*string*, **REQUIRED**): `create` | `read` | `update` | `delete`
  - `data` (*object*): Datos de la materia (`id`, `university_id`, `professor_id`, `name`, `code`, `credits`, `difficulty`, `target_grade`).

### 8. `manage_schedules`
- **Description:** Operaciones CRUD sobre Horarios y Aulas de clase.
- **Parameters:**
  - `action` (*string*, **REQUIRED**): `create` | `read` | `update` | `delete`
  - `data` (*object*): Datos del horario (`id`, `subject_id`, `day_of_week`, `start_time`, `end_time`, `classroom`).

### 9. `manage_deliverables`
- **Description:** Operaciones CRUD sobre Entregables / Parciales / Tareas.
- **Parameters:**
  - `action` (*string*, **REQUIRED**): `create` | `read` | `update` | `delete`
  - `data` (*object*): Datos del entregable (`id`, `subject_id`, `title`, `due_date`, `weight_percentage`, `grade`, `type`, `status`).

### 10. `manage_syllabus_topics`
- **Description:** Operaciones CRUD sobre Temarios y Ejes Temáticos.
- **Parameters:**
  - `action` (*string*, **REQUIRED**): `create` | `read` | `update` | `delete`
  - `data` (*object*): Datos del tema (`id`, `subject_id`, `parent_id`, `title`, `description`, `mastery_status`, `order_index`).

---

## Connection Instructions

### Connecting in Claude.ai (Custom Connectors)

1. Open **Claude.ai > Settings > Connectors** (or **Customize > Connectors**).
2. Click **Add custom connector** and choose **Web (Remote MCP)**.
3. Enter your remote MCP URL:
   - **Server URL:** `https://mcp.btw-one.com/mcp` (or `/sse`)
   - **Authentication:** None / Zero-Auth Auto-Approve (or Bearer Token if configured).
4. Save and test with `@pure "¿Cuál es mi resumen académico?"`.

### Connecting via Claude CLI (`claude mcp add`)

To register the MCP server in Claude CLI locally:

```bash
# Using HTTP/SSE transport
claude mcp add pure --transport sse http://localhost:3001/sse

# Or using Stdio transport
claude mcp add pure -- npx tsx c:/Proyectos/Pure/mcp-server/index.ts
```

---

## Environment & Docker Configuration

| Variable | Default | Description |
|---|---|---|
| `MCP_PORT` | `3001` | Internal HTTP/SSE server port |
| `PUBLIC_MCP_URL` | `https://mcp.btw-one.com` | Public base URL used for OAuth discovery metadata |
| `DATABASE_URL` | — | PostgreSQL database connection string |
| `NODE_ENV` | `production` | Execution environment |
