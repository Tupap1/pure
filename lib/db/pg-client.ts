import { Pool } from 'pg';
import { runPostgresMigrations } from '../../scripts/migrate';

function getConnectionString(): string {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.trim() === '') {
    // Return resilient default connection string for Docker containers & production fallbacks
    const defaultHost = process.env.POSTGRES_HOST || 'pure-db';
    const user = process.env.POSTGRES_USER || 'pure_user';
    const pass = process.env.POSTGRES_PASSWORD || '';
    const dbName = process.env.POSTGRES_DB || 'pure_academic';
    return `postgresql://${user}:${pass}@${defaultHost}:5432/${dbName}?sslmode=disable`;
  }
  return dbUrl;
}

export const pgPool = new Pool({
  connectionString: getConnectionString(),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

let isInitialized = false;

export async function initPostgresSchema() {
  if (isInitialized) return;

  try {
    const client = await pgPool.connect();
    try {
      // 1. Run migrations first
      await runPostgresMigrations(pgPool);

      // 2. Safeguard DDL check
      await client.query(`
        CREATE TABLE IF NOT EXISTS universities (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          modality TEXT NOT NULL,
          scale_min NUMERIC NOT NULL DEFAULT 0.0,
          scale_max NUMERIC NOT NULL DEFAULT 5.0,
          passing_grade NUMERIC NOT NULL DEFAULT 3.0,
          color TEXT DEFAULT '#0ea5e9',
          has_alternating_saturdays BOOLEAN DEFAULT TRUE,
          first_sabado_a_date TEXT DEFAULT '2026-08-01',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        ALTER TABLE universities ADD COLUMN IF NOT EXISTS has_alternating_saturdays BOOLEAN DEFAULT TRUE;
        ALTER TABLE universities ADD COLUMN IF NOT EXISTS first_sabado_a_date TEXT DEFAULT '2026-08-01';

        CREATE TABLE IF NOT EXISTS professors (
          id TEXT PRIMARY KEY,
          university_id TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          email TEXT,
          office_hours TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS subjects (
          id TEXT PRIMARY KEY,
          university_id TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
          professor_id TEXT,
          name TEXT NOT NULL,
          code TEXT,
          credits INT NOT NULL DEFAULT 3,
          difficulty INT NOT NULL DEFAULT 3,
          modality TEXT NOT NULL DEFAULT 'presencial',
          target_grade NUMERIC NOT NULL DEFAULT 4.5,
          current_grade NUMERIC NOT NULL DEFAULT 0.0,
          max_absences INT DEFAULT 4,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS schedules (
          id TEXT PRIMARY KEY,
          subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
          day_of_week INT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          classroom TEXT,
          periodicity TEXT DEFAULT 'semanal',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        ALTER TABLE schedules ADD COLUMN IF NOT EXISTS periodicity TEXT DEFAULT 'semanal';

        CREATE TABLE IF NOT EXISTS deliverables (
          id TEXT PRIMARY KEY,
          subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
          topic_id TEXT,
          title TEXT NOT NULL,
          description TEXT,
          due_date TIMESTAMPTZ NOT NULL,
          weight_percentage NUMERIC NOT NULL DEFAULT 20,
          grade NUMERIC,
          type TEXT NOT NULL DEFAULT 'Parcial',
          location_modality TEXT DEFAULT 'presencial',
          is_group BOOLEAN DEFAULT FALSE,
          complexity TEXT DEFAULT 'medio',
          status TEXT DEFAULT 'pendiente',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS syllabus_topics (
          id TEXT PRIMARY KEY,
          subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
          parent_id TEXT,
          title TEXT NOT NULL,
          description TEXT,
          mastery_status TEXT DEFAULT 'no_iniciado',
          order_index INT DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS oauth_clients (
          client_id VARCHAR(255) PRIMARY KEY,
          client_name VARCHAR(255),
          redirect_uris TEXT[],
          token_endpoint_auth_method VARCHAR(50) DEFAULT 'none',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS oauth_auth_codes (
          code VARCHAR(255) PRIMARY KEY,
          client_id VARCHAR(255) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
          redirect_uri TEXT NOT NULL,
          code_challenge TEXT NOT NULL,
          code_challenge_method VARCHAR(20) DEFAULT 'S256',
          expires_at TIMESTAMPTZ NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS oauth_access_tokens (
          token VARCHAR(255) PRIMARY KEY,
          client_id VARCHAR(255),
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      isInitialized = true;
      console.log('✅ PostgreSQL Schema initialized successfully');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('⚠️ PostgreSQL connection/schema warning:', error);
  }
}
