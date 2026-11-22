# Backend Dockerfile for Cricket Management & Scoring Engine
FROM node:20-alpine AS base
WORKDIR /app

# Copy package descriptors and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Expose default backend server port
EXPOSE 5000

ENV NODE_ENV=production \
    PORT=5000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "server.js"]
