-- Migration 001: Initial Base Schema
CREATE TABLE IF NOT EXISTS universities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  modality TEXT NOT NULL,
  scale_min NUMERIC NOT NULL DEFAULT 0.0,
  scale_max NUMERIC NOT NULL DEFAULT 5.0,
  passing_grade NUMERIC NOT NULL DEFAULT 3.0,
  color TEXT DEFAULT '#0ea5e9',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS professors (
  id TEXT PRIMARY KEY,
  university_id TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  office_hours TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  university_id TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  professor_id TEXT,
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

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  classroom TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS syllabus_topics (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  parent_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  mastery_status TEXT DEFAULT 'no_iniciado',
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
