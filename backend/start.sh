#!/bin/sh
echo "Running migrations..."
npx prisma migrate deploy
echo "Running seed..."
node dist/seed.js
echo "Starting application..."
exec node dist/main
