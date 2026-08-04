FROM node:22-alpine AS base

# Install dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Copy source files and build
COPY . .
RUN npm run build

# Production image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV MCP_PORT=3001

COPY --from=base /app/public ./public
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/mcp-server ./mcp-server
COPY --from=base /app/lib ./lib
COPY --from=base /app/node_modules ./node_modules

EXPOSE 3000 3001

CMD ["node", "server.js"]
