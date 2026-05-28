FROM node:22-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/engine/package.json ./packages/engine/
COPY packages/server/package.json ./packages/server/
RUN pnpm install --frozen-lockfile --filter @artemis/server...

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/engine/node_modules ./packages/engine/node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY . .
RUN pnpm --filter @artemis/shared build
RUN pnpm --filter @artemis/engine build
RUN pnpm --filter @artemis/server build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm
COPY --from=build /app/packages/server/dist ./dist
COPY --from=build /app/packages/server/prisma ./prisma
COPY --from=build /app/packages/shared/dist ./node_modules/@artemis/shared/dist
COPY --from=build /app/packages/engine/dist ./node_modules/@artemis/engine/dist
COPY --from=build /app/packages/server/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/app.js"]
