# ── Build stage ─────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY apps/api/package.json ./apps/api/
RUN npm install --workspace=apps/api

COPY apps/api/ ./apps/api/
RUN cd apps/api && npx prisma generate && npm run build

# ── Production stage ───────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production

EXPOSE 3001

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
