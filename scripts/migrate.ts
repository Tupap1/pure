import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

export async function runPostgresMigrations(customPool?: Pool) {
  console.log('🚀 Inicializando ejecutor de migraciones de PostgreSQL...');
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://pure_user:pure_secure_password_2026@localhost:5432/pure_academic';

  const pool = customPool || new Pool({ connectionString });
  const client = await pool.connect();

  try {
    // 1. Crear tabla de control schema_migrations si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version INT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Obtener lista de versiones ya ejecutadas
    const res = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC');
    const executedVersions = new Set<number>(res.rows.map((r: { version: number }) => Number(r.version)));

    // 3. Leer archivos .sql en db/migrations
    const migrationsDir = path.join(process.cwd(), 'db', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.warn('⚠️ No se encontró el directorio db/migrations');
      client.release();
      if (!customPool) await pool.end();
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let appliedCount = 0;

    for (const file of files) {
      const match = file.match(/^(\d+)_/);
      if (!match) continue;

      const version = parseInt(match[1], 10);
      if (executedVersions.has(version)) {
        continue; // Ya fue ejecutada
      }

      console.log(`⏳ Aplicando migración [${version}]: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [version, file]);
        await client.query('COMMIT');
        console.log(`✅ Migración [${version}] aplicada con éxito.`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Error al ejecutar la migración [${version}] (${file}):`, err);
        throw err;
      }
    }

    if (appliedCount === 0) {
      console.log('✨ Base de datos al día. No hay migraciones pendientes.');
    } else {
      console.log(`🎉 Se aplicaron ${appliedCount} migración(es) correctamente.`);
    }
  } catch (error) {
    console.error('❌ Error en el runner de migraciones:', error);
    throw error;
  } finally {
    client.release();
    if (!customPool) await pool.end();
  }
}

// Ejecución directa por CLI (`npm run db:migrate`)
if (process.argv[1] && process.argv[1].includes('migrate')) {
  runPostgresMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
