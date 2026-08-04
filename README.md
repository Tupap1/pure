# 🎓 PURE OS — Sistema de Gestión Académica Multi-Universidad

[![Next.js](https://img.shields.io/badge/Next.js-14.2.16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.3.1-blue?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/Model_Context_Protocol-1.0.0-purple?style=flat-square)](https://modelcontextprotocol.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.14-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-2.1.9-green?style=flat-square&logo=vitest)](https://vitest.dev/)

**PURE OS** (System for Personal University Resource Efficiency) es una plataforma académica de alto rendimiento diseñada específicamente para estudiantes universitarios matriculados en **múltiples carreras concurrentes** (ej. *Ingeniería Aeroespacial* en modalidad presencial e *Ingeniería de Software* en modalidad a distancia/virtual).

El sistema combina algoritmos de optimización del tiempo de estudio mediante **Dosis Mínima Eficaz (DME)**, detección automática de **traslapes de horarios**, cruce de **sinergias temáticas en temarios**, y un **servidor de Protocolo de Contexto de Modelo (MCP - Model Context Protocol)** con transporte dual (stdio + HTTP/SSE) para ser operado directamente por agentes de Inteligencia Artificial.

---

## 📑 Tabla de Contenidos

1. [Arquitectura del Sistema & Módulos](#-arquitectura-del-sistema--módulos)
2. [Algoritmos de Eficiencia Académica](#-algoritmos-de-eficiencia-académica)
3. [Servidor MCP Integrado (AI Agent System)](#-servidor-mcp-integrado-ai-agent-system)
4. [Estructura del Proyecto](#-estructura-del-proyecto)
5. [Guía de Instalación y Desarrollo Local](#-guía-de-instalación-y-desarrollo-local)
6. [Despliegue con Docker & Portainer](#-despliegue-con-docker--portainer)
7. [Acceso Remoto / Móvil (Cloudflare Tunnel)](#-acceso-remoto--móvil-cloudflare-tunnel)
8. [Suite de Pruebas y Calidad de Código](#-suite-de-pruebas-y-calidad-de-código)

---

## 🏛️ Arquitectura del Sistema & Módulos

PURE OS está estructurado en 5 módulos core accesible desde la barra de navegación principal:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 PURE OS UI                                  │
├───────────────┬────────────────┬─────────────────┬─────────────┬────────────┤
│   Dashboard   │  Sinergias &   │ Master Schedule │ Entregables │Config. CRUD│
│   (Control)   │    Syllabus    │(Google Calendar)│ & Evaluac.  │ & Direct.  │
└───────┬───────┴────────┬───────┴────────┬────────┴──────┬──────┴─────┬──────┘
        │                │                │               │            │
        ▼                ▼                ▼               ▼            ▼
 ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ ┌────────────┐ ┌──────────┐
 │ Algoritmo   │  ┌ Sinergias   │  │ Detector de │ │ Calculadora│ │ Base de  │
 │   DME &     │  │ Vectoriales │  │  Traslapes  │ │Nota Mínima │ │ Datos    │
 │Tiempo Libre │  └ Inter-carrera│  │  de Horario │ │ Requerida  │ │ IndexedDB│
 └─────────────┘  └─────────────┘  └─────────────┘ └────────────┘ └──────────┘
```

### 1. Dashboard (Centro de Mando & Balance de Tiempo)
- **MultiProgressRing**: Medidor de anillos concéntricos SVG que visualiza la proporción de **Tiempo Libre Neto**, **Carga de Estudio DME** y **Horario de Clases**.
- **DailyLoadStackedBar**: Histograma de distribución de carga horaria por día de la semana (Lunes a Sábado A/B).
- **StudyHeatmap**: Mapa de calor interactivo tipo GitHub para registrar la consistencia de bloques de estudio.
- **SemesterProgressChart**: Gráfica SVG interactiva que traza la curva de evolución del Promedio Académico (GPA) acumulado frente a la Nota Meta (4.50).
- **Tarjetas de Asignatura con Anillos de Nota Target**: Muestra el progreso actual hacia la nota objetivo y las horas recomendadas de DME semanal por materia.

### 2. Sinergias & Syllabus
- **Detector de Coincidencias Temáticas**: Analiza los temarios (Syllabus) de asignaturas de facultades distintas (ej. *Geometría Vectorial* de Aeroespacial vs *Algoritmos Matriciales* de Software).
- **Descuento de Tiempo de Estudio**: Calcula el porcentaje de solapamiento conceptual para otorgar descuentos automáticos en las horas DME requeridas.

### 3. Master Schedule (Horario Unificado)
- **Modo Desktop (Matriz Semanal)**: Tabla interactiva 7x12 con código de colores por institución y modalidad.
- **Modo Móvil (Estilo Google Calendar)**:
  - Rejilla vertical de tiempo de `06:00` a `22:00` con eje de horas a la izquierda.
  - Bloques de clase posicionados de forma proporcional a su hora de inicio y duración.
  - **Línea de tiempo en vivo roja** con indicador LED en el eje temporal del día actual.
  - Control de fecha con botón `[ Hoy ]`, navegación de día y selector de vista (`Cuadrícula` | `Lista`).
- **Motor de Detección de Conflictos**: Alerta en rojo vivo si dos clases coinciden en el mismo día y rango horario.

### 4. Entregables, Evaluaciones & Exámenes
- **Directorio de Evaluaciones**: Clasificación por modalidad (Individual / Grupal), complejidad (Fácil, Medio, Difícil) y fecha de entrega.
- **Calculadora de Nota Mínima Requerida**: Algoritmo en `lib/domain/subject.ts` que determina qué promedio exacto necesitas sacar en el % restante de la materia para alcanzar tu nota meta.

### 5. Configuración & Directorio Base (CRUD)
- **Navegación por Pestañas Segmentadas**:
  - **Instituciones**: Creación y edición de universidades con color distintivo, escalas de nota y nota mínima aprobatoria.
  - **Asignaturas**: Gestión de código, créditos, dificultad, modalidad y nota meta.
  - **Docentes**: Directorio de profesores vinculados a cada institución con correo institucional.
  - **Mantenimiento**: Botones para **Ingestar Matrícula Demo vía MCP** o **Resetear Base de Datos Local IndexedDB**.

---

## 🧮 Algoritmos de Eficiencia Académica

### 1. Dosis Mínima Eficaz (DME) (`lib/algorithms/study-hours-dme.ts`)

Calcula la cantidad óptima de horas de estudio semanal por materia:

$$\text{DME Semanal} = \big(\text{Horas Base} \times \text{Dificultad} \times \text{Margen de Nota} \times \text{Sinergia}\big) + \text{Bonus Urgencia}$$

- **Horas Base**: $\text{Créditos} \times 1.2$.
- **Dificultad**: $0.8 + (\text{Dificultad [1..5]} \times 0.1)$.
- **Margen de Nota**:
  - **Inicio de Semestre (`current_grade === 0`)**: Factor neutral de `1.0x` para evitar recomendaciones infladas de horas cuando aún no hay parciales calificados.
  - **Nota Actual $\ge$ Meta + 0.5**: Factor de `0.6x` (excelente margen, reducción de horas).
  - **Nota Actual $\ge$ Meta**: Factor de `0.8x`.
  - **Brecha Negativa**: $1.0 + \min(1.0, \text{Meta} - \text{Nota Actual})$.
- **Factor Sinergia**: $1.0 - (0.3 \times \% \text{Temas Compartidos})$.
- **Bonus Urgencia**: $\text{Peso \% Parciales en 7 días} \times 0.05$.

### 2. Tiempo Libre Neto Semanal

$$\text{Tiempo Libre Neto} = 168\text{h} - (\text{Horas de Clase} + \text{Horas de Sueño [49h]} + \text{Estudio DME})$$

### 3. Detector de Traslapes de Horario (`lib/algorithms/conflict-detector.ts`)

Analiza pares de clases en el mismo día de la semana y detecta solapamientos si:
$$\text{Inicio}_A < \text{Fin}_B \quad \text{y} \quad \text{Inicio}_B < \text{Fin}_A$$

---

## 🤖 Servidor MCP Integrado (AI Agent System)

PURE OS incluye un servidor MCP (Model Context Protocol) nativo en Node 22 LTS bajo la carpeta `mcp-server/`. Permite a cualquier agente de Inteligencia Artificial (Claude, Antigravity, Gemini, OpenAI) inspeccionar e ingestar datos de forma remota o local.

### Transporte Dual (stdio + HTTP/SSE)
- **Modo Stdio**: Para integraciones locales en editores o CLI (`node dist-mcp/index.js`).
- **Modo HTTP/SSE**: Escucha en el puerto `3001` (`http://0.0.0.0:3001/sse`) con soporte CORS libre (`origin: '*'`), habilitado para Cloudflare Tunnels y agentes Cloud.

### Catálogo de Herramientas MCP Disponibles

| Nombre Herramienta | Parámetros | Descripción |
| :--- | :--- | :--- |
| `get_academic_overview` | Ninguno | Retorna el tiempo libre neto, universidades activas, sinergias y alertas urgentes. |
| `ingest_academic_enrollment` | `raw_text?: string` | Ingesta la matrícula completa (UdeA Aeroespacial + UdeC Software) con instituciones, materias, docentes y horarios con aulas. |
| `parse_and_ingest_syllabus` | `subject_id`, `raw_text` | Convierte el texto de un temario en un árbol jerárquico de unidades y temas. |
| `find_cross_subject_synergies` | Ninguno | Escanea temarios entre carreras e identifica coincidencias conceptuales para reducir horas de estudio. |

> 📌 **Documentación Completa del Servidor MCP**: Consulta la guía técnica extendida en [`mcp-server/README.md`](file:///c:/Proyectos/Pure/mcp-server/README.md).

---

## 📁 Estructura del Proyecto

```
Pure/
├── app/                        # App Router de Next.js
│   ├── globals.css             # Tailwind CSS & Estilos Globales
│   ├── layout.tsx              # Root Layout HTML/Body con Metadatos
│   ├── page.tsx                # Renderizador Principal de PURE OS
│   └── manifest.json           # Configuración PWA
├── components/                 # Componentes React
│   ├── dashboards/             # Paneles Principales de Dashboard
│   │   ├── CommandCenter.tsx   # Dashboard Principal (Balance & DME)
│   │   ├── ScheduleDashboard.tsx # Master Schedule & Horarios
│   │   ├── MobileScheduleTimeline.tsx # Rejilla Google Calendar Móvil
│   │   ├── DeliverablesDashboard.tsx # Entregables & Evaluaciones
│   │   ├── SyllabusDashboard.tsx # Sinergias Temáticas
│   │   └── ConfigDashboard.tsx # CRUD Tabulado de Instituciones & Materias
│   ├── layout/                 # Header & Sidebar de Navegación
│   └── ui/                     # Componentes UI Atomicos
│       ├── Badge.tsx           # Variantes Aeroespacial, Software, Danger, Synergy
│       ├── Button.tsx          # Botones con micro-interacciones
│       ├── Card.tsx            # Tarjetas de contenedor
│       ├── Modal.tsx           # Modales flotantes con React.createPortal
│       ├── ProgressRing.tsx    # Anillos concéntricos SVG y simples
│       ├── DailyLoadStackedBar.tsx # Histograma de carga diaria
│       ├── StudyHeatmap.tsx    # Mapa de calor estilo GitHub
│       └── SemesterProgressChart.tsx # Gráfica de evolución de GPA
├── lib/                        # Lógica de Dominio, Base de Datos y Algoritmos
│   ├── algorithms/             # Motor Algorítmico (DME, Conflictos, Transformer)
│   ├── db/                     # Esquema IndexedDB con Dexie.js (`pureDB`)
│   ├── domain/                 # Entidades y Funciones de Dominio
│   ├── hooks/                  # Hook de React `usePureData` y `useTheme`
│   └── validations/            # Esquemas de Validación con Zod
├── mcp-server/                 # Servidor de Protocolo de Contexto de Modelo (MCP)
│   ├── index.ts                # Servidor MCP Principal (Stdio + Express SSE)
│   ├── tools-handler.ts        # Handlers Ejecutables de Herramientas MCP
│   └── README.md               # Documentación Técnica Completa para Agentes IA
├── __tests__/                  # Suite de Pruebas Automatizadas con Vitest (36 tests)
├── Dockerfile                  # Multi-stage Standalone Docker build
├── docker-compose.yml          # Orquestación de Contenedores Docker
├── package.json                # Dependencias y Scripts de NPM
└── tsconfig.json               # Configuración de TypeScript
```

---

## 🛠️ Guía de Instalación y Desarrollo Local

### Requisitos Previos
- **Node.js**: `v20.x` o `v22.x` (LTS)
- **NPM**: `v10.x` o superior

### Pasos de Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/Tupap1/pure.git
cd pure

# 2. Instalar dependencias del proyecto y del servidor MCP
npm install
cd mcp-server && npm install && cd ..

# 3. Iniciar el servidor de desarrollo local de Next.js
npm run dev
```

La aplicación web estará disponible de inmediato en `http://localhost:3000`.

---

## 🐳 Despliegue con Docker & Portainer

El proyecto utiliza una build multi-etapa optimizada con el modo `standalone` de Next.js y expone el Servidor MCP en el puerto `3001`.

### Comandos de Despliegue con Docker Compose

```bash
# Construir e iniciar todos los servicios en segundo plano
docker compose up -d --build
```

### Puertos Expuestos

| Servicio | Contenedor | Puerto | Descripción |
| :--- | :--- | :---: | :--- |
| **PURE Web App** | `pure_academic_app` | `3000` | Interfaz Web Next.js Standalone |
| **Servidor MCP SSE** | `pure_mcp_server` | `3001` | Server-Sent Events MCP para IA |

### Integración con Portainer Stacks
1. En tu panel de **Portainer**, navega a **Stacks** $\rightarrow$ **Add stack**.
2. Selecciona la opción **Repository** e ingresa la URL: `https://github.com/Tupap1/pure.git`.
3. Haz clic en **Deploy the stack**. Portainer se encargará de descargar el código, construir la imagen de Docker y levantar el servicio automáticamente.

---

## 📱 Acceso Remoto / Móvil (Cloudflare Tunnel)

Para acceder de forma segura a PURE OS y su Servidor MCP desde cualquier lugar sin necesidad de abrir puertos en tu router:

```bash
# Iniciar túnel rápido para la aplicación web
npx cloudflared tunnel --url http://localhost:3000

# Iniciar túnel rápido para el Servidor MCP SSE (Agentes Cloud)
npx cloudflared tunnel --url http://localhost:3001
```

---

## 🧪 Suite de Pruebas y Calidad de Código

PURE OS cuenta con una suite de pruebas automatizadas con **Vitest** y validación estricta de tipos de TypeScript.

```bash
# Ejecutar la suite completa de pruebas unitarias
npm run test

# Verificar la integridad de tipos en TypeScript
npx tsc --noEmit
```

**Estado Actual de Pruebas**: `36 passed (100% OK)`.
