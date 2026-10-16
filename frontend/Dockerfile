# ----------------------------------------------------------------------------
# Frontend Dockerfile — Next.js 15 (standalone output)
# Multi-stage build that outputs a standalone server for a small image.
# Requires `output: 'standalone'` in next.config.js.
# ----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production runner ----------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Next.js standalone output includes everything needed to run
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

# Set the hostname to 0.0.0.0 so the server is reachable from outside the container
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

CMD ["node", "server.js"]
