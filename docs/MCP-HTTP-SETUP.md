# Guía de Conexión MCP HTTP / SSE & OAuth 2.0 para Claude.ai

## Resumen

El servidor MCP de **Pure OS** implementa la especificación **Model Context Protocol (MCP)** con soporte dual para conectores personalizados de Claude.ai:

1. **OAuth 2.0 Dynamic Client Registration (RFC 7591 / RFC 8414)**: Permite a Claude.ai registrarse automáticamente y realizar el apretón de manos OAuth de forma transparente.
2. **Request Headers (Bearer Token)**: Permite pasar directamente la cabecera `Authorization: Bearer <token>` desde la configuración del conector de Claude.ai.

---

## Endpoints Expuestos

| Endpoint | Método | Descripción |
| :--- | :---: | :--- |
| `/sse` | `GET` | Endpoint Server-Sent Events (SSE) principal para la conexión con Claude |
| `/messages` | `POST` | Canal de mensajes JSON-RPC para la sesión activa |
| `/.well-known/oauth-authorization-server` | `GET` | Metadatos de descubrimiento OAuth 2.0 (RFC 8414) |
| `/oauth/register` | `POST` | Registro dinámico de clientes OAuth (RFC 7591) para Claude.ai |
| `/oauth/authorize` | `GET` | Endpoint de autorización que concede la conexión |
| `/oauth/token` | `POST` | Endpoint de emisión e intercambio de tokens de acceso Bearer |
| `/health` | `GET` | Healthcheck y contador de sesiones activas (sin autenticación) |

---

## Cómo Conectar en Claude.ai

### Opción A: Conexión Automática por OAuth (Recomendada)

1. Ir a **Settings > Connectors** en Claude.ai.
2. Hacer clic en **Add custom connector**.
3. Rellenar los campos:
   - **Name:** `Pure MCP`
   - **Server URL:** `http://TU_IP_O_DOMINIO:3001/sse`  
     *(O `https://pure-mcp.tudominio.com/sse` si usas HTTPS con Nginx/Cloudflare Tunnel)*
4. Hacer clic en **Add**. Claude detectará automáticamente los metadatos OAuth del servidor y registrará el conector sin errores.

---

### Opción B: Conexión por Request Headers (Bearer Token)

Si prefieres usar autenticación por clave fija o token estático:

1. En el diálogo **Add custom connector**:
2. Desplegar la sección **Request headers**.
3. Configurar la cabecera:
   - **Header Name:** `authorization`
   - **Header Value:** `Bearer pure_secret_token_2026` *(Asegúrate de incluir la palabra `Bearer ` con espacio)*
   - **Required:** Activar casilla
4. Hacer clic en **Add**.

---

## Despliegue con Docker en el Servidor Remoto

### 1. Iniciar los Servicios

```bash
# Reconstruir la imagen e iniciar en segundo plano
docker compose up -d --build
```

### 2. Verificar el Estado del Servidor MCP

```bash
curl http://localhost:3001/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "server": "pure-mcp-server",
  "activeSessions": 0,
  "endpoints": ["/sse", "/messages", "/api/mcp", "/oauth/register", "/.well-known/oauth-authorization-server"]
}
```

---

## Verificación de Metadatos OAuth

Puedes verificar los metadatos RFC 8414 con cURL:

```bash
curl http://localhost:3001/.well-known/oauth-authorization-server
```

**Respuesta JSON esperada:**
```json
{
  "issuer": "http://localhost:3001",
  "authorization_endpoint": "http://localhost:3001/oauth/authorize",
  "token_endpoint": "http://localhost:3001/oauth/token",
  "registration_endpoint": "http://localhost:3001/oauth/register",
  "scopes_supported": ["mcp"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code"]
}
```
