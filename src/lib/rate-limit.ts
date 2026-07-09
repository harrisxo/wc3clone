import "server-only";
import { database } from "@/lib/db";

export type RateLimitScope = "login" | "register";

const WINDOW_MS: Record<RateLimitScope, number> = {
  login: 15 * 60 * 1000,
  register: 60 * 60 * 1000,
};
const LIMITS: Record<RateLimitScope, number> = {
  login: 5,
  register: 5,
};

export function isRateLimited(scope: RateLimitScope, key: string): boolean {
  const windowStart = new Date(Date.now() - WINDOW_MS[scope]).toISOString();
  const { count } = database.prepare("SELECT COUNT(*) count FROM auth_attempts WHERE scope = ? AND key = ? AND created_at > ?").get(scope, key, windowStart) as { count: number };
  return count >= LIMITS[scope];
}

export function recordAttempt(scope: RateLimitScope, key: string) {
  // Opportunistic cleanup keeps the table bounded without a separate cron job.
  const cutoff = new Date(Date.now() - Math.max(...Object.values(WINDOW_MS))).toISOString();
  database.prepare("DELETE FROM auth_attempts WHERE created_at < ?").run(cutoff);
  database.prepare("INSERT INTO auth_attempts (scope, key, created_at) VALUES (?, ?, ?)").run(scope, key, new Date().toISOString());
}
