# Especificación de Arquitectura — Sistema "Pure"

**Proyecto**: Pure — Sistema de Gestión Académica Multi-Universidad & MCP AI Assistant
**Caso de Uso**: Doble Ingeniería (Aeroespacial Presencial + Software Virtual)
**Fecha**: 2026-08-01

---

## 🗄️ Esquema Completo de Base de Datos (PostgreSQL & Dexie.js Schema)

```sql
-- 1. Universidades
CREATE TABLE universities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    modality TEXT CHECK (modality IN ('presencial', 'virtual', 'hibrida')) DEFAULT 'presencial',
    scale_min NUMERIC(4,2) NOT NULL DEFAULT 0.0,
    scale_max NUMERIC(4,2) NOT NULL DEFAULT 5.0,
    passing_grade NUMERIC(4,2) NOT NULL DEFAULT 3.0,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Profesores
CREATE TABLE professors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    office_hours TEXT,
    notes TEXT, -- Observaciones sobre estilo de clases o exámenes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Asignaturas / Materias
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
    professor_id UUID REFERENCES professors(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    code TEXT,
    credits INT NOT NULL DEFAULT 3,
    difficulty INT CHECK (difficulty BETWEEN 1 AND 5) DEFAULT 3,
    modality TEXT CHECK (modality IN ('presencial', 'virtual')) DEFAULT 'presencial',
    target_grade NUMERIC(4,2) NOT NULL,
    current_grade NUMERIC(4,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Horarios de Clases
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    day_of_week INT CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Lunes, 7=Domingo
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    classroom TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Ejes Temáticos (Syllabus)
CREATE TABLE syllabus_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES syllabus_topics(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    mastery_status TEXT CHECK (mastery_status IN ('no_iniciado', 'en_estudio', 'repasado', 'dominado')) DEFAULT 'no_iniciado',
    order_index INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Entregas, Evaluaciones y Tareas (Deliverables)
CREATE TABLE deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES syllabus_topics(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    weight_percentage NUMERIC(5,2) NOT NULL, -- Ej: 20.00 para 20%
    grade NUMERIC(4,2),
    type TEXT CHECK (type IN ('taller', 'proyecto', 'parcial', 'quiz', 'examen_final')) DEFAULT 'taller',
    is_group BOOLEAN DEFAULT FALSE, -- Grupal vs Individual
    complexity TEXT CHECK (complexity IN ('facil', 'medio', 'dificil')) DEFAULT 'medio',
    status TEXT CHECK (status IN ('pendiente', 'entregado', 'calificado')) DEFAULT 'pendiente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Bloques de Sesiones de Estudio (Generados por Algoritmo o IA)
CREATE TABLE study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES syllabus_topics(id) ON DELETE SET NULL,
    deliverable_id UUID REFERENCES deliverables(id) ON DELETE SET NULL,
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    source TEXT CHECK (source IN ('algorithm', 'ai_mcp', 'manual')) DEFAULT 'algorithm',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🤖 Herramientas del Servidor MCP (Antigravity AI Bridge)

1. `get_academic_overview`: Retorna universidades, profesores, materias, nota promedio acumulada y mapa de tiempo libre.
2. `parse_and_ingest_syllabus`: Recibe texto plano o JSON de temarios y crea el árbol de `syllabus_topics`.
3. `find_cross_subject_synergies`: Escanea temarios entre Ingeniería Aeroespacial e Ingeniería de Software para sugerir sinergias de estudio.
4. `generate_minimal_effective_study_plan`: Crea bloques de estudio asignando tareas urgentes y temas de exámene finales.
5. `record_deliverable_or_grade`: Crea o actualiza actividades (grupales/individuales, complejidad, fecha) y calificaciones.
6. `update_topic_mastery`: Actualiza el grado de dominio (`no_iniciado`, `en_estudio`, `repasado`, `dominado`).
