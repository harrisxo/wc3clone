import { randomBytes } from "node:crypto";
import { database } from "@/lib/db";
import type { Race } from "@/lib/auth";

export function createTestUser(overrides: Partial<{ race: Race; gold: number; wood: number; totalWorkers: number; goldWorkers: number; woodWorkers: number; foodCapacity: number; resourcesUpdatedAt: string | null; isAdmin: boolean }> = {}) {
  const suffix = randomBytes(6).toString("hex");
  const username = `test_${suffix}`;
  const result = database
    .prepare("INSERT INTO users (username, display_name, email, password_hash, race, gold, wood, total_workers, gold_workers, wood_workers, food_capacity, resources_updated_at, is_admin) VALUES (?, ?, ?, 'x', ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(username, username, `${username}@test.de`, overrides.race ?? null, overrides.gold ?? 0, overrides.wood ?? 0, overrides.totalWorkers ?? 5, overrides.goldWorkers ?? 0, overrides.woodWorkers ?? 0, overrides.foodCapacity ?? 10, overrides.resourcesUpdatedAt === undefined ? new Date().toISOString() : overrides.resourcesUpdatedAt, overrides.isAdmin ? 1 : 0);
  return Number(result.lastInsertRowid);
}
