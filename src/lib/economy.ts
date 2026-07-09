import "server-only";
import { database } from "@/lib/db";

export type EconomyState = {
  gold: number; wood: number; goldCapacity: number; woodCapacity: number;
  totalWorkers: number; goldWorkers: number; woodWorkers: number;
  goldWorkplaces: number; woodWorkplaces: number; busyWorkers: number; updatedAt: string;
};

function capacities(userId: number) {
  const territory = database.prepare(`SELECT
    SUM(CASE WHEN field_type IN ('small', 'medium') THEN 1 ELSE 0 END) storage_fields,
    SUM(CASE WHEN field_type = 'goldmine' THEN 1 ELSE 0 END) mines
    FROM world_tiles WHERE conquered_by_user_id = ?`).get(userId) as { storage_fields: number | null; mines: number | null };
  return { storage: 5000 + (territory.storage_fields ?? 0) * 1000, goldWorkplaces: 5 + (territory.mines ?? 0) };
}

export function accrueResources(userId: number): EconomyState {
  const user = database.prepare(`SELECT gold, wood, total_workers, gold_workers, wood_workers, resources_updated_at FROM users WHERE id = ?`).get(userId) as {
    gold: number; wood: number; total_workers: number; gold_workers: number; wood_workers: number; resources_updated_at: string | null;
  } | undefined;
  if (!user) throw new Error("Spieler nicht gefunden.");

  const now = new Date();
  const lastUpdate = user.resources_updated_at ? new Date(user.resources_updated_at) : now;
  const elapsedHours = Math.max(0, now.getTime() - lastUpdate.getTime()) / 3_600_000;
  const caps = capacities(userId);
  const goldWorkers = Math.min(user.gold_workers, caps.goldWorkplaces);
  const woodWorkers = Math.min(user.wood_workers, 5);
  const gold = Math.min(caps.storage, user.gold + goldWorkers * 10 * elapsedHours);
  const wood = Math.min(caps.storage, user.wood + woodWorkers * 10 * elapsedHours);

  database.prepare(`UPDATE users SET gold = ?, wood = ?, gold_workers = ?, wood_workers = ?, resources_updated_at = ? WHERE id = ?`)
    .run(gold, wood, goldWorkers, woodWorkers, now.toISOString(), userId);

  const busyWorkers = (database.prepare("SELECT COUNT(*) count FROM build_jobs WHERE user_id = ? AND job_type = 'build'").get(userId) as { count: number }).count;
  return { gold, wood, goldCapacity: caps.storage, woodCapacity: caps.storage, totalWorkers: user.total_workers, goldWorkers, woodWorkers, goldWorkplaces: caps.goldWorkplaces, woodWorkplaces: 5, busyWorkers, updatedAt: now.toISOString() };
}

