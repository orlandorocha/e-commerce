# ---------- Stage 1: build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Dependencias de sistema necessarias para o Prisma
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# ---------- Stage 2: runtime ----------
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001

# Aplica migrations pendentes e sobe a API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
