export function getAuthSecret(): string | undefined {
  return process.env.NEXTAUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim() || undefined;
}

export function getAuthBaseUrl(): string | undefined {
  return (
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    undefined
  );
}

