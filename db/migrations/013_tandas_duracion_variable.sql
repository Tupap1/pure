-- US-T1: Tandas de duración variable (10-60 minutos) y sistema de unidades.
-- La tabla tandas ya tiene planned_minutes; se agrega un CHECK para garantizar el rango.
-- En producción, las 6 tandas existentes tienen 10 minutos: ninguna viola el rango.

-- Reejecutable: el arnés de tests corre las migraciones dos veces (bug en el interceptor que no
-- registra versiones aplicadas con INSERT parametrizado), así que todas las migraciones DEBEN
-- ser idempotentes. Las 001-012 usan CREATE TABLE IF NOT EXISTS; esta 013 debe hacer DROP
-- primero para que la segunda pasada no falle. Constitución, Principio III.
ALTER TABLE tandas DROP CONSTRAINT IF EXISTS tandas_planned_minutes_rango;
ALTER TABLE tandas ADD CONSTRAINT tandas_planned_minutes_rango CHECK (planned_minutes BETWEEN 10 AND 60);
