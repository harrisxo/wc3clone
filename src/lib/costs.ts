// TESTING: all gold/wood costs below are temporarily set to 1.
export function foodBuildingCost(_currentFoodCapacity: number) {
  return { gold: 1, wood: 1, seconds: 10 };
}

export function queueUpgradeCost(_currentQueueSlots: number) {
  return { gold: 1, wood: 1, seconds: 10 };
}

export function buildingUpgradeCost(currentUpgradeLevel: number) {
  return { gold: 1, wood: 1, seconds: 10 };
}

// Level n costs n gold/wood. TESTING: 60s per level; production will use hours
// instead (level 1 = 1h, level 2 = 2h, ...).
export function researchCost(currentLevel: number) {
  const nextLevel = currentLevel + 1;
  return { gold: nextLevel, wood: nextLevel, seconds: 10 };
}

// Heldenturm and forge queues are capped at 4; other buildings stay unlimited.
export function maxQueueSlots(buildingKey: string) {
  return buildingKey === "magic" || buildingKey === "forge" ? 4 : Infinity;
}
