-- Migración 016: Columnas para cronómetro, objetivos y correcciones (Módulo de Ejecución - Focus)
--
-- Razón: la feature 004 separa temporizador y cronómetro (`kind`), permite vincular una sesión
-- a un objetivo, y permite registrar correcciones (US-F4). Las filas existentes quedan como
-- temporizador, las nuevas pueden ser cronómetro con planned_minutes NULL.
--
-- Regla R2 (research.md): En Postgres, un CHECK que evalúa a NULL se ACEPTA; pg-mem lo rechaza.
-- Con la versión ingenua, un temporizador con planned_minutes NULL pasaría en producción y
-- fallaría en los tests. Por eso cada rama lleva IS [NOT] NULL explícito: así las dos ramas
-- dan FALSE y la fila se rechaza igual en ambos motores (pg y pg-mem).

-- Permitir planned_minutes = NULL (cronómetro)
ALTER TABLE tandas ALTER COLUMN planned_minutes DROP NOT NULL;

-- Tipo de sesión: temporizador (tiempo fijo) o cronómetro (sin fin)
ALTER TABLE tandas ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'temporizador';

-- Vincular a un objetivo
ALTER TABLE tandas ADD COLUMN IF NOT EXISTS objective_id TEXT REFERENCES objetivos(id) ON DELETE SET NULL;

-- Bandera de corrección
ALTER TABLE tandas ADD COLUMN IF NOT EXISTS corrected BOOLEAN NOT NULL DEFAULT FALSE;

-- Hora del servidor de la última corrección
ALTER TABLE tandas ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMPTZ;

-- Fin antes de la primera corrección (en un cronómetro en curso, la hora en que se corrigió)
ALTER TABLE tandas ADD COLUMN IF NOT EXISTS original_ended_at TIMESTAMPTZ;

-- Minutos antes de la primera corrección
ALTER TABLE tandas ADD COLUMN IF NOT EXISTS original_minutes INT;

-- Razón de la última corrección
ALTER TABLE tandas ADD COLUMN IF NOT EXISTS correction_reason TEXT;

-- Índice para filtrar por objetivo
CREATE INDEX IF NOT EXISTS idx_tandas_objective ON tandas(objective_id);

-- Reemplazar la restricción antigua de rango de minutos con la nueva que respeta el tipo
ALTER TABLE tandas DROP CONSTRAINT IF EXISTS tandas_planned_minutes_rango;

ALTER TABLE tandas DROP CONSTRAINT IF EXISTS tandas_tipo_duracion;

ALTER TABLE tandas
ADD CONSTRAINT tandas_tipo_duracion CHECK (
  (kind = 'temporizador' AND planned_minutes IS NOT NULL AND planned_minutes BETWEEN 10 AND 180)
  OR
  (kind = 'cronometro' AND planned_minutes IS NULL)
);

-- Restricción de integridad para correcciones: todos los campos de una corrección deben estar
-- presentes a la vez (R2: IS NOT NULL explícito).
ALTER TABLE tandas DROP CONSTRAINT IF EXISTS tandas_correccion_completa;

ALTER TABLE tandas
ADD CONSTRAINT tandas_correccion_completa CHECK (
  corrected = FALSE
  OR
  (corrected_at IS NOT NULL AND original_ended_at IS NOT NULL AND original_minutes IS NOT NULL AND correction_reason IS NOT NULL)
);
