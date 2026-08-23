# ClearPanel — production image
# Bun runtime, matching the "bun run index.ts" start command Railway used.
FROM oven/bun:1 AS deps
WORKDIR /app
# Copy manifests first so dependency layers cache between code-only deploys.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1 AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Bun's base image ships a non-root "bun" user — run as it, not root.
COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun . .
USER bun

# The app reads PORT and defaults to 8080 (see the export block in index.ts).
ENV PORT=8080
EXPOSE 8080

# Container-level healthcheck. Coolify also has its own; this one makes
# `docker ps` honest if you ever run plain compose.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/branding').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "run", "index.ts"]
