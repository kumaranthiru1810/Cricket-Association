# Multi-stage Dockerfile for Expo Web Frontend
FROM node:20.18-alpine3.20 AS builder
WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install all dependencies required to build the web bundle
RUN npm ci

# Copy source code
COPY . .

# Build production web bundle
ENV CI=true \
    NODE_ENV=production
RUN npx expo export -p web

# Runner stage: Production Nginx web server
FROM nginx:1.27.3-alpine AS runner

# Create non-root directories & default configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80 443

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
