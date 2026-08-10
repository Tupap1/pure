import { newDb, IMemoryDb, DataType } from 'pg-mem';
import { pgPool, initPostgresSchema } from '../../lib/db/pg-client';
import { runPostgresMigrations } from '../../scripts/migrate';

export interface TestDbHarness {
  db: IMemoryDb;
  pool: any;
  reset: () => Promise<void>;
}

export async function createTestDb(): Promise<TestDbHarness> {
  const db = newDb({
    autoCreateForeignKeyIndices: true,
  });

  db.public.registerFunction({
    name: 'now',
    returns: DataType.timestamp,
    implementation: () => new Date(),
  });

  const executedVersions = new Set<number>();
  db.public.interceptQueries((sql) => {
    const lower = sql.toLowerCase();

    // Intercept schema_migrations table queries
    if (lower.includes('schema_migrations')) {
      if (lower.includes('select version from schema_migrations')) {
        return Array.from(executedVersions).map((v) => ({ version: v }));
      }
      if (lower.includes('insert into schema_migrations')) {
        const match = sql.match(/values\s*\(\s*(\d+)/i);
        if (match && match[1]) {
          executedVersions.add(parseInt(match[1], 10));
        }
        return [];
      }
      return [];
    }

    // Intercept CREATE TABLE IF NOT EXISTS when table already exists to prevent AST coverage warnings
    if (lower.includes('create table if not exists')) {
      const match = lower.match(/create table if not exists\s+([a-z0-9_]+)/i);
      if (match && match[1]) {
        const tableName = match[1];
        const existingTables = Array.from(db.public.listTables()).map((t) => t.name);
        if (existingTables.includes(tableName)) {
          return [];
        }
      }
    }

    return null;
  });

  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool();

  // Redirect pgPool methods to test pg-mem pool
  pgPool.query = pool.query.bind(pool);
  pgPool.connect = (async () => {
    return pool.connect();
  }) as any;

  // Execute exact production initialization sequence:
  // 1. runPostgresMigrations(pool)
  // 2. initPostgresSchema()
  await runPostgresMigrations(pool as any);
  await initPostgresSchema();

  return {
    db,
    pool,
    reset: async () => {
      const tables = [
        'oauth_access_tokens',
        'oauth_auth_codes',
        'oauth_clients',
        'deliverables',
        'schedules',
        'syllabus_topics',
        'subjects',
        'professors',
        'universities',
      ];
      for (const table of tables) {
        await pool.query(`DELETE FROM ${table};`);
      }
    },
  };
}
