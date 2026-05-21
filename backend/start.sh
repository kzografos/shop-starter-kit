#!/bin/sh
echo "Running migrations..."
./node_modules/.bin/prisma migrate deploy
echo "Running seed..."
node dist/seed.js || echo "Seed skipped or failed"
echo "Starting application..."
exec node dist/main
