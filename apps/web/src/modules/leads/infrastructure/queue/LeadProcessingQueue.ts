import PgBoss from "pg-boss";
import type { ILeadProcessingQueue } from "../../application/use-cases/SearchLeadsUseCase";

export const LEAD_POSTPROCESS_JOB = "lead.postprocess";
export const LEAD_RECHECK_JOB = "lead.recheck";

let bossInstance: PgBoss | null = null;
let bossStartPromise: Promise<PgBoss> | null = null;

async function getBoss(): Promise<PgBoss> {
  if (bossInstance) return bossInstance;
  if (bossStartPromise) return bossStartPromise;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for queue");
  const maxConnections = Math.max(1, Number(process.env.PGBOSS_MAX_CONNECTIONS || "1"));

  bossStartPromise = (async () => {
    const boss = new PgBoss({
      connectionString,
      max: maxConnections,
      application_name: "leadradar-web-queue",
    } as any);
    boss.on("error", (error) => {
      console.error("PgBoss queue error", {
        error,
      });
    });
    await boss.start();
    await boss.createQueue(LEAD_POSTPROCESS_JOB);
    await boss.createQueue(LEAD_RECHECK_JOB);
    bossInstance = boss;
    return boss;
  })();

  return bossStartPromise;
}

export class PgBossLeadProcessingQueue implements ILeadProcessingQueue {
  async enqueuePostprocess(payload: { leadId: string; userId: string }): Promise<boolean> {
    try {
      const boss = await getBoss();
      const id = await boss.send(LEAD_POSTPROCESS_JOB, payload, {
        retryLimit: 4,
        retryDelay: 10,
        retryBackoff: true,
        expireInSeconds: 600,
      });
      return Boolean(id);
    } catch (error) {
      console.error("Failed to enqueue lead.postprocess job", {
        payload,
        error,
      });
      return false;
    }
  }

  async enqueueRecheck(payload: { leadId: string; userId: string; batchId?: string }): Promise<boolean> {
    try {
      const boss = await getBoss();
      const id = await boss.send(LEAD_RECHECK_JOB, payload, {
        retryLimit: 4,
        retryDelay: 10,
        retryBackoff: true,
        expireInSeconds: 600,
      });
      return Boolean(id);
    } catch (error) {
      console.error("Failed to enqueue lead.recheck job", {
        payload,
        error,
      });
      return false;
    }
  }
}
