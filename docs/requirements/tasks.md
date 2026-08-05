# Master Plan de Tareas Ultra-Detallado (Atomic SDD Task List) — Sistema "Pure"

**Metodología**: Spec-Driven Development (SDD) & Multi-Agent Execution
**Asignación de Subagentes**: `agent-ui-architect`, `agent-data-engine`, `agent-algorithm-dme`, `agent-mcp-engineer`, `agent-qa-verifier`

---

## 📋 Backlog Ultra-Detallado por Fases

### FASE 1: Configuración de Entorno, Arquitectura y Skills UI/UX
- [x] **T-1.1**: Especificación de Requisitos Funcionales (`specs/functional-requirements.md`).
- [x] **T-1.2**: Especificación de Arquitectura de Datos (`specs/architecture-spec.md`).
- [x] **T-1.3**: Especificación de Sistema de Diseño y 5 Tableros (`specs/design-system-spec.md`).
- [x] **T-1.4**: Especificación de Matriz de Subagentes (`specs/subagents-spec.md`).
- [ ] **T-1.5**: Instalación y configuración de **Impeccable UI/UX Skill** (`npx impeccable install`).
  - *Asignado a*: `agent-ui-architect`
  - *Objetivo*: Instalar la guía de diseño Impeccable con sus 59 reglas de frontend y tokenización.
- [ ] **T-1.6**: Inicialización del proyecto Next.js 14+ con TypeScript, App Router, Tailwind CSS, Lucide Icons.
  - *Asignado a*: `agent-ui-architect`
  - *Comando*: `npx -y create-next-app@latest ./ --typescript --tailwind --app --src-dir=false --import-alias="@/*" --use-npm`

---

### FASE 2: Capa de Datos Local-First y Sincronización (IndexedDB + Supabase)
- [ ] **T-2.1**: Definición del Esquema Local-First en Dexie.js (`lib/db/dexie-schema.ts`).
  - *Asignado a*: `agent-data-engine`
  - *Objetivo*: Crear las tablas relacionales para `universities`, `professors`, `subjects`, `schedules`, `syllabus_topics`, `deliverables`, `study_sessions`, `sync_queue`.
  - *Criterio de Aceptación*: Instancia de Dexie exportada con tipos TypeScript e índices en `university_id`, `subject_id`, `due_date`.
- [ ] **T-2.2**: Configuración del Cliente Supabase (`lib/db/supabase-client.ts`).
  - *Asignado a*: `agent-data-engine`
  - *Objetivo*: Instanciar el cliente Supabase con soporte de claves `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] **T-2.3**: Motor de Sincronización Offline (`lib/db/sync-engine.ts`).
  - *Asignado a*: `agent-data-engine`
  - *Objetivo*: Manejar el almacenamiento en `sync_queue` cuando se está offline y despachar peticiones a Supabase al detectar `window.addEventListener('online')`.
- [ ] **T-2.4**: Creación de React Hooks Reutilizables de Datos (`lib/hooks/useAcademicData.ts`).
  - *Asignado a*: `agent-data-engine`
  - *Objetivo*: Exponer hooks `useUniversities`, `useProfessors`, `useSubjects`, `useDeliverables`, `useSyllabus` con reactividad Dexie `useLiveQuery`.

---

### FASE 3: Motores de Algoritmos & Eficiencia de Tiempo
- [ ] **T-3.1**: Algoritmo de Dosis Mínima Eficaz (DME) (`lib/algorithms/study-hours-dme.ts`).
  - *Asignado a*: `agent-algorithm-dme`
  - *Objetivo*: Programar la función `calculateDME()` ajustando horas por créditos, dificultad, margen de nota meta y sinergias temáticas.
- [ ] **T-3.2**: Detector de Traslapes de Horarios (`lib/algorithms/conflict-detector.ts`).
  - *Asignado a*: `agent-algorithm-dme`
  - *Objetivo*: Programar `detectScheduleConflicts()` para identificar empalmes entre materias de Ing. Aeroespacial e Ing. de Software.
- [ ] **T-3.3**: Calculadora de Nota Mínima Requerida (`lib/algorithms/grade-calculator.ts`).
  - *Asignado a*: `agent-algorithm-dme`
  - *Objetivo*: Calcular la nota necesaria en las entregas restantes para alcanzar la nota meta gastando el mínimo esfuerzo.

---

### FASE 4: Desarrollo Visual de los 5 Tableros (UI/UX Pro Max)
- [ ] **T-4.1**: Layout Shell & Navigation Sidebar (`components/layout/Shell.tsx`).
  - *Asignado a*: `agent-ui-architect`
  - *Objetivo*: Sidebar con navegación suave entre los 5 Tableros, Header vivo con contador de Tiempo Libre Garantizado.
- [ ] **T-4.2**: Tablero 1 — Command Center (`components/dashboards/CommandCenter.tsx`).
  - *Asignado a*: `agent-ui-architect`
  - *Objetivo*: Renderizar Header de métricas (Tiempo Libre, DME, Promedio), Widget de entregas urgentes y bloque de estudio activo.
- [ ] **T-4.3**: Tablero 2 — Sinergias & Syllabus (`components/dashboards/SyllabusDashboard.tsx`).
  - *Asignado a*: `agent-ui-architect`
  - *Objetivo*: Árbol jerárquico de ejes temáticos, selector de dominio (4 niveles), panel de sinergias Cross-Degree y modal de ingesta IA.
- [ ] **T-4.4**: Tablero 3 — Master Schedule & Conflict Matrix (`components/dashboards/ScheduleDashboard.tsx`).
  - *Asignado a*: `agent-ui-architect`
  - *Objetivo*: Grid semanal Lunes-Domingo con código de colores HSL por universidad, bloques de estudio DME y banner de advertencia en rojo por traslapes.
- [ ] **T-4.5**: Tablero 4 — Entregas & Evaluaciones (`components/dashboards/DeliverablesDashboard.tsx`).
  - *Asignado a*: `agent-ui-architect`
  - *Objetivo*: Tarjetas con modalidad (Grupal vs Individual), peso %, nivel de complejidad y calculadora de nota requerida.
- [ ] **T-4.6**: Tablero 5 — Universidades & Profesores (`components/dashboards/ConfigDashboard.tsx`).
  - *Asignado a*: `agent-ui-architect`
  - *Objetivo*: Modales CRUD completos para Universidades, Profesores y Materias.

---

### FASE 5: Servidor MCP Bidireccional (Antigravity AI Bridge)
- [ ] **T-5.1**: Configuración del Servidor MCP TypeScript (`mcp-server/index.ts`).
  - *Asignado a*: `agent-mcp-engineer`
  - *Objetivo*: Inicializar `@modelcontextprotocol/sdk` conectándose a la base de datos de Pure.
- [ ] **T-5.2**: Herramienta `parse_and_ingest_syllabus` (`mcp-server/tools/ingestSyllabus.ts`).
  - *Asignado a*: `agent-mcp-engineer`
  - *Objetivo*: Convertir temarios en texto a árbol jerárquico JSON de temas y guardarlo en la materia.
- [ ] **T-5.3**: Herramienta `find_cross_subject_synergies` (`mcp-server/tools/findSynergies.ts`).
  - *Asignado a*: `agent-mcp-engineer`
  - *Objetivo*: Escanear y comparar temarios entre Ing. Aeroespacial e Ing. de Software para sugerir estudio unificado.
- [ ] **T-5.4**: Herramientas de Gestión Académica (`mcp-server/tools/manageAcademic.ts`).
  - *Asignado a*: `agent-mcp-engineer`
  - *Objetivo*: Exponer `get_academic_overview`, `generate_minimal_effective_study_plan`, `record_deliverable_or_grade`, `update_topic_mastery`.

---

### FASE 6: PWA, Pruebas Offline & Verificación Final
- [ ] **T-6.1**: Configuración de PWA Offline (`public/manifest.json` + Service Workers).
  - *Asignado a*: `agent-qa-verifier`
- [ ] **T-6.2**: Prueba de Corte de Conexión (Offline DevTools Check).
  - *Asignado a*: `agent-qa-verifier`
  - *Objetivo*: Confirmar que todas las vistas y escrituras se realizan en IndexedDB sin errores estando desconectado.
- [ ] **T-6.3**: Verificación de Compilación y Tipos (`npm run build` & `tsc --noEmit`).
  - *Asignado a*: `agent-qa-verifier`
