// TESTING: all gold/wood costs below are temporarily set to 1.
export function foodBuildingCost(_currentFoodCapacity: number) {
  return { gold: 1, wood: 1, seconds: 120 };
}

export function queueUpgradeCost(_currentQueueSlots: number) {
  return { gold: 1, wood: 1, seconds: 300 };
}

export function buildingUpgradeCost(currentUpgradeLevel: number) {
  return { gold: 1, wood: 1, seconds: 240 + currentUpgradeLevel * 60 };
}
