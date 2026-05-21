#!/bin/sh
echo "Running migrations..."
npx prisma migrate deploy
echo "Running seed..."
npx ts-node -r tsconfig-paths/register prisma/seed.ts
echo "Starting application..."
exec node dist/main
