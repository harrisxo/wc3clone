export function foodBuildingCost(currentFoodCapacity: number) {
  const step = Math.floor((currentFoodCapacity - 10) / 10);
  return { gold: 100 + step * 35, wood: 60 + step * 20, seconds: 120 };
}

export function queueUpgradeCost(currentQueueSlots: number) {
  return { gold: 300 * currentQueueSlots, wood: 250 * currentQueueSlots, seconds: 300 };
}

export function buildingUpgradeCost(currentUpgradeLevel: number) {
  return { gold: 180 + currentUpgradeLevel * 120, wood: 140 + currentUpgradeLevel * 90, seconds: 240 + currentUpgradeLevel * 60 };
}
