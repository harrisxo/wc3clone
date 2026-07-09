import { test } from "node:test";
import assert from "node:assert/strict";
import { database } from "@/lib/db";
import { ensureHomeTile, expandWorldByTime, getWorldMap } from "@/lib/world";
import { createTestUser } from "@/lib/test-utils";

// Tests in this file share one in-memory database and run in definition order
// (node:test's default), because "the first user becomes admin" is a
// database-wide fact, not a per-user one — it must be observed before any
// other user claims a home tile.

test("the first-ever user becomes admin and is placed near the center of the starting grid", () => {
  const userId = createTestUser();
  const home = ensureHomeTile(userId);
  assert.ok(home.x < 10 && home.y < 10, "admin should settle within the original 10x10 grid");
  const user = database.prepare("SELECT is_admin FROM users WHERE id = ?").get(userId) as { is_admin: number };
  assert.equal(user.is_admin, 1);
});

test("ensureHomeTile is idempotent for a user who already has a home", () => {
  const userId = createTestUser();
  const first = ensureHomeTile(userId);
  const second = ensureHomeTile(userId);
  assert.equal(second.x, first.x);
  assert.equal(second.y, first.y);
});

test("a later, non-admin user is placed in a freshly expanded column beyond the starting grid", () => {
  const before = database.prepare("SELECT COALESCE(MAX(x), 9) + 1 AS start_x FROM world_tiles").get() as { start_x: number };
  const userId = createTestUser();
  const home = ensureHomeTile(userId);
  assert.ok(home.x >= before.start_x, "non-admin players settle beyond the already-occupied columns");
  const tile = database.prepare("SELECT owner_user_id, is_main_village FROM world_tiles WHERE x = ? AND y = ?").get(home.x, home.y) as { owner_user_id: number; is_main_village: number };
  assert.equal(tile.owner_user_id, userId);
  assert.equal(tile.is_main_village, 1);
});

test("expandWorldByTime establishes a baseline on first call and adds nothing yet", () => {
  database.prepare("DELETE FROM app_meta WHERE key = 'world_last_expanded_at'").run();
  const added = expandWorldByTime();
  assert.equal(added, 0);
});

test("expandWorldByTime adds 3 columns per elapsed hour once a baseline exists", () => {
  const widthBefore = (database.prepare("SELECT COALESCE(MAX(x), 9) + 1 AS w FROM world_tiles").get() as { w: number }).w;
  database.prepare("UPDATE app_meta SET value = ? WHERE key = 'world_last_expanded_at'").run(new Date(Date.now() - 2 * 3_600_000).toISOString());

  const added = expandWorldByTime();

  assert.equal(added, 6, "2 elapsed hours * 3 columns");
  const widthAfter = (database.prepare("SELECT COALESCE(MAX(x), 9) + 1 AS w FROM world_tiles").get() as { w: number }).w;
  assert.equal(widthAfter, widthBefore + 6);
});

test("getWorldMap returns a 10-wide slice centered on the requesting player's home", () => {
  const userId = createTestUser();
  const home = ensureHomeTile(userId);
  const map = getWorldMap(userId);
  assert.equal(map.tiles.length, 100, "a 10x10 slice");
  assert.ok(map.startX <= home.x && home.x < map.startX + 10, "the home tile falls within the returned slice");
});
