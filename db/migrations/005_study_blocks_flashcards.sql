CREATE TABLE IF NOT EXISTS study_blocks (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id TEXT REFERENCES syllabus_topics(id) ON DELETE SET NULL,
  deliverable_id TEXT REFERENCES deliverables(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'study',
  is_completed BOOLEAN DEFAULT FALSE,
  actual_minutes INT,
  source TEXT NOT NULL DEFAULT 'manual',
  plan_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_study_blocks_subject ON study_blocks(subject_id);
CREATE INDEX idx_study_blocks_date ON study_blocks(date);

CREATE TABLE IF NOT EXISTS flashcards (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES syllabus_topics(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'open',
  options TEXT[],
  due TIMESTAMPTZ NOT NULL,
  stability DOUBLE PRECISION NOT NULL DEFAULT 0,
  difficulty DOUBLE PRECISION NOT NULL DEFAULT 0,
  elapsed_days INT NOT NULL DEFAULT 0,
  scheduled_days INT NOT NULL DEFAULT 0,
  reps INT NOT NULL DEFAULT 0,
  lapses INT NOT NULL DEFAULT 0,
  state INT NOT NULL DEFAULT 0,
  last_review TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flashcards_subject ON flashcards(subject_id);
CREATE INDEX idx_flashcards_due ON flashcards(due);
CREATE INDEX idx_flashcards_topic ON flashcards(topic_id);
