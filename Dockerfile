FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

FROM base AS dependencies

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/portal/package.json packages/portal/package.json
COPY packages/toolbar/package.json packages/toolbar/package.json
COPY examples/react-consumer/package.json examples/react-consumer/package.json
COPY examples/vanilla-consumer/package.json examples/vanilla-consumer/package.json
COPY examples/vue-consumer/package.json examples/vue-consumer/package.json
COPY examples/angular-consumer/package.json examples/angular-consumer/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS builder

WORKDIR /app

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder --chown=node:node /app/packages/portal/.next/standalone ./

USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "packages/portal/server.js"]
