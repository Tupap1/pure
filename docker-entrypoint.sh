#!/bin/sh
set -e

echo "🚀 Ejecutando migraciones de PostgreSQL..."
npm run db:migrate

echo "✅ Migraciones completadas. Iniciando servidor web..."
exec "$@"
