# syntax=docker/dockerfile:1.7
# ============================================================
# Stage 1 — Install backend production dependencies
# ============================================================
FROM node:20-alpine AS deps-backend

WORKDIR /app/backend

# Install only the deps backend/server.js needs (it uses CommonJS require())
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ============================================================
# Stage 2 — Install root dependencies (needed for `vite build`)
# ============================================================
FROM node:20-alpine AS deps-frontend

WORKDIR /app

# Native build deps for bcrypt, etc.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ============================================================
# Stage 3 — Build the frontend (Vite -> dist/)
# ============================================================
FROM deps-frontend AS builder

WORKDIR /app

COPY . .

# Vite needs only public assets + src at build time.
# node_modules were installed in deps-frontend.
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build:fe

# ============================================================
# Stage 4 — Production runtime
# ============================================================
FROM node:20-alpine AS runtime

LABEL org.opencontainers.image.title="moc-nhien-authentic" \
      org.opencontainers.image.description="Mộc Nhiên Authentic — Node.js + React production image" \
      org.opencontainers.image.source="https://github.com/your-org/moc-nhien-authentic"

# wget is useful for HEALTHCHECK below
RUN apk add --no-cache wget

ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_LOGLEVEL=warn

WORKDIR /app

# Copy the backend app + its production node_modules
COPY --from=deps-backend /app/backend/node_modules ./backend/node_modules
COPY backend ./backend

# Copy the built frontend static assets
COPY --from=builder /app/dist ./dist

# Drop privileges
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

WORKDIR /app/backend

CMD ["sh", "-c", "node server.js"]