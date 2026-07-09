import { test } from "node:test";
import assert from "node:assert/strict";
import { database } from "@/lib/db";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";

function uniqueKey() {
  return `key_${Math.random().toString(36).slice(2)}`;
}

test("isRateLimited stays false below the limit and trips at the limit", () => {
  const key = uniqueKey();
  for (let i = 0; i < 4; i += 1) recordAttempt("login", key);
  assert.equal(isRateLimited("login", key), false, "4 attempts is below the limit of 5");

  recordAttempt("login", key);
  assert.equal(isRateLimited("login", key), true, "the 5th attempt should trip the limit");
});

test("attempts outside the scope's window are not counted", () => {
  const key = uniqueKey();
  const outsideWindow = new Date(Date.now() - 20 * 60_000).toISOString(); // login's window is 15 minutes
  database.prepare("INSERT INTO auth_attempts (scope, key, created_at) VALUES ('login', ?, ?)").run(key, outsideWindow);
  for (let i = 0; i < 4; i += 1) recordAttempt("login", key);

  assert.equal(isRateLimited("login", key), false, "the stale attempt outside the window must not count toward the limit");
});

test("scopes are tracked independently", () => {
  const key = uniqueKey();
  for (let i = 0; i < 5; i += 1) recordAttempt("login", key);
  assert.equal(isRateLimited("login", key), true);
  assert.equal(isRateLimited("register", key), false, "hitting the login limit must not affect the register scope for the same key");
});

test("recordAttempt sweeps attempts older than the largest configured window", () => {
  const key = uniqueKey();
  const veryOld = new Date(Date.now() - 2 * 3_600_000).toISOString(); // older than register's 60-minute window
  database.prepare("INSERT INTO auth_attempts (scope, key, created_at) VALUES ('register', ?, ?)").run(key, veryOld);

  recordAttempt("register", uniqueKey());

  const stale = database.prepare("SELECT 1 FROM auth_attempts WHERE key = ? AND created_at = ?").get(key, veryOld);
  assert.equal(stale, undefined, "the opportunistic sweep should have deleted the very old row");
});
