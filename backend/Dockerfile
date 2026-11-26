# Production Backend Dockerfile
FROM node:20.18-alpine3.20 AS builder
WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application files
COPY . .

# Runner stage: small, non-root user execution
FROM node:20.18-alpine3.20 AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production \
    PORT=5000

# Create uploads directory and non-root node user permissions
RUN mkdir -p /app/uploads && chown -R node:node /app

# Copy dependencies and application from builder stage
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app ./

# Switch to non-root user
USER node

# Expose internal application port
EXPOSE 5000

# Container healthcheck
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/api/health || exit 1

CMD ["node", "server.js"]
