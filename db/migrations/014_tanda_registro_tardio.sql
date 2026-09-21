-- US-T2: registro tardío acotado y visible (manage_tandas:log_late). late_logged marca las
-- tandas creadas por esa acción -- la única entrada del módulo que acepta instantes del cliente
-- (excepción deliberada y acotada al Principio III, documentada en specs/003-tandas-variables/
-- plan.md) -- para que nunca se confundan con una tanda real y el reporte semanal pueda
-- contarlas aparte (registros_tardios).
--
-- Reejecutable: el arnés de tests corre las migraciones dos veces (ver 013). ADD COLUMN IF NOT
-- EXISTS ya es idempotente por sí sola. Constitución, Principio III (sin plpgsql, sin
-- AT TIME ZONE, sin índices únicos parciales).
ALTER TABLE tandas ADD COLUMN IF NOT EXISTS late_logged BOOLEAN NOT NULL DEFAULT FALSE;
