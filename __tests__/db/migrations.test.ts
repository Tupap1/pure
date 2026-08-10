import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Sistema de Migraciones Versionadas PostgreSQL', () => {
  it('debe contener el directorio db/migrations con al menos las migraciones 001, 002 y 003', () => {
    const migrationsDir = path.join(process.cwd(), 'db', 'migrations');
    expect(fs.existsSync(migrationsDir)).toBe(true);

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThanOrEqual(3);

    expect(files).toContain('001_initial_schema.sql');
    expect(files).toContain('002_add_sabado_ab_columns.sql');
    expect(files).toContain('003_oauth_tables.sql');
  });

  it('la migración 002 debe incluir la alteración idempotente para Sábado A/B y periodicidad', () => {
    const mig2Path = path.join(process.cwd(), 'db', 'migrations', '002_add_sabado_ab_columns.sql');
    const content = fs.readFileSync(mig2Path, 'utf-8');

    expect(content).toContain('has_alternating_saturdays');
    expect(content).toContain('first_sabado_a_date');
    expect(content).toContain('periodicity');
  });

  it('la migración 003 debe definir las tablas de OAuth 2.0 PKCE (oauth_clients, oauth_auth_codes, oauth_access_tokens)', () => {
    const mig3Path = path.join(process.cwd(), 'db', 'migrations', '003_oauth_tables.sql');
    expect(fs.existsSync(mig3Path)).toBe(true);

    const content = fs.readFileSync(mig3Path, 'utf-8');
    expect(content).toContain('oauth_clients');
    expect(content).toContain('oauth_auth_codes');
    expect(content).toContain('oauth_access_tokens');
  });
});
