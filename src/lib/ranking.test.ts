import { test } from "node:test";
import assert from "node:assert/strict";
import { database } from "@/lib/db";
import { getRanking, updateRankingsIfDue } from "@/lib/ranking";
import { createTestUser } from "@/lib/test-utils";

function makeDue() {
  database.prepare("DELETE FROM app_meta WHERE key = 'ranking_last_calculated_at'").run();
}

test("updateRankingsIfDue only snapshots users who have chosen a race", () => {
  makeDue();
  const withRace = createTestUser({ race: "human" });
  const withoutRace = createTestUser();

  updateRankingsIfDue();

  assert.ok(database.prepare("SELECT 1 FROM ranking_snapshots WHERE user_id = ?").get(withRace));
  assert.equal(database.prepare("SELECT 1 FROM ranking_snapshots WHERE user_id = ?").get(withoutRace), undefined);
});

test("a call within the 10-minute window is a no-op, even if points would otherwise change", () => {
  makeDue();
  const userId = createTestUser({ race: "human" });
  updateRankingsIfDue();
  const before = database.prepare("SELECT points, calculated_at FROM ranking_snapshots WHERE user_id = ?").get(userId) as { points: number; calculated_at: string };

  // Conquer a mine, which would raise points if recomputed.
  database.prepare("UPDATE world_tiles SET conquered_by_user_id = ? WHERE (x, y) = (SELECT x, y FROM world_tiles WHERE field_type = 'goldmine' LIMIT 1)").run(userId);
  updateRankingsIfDue();

  const after = database.prepare("SELECT points, calculated_at FROM ranking_snapshots WHERE user_id = ?").get(userId) as { points: number; calculated_at: string };
  assert.equal(after.calculated_at, before.calculated_at, "the locked-out call must not recompute");
  assert.equal(after.points, before.points);
});

test("getRanking orders players by points descending", () => {
  makeDue();
  const leader = createTestUser({ race: "orc" });
  const laggard = createTestUser({ race: "orc" });
  database.prepare("UPDATE world_tiles SET conquered_by_user_id = ? WHERE (x, y) = (SELECT x, y FROM world_tiles WHERE field_type = 'goldmine' AND conquered_by_user_id IS NULL LIMIT 1)").run(leader);

  const rows = getRanking();
  const leaderRow = rows.find((r) => r.id === leader)!;
  const laggardRow = rows.find((r) => r.id === laggard)!;
  assert.ok(leaderRow.points > laggardRow.points, "conquering a mine should outscore an idle player");
  assert.ok(rows.indexOf(leaderRow) < rows.indexOf(laggardRow), "the higher-scoring player must rank above the lower one");
});
