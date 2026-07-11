import { test } from "node:test";
import assert from "node:assert/strict";
import { database } from "@/lib/db";
import { accrueResources, previewResources } from "@/lib/economy";
import { createTestUser } from "@/lib/test-utils";

test("accrual credits gold and wood proportional to elapsed hours and worker count", () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const userId = createTestUser({ gold: 100, wood: 50, goldWorkers: 2, woodWorkers: 1, resourcesUpdatedAt: twoHoursAgo });
  const state = accrueResources(userId);
  assert.ok(Math.abs(state.gold - 140) < 0.5, `expected ~140 gold, got ${state.gold}`);
  assert.ok(Math.abs(state.wood - 70) < 0.5, `expected ~70 wood, got ${state.wood}`);
});

test("previewResources computes the same totals as accrueResources but does not persist", () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const userId = createTestUser({ gold: 100, wood: 50, goldWorkers: 1, resourcesUpdatedAt: twoHoursAgo });

  const preview = previewResources(userId);
  assert.ok(preview.gold > 100, "preview should reflect accrued gold");

  const stored = database.prepare("SELECT gold, resources_updated_at FROM users WHERE id = ?").get(userId) as { gold: number; resources_updated_at: string };
  assert.equal(stored.gold, 100, "preview must not write the accrued gold back to the row");
  assert.equal(stored.resources_updated_at, twoHoursAgo, "preview must not touch resources_updated_at");

  const accrued = accrueResources(userId);
  assert.ok(Math.abs(accrued.gold - preview.gold) < 1, "a persisting call moments later should land near the same total the preview computed");
  const storedAfter = database.prepare("SELECT gold FROM users WHERE id = ?").get(userId) as { gold: number };
  assert.ok(Math.abs(storedAfter.gold - accrued.gold) < 0.001, "accrueResources must persist the computed gold");
});

test("worker counts are clamped to workplace capacity", () => {
  const userId = createTestUser({ goldWorkers: 12, woodWorkers: 9 });
  const state = accrueResources(userId);
  assert.equal(state.goldWorkers, 5, "base gold capacity is 5 workplaces without conquered mines");
  assert.equal(state.woodWorkers, 5, "base wood capacity is 5 workplaces without conquered fields");
});

test("conquered small/medium fields raise wood workplace capacity", () => {
  const userId = createTestUser({ woodWorkers: 6 });
  database.prepare("UPDATE world_tiles SET conquered_by_user_id = ? WHERE (x, y) = (SELECT x, y FROM world_tiles WHERE field_type IN ('small', 'medium') LIMIT 1)").run(userId);
  const state = accrueResources(userId);
  assert.equal(state.woodWorkplaces, 6, "one conquered field should raise capacity from 5 to 6");
  assert.equal(state.woodWorkers, 6, "workers up to the raised capacity are no longer clamped");
});

test("conquered goldmines raise gold workplace capacity and storage", () => {
  const userId = createTestUser({ goldWorkers: 6 });
  database.prepare("UPDATE world_tiles SET conquered_by_user_id = ? WHERE (x, y) = (SELECT x, y FROM world_tiles WHERE field_type = 'goldmine' LIMIT 1)").run(userId);
  const state = accrueResources(userId);
  assert.equal(state.goldWorkplaces, 6, "one conquered mine should raise capacity from 5 to 6");
  assert.equal(state.goldWorkers, 6, "workers up to the raised capacity are no longer clamped");
});
