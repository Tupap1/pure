# Spec General del Sistema — "Pure" (SDD + TDD Master Spec)

**Proyecto**: Pure — Sistema de Gestión Académica Multi-Universidad para Doble Ingeniería
**Metodología**: Spec-Driven Development (SDD) + Test-Driven Development (TDD)
**Estado**: Especificación Aprobada — Lista para Ciclo TDD (Red -> Green -> Refactor)

---

## 🎯 1. Requerimientos de la Aplicación

### REQ-01: Gestión Multi-Universidad (Presencial vs Virtual)
- Soporte para 2 o más universidades con escalas independientes (ej. `0.0 - 5.0` min/max/aprobatoria vs `0 - 100`).
- Colores representativos HSL e indicador de modalidad (`presencial`, `virtual`, `hibrida`).

### REQ-02: Gestión de Profesores y Asignaturas
- CRUD de Profesores (contacto, tutorías, observaciones).
- CRUD de Materias (código, créditos, modalidad, profesor, nota meta, nota actual ponderada).

### REQ-03: Ingesta de Ejes Temáticos (Syllabus) y Estado de Dominio
- Estrcutura de árbol temático (`Unidad -> Tema -> Subtema`).
- 4 estados de dominio: `no_iniciado`, `en_estudio`, `repasado`, `dominado`.
- Ingesta de temarios mediante parser JSON/Markdown asistido por IA (MCP).

### REQ-04: Detector de Sinergias Temáticas entre Carreras (Cross-Degree Synergies)
- Identificación automática de temas duplicados/equivalentes entre Ingeniería Aeroespacial e Ingeniería de Software.
- Propagación de avance de dominio entre materias hermanas.

### REQ-05: Entregas, Evaluaciones y Tareas Detalladas
- Registro de tareas con tipo (`Taller`, `Proyecto`, `Parcial`, `Quiz`, `Examen Final`), modalidad (`Grupal` vs `Individual`), `Complejidad` (`Fácil`, `Medio`, `Difícil`), `Peso %` y fecha límite.
- Calculadora de nota mínima requerida en entregas restantes.

### REQ-06: Algoritmo de Dosis Mínima Eficaz (DME) y Tiempo Libre Net
- Asignación de horas de estudio semanales óptimas:
  $$H_{\text{DME}} = (H_{\text{base}} \times M_{\text{dificultad}} \times F_{\text{margen}} \times F_{\text{sinergia}}) + \text{Urgencia7Días}$$
- Calculadora de Tiempo Libre Neto Semanal.

### REQ-07: Calendario Semanal Interactivo & Detector de Traslapes
- Grid semanal (Lunes-Domingo, 06:00-23:00) con detección automática y alerta visual en rojo por empalmes de clases o exámenes.

### REQ-08: Persistencia Local-First (IndexedDB / Dexie.js + Supabase Sync)
- Almacenamiento primario en IndexedDB (Dexie.js) con operatividad 100% offline.
- Sincronización en segundo plano a Supabase (PostgreSQL).

### REQ-09: Servidor MCP Bidireccional para Antigravity AI
- 6 herramientas MCP (`get_academic_overview`, `parse_and_ingest_syllabus`, `find_cross_subject_synergies`, `generate_minimal_effective_study_plan`, `record_deliverable_or_grade`, `update_topic_mastery`).

---

## 🗄️ 2. Modelo de Datos Relacional

```
Universities (id, name, modality, scale_min, scale_max, passing_grade, color)
Professors (id, university_id, name, email, office_hours, notes)
Subjects (id, university_id, professor_id, name, code, credits, difficulty, modality, target_grade, current_grade)
Schedules (id, subject_id, day_of_week, start_time, end_time, classroom)
SyllabusTopics (id, subject_id, parent_id, title, description, mastery_status, order_index)
Deliverables (id, subject_id, topic_id, title, description, due_date, weight_percentage, grade, type, is_group, complexity, status)
StudySessions (id, subject_id, topic_id, deliverable_id, scheduled_start, scheduled_end, is_completed, source)
```

---

## ✅ 3. Criterios de Aceptación Globales

1. Todo cambio o nueva funcionalidad debe contar primero con un test unitario/integración que falle (Fase Red).
2. El código de la aplicación se escribe únicamente para hacer pasar el test que falla (Fase Green).
3. Las aserciones de las pruebas son inmutables a menos que cambie el requerimiento expreso en `spec.md`.
4. El éxito empírico reportado por la terminal es la única prueba de conclusión de una tarea.
