import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "@/lib/auth";

test("verifyPassword accepts the correct password and rejects a wrong one", async () => {
  const stored = await hashPassword("korrektesPasswort123");
  assert.equal(await verifyPassword("korrektesPasswort123", stored), true);
  assert.equal(await verifyPassword("falschesPasswort", stored), false);
});

test("hashPassword salts independently, so hashing the same password twice differs", async () => {
  const first = await hashPassword("gleichesPasswort");
  const second = await hashPassword("gleichesPasswort");
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("gleichesPasswort", first), true);
  assert.equal(await verifyPassword("gleichesPasswort", second), true);
});

test("verifyPassword fails closed on a malformed stored hash instead of throwing", async () => {
  await assert.doesNotReject(async () => {
    const ok = await verifyPassword("irgendwas", "keinDoppelpunktHier");
    assert.equal(ok, false);
  });
});
