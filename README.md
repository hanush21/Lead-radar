# LeadRadar

LeadRadar es una plataforma de captacion de leads locales construida con Next.js, Prisma y PostgreSQL.  
Incluye autenticacion, busqueda geolocalizada, gestion de leads/campanas y enriquecimiento asincrono.

## Estado actual (Hardening v1)

Se implemento un hardening de captacion sin romper la API actual:

- `POST /api/v1/search` sigue devolviendo leads en la respuesta inmediata.
- Dedupe reforzado en base de datos con claves unicas por usuario.
- Pipeline interno asincrono con cola (`pg-boss`) y worker separado.
- Scoring de leads (0-100) y priorizacion por score.
- Rate limit activo en busquedas.
- Trazabilidad con contadores operativos en `meta` y logs.

Tambien se implemento hardening de campanas:

- Tracking robusto de eventos Resend por webhook firmado (`svix`) con deduplicacion.
- Reconciliacion automatica cada 6h (eventos de email + conversiones por estado `CONVERTED`).
- Plantillas profesionales por categoria (`CampaignTemplate`) y personalizacion IA por lead.
- Soporte de `Reply-To` configurable (`RESEND_REPLY_TO`) para centralizar respuestas de prospectos.
- Analitica de campanas con funnel y tasas (`openRate`, `clickRate`, `ctor`, `conversionRate`).

## Stack

- Next.js 14 (App Router)
- React 18 + TypeScript
- Prisma + PostgreSQL
- NextAuth v5
- pg-boss (cola sobre PostgreSQL)
- Tailwind CSS
- Vitest + ESLint + TypeScript
- Turborepo

## Estructura

```text
leadradar/
  apps/
    web/
      prisma/
      scripts/
      src/
  Dockerfile
  docker-compose.yml
```

## API relevante

- `POST /api/v1/search`
  - Respuesta compatible (`data` con leads).
  - `meta` extendido: `fetched`, `insideRadius`, `dedupedInMemory`, `created`, `updated`, `deduped`, `queuedForEnrichment`, `persisted`, `total`.
- `GET /api/v1/leads`
  - Orden por `leadScore desc, createdAt desc`.
- `POST /api/v1/webhooks/resend`
  - Ingesta segura de eventos de email (`sent`, `delivered`, `opened`, `clicked`, `bounced`, `complained`, `unsubscribed`).
- `GET /api/v1/campaigns/templates`
  - Catalogo de plantillas activas por categoria.
- `GET /api/v1/campaigns/[id]/stats`
  - Totales compatibles + metricas avanzadas y tasas.

## Modelo Lead (campos nuevos)

- `provider` (default `serpapi`)
- `providerPlaceId` (nullable)
- `dedupeKey` (unico por usuario)
- `leadScore` (default `0`)
- `enrichmentStatus` (`PENDING | PROCESSING | DONE | FAILED`)
- `segment` (`HOT | WARM | COLD`)
- `tags` (json de etiquetas operativas)
- `lastSeenAt`

Unicidad garantizada en DB:

- `@@unique([userId, dedupeKey])`
- `@@unique([userId, provider, providerPlaceId])`

## Variables de entorno

Crear `apps/web/.env.local` desde `apps/web/.env.example`.

Requeridas:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `SERPAPI_API_KEY`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO`
- `AI_BASE_URL`
- `AI_MODEL`
- `AI_API_KEY`
- `NEXT_PUBLIC_MAPBOX_TOKEN`

Opcionales del worker:

- `WORKER_CONCURRENCY` (default `3`)
- `WORKER_ONCE=true` para ejecucion unica
- `AI_TIMEOUT_MS` (default `8000`)

## Migraciones y backfill (importante en entornos con datos)

El hardening usa migracion en 2 pasos para no romper historicos:

1. Aplicar step1:
```bash
npx prisma migrate deploy --schema=apps/web/prisma/schema.prisma
```

2. Ejecutar backfill:
```bash
npm run leads:backfill-dedupe --workspace=apps/web
```

3. Aplicar step2 (constraints unicos finales):
```bash
npx prisma migrate deploy --schema=apps/web/prisma/schema.prisma
```

## Desarrollo local

```bash
npm install
npm run db:generate --workspace=apps/web
npm run dev
```

## Scripts utiles

Desde la raiz:

- `npm run dev`
- `npm run lint`
- `npm run type-check`
- `npm test`
- `npm run build`

Desde `apps/web`:

- `npm run worker:start`
- `npm run worker:once`
- `npm run leads:backfill-dedupe`

## Docker

`docker-compose.yml` levanta:

- `db` (PostgreSQL)
- `web` (Next.js)
- `worker` (procesador de jobs `lead.postprocess` y `lead.recheck`)
- `worker` tambien reconcilia campanas:
  - `campaign.reconcile-email-events` (cada 6h)
  - `campaign.reconcile-conversions` (cada 6h)

Arranque:

```bash
docker compose up --build
```

`web` y `worker` ejecutan `prisma migrate deploy` al iniciar.
