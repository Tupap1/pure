# Plan de implementación — Hub de Asignatura

> Documento de handoff para los agentes de implementación. Rama: `feat/hub-asignatura`.
> Escrito tras una fase de shape (wireframe navegable) + auditoría multi-agente verificada.
> Regla de trabajo: este plan lo ejecutan agentes de implementación; el rol de planeación/auditoría no edita el código de la app.

## 1. Qué se construye y por qué

Una **pestaña/surface "Asignatura" (hub)**: todo lo relativo a una materia en un solo lugar, en vez de repartido entre Configuración, Entregas, Temario, Horarios y Clases. Se llega por **drill-in (tocando una materia)**, no como una 7.ª pestaña de la barra inferior. Dentro, la sección **Evaluación** define el esquema ponderado de la materia (reutilizando la entidad `deliverables`) y a partir de ahí el sistema **calcula la nota**.

Sub-navegación del detalle (6 secciones): **Resumen · Ficha · Evaluación · Clases · Temario · Asistencia**.

### Decisiones bloqueadas
- **Modelo de evaluación**: reutilizar la entidad `deliverables` (sin entidad nueva, sin migración, sin tool MCP nuevo).
- **Acceso**: drill-in por tap (no ocupa slot en `BottomNav`).
- **Ficha** absorbe aula + horario + datos del profesor + metadatos ("todos los detalles").
- **Clases** destaca grabaciones/transcripciones; **Asistencia** es el registro; **Evaluación** incluye las actividades con fecha.

## 2. Defectos preexistentes (verificados) que el hub debe absorber

| ID | Estado | Descripción | Evidencia |
|---|---|---|---|
| **B2** | **CONFIRMADO — bug real** | `deliverables.type` se escribe capitalizado (`'Parcial'`) pero se lee en minúscula. Toda entrega creada por UI nunca se clasifica en el planificador de estudio. | Escritura: `lib/db/repository-pg.ts:373` (`deliv.type \|\| 'Parcial'`), `components/dashboards/DeliverablesDashboard.tsx:120,148` (hardcode). Lectura minúscula: `lib/algorithms/study-planner.ts:155-156`. El form de Entregas no tiene selector de `type`. |
| **B3** | **CONFIRMADO** | `subject.current_grade` nunca se recalcula desde las entregas calificadas; queda en 0 o heredado y stale. Telemetría, DME y GPA leen ese valor. | Escritura: `ConfigDashboard.tsx:260,282` (0/heredado). Lectura: `study-hours-dme.ts:174-181`, `CommandCenter.tsx:324`, `SubjectTelemetryTable.tsx:254,376`, `SubjectDetailsModal.tsx:316`. Helpers a reutilizar: `calculateWeightedGrade` (`lib/domain/subject.ts:15`), `calculateSubjectGradeProgress` (`lib/domain/deliverable.ts:73`). |
| **C** | **CONFIRMADO** | `calculateSubjectGradeProgress`, `PRESETS`, `generateDeliverablesFromPreset` están huérfanos (solo tests). Son el andamiaje de la sección Evaluación. | `lib/domain/deliverable.ts:73,110,137`; únicos consumidores en `__tests__/domain/deliverable.test.ts`. |
| **B4** | **REFUTADO — NO tocar** | La supuesta pérdida de campos Fireflies/AI al persistir clases NO existe: ya se corrigió. | `lib/db/repository-pg.ts:508-528` incluye las 17 columnas con `COALESCE`. Commit `55f4d3b` "fix(clases): persistir de verdad transcript_text y campos de IA". |

## 3. Plan por fases (secuencial — dependencias reales, no paralelizable en los mismos archivos)

### Fase 1 — Bloque `SubjectEvaluation` + correcciones de correctitud
No requiere aún el shell del hub. Se monta como pestaña "Evaluación" en `SubjectDetailsModal` (ya está scoped a una materia) como hogar interino.

1. **Arreglar B2 (casing de `type`)**
   - `lib/validations/schemas.ts:87`: que el `enum` de `type` normalice a minúscula canónica (aceptar entrada case-insensitive y `.transform(v => v.toLowerCase())`), para que tanto el form como cualquier valor legado queden en minúscula.
   - `lib/db/repository-pg.ts:373`: default `'parcial'` (minúscula) y normalizar `type` entrante a minúscula.
   - `components/dashboards/DeliverablesDashboard.tsx`: eliminar el `type: 'Parcial'` hardcodeado (líneas ~120, ~148) y **añadir un `<select>` de tipo** (`taller|proyecto|parcial|quiz|laboratorio|examen_final`).
   - No tocar `study-planner.ts` (ya lee minúscula; queda correcto al normalizar la escritura).
2. **Arreglar B3 (fuente única de `current_grade`)**
   - Nuevo helper `recomputeSubjectCurrentGrade(subjectId)` (en `lib/db/repository.ts` o dominio) que use `calculateWeightedGrade`/`calculateSubjectGradeProgress` sobre las entregas calificadas de la materia y persista en `subject.current_grade` vía `saveSubject`.
   - Llamarlo tras `saveDeliverable`/`deleteDeliverable` en `lib/db/repository.ts` (camino local-first).
3. **Extraer `DeliverableFormModal`** de `DeliverablesDashboard.tsx:103-155,443-568` a `components/ui/DeliverableFormModal.tsx` (props `initialData`, `subjects`/`defaultSubjectId`, `onSave`, `onCancel`), imitando el patrón ya extraído de `components/ui/ClassSessionForm.tsx`. `DeliverablesDashboard` debe reutilizarlo (no forkear la lógica).
4. **Bloque `components/ui/SubjectEvaluation.tsx`** (props: `subject` + sus `deliverables`): medidor de suma 100% (`calculateSubjectGradeProgress`: verde `=100`, ámbar `<100`, rojo `>100`), nota calculada (`calculateWeightedGrade`) y requerida (`calculateRequiredGradeForRemaining`), botón "Usar plantilla" (`PRESETS` + `generateDeliverablesFromPreset` + `saveDeliverable` en bucle), y "Agregar ítem" con el `DeliverableFormModal`. Ojo: `generateDeliverablesFromPreset` genera `type` minúscula — ya consistente tras B2.
5. **Montaje interino**: pestaña "Evaluación" en `SubjectDetailsModal.tsx` (junto a "Últimas Sesiones" / "Información & Telemetría").
6. **Tests**: specs de dominio para el recompute de `current_grade` y para `type` normalizado; ampliar/añadir en `__tests__/` (hoy no hay tests de `deliverables`/`type`).

### Fase 2 — Shell del hub + navegación drill-in + secciones por composición
Depende de Fase 1 (usa `SubjectEvaluation`).

- **Navegación (primer React Context del repo — decisión consciente; verificado que no existe ninguno)**: `lib/hooks/useNavigation.tsx` con una unión `NavView = {kind:'tab',tab} | {kind:'subjects-index'} | {kind:'subject',subjectId}` y acciones `selectTab/openSubjectsIndex/openSubject/goBack`. `Shell.tsx` como provider; sustituir el `activeTab` suelto por `view`; pasar `view` al render-prop.
- `app/page.tsx`: anteponer la bifurcación `subject`/`subjects-index` antes del `switch` actual (los 6 casos quedan intactos).
- `Sidebar.tsx`: botón bespoke "Asignaturas" **fuera** de `NAV_ITEMS.map` (para no meter 7.º slot en `BottomNav`, que mapea el mismo array). `Header.tsx`: título dinámico + "volver" cuando `view.kind !== 'tab'`.
- **Entradas drill-in**: `SubjectTelemetryTable.tsx:400` ("Ver Detalle") → `openSubject`; **hueco móvil**: hacer tappable el nombre/tarjeta (`:208`/`:216`); conservar `SubjectDetailsModal` para `CalendarView` (scoped a horario).
- **Secciones (composición, no reescritura)** — extracciones necesarias:
  - Resumen: extraer `NormativeBreakdown` + `BreakdownRow` (hoy privados en `SubjectTelemetryTable.tsx:28,50`) a `components/ui/NormativeBreakdown.tsx`; reutilizar `GradeProgressBar`, `useAcademicLoad().perSubject.find(...)`.
  - Ficha: extraer `SubjectForm`/`ProfessorForm`/`ScheduleForm` de `ConfigDashboard.tsx` (imitando `ClassSessionForm`); **mostrar `professor.office_hours`/`notes` y `university.scale_*`/`passing_grade`**, que existen en datos pero faltan hoy en UI.
  - Evaluación: montar el bloque de Fase 1.
  - Clases: extraer `ClassSessionsList` de `ClassSessionsDashboard.tsx:195-301`; reutilizar `ClassSessionForm`/`ClassSessionDetail`.
  - Temario: extraer `SubjectSyllabusPanel` de `SyllabusDashboard.tsx` (ya tiene `selectedSubjectId`).
  - Asistencia: reutilizar `AttendancePanel` con props filtradas por materia; net-new solo si se quiere historial por fecha (hoy solo registra "hoy").

### Fase 3 — Entregas → Agenda transversal
Depende de Fase 2. `DeliverablesDashboard` se adelgaza a la vista transversal por fecha (triaje de vencimientos entre carreras).

## 4. Reglas y verificación
- **Diseño**: `DESIGN.md` (estética Notion; mono solo cifras; estado activo en gris sutil, **sin barras de acento laterales**; sin cajitas de icono tintadas). El hook `impeccable` corre al editar UI.
- **Dos esquemas**: al tocar `deliverables`/`subjects`, mantener Dexie + Postgres + Zod consistentes; correr `__tests__/build/schema-type-consistency.test.ts`.
- **Datos**: el CRUD de UI va por `lib/db/repository` (local-first), igual que hoy; no hardcodear seed data en componentes.
- **Verificación (definición de "hecho")**: `npm run test:all` (typecheck + vitest) debe pasar. La normalización de `repository-pg.ts` afecta también el camino MCP (solo normalización).
- **Commits**: mensaje en español con cuerpo explicativo del porqué; **sin** trailer `Co-Authored-By` y **sin** pie "Generated with Claude Code".
