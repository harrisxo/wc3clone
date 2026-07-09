import { test } from "node:test";
import assert from "node:assert/strict";
import { database } from "@/lib/db";

test("migrations have run to the latest version", () => {
  const { user_version: version } = database.prepare("PRAGMA user_version").get() as { user_version: number };
  assert.equal(version, 4);
});

test("users.gold is REAL, matching wood, since accrual writes fractional amounts", () => {
  const { sql } = database.prepare("SELECT sql FROM sqlite_master WHERE name = 'users'").get() as { sql: string };
  assert.match(sql, /gold REAL/);
});

test("the starting world is seeded with exactly 100 tiles in a 34/34/32 split", () => {
  const total = (database.prepare("SELECT COUNT(*) c FROM world_tiles").get() as { c: number }).c;
  assert.equal(total, 100);
  const byType = Object.fromEntries((database.prepare("SELECT field_type, COUNT(*) c FROM world_tiles GROUP BY field_type").all() as { field_type: string; c: number }[]).map((r) => [r.field_type, r.c]));
  assert.equal(byType.small, 34);
  assert.equal(byType.medium, 34);
  assert.equal(byType.goldmine, 32);
});

test("PRAGMA foreign_key_check reports no violations after migrating", () => {
  const violations = database.prepare("PRAGMA foreign_key_check").all();
  assert.deepEqual(violations, []);
});
