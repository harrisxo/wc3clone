import { test } from "node:test";
import assert from "node:assert/strict";
import { buildingUpgradeCost, foodBuildingCost, queueUpgradeCost } from "@/lib/costs";

test("foodBuildingCost scales with the current food capacity", () => {
  assert.deepEqual(foodBuildingCost(10), { gold: 100, wood: 60, seconds: 120 });
  assert.deepEqual(foodBuildingCost(20), { gold: 135, wood: 80, seconds: 120 });
  assert.deepEqual(foodBuildingCost(50), { gold: 240, wood: 140, seconds: 120 });
});

test("queueUpgradeCost scales linearly with existing queue slots", () => {
  assert.deepEqual(queueUpgradeCost(1), { gold: 300, wood: 250, seconds: 300 });
  assert.deepEqual(queueUpgradeCost(3), { gold: 900, wood: 750, seconds: 300 });
});

test("buildingUpgradeCost scales with the current upgrade level", () => {
  assert.deepEqual(buildingUpgradeCost(0), { gold: 180, wood: 140, seconds: 240 });
  assert.deepEqual(buildingUpgradeCost(2), { gold: 420, wood: 320, seconds: 360 });
});
