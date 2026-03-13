import { createHash, randomBytes } from "crypto";
import { getAuthBaseUrl } from "@/modules/auth/infrastructure/authEnv";

const DEFAULT_PASSWORD_RESET_TTL_MINUTES = 60;

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString("hex");
  return {
    rawToken,
    tokenHash: hashPasswordResetToken(rawToken),
  };
}

export function getPasswordResetExpiry(now = new Date()): Date {
  const ttlMinutes = Math.max(
    5,
    Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || DEFAULT_PASSWORD_RESET_TTL_MINUTES)
  );
  return new Date(now.getTime() + ttlMinutes * 60 * 1000);
}

export function getPasswordResetTtlMinutes(): number {
  return Math.max(
    5,
    Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || DEFAULT_PASSWORD_RESET_TTL_MINUTES)
  );
}

export function getConfiguredAppBaseUrl(): string | null {
  const configured = getAuthBaseUrl();
  if (!configured) return null;
  return configured.replace(/\/+$/, "");
}

export function resolveAppBaseUrl(fallbackOrigin?: string): string {
  const configured = getConfiguredAppBaseUrl();
  if (configured) return configured;
  return String(fallbackOrigin || "").replace(/\/+$/, "");
}
