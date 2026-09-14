-- 012_friction.sql — US-B5 (002): medidas de fricción del teléfono y calificación semanal de irritación

CREATE TABLE IF NOT EXISTS friction_measures (
  id TEXT PRIMARY KEY,           -- measure_key
  enabled_slot TEXT UNIQUE,      -- 'a' | 'b' mientras está habilitada; NULL si no (máximo 2)
  started_on TEXT,               -- YYYY-MM-DD (PURE_TZ) de la última habilitación
  enabled_at TIMESTAMPTZ,        -- instante de la última habilitación
  verified_at TIMESTAMPTZ,       -- última verificación; se limpia al volver a habilitar
  disabled_at TIMESTAMPTZ,       -- último retiro
  drop_reason TEXT,              -- 'manual' | 'irritacion'; NULL mientras está habilitada
  created_at TIMESTAMPTZ DEFAULT NOW());

CREATE TABLE IF NOT EXISTS friction_ratings (
  id TEXT PRIMARY KEY,           -- = program_week_id: una calificación por semana
  program_week_id TEXT NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score BETWEEN 0 AND 10),
  rated_at TIMESTAMPTZ NOT NULL,
  drop_applied_at TIMESTAMPTZ,   -- el par (semana anterior, esta) con ambas >= 7 ya se atendió
  dropped_measure_id TEXT,       -- medida que retiró ese par; NULL si no había ninguna habilitada
  created_at TIMESTAMPTZ DEFAULT NOW());
