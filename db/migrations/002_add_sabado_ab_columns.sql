-- Migration 002: Add Saturday A/B anchor and periodicity columns
ALTER TABLE universities ADD COLUMN IF NOT EXISTS has_alternating_saturdays BOOLEAN DEFAULT TRUE;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS first_sabado_a_date TEXT DEFAULT '2026-08-01';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS periodicity TEXT DEFAULT 'semanal';
