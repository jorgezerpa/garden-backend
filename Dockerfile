# Stage 1: Build
FROM node:22.12-alpine AS builder

WORKDIR /app

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDeps for building)
RUN npm ci

# Copy the rest of the source code
COPY . .

# Generate Prisma Client (crucial for type safety and queries)
RUN npx prisma generate

# Build the project using tsdown
RUN npm run build

# Stage 2: Production
FROM node:22.12-alpine AS runners

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy only what's needed to run
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

# Expose the port your Express app uses
EXPOSE 3001

# Start the application using your start script
CMD ["npm", "start"]