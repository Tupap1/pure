CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'presente',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_subject ON attendance_records(subject_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
