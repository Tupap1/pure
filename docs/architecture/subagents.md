# Especificación de Subagentes & Roles de Desarrollo — Sistema "Pure"

**Proyecto**: Pure — Sistema de Gestión Académica Multi-Universidad
**Metodología**: Spec-Driven Multi-Agent Execution

---

## 🤖 1. Matriz de Subagentes Especializados

### Subagente 1: `agent-ui-architect` (Arquitecto UI/UX & Frontend Lead)
* **Objetivo Principal**: Implementar la interfaz visual completa de los 5 Tableros utilizando Next.js, Tailwind CSS, Lucide Icons y las reglas de diseño Impeccable (Cyber-Academic Dark Glassmorphism).
* **Entradas**: `specs/design-system-spec.md`, `specs/functional-requirements.md`.
* **Salidas**: Componentes React (`components/ui/`, `components/dashboards/`), Páginas (`app/`), Estilos globales (`app/globals.css`).
* **Responsabilidades Atómicas**:
  - Implementar el Layout Shell (Sidebar de navegación para los 5 Tableros, Header con resumen de Tiempo Libre).
  - Desarrollar las tarjetas visuales de Universidades, Profesores y Materias con sus diálogos de edición (CRUD Modals).
  - Construir la grilla visual del Calendario Semanal con renderizado diferenciado por color (Aeroespacial vs Software vs Estudio DME).
  - Desarrollar la interfaz en árbol para los Ejes Temáticos con selector de estado de dominio.

### Subagente 2: `agent-data-engine` (Engeniero de Datos & Persistencia Local-First)
* **Objetivo Principal**: Crear la capa de base de datos relacional local-first con Dexie.js (IndexedDB), el cliente de Supabase y el Sync Engine offline.
* **Entradas**: `specs/architecture-spec.md`.
* **Salidas**: `lib/db/dexie-schema.ts`, `lib/db/supabase-client.ts`, `lib/db/sync-engine.ts`, React Hooks de datos (`lib/hooks/`).
* **Responsabilidades Atómicas**:
  - Definir las tablas Dexie.js (`universities`, `professors`, `subjects`, `schedules`, `syllabus_topics`, `deliverables`, `study_sessions`, `sync_queue`).
  - Implementar los Hooks CRUD reutilizables con actualización reactiva (`useUniversities`, `useProfessors`, `useSubjects`, `useDeliverables`, `useSyllabus`).
  - Desarrollar el motor de sincronización offline `sync-engine.ts` que encola mutaciones y las envía a Supabase cuando se reconecta internet.

### Subagente 3: `agent-algorithm-dme` (Especialista en Algoritmos & Eficiencia de Tiempo)
* **Objetivo Principal**: Implementar las fórmulas matemáticas de la Dosis Mínima Eficaz (DME), la matriz de Tiempo Libre Neto y el detector de traslapes de horario.
* **Entradas**: `specs/modules/02-study-hours-algorithm.md`, `specs/modules/04-schedule-conflict-calendar.md`.
* **Salidas**: `lib/algorithms/study-hours-dme.ts`, `lib/algorithms/conflict-detector.ts`, `lib/algorithms/grade-calculator.ts`.
* **Responsabilidades Atómicas**:
  - Programar la función `calculateDME(subject, deliverables, currentGrade, targetGrade)` que devuelve las horas semanales necesarias.
  - Programar la función `detectScheduleConflicts(schedules)` que analiza empalmes entre clases de ambas universidades.
  - Programar la calculadora de "Nota Mínima Requerida en Entregas Restantes".

### Subagente 4: `agent-mcp-engineer` (Ingeniero de IA & Servidor MCP)
* **Objetivo Principal**: Construir el servidor TypeScript MCP (`@modelcontextprotocol/sdk`) con las 6 herramientas bidireccionales para Antigravity.
* **Entradas**: `specs/modules/06-mcp-server-bidirectional.md`, `specs/architecture-spec.md`.
* **Salidas**: `mcp-server/index.ts`, `mcp-server/tools/*.ts`.
* **Responsabilidades Atómicas**:
  - Implementar la herramienta `parse_and_ingest_syllabus` (conversión de texto de temarios a árbol JSON).
  - Implementar la herramienta `find_cross_subject_synergies` (escaneo y comparación de temarios de Aeroespacial vs Software).
  - Implementar las herramientas de actualización de notas, entregas y estados de dominio.

### Subagente 5: `agent-qa-verifier` (Ingeniero de Pruebas & Verificación)
* **Objetivo Principal**: Validar la compilación TypeScript, ejecutar pruebas de persistencia offline y verificar la integración end-to-end.
* **Entradas**: Todas las especificaciones en `specs/`.
* **Salidas**: `specs/walkthrough.md`, reportes de pruebas.
* **Responsabilidades Atómicas**:
  - Ejecutar la verificación de tipos `tsc --noEmit` y el build `npm run build`.
  - Simular desconexión a red (DevTools Offline) y comprobar que la app crea/edita datos localmente en Dexie.js sin errores.
  - Probar las llamadas de herramientas MCP.
