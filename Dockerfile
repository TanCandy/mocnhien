# syntax=docker/dockerfile:1.7
# ============================================================
# Stage 1 — Install backend production dependencies
# ============================================================
FROM node:20-alpine AS deps-backend

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ============================================================
# Stage 2 — Install root dependencies (needed for `vite build`)
# ============================================================
FROM node:20-alpine AS deps-frontend

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund

# ============================================================
# Stage 3 — Build the frontend (Vite -> dist/)
# ============================================================
FROM deps-frontend AS builder

WORKDIR /app

COPY . .

ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

RUN npm ci --no-audit --no-fund && npm run build:fe

# ============================================================
# Stage 4 — Production runtime
# ============================================================
FROM node:20-alpine AS runtime

LABEL org.opencontainers.image.title="moc-nhien-authentic" \
      org.opencontainers.image.description="Mộc Nhiên Authentic — Node.js + React production image"

RUN apk add --no-cache wget

ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_LOGLEVEL=warn

WORKDIR /app

# backend's own node_modules (CommonJS deps: express, mongoose, bcrypt, etc.)
COPY --from=deps-backend /app/node_modules ./backend/node_modules

# entire backend directory (server.js, config/, routes/, models/, etc.)
COPY backend ./backend

# built frontend
COPY --from=builder /app/dist ./dist

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

CMD ["node", "backend/server.js"]
