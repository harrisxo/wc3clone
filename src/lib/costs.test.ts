import { test } from "node:test";
import assert from "node:assert/strict";
import { buildingUpgradeCost, foodBuildingCost, queueUpgradeCost } from "@/lib/costs";

// Gold/wood are temporarily pinned to 1 for testing (see costs.ts); only the
// time formula still varies, so that's what these tests cover.

test("foodBuildingCost always costs 1/1 while testing", () => {
  assert.deepEqual(foodBuildingCost(10), { gold: 1, wood: 1, seconds: 10 });
  assert.deepEqual(foodBuildingCost(50), { gold: 1, wood: 1, seconds: 10 });
});

test("queueUpgradeCost always costs 1/1 while testing", () => {
  assert.deepEqual(queueUpgradeCost(1), { gold: 1, wood: 1, seconds: 10 });
  assert.deepEqual(queueUpgradeCost(3), { gold: 1, wood: 1, seconds: 10 });
});

test("buildingUpgradeCost costs 1/1 and takes 10 seconds while testing", () => {
  assert.deepEqual(buildingUpgradeCost(0), { gold: 1, wood: 1, seconds: 10 });
  assert.deepEqual(buildingUpgradeCost(2), { gold: 1, wood: 1, seconds: 10 });
});
