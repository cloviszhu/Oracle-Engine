ARG NODE_IMAGE=node:20.19.3-bookworm-slim

FROM ${NODE_IMAGE} AS base

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY tsconfig.json tsconfig.server.json nest-cli.json vite.config.ts vitest.config.ts ./
COPY client ./client
COPY server ./server
COPY shared ./shared
COPY drizzle ./drizzle
RUN pnpm build

FROM base AS prod-deps

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM ${NODE_IMAGE} AS runtime

WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle/migrations ./drizzle/migrations

EXPOSE 3000
CMD ["node", "dist/server/main.js"]
