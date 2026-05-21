FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npx tsc prisma/seed.ts --outDir dist \
  --esModuleInterop --module commonjs \
  --moduleResolution node --skipLibCheck \
  --target ES2021 || echo "seed compile warning"

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY start.sh ./start.sh
RUN chmod +x start.sh
EXPOSE 3001
CMD ["sh", "start.sh"]
