-- US7 — Avisos en el teléfono. Suscripciones push y las marcas idempotentes de los otros dos
-- avisos (fin de tanda, reporte congelado), que viven como columnas nuevas sobre tablas ya
-- existentes. Sin plpgsql, sin `AT TIME ZONE` y sin índices únicos parciales (Constitución,
-- Principio III): `id` de la suscripción es sha256(endpoint), calculado en TypeScript, así que
-- un mismo endpoint siempre upsertea la misma fila sin necesitar una UNIQUE adicional.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  user_agent TEXT, last_success_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW());
ALTER TABLE tandas ADD COLUMN IF NOT EXISTS end_notified_at TIMESTAMPTZ;
ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS freeze_notified_at TIMESTAMPTZ;
