#!/bin/sh
echo "Running migrations..."
# --schema: the schema is a folder (prisma/*.prisma) and the runner image has no
# package.json to read the prisma.schema setting from.
./node_modules/.bin/prisma migrate deploy --schema prisma
echo "Running seed..."
node dist/seed.js || echo "Seed skipped or failed"
echo "Starting application..."
exec node dist/main
