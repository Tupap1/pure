# Módulo 06: Servidor MCP Bidireccional para Antigravity AI Bridge

**Fichero de especificación modular**: `specs/modules/06-mcp-server-bidirectional.md`

---

## 🎯 Objetivo
Implementar un servidor MCP (Model Context Protocol) en Node.js/TypeScript que permita a Antigravity (o cualquier cliente de IA) consultar el estado de ambas universidades, generar planes de estudio ajustados y registrar notas o avances del syllabus en tiempo real.

## 🛠️ Herramientas Expuestas (Tools)

### 1. `get_academic_overview`
* **Parámetros**: `{ university_id?: string }`
* **Retorno**: JSON con listado de universidades, materias, notas ponderadas actuales, notas meta y entregas pendientes clasificadas por urgencia.

### 2. `get_syllabus_progress`
* **Parámetros**: `{ subject_id: string }`
* **Retorno**: Árbol completo de ejes temáticos de la materia con el estado de dominio de cada tema (`no_iniciado`, `en_estudio`, `repasado`, `dominado`) y porcentaje general.

### 3. `generate_and_save_study_plan`
* **Parámetros**:
  ```json
  {
    "available_hours_per_day": { "monday": 3, "tuesday": 2, "wednesday": 4 },
    "target_subject_ids": ["uuid-1", "uuid-2"],
    "date_start": "2026-08-03"
  }
  ```
* **Retorno**: Bloques de estudio agendados en `study_sessions` asignando los temas prioritarios del syllabus.

### 4. `record_grade_or_submission`
* **Parámetros**:
  ```json
  {
    "deliverable_id": "uuid-deliverable",
    "grade": 4.5,
    "status": "calificado"
  }
  ```
* **Retorno**: Confirmación de la nota registrada y la nueva nota promedio ponderada de la materia.

### 5. `update_topic_status`
* **Parámetros**:
  ```json
  {
    "topic_id": "uuid-topic",
    "mastery_status": "dominado"
  }
  ```
* **Retorno**: Estado del tema actualizado y nuevo % global del syllabus de la asignatura.
