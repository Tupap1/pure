-- Migration 004: Add Class Sessions Table
CREATE TABLE IF NOT EXISTS class_sessions (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  schedule_id TEXT REFERENCES schedules(id) ON DELETE SET NULL,
  session_date TIMESTAMP NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  notion_link TEXT,
  recording_url TEXT,
  topics_covered TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
