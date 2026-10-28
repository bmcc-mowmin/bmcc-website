# Production image. Build: docker build -t bmcc-website .
# Runtime settings come from environment variables (see RENDER.md for the full list); no secrets are baked in.
# Render passes the service's environment variables as build args; only the public ones below are read at build time.

FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# ── Dependencies ───────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# Production-only dependencies (includes the Prisma CLI used to run migrations on start).
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --omit=dev

# ── Build ──────────────────────────────────────────────────────────────────────
FROM base AS builder
# Public values compiled into the browser bundle / Next config. Never put secrets here.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_CLERK_SIGN_IN_URL \
    NEXT_PUBLIC_CLERK_SIGN_UP_URL \
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL \
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    SERVER_ACTIONS_ALLOWED_ORIGINS
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholders so env validation passes at build time; real values are supplied at runtime.
ENV APP_ENV=local \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    SESSION_SECRET=build-time-placeholder-not-used-at-runtime \
    NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# ── Runtime ────────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app

COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
# Migrations, applied by the entrypoint on start.
COPY --from=builder --chown=app:app /app/prisma ./prisma
COPY --from=builder --chown=app:app /app/prisma.config.ts ./
COPY --chown=app:app scripts/docker-entrypoint.sh ./
RUN mkdir -p /app/uploads && chown app:app /app/uploads

USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
