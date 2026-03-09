# LeadRadar

LeadRadar is a local lead generation platform built with Next.js 14, TypeScript, Prisma, NextAuth, and PostgreSQL.

The project is organized as a monorepo and currently ships one app:
- `apps/web`: main web app (dashboard + REST API)

## What It Does

- User auth (register/login) with NextAuth credentials
- Lead search by map center + radius + business category
- Lead enrichment and opportunity analysis
- Campaign creation and campaign send flow
- Basic analytics (leads, campaigns, email metrics)
- Lead deduplication on search/import

## Current Stack

- Next.js 14 (App Router)
- React 18 + TypeScript
- Prisma ORM + PostgreSQL
- NextAuth v5 (beta)
- Tailwind CSS
- Vitest
- Turborepo

## Project Structure

```text
leadradar/
  apps/
    web/
      prisma/
      src/
        app/
        modules/
        components/
        shared/
  package.json
  turbo.json
```

## API Routes (Current)

- `POST /api/auth/register`
- `GET|POST /api/auth/[...nextauth]`
- `POST /api/v1/search`
- `GET /api/v1/leads`
- `GET|PATCH|DELETE /api/v1/leads/[id]`
- `GET /api/v1/analytics`
- `GET|POST /api/v1/campaigns`
- `GET /api/v1/campaigns/[id]`
- `POST /api/v1/campaigns/[id]/send`
- `GET /api/v1/campaigns/[id]/stats`

## Environment Variables

Create `apps/web/.env.local` from `apps/web/.env.example`.

Required:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `SERPAPI_API_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NEXT_PUBLIC_MAPBOX_TOKEN`

## Local Development

1. Install dependencies

```bash
npm install
```

2. Configure environment

```bash
cp apps/web/.env.example apps/web/.env.local
```

3. Run DB migrations

```bash
npx prisma migrate deploy --schema=apps/web/prisma/schema.prisma
```

4. Start development server

```bash
npm run dev
```

App runs on:
- `http://localhost:3000`

## Useful Scripts

From repo root:

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run type-check`
- `npm test`
- `npm run db:generate`
- `npm run db:migrate`

## Docker

This repo includes:
- `Dockerfile`
- `docker-compose.yml`

Quick start:

```bash
docker compose up --build
```

This starts:
- `db` (PostgreSQL on `localhost:5432`)
- `web` (Next.js on `http://localhost:3000`)

The web container runs Prisma migrations on boot:
- `prisma migrate deploy`

## Notes About Search and Leads

- Map selection is used as the real search center.
- Results are filtered by real radius distance (Haversine).
- Duplicate leads are prevented:
  - inside the same search result set
  - against existing user leads in DB (update instead of duplicate insert)

