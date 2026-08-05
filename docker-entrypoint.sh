#!/bin/sh
set -e

echo "🚀 Ejecutando migraciones de PostgreSQL..."
npm run db:migrate || echo "⚠️ Advertencia: Error en la migración. Continuando..."

echo "✅ Iniciando servidor..."
exec "$@"
