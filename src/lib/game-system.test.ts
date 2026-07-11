import { test } from "node:test";
import assert from "node:assert/strict";
import { database } from "@/lib/db";
import { getGameState, processGameJobs } from "@/lib/game-system";
import { createTestUser } from "@/lib/test-utils";

const past = () => new Date(Date.now() - 60_000).toISOString();
const future = () => new Date(Date.now() + 60_000).toISOString();

test("processGameJobs finishes a due build job into player_buildings", () => {
  const userId = createTestUser({ race: "human" });
  database.prepare("INSERT INTO build_jobs (user_id, building_key, job_type, finishes_at) VALUES (?, 'barracks', 'build', ?)").run(userId, past());

  processGameJobs(userId, "human");

  const owned = database.prepare("SELECT * FROM player_buildings WHERE user_id = ? AND building_key = 'barracks'").get(userId);
  assert.ok(owned, "the barracks should now be an owned building");
  const remainingJobs = database.prepare("SELECT COUNT(*) c FROM build_jobs WHERE user_id = ?").get(userId) as { c: number };
  assert.equal(remainingJobs.c, 0, "the finished job should be removed");
});

test("processGameJobs adds trained workers to total_workers instead of unit_stacks", () => {
  const userId = createTestUser({ race: "human", totalWorkers: 5 });
  database.prepare("INSERT INTO unit_jobs (user_id, building_key, unit_key, quantity, finishes_at) VALUES (?, 'main', 'worker', 2, ?)").run(userId, past());

  processGameJobs(userId, "human");

  const user = database.prepare("SELECT total_workers FROM users WHERE id = ?").get(userId) as { total_workers: number };
  assert.equal(user.total_workers, 7, "5 starting workers + 2 trained");
  const stack = database.prepare("SELECT quantity FROM unit_stacks WHERE user_id = ? AND unit_key = 'worker'").get(userId);
  assert.equal(stack, undefined, "workers must not also land in unit_stacks");
});

test("processGameJobs adds trained combat units to unit_stacks", () => {
  const userId = createTestUser({ race: "human" });
  database.prepare("INSERT INTO unit_jobs (user_id, building_key, unit_key, quantity, finishes_at) VALUES (?, 'barracks', 'melee', 3, ?)").run(userId, past());

  processGameJobs(userId, "human");

  const stack = database.prepare("SELECT quantity FROM unit_stacks WHERE user_id = ? AND unit_key = 'melee'").get(userId) as { quantity: number };
  assert.equal(stack.quantity, 3);
});

test("processGameJobs levels up finished research and clears the job", () => {
  const userId = createTestUser({ race: "human" });
  database.prepare("INSERT INTO research_jobs (user_id, research_key, finishes_at) VALUES (?, 'melee_damage', ?)").run(userId, past());
  database.prepare("INSERT INTO research_jobs (user_id, research_key, finishes_at) VALUES (?, 'ranged_defense', ?)").run(userId, future());

  const state = getGameState(userId, "human");

  assert.equal(state.researchLevels.melee_damage, 1, "the due research should reach level 1");
  assert.equal(state.researchLevels.ranged_defense, 0, "the pending research must not level up early");
  assert.equal(state.researchJobs.length, 1, "only the unfinished job remains queued");
});

test("getGameState reserves food supply for in-flight training jobs, not just finished units", () => {
  const userId = createTestUser({ race: "human", totalWorkers: 5, foodCapacity: 10 });
  // siege (supply 4) and hero_1 (supply 1) still training, not yet due
  database.prepare("INSERT INTO unit_jobs (user_id, building_key, unit_key, finishes_at) VALUES (?, 'siege', 'siege', ?)").run(userId, future());
  database.prepare("INSERT INTO unit_jobs (user_id, building_key, unit_key, finishes_at) VALUES (?, 'magic', 'hero_1', ?)").run(userId, future());

  const state = getGameState(userId, "human");

  assert.equal(state.supplyUsed, 10, "5 workers + 4 (pending siege) + 1 (pending hero) = 10, exactly at the food cap");
});