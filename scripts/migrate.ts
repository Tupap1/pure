import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

async function runMigration() {
  console.log('🚀 Ejecutando migración DDL de PostgreSQL en PURE OS...');
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://pure_user:pure_secure_password_2026@localhost:5432/pure_academic';

  const pool = new Pool({ connectionString });
  const schemaSqlPath = path.join(process.cwd(), 'db', 'schema.sql');

  if (!fs.existsSync(schemaSqlPath)) {
    console.error('❌ Error: No se encontró el archivo db/schema.sql');
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(schemaSqlPath, 'utf-8');

  try {
    const client = await pool.connect();
    await client.query(sqlContent);
    client.release();
    console.log('✅ Migración de PostgreSQL completada exitosamente.');
    await pool.end();
  } catch (error) {
    console.error('❌ Error durante la migración de PostgreSQL:', error);
    process.exit(1);
  }
}

runMigration();
