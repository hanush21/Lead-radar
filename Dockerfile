# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build --workspace=apps/web

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/package-lock.json /app/turbo.json ./
COPY --from=build /app/apps/web ./apps/web

RUN npm prune --omit=dev --workspaces --include-workspace-root

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=apps/web"]

