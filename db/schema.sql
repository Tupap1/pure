-- =============================================================================
-- PURE OS — PostgreSQL Production Database Schema & DDL Migrations
-- =============================================================================

-- 1. Universidades (Instituciones)
CREATE TABLE IF NOT EXISTS universities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  modality TEXT NOT NULL DEFAULT 'presencial',
  scale_min NUMERIC NOT NULL DEFAULT 0.0,
  scale_max NUMERIC NOT NULL DEFAULT 5.0,
  passing_grade NUMERIC NOT NULL DEFAULT 3.0,
  color TEXT DEFAULT '#0ea5e9',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Profesores (Docentes)
CREATE TABLE IF NOT EXISTS professors (
  id TEXT PRIMARY KEY,
  university_id TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  office_hours TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Asignaturas (Materias)
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  university_id TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  professor_id TEXT REFERENCES professors(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT,
  credits INT NOT NULL DEFAULT 3,
  difficulty INT NOT NULL DEFAULT 3,
  modality TEXT NOT NULL DEFAULT 'presencial',
  target_grade NUMERIC NOT NULL DEFAULT 4.5,
  current_grade NUMERIC NOT NULL DEFAULT 0.0,
  max_absences INT DEFAULT 4,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Horarios (Schedules Semanales)
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  classroom TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Entregables, Evaluaciones y Exámenes
CREATE TABLE IF NOT EXISTS deliverables (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  weight_percentage NUMERIC NOT NULL DEFAULT 20,
  grade NUMERIC,
  type TEXT NOT NULL DEFAULT 'Parcial',
  location_modality TEXT DEFAULT 'presencial',
  is_group BOOLEAN DEFAULT FALSE,
  complexity TEXT DEFAULT 'medio',
  status TEXT DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Ejes Temáticos del Syllabus
CREATE TABLE IF NOT EXISTS syllabus_topics (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES syllabus_topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  mastery_status TEXT DEFAULT 'no_iniciado',
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para alto rendimiento en consultas
CREATE INDEX IF NOT EXISTS idx_professors_uni ON professors(university_id);
CREATE INDEX IF NOT EXISTS idx_subjects_uni ON subjects(university_id);
CREATE INDEX IF NOT EXISTS idx_schedules_subject ON schedules(subject_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_subject ON deliverables(subject_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_status ON deliverables(status);
CREATE INDEX IF NOT EXISTS idx_syllabus_topics_subject ON syllabus_topics(subject_id);
