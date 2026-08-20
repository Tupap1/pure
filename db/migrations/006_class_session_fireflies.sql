ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS fireflies_transcript_id TEXT;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS transcript_text TEXT;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS ai_action_items TEXT[] DEFAULT '{}';
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS ai_questions TEXT[] DEFAULT '{}';
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS duration_minutes INT;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS session_source TEXT DEFAULT 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS idx_class_sessions_fireflies
  ON class_sessions(fireflies_transcript_id)
  WHERE fireflies_transcript_id IS NOT NULL;
