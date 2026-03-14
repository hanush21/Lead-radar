import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const shouldLogQueries = process.env.PRISMA_LOG_QUERIES === "true";
const databaseUrl = process.env.DATABASE_URL;

function getRuntimeDatabaseUrl() {
  if (!databaseUrl) return undefined;

  try {
    const url = new URL(databaseUrl);
    const isSupabasePooler = url.hostname.includes("pooler.supabase.com");
    const isTransactionPooler = url.port === "6543";

    if (!isSupabasePooler || !isTransactionPooler) {
      return databaseUrl;
    }

    if (!url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }

    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }

    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "20");
    }

    if (!url.searchParams.has("sslmode")) {
      url.searchParams.set("sslmode", "require");
    }

    return url.toString();
  } catch {
    return databaseUrl;
  }
}

const runtimeDatabaseUrl = getRuntimeDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: runtimeDatabaseUrl,
    log: shouldLogQueries ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
