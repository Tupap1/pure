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
