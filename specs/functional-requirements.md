# Especificación de Requisitos Funcionales — Sistema "Pure"

**Proyecto**: Pure — Sistema de Gestión Académica Multi-Universidad & MCP AI Assistant
**Caso de Uso Real**: **Doble Titulación: Ingeniería Aeroespacial (Presencial) + Ingeniería de Software (Virtual)**
**Objetivo Core**: **Dominio Real de los Temas + Mínima Dosis Eficaz de Estudio + Máximo Tiempo Libre**

---

## 📌 1. Visión General del Proyecto
Pure es la plataforma centralizada para gestionar la carga académica de dos carreras de alta exigencia: **Ingeniería Aeroespacial** (con modalidad presencial y exámenes finales de alto impacto) e **Ingeniería de Software** (modalidad virtual a distancia con entregas continuas).

El sistema permite estructurar y automatizar el ciclo académico completo: desde el alta de entidades (Universidades, Profesores, Materias), la ingesta asistida por IA de temarios completos (Ejes Temáticos), hasta la planificación inteligente de entregas (individuales/grupales), detección de traslapes y cruce de sinergias científicas/tecnológicas entre ambas ingenierías.

---

## 🎯 2. Requisitos Funcionales (RF)

### RF-01: Gestión de Entidades Base (CRUDs Completos)
* **RF-01.1 (CRUD Universidades)**:
  - Crear, leer, actualizar y eliminar Universidades.
  - Campos: Nombre, Modalidad (`Presencial`, `Virtual`, `Híbrida`), Escala de Calificación (`scale_min`, `scale_max`, `passing_grade`), Color institucional distintivo.
* **RF-01.2 (CRUD Profesores)**:
  - Crear, leer, actualizar y eliminar Profesores.
  - Campos: Nombre completo, Universidad asociada, Email/Contacto, Horarios de atención/tutoría, Notas sobre estilo de evaluación/exigencia.
* **RF-01.3 (CRUD Materias / Asignaturas)**:
  - Crear, leer, actualizar y eliminar Materias.
  - Campos: Nombre, Código, Universidad, Profesor asignado, Créditos académicos, Modalidad de la clase, Intensidad horaria presencial/virtual, Horario semanal, Nota Meta.

### RF-02: Ingesta de Ejes Temáticos (Syllabus) y Carga Asistida por IA
* **RF-02.1**: Estructura en árbol jerárquico del temario (Unidad -> Tema -> Subtema).
* **RF-02.2 (Asistente de Ingesta IA / MCP)**:
  - Formato JSON / Markdown estandarizado para carga masiva de temarios.
  - El usuario o la IA (vía MCP) pueden pegar el PDF/texto plano del plan de estudios y convertirlo automáticamente en el árbol de ejes temáticos de la materia.
* **RF-02.3 (Seguimiento de Dominio y Preparación para Exámenes)**:
  - 4 Estados de Dominio: `no_iniciado`, `en_estudio`, `repasado`, `dominado`.
  - Indicador de **Preparación para Examen Final Presencial**: Mide el % de temas en estado `dominado` o `repasado` antes de las fechas de finales.

### RF-03: Detector de Sinergias Temáticas (Cross-Degree Synergies)
* **RF-03.1**: El sistema o la IA (vía MCP) comparan automáticamente los syllabus de Ingeniería Aeroespacial y de Software.
* **RF-03.2**: Detecta temas compartidos/equivalentes (*ej. Álgebra Lineal, Cálculo Vectorial, Métodos Numéricos, Física Mecánica, Programación C++/Python, Simulación*).
* **RF-03.3**: Al estudiar y dominar un tema en una materia (ej. *Cálculo en Aeroespacial*), se propaga la sugerencia de dominio al tema equivalente en Software, eliminando el estudio duplicado.

### RF-04: Registro Detallado de Actividades y Entregas (Deliverables & Tasks)
* **RF-04.1 (CRUD Actividades)**:
  - Campos: Título, Materia asociada, Tema del Syllabus relacionado (opcional), Tipo (`Taller`, `Proyecto`, `Parcial`, `Quiz`, `Examen Final`), Modalidad (`Individual` vs `Grupal`), Nivel de Complejidad (`Fácil`, `Medio`, `Alta Complejidad`), Peso % en la nota final, Fecha y hora límite.
* **RF-04.2 (Planificador de Ejecución)**:
  - Estado de Entrega: `pendiente`, `entregado`, `calificado`.
  - Estado de Planificación: Asignación de bloques de tiempo específicos en el calendario para resolver la tarea antes de la fecha límite.

### RF-05: Calendario Semanal Interactivo, Detección de Traslapes y Tiempo Libre
* **RF-05.1**: Grid semanal unificado de clases y evaluaciones presenciales vs virtuales.
* **RF-05.2 (Detector de Traslapes)**: Alerta visual roja en caso de coincidencia horaria de clases o exámene finales de ambas universidades.
* **RF-05.3 (Planificador de Bloques de Estudio y Dosis Mínima Eficaz)**:
  - Asignación inteligente del mínimo número de horas necesarias.
  - Medidor del **Tiempo Libre Neto Garantizado** (168h - clases - estudio DME - sueño - traslados).

### RF-06: Arquitectura Local-First y Sincronización (Dexie.js + Supabase)
* **RF-06.1**: Todas las operaciones CRUD y actualizaciones se realizan primero en **IndexedDB (Dexie.js)** con respuesta < 10ms.
* **RF-06.2**: Funciona al 100% sin internet o si el servidor está caído.
* **RF-06.3**: Sincronización automática en segundo plano con **Supabase** al detectar red.

### RF-07: Servidor MCP Bidireccional para Antigravity AI
* **RF-07.1**: Exposición de herramientas MCP para:
  1. `get_academic_overview`: Estado de materias, profesores, notas y tiempo libre.
  2. `parse_and_ingest_syllabus`: Convierte texto/PDF de temarios en el árbol jerárquico de la materia.
  3. `find_cross_subject_synergies`: Encuentra equivalencias entre Ingeniería Aeroespacial y de Software.
  4. `generate_minimal_effective_study_plan`: Crea bloques de estudio minimizando horas invertidas.
  5. `record_deliverable_or_grade`: Registra o actualiza tareas (individuales/grupales) y notas.
  6. `update_topic_mastery`: Actualiza el grado de comprensión/dominio real para exámene finales.
