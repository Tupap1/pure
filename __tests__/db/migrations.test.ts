import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Sistema de Migraciones Versionadas PostgreSQL', () => {
  it('debe contener el directorio db/migrations con al menos las migraciones 001 y 002', () => {
    const migrationsDir = path.join(process.cwd(), 'db', 'migrations');
    expect(fs.existsSync(migrationsDir)).toBe(true);

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThanOrEqual(2);

    expect(files).toContain('001_initial_schema.sql');
    expect(files).toContain('002_add_sabado_ab_columns.sql');
  });

  it('la migración 002 debe incluir la alteración idempotente para Sábado A/B y periodicidad', () => {
    const mig2Path = path.join(process.cwd(), 'db', 'migrations', '002_add_sabado_ab_columns.sql');
    const content = fs.readFileSync(mig2Path, 'utf-8');

    expect(content).toContain('has_alternating_saturdays');
    expect(content).toContain('first_sabado_a_date');
    expect(content).toContain('periodicity');
  });
});
