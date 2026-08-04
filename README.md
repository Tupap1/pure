# 🎓 Pure OS — Sistema de Gestión Académica Multi-Universidad

**Pure OS** es una plataforma académica de alto rendimiento diseñada para estudiantes matriculados en múltiples carreras universitarias simultáneas (ej. *Ingeniería Aeroespacial* e *Ingeniería de Software*).

---

## ⚡ Características Principales

- **Multi-Universidad & Multi-Carrera**: Administra múltiples instituciones simultáneamente (Presencial, Virtual, A Distancia / Sábados Alternados A/B).
- **Servidor MCP Integrado**: Conexión bidireccional con IA vía Model Context Protocol (`mcp-server`) en Node 22 LTS.
- **Cero Datos Mock por Defecto**: Ingesta real mediante herramientas MCP inteligentes (`ingest_academic_enrollment`).
- **Dosis Mínima Eficaz (DME)**: Algoritmo de cálculo de horas libres netas y optimización de tiempo de estudio.
- **Master Schedule Grid**: Calendario semanal dinámico con prevención de traslapes y gestión de aulas.
- **Sinergias Ejes Temáticos**: Detector de intersecciones temáticas entre asignaturas de distintas facultades.
- **Persistencia PostgreSQL en Docker**: Base de datos de producción mapeada en volumen local persistente (`pure_postgres_data`).
- **Light & Dark Mode**: Interfaz adaptable con paleta Slate (modo claro y oscuro elegante).

---

## 🚀 Despliegue con Docker (Servidor VPS / Local)

### Requisitos
- Docker y Docker Compose instalados.

### Comandos de Arranque

```bash
# 1. Clonar el repositorio
git clone https://github.com/Tupap1/pure.git
cd pure

# 2. Iniciar todos los servicios en segundo plano
docker compose up -d --build
```

### Servicios Desplegados

| Servicio | Contenedor | Puerto | Descripción |
| :--- | :--- | :---: | :--- |
| **Pure Web App** | `pure_academic_app` | `3000` | Aplicación Next.js Standalone |
| **Servidor MCP** | `pure_mcp_server` | Stdio / Internal | Servidor MCP de IA en Node 22 |
| **PostgreSQL DB** | `pure_postgres_db` | `5432` | Base de datos persistente |

---

## 📱 Acceso Móvil / Remoto

Para acceder a la aplicación desde tu teléfono móvil o laptop fuera de tu red local:

```bash
# Opción rápida con Cloudflare Tunnel
npx cloudflared tunnel --url http://localhost:3000
```

---

## 🛠️ Tecnologías

- **Frontend / Framework**: Next.js 14, React 18, Tailwind CSS, Lucide Icons, Dexie.js (IndexedDB).
- **Backend / DB**: Node.js 22 LTS, PostgreSQL 16 Alpine, Model Context Protocol (MCP SDK).
- **Testing**: Vitest (22 unit tests passing).
- **Contenedores**: Docker Compose, Standalone Multi-stage Dockerfile.
