#!/bin/sh
set -e

echo "🚀 Ejecutando migraciones de PostgreSQL..."
npm run db:migrate || echo "⚠️ Advertencia: Ocurrió un retraso en la migración o la base de datos se está iniciando. Continuando con la ejecución del servidor..."

echo "✅ Iniciando servidor web Next.js..."
exec "$@"
