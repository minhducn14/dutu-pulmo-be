# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy built assets and production dependencies
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
# Re-install only production dependencies to keep image small (optional if node_modules is large)
# RUN npm ci --only=production

# Expose port (default NestJS is 3000)
EXPOSE 3000

CMD ["npm", "run", "start:prod"]
