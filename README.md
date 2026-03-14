# LeadRadar

LeadRadar es una plataforma para captacion de leads locales con Next.js, Prisma y PostgreSQL.
Incluye busqueda geolocalizada, deduplicacion, scoring, campanas de email, plantillas por categoria, IA por lead y procesamiento asincrono con worker.

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- Prisma + PostgreSQL
- NextAuth v5
- pg-boss (cola sobre PostgreSQL)
- Resend (envio/tracking de emails)
- Tailwind CSS
- Turborepo

## Requisitos

- Node.js 18+ (recomendado 22)
- npm 9+
- PostgreSQL

## Variables de entorno

Crear `apps/web/.env.local` usando `apps/web/.env.example`.

Variables principales:

- `DATABASE_URL`
- `DIRECT_URL`
- `APP_BASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `PASSWORD_RESET_TOKEN_TTL_MINUTES`
- `SERPAPI_API_KEY`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO`
- `AI_BASE_URL`
- `AI_MODEL`
- `AI_API_KEY`
- `NEXT_PUBLIC_MAPBOX_TOKEN`

Variables operativas recomendadas (evitan saturar conexiones):

- `PGBOSS_MAX_CONNECTIONS=1`
- `WORKER_PGBOSS_MAX_CONNECTIONS=1`
- `WORKER_CONCURRENCY=1`
- `PRISMA_LOG_QUERIES=false`

Configuracion recomendada con Supabase:

- `DATABASE_URL`: URL pooled para runtime.
  - Vercel / serverless: usar Supavisor transaction mode con `connection_limit=1`.
  - Worker persistente: usar direct connection o session mode si necesitas pooler IPv4.
- `DIRECT_URL`: URL para Prisma CLI (`migrate deploy`).
  - usar direct connection si tu entorno soporta IPv6.
  - si no, usar session mode de Supavisor.
- `APP_BASE_URL`: URL publica canonica usada en emails de bienvenida y recuperacion.
  - ejemplo en produccion: `https://tu-dominio.com`
  - no debe apuntar a `localhost`

## Arranque local (recomendado)

1. Instalar dependencias:

```bash
npm install
```

2. Generar cliente Prisma:

```bash
npm run db:generate --workspace=apps/web
```

3. Aplicar migraciones:

```bash
npx prisma migrate deploy --schema=apps/web/prisma/schema.prisma
```

4. Levantar app web (terminal 1):

```bash
npm run dev
```

5. Levantar worker (terminal 2):

```bash
npm run worker:start --workspace=apps/web
```

Sin worker, los batches de enriquecimiento quedan en `PENDING`.

## Comandos utiles

Desde la raiz:

```bash
npm run dev
npm run lint
npm run type-check
npm run test
npm run build
```

Desde `apps/web`:

```bash
npm run worker:start
npm run worker:once
npm run leads:backfill-dedupe
npm run db:generate
npm run db:migrate
npm run build
npm run start:hostinger
```

Al ejecutar `npm run build` dentro de `apps/web`, Next genera:

- `.next/standalone`
- `.next/static`
- `dist-hostinger`

`dist-hostinger` queda preparado para despliegue manual en un hosting Node como Hostinger.

## Flujo de enriquecimiento de emails

En `Campaigns -> Nueva campana`:

- `Enriquecer emails faltantes`: procesa solo la categoria seleccionada.
- `Enriquecer todas las categorias`: procesa todo tu dataset elegible.

La UI muestra:

- barra de progreso por `batchId`
- consola tipo terminal con eventos por lead
- estados `PENDING | PROCESSING | DONE | FAILED`

Criterio de elegibilidad:

- lead sin email
- lead con `website`

## API relevante

- `POST /api/auth/register`
  - crea usuario y envia email de bienvenida si Resend esta configurado
- `POST /api/auth/forgot-password`
  - genera token de recuperacion y envia email de reset
- `POST /api/auth/reset-password`
  - valida token y actualiza la contrasena
- `POST /api/v1/search`
  - devuelve leads inmediatamente (compatible)
  - `meta` incluye: `fetched`, `insideRadius`, `created`, `updated`, `deduped`, `queuedForEnrichment`, etc.
- `GET /api/v1/leads`
  - orden por `leadScore desc, createdAt desc`
- `GET /api/v1/leads/stats`
  - total / con email / sin email / candidatos a enriquecimiento
- `POST /api/v1/leads/enrich-emails`
  - crea lote (`batchId`) de enriquecimiento
- `GET /api/v1/leads/enrich-emails/[batchId]/progress`
  - progreso consolidado del lote
- `POST /api/v1/webhooks/resend`
  - tracking de eventos de email firmado

## Docker

Levantar todo:

```bash
docker compose up --build
```

Servicios:

- `db` (PostgreSQL)
- `web` (Next.js)
- `worker` (jobs de leads y reconciliacion de campanas)

Nota: en Docker revisa `WORKER_CONCURRENCY` si tu plan de BD tiene limite bajo de conexiones.

### EasyPanel (un solo Dockerfile para web/worker)

Este repo incluye un `entrypoint` que permite usar la misma imagen para ambos servicios.

Variables importantes:

- `SERVICE_ROLE=web` o `SERVICE_ROLE=worker`
- `RUN_MIGRATIONS=true` (por defecto)
- `DATABASE_URL` (o `WORKER_DATABASE_URL` para worker)

Comportamiento:

- al iniciar, ejecuta `prisma migrate deploy` si `RUN_MIGRATIONS=true`
- luego arranca `next start` (`web`) o `worker:start` (`worker`)

Nota: las migraciones crean/actualizan tablas existentes, pero no crean la base de datos si no existe.

## Despliegue manual en Hostinger

Si no quieres depender de Vercel, puedes desplegar la web manualmente en un hosting Node.

1. Genera el paquete:

```bash
cd apps/web
npm run build
```

2. Se creara `apps/web/dist-hostinger`.

3. Sube **todo el contenido** de `dist-hostinger` al servidor de Hostinger.

4. Configura el comando de inicio:

```bash
node start.js
```

5. Configura en Hostinger las variables de entorno necesarias:

- `DATABASE_URL`
- `DIRECT_URL`
- `APP_BASE_URL`
- `NEXTAUTH_URL`
- `AUTH_URL`
- `NEXTAUTH_SECRET`
- `AUTH_SECRET`
- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `SERPAPI_API_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO`

6. Aplica migraciones **antes del upload** desde tu entorno local o CI si la base de datos no esta actualizada:

```bash
cd apps/web
npx prisma migrate deploy --schema=prisma/schema.prisma
```

Notas:

- `dist-hostinger/HOSTINGER_DEPLOY.txt` incluye un recordatorio del comando de arranque.
- `dist-hostinger/.env.example` te sirve como base para configurar variables en Hostinger.
- Este despliegue sirve para la **web**. El worker sigue siendo un proceso separado si quieres enriquecimiento y reconciliacion asincrona.

## Troubleshooting

### 1) `Error validating datasource db: the URL must start with prisma://`

Causa: Prisma Client generado en modo Data Proxy (`--no-engine`).

Solucion:

```bash
npm run db:generate --workspace=apps/web
```

### 2) `The column Lead.enrichmentBatchId does not exist`

Causa: codigo actualizado pero migraciones sin aplicar.

Solucion:

```bash
npx prisma migrate deploy --schema=apps/web/prisma/schema.prisma
```

### 3) `Max client connections reached`

Causa: demasiadas conexiones concurrentes (web + worker + polling).

Solucion recomendada:

- `PGBOSS_MAX_CONNECTIONS=1`
- `WORKER_PGBOSS_MAX_CONNECTIONS=1`
- `WORKER_CONCURRENCY=1`
- dejar un solo worker ejecutandose
- usar `DATABASE_URL` pooled para runtime
- usar `DIRECT_URL` para migraciones Prisma
- no compartir la base de produccion con `localhost` salvo para pruebas puntuales

### 4) Lote de enriquecimiento no avanza (todo `PENDING`)

Checklist:

1. worker activo (`npm run worker:start --workspace=apps/web`)
2. `DATABASE_URL` correcto en web y worker
3. migraciones aplicadas
4. no superar conexiones maximas de la BD

### 5) Render: `password authentication failed for user ...` (`28P01`)

Causa habitual: credenciales incorrectas en el servicio worker (o password no codificado en URL).

Checklist:

1. definir en Render `WORKER_DATABASE_URL` (o `DATABASE_URL`) en el servicio del worker
2. no envolver el valor con comillas (`"` o `'`)
3. si el password tiene caracteres especiales (`@`, `:`, `/`, `#`, `%`), usar URL encoding
4. confirmar que web y worker apuntan a la misma base de datos
5. redeploy del worker tras actualizar variables
