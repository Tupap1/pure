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

# Crear usuario y grupo sin privilegios de superusuario (Security INF-01)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=base /app/public ./public
COPY --from=base --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=base --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=base --chown=nextjs:nodejs /app/mcp-server ./mcp-server
COPY --from=base --chown=nextjs:nodejs /app/lib ./lib
COPY --from=base --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=base --chown=nextjs:nodejs /app/db ./db
COPY --from=base --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=nextjs:nodejs /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
