# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=24

# ============================================================
# Stage 1 — Backend production dependencies
# ============================================================
FROM node:${NODE_VERSION}-alpine AS deps-backend

WORKDIR /app/backend

# Toolchain only for native modules without a prebuilt musl binary (bcrypt);
# it stays in this stage and never reaches the runtime image.
RUN apk add --no-cache python3 make g++

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ============================================================
# Stage 2 — Build the frontend (Vite -> dist/)
# ============================================================
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# The SPA calls the API on its own origin (/api/...), so no API URL is baked in.
RUN npm run build:fe

# ============================================================
# Stage 3 — Production runtime
# ============================================================
FROM node:${NODE_VERSION}-alpine AS runtime

LABEL org.opencontainers.image.title="moc-nhien-authentic" \
      org.opencontainers.image.description="Mộc Nhiên Authentic — Node.js + React production image"

ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_LOGLEVEL=warn

WORKDIR /app

COPY --from=deps-backend --chown=node:node /app/backend/node_modules ./backend/node_modules
COPY --chown=node:node backend ./backend
COPY --from=builder --chown=node:node /app/dist ./dist

USER node

EXPOSE 3000

# busybox wget ships with alpine
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

CMD ["node", "backend/server.js"]
