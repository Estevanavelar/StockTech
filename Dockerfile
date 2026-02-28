# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev) for build
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install dumb-init and curl for health check
RUN apk add --no-cache dumb-init curl

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S stocktech -u 1001

# Copy built application from builder stage
COPY --from=builder --chown=stocktech:nodejs /app/dist ./dist
COPY --from=builder --chown=stocktech:nodejs /app/server ./server
COPY --from=builder --chown=stocktech:nodejs /app/package*.json ./
COPY --from=builder --chown=stocktech:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=stocktech:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER stocktech

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]