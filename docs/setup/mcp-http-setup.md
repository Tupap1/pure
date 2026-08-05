# MCP HTTP Server Setup Guide

## Overview

El servidor MCP de Pure ahora está disponible como endpoint HTTP/SSE para conectarlo desde Claude.ai u otros clientes MCP.

### Cambios implementados

- **`mcp-server/server-config.ts`**: Configuración compartida del servidor MCP
- **`mcp-server/http-server.ts`**: Nuevo entrypoint HTTP con Express + StreamableHTTPServerTransport
- **`mcp-server/index.ts`**: Refactorizado para reutilizar `server-config.ts`
- **`docker-compose.yml`**: Servicio `pure-mcp` exponiendo puerto 3001
- **`package.json`**: Agregadas dependencias `express` y `@types/express`

---

## Instalación y Configuración

### 1. Generar Token de Autenticación

```bash
openssl rand -hex 32
# Salida: abc123def456...
```

### 2. Crear `.env.local`

```bash
cp .env.example .env.local

# Editar .env.local y reemplazar:
MCP_AUTH_TOKEN=abc123def456...  # Token generado arriba
```

### 3. Lanzar Docker

```bash
docker compose up -d --build
```

Verificar que `pure_mcp_server` está corriendo:

```bash
docker ps | grep pure_mcp_server
```

---

## Testing Local

### Test rápido

```bash
# Health check (sin autenticación)
curl http://localhost:3001/health

# Respuesta esperada:
# {"status":"ok","server":"pure-mcp-http","port":3001,"timestamp":"..."}
```

### Test completo

```bash
# Ejecutar script de testing
bash scripts/test-mcp-http.sh

# O contra URL remota:
bash scripts/test-mcp-http.sh https://tudominio.com/pure-mcp
```

### Test manual: Initialize

```bash
export TOKEN=$(grep MCP_AUTH_TOKEN .env.local | cut -d= -f2)

curl -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0.0"}
    }
  }' | jq .
```

---

## Autenticación

### Bearer Token

Todo request (excepto `/health`) requiere header:

```
Authorization: Bearer {MCP_AUTH_TOKEN}
```

**Sin token:**
```json
{"error": "Missing or invalid authorization header"}
```
**Token inválido:**
```json
{"error": "Invalid token"}
```

---

## Endpoints Disponibles

### GET `/health`

Verifica que el servidor está activo (sin autenticación).

```bash
curl http://localhost:3001/health
```

**Respuesta:**
```json
{
  "status": "ok",
  "server": "pure-mcp-http",
  "port": 3001,
  "timestamp": "2026-08-04T14:15:30Z"
}
```

### POST `/mcp`

Endpoint MCP que acepta requests JSON-RPC 2.0 (requiere autenticación).

**Métodos soportados:**
- `initialize` - Inicializar sesión MCP
- `tools/list` - Listar herramientas disponibles
- `tools/call` - Ejecutar una herramienta

---

## Herramientas Disponibles

### 1. `get_academic_overview`

Retorna resumen académico global.

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_academic_overview",
      "arguments": {}
    }
  }'
```

**Respuesta:**
```json
{
  "netFreeTimeHours": 42,
  "universities": [
    {"name": "Universidad de Antioquia - Ingeniería Aeroespacial", "currentGPA": 4.5, "modality": "presencial"},
    {"name": "Universidad de Cartagena - Ingeniería de Software", "currentGPA": 4.6, "modality": "virtual"}
  ],
  "activeSynergies": 4,
  "urgentDeliverables": 0
}
```

### 2. `ingest_academic_enrollment`

Procesa matrícula del estudiante.

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "ingest_academic_enrollment",
      "arguments": {"raw_text": "Geometría Vectorial 3 créditos..."}
    }
  }'
```

### 3. `parse_and_ingest_syllabus`

Procesa temarios y crea árbol jerárquico de temas.

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "parse_and_ingest_syllabus",
      "arguments": {
        "subject_id": "sub-geom",
        "raw_text": "Unidad 1: Vectores\n- Producto punto\n- Producto cruz"
      }
    }
  }'
```

### 4. `find_cross_subject_synergies`

Detecta coincidencias temáticas entre asignaturas.

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "find_cross_subject_synergies",
      "arguments": {}
    }
  }'
```

---

## Exposición Pública (Nginx)

### Opción A: Subdominio

Crear `/etc/nginx/conf.d/pure-mcp.conf`:

```nginx
upstream pure_mcp {
    server pure_mcp_server:3001;  # O: localhost:3001
}

server {
    listen 80;
    server_name pure-mcp.tudominio.com;

    location / {
        proxy_pass http://pure_mcp;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
```

### Opción B: Path-based

Añadir a tu servidor principal:

```nginx
location /pure-mcp/ {
    proxy_pass http://pure_mcp_server:3001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_request_buffering off;
}
```

Recargar nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Conectar en Claude.ai

### Pasos

1. Ir a **Settings > Connectors**
2. Seleccionar **"Add custom connector"** → MCP
3. Rellenar:
   - **Server URL:** `https://pure-mcp.tudominio.com/mcp`
     (O: `https://tudominio.com/pure-mcp/mcp`)
   - **Authorization Type:** `Bearer Token`
   - **Token:** `<copiar_desde_.env.local>`
   - **Name:** `Pure MCP`
4. Guardar y probar:
   ```
   @pure
   "¿Cuál es mi resumen académico?"
   ```

---

## Troubleshooting

### Puerto 3001 ya está en uso

```bash
lsof -i :3001
kill -9 <PID>
```

### MCP_AUTH_TOKEN no configurado

```bash
# Docker logs
docker logs pure_mcp_server

# Debe mostrar:
# ERROR: MCP_AUTH_TOKEN environment variable is required
```

### Conexión rechazada

```bash
# Verificar que el contenedor está corriendo
docker ps | grep pure_mcp

# Reiniciar
docker compose restart pure-mcp
```

### CORS o headers incorrectos

Verificar nginx config:

```bash
sudo nginx -t
sudo systemctl status nginx
```

---

## Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `MCP_HTTP_PORT` | `3001` | Puerto interno del servidor |
| `MCP_AUTH_TOKEN` | (requerido) | Token Bearer para autenticación |
| `NODE_ENV` | `production` | Entorno (development/production) |

---

## Scripts Útiles

### Generar token fuerte

```bash
openssl rand -hex 32
```

### Testear endpoint remoto

```bash
bash scripts/test-mcp-http.sh https://tudominio.com/pure-mcp
```

### Ver logs del servidor

```bash
docker logs -f pure_mcp_server
```

### Reiniciar servicio

```bash
docker compose restart pure-mcp
```

---

## Referencias

- [Model Context Protocol (MCP) - Docs](https://modelcontextprotocol.io)
- [Express.js - HTTP Server Framework](https://expressjs.com)
- [nginx - Reverse Proxy](https://nginx.org)
