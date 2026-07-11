import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateBattle, type Fighter, type Rng } from "@/lib/combat";
import { creepRanges, heroStats, towerStats, unitsByRace } from "@/lib/game-data";

const minRng: Rng = (min) => min;
const maxRng: Rng = (_min, max) => max;

const unit = (race: "human" | "orc" | "undead" | "nightelf", key: string, hp: "min" | "max"): Fighter => {
  const def = unitsByRace[race].find((entry) => entry.key === key)!;
  return { key, owner: 1, siege: key === "siege", damageMin: def.damage[0], damageMax: def.damage[1], damageBonus: 0, hp: def.defense[hp === "min" ? 0 : 1] };
};

const hero = (level: number): Fighter => {
  const stats = heroStats(level);
  return { key: "hero_1", owner: 1, hero: true, damageMin: stats.damage[0], damageMax: stats.damage[1], damageBonus: 0, hp: stats.defense[0] };
};

// Worst-case field: maximum creep count with maximum stats.
const maxField = (type: keyof typeof creepRanges): Fighter[] => {
  const range = creepRanges[type];
  return Array.from({ length: range.count[1] }, () => ({ key: "creep", owner: null, damageMin: range.damage[1], damageMax: range.damage[1], damageBonus: 0, hp: range.defense[1] }));
};

test("4 melee + 4 ranged always beat a maximally rolled small field (human)", () => {
  const attackers = [...Array.from({ length: 4 }, () => unit("human", "melee", "min")), ...Array.from({ length: 4 }, () => unit("human", "ranged", "min"))];
  const result = simulateBattle(attackers, maxField("small"), minRng);
  assert.equal(result.attackerWon, true, "minimum damage rolls must still clear the strongest small field");
  assert.equal(result.attackerLosses.length, 0, "the field dies in round one before striking back");
});

test("4 level-1 heroes creep a maximally rolled medium field without losses", () => {
  const attackers = Array.from({ length: 4 }, () => hero(1));
  const result = simulateBattle(attackers, maxField("medium"), minRng);
  assert.equal(result.attackerWon, true);
  assert.equal(result.attackerLosses.length, 0, "all creeps must fall before they can strike back");
});

test("2 melee + 2 ranged can win a weakly rolled small field but lose against a strong one", () => {
  const weakField: Fighter[] = Array.from({ length: 3 }, () => ({ key: "creep", owner: null, damageMin: 1, damageMax: 1, damageBonus: 0, hp: 1 }));
  const attackers = [...Array.from({ length: 2 }, () => unit("human", "melee", "max")), ...Array.from({ length: 2 }, () => unit("human", "ranged", "max"))];
  const luckyWin = simulateBattle(attackers, weakField, maxRng);
  assert.equal(luckyWin.attackerWon, true, "a weak field with good rolls is beatable");

  const unlucky = simulateBattle([...Array.from({ length: 2 }, () => unit("human", "melee", "min")), ...Array.from({ length: 2 }, () => unit("human", "ranged", "min"))], maxField("small"), minRng);
  assert.equal(unlucky.attackerWon, false, "minimum rolls against a maximal field must fail");
});

test("siege units kill towers three times faster than their raw damage", () => {
  const tower: Fighter = { key: "tower", owner: 2, tower: true, damageMin: 0, damageMax: 0, damageBonus: 0, hp: towerStats.defense[1] };
  // 2 human siege at max roll deal 16 raw damage; tripled to 48 >= 30 hp.
  const siege = Array.from({ length: 2 }, () => unit("human", "siege", "max"));
  const result = simulateBattle(siege, [tower], maxRng);
  assert.equal(result.attackerWon, true, "16 raw damage must destroy a 30 hp tower thanks to the 3x multiplier");

  // The same 16 raw damage without the multiplier would not: use melee-only attackers.
  const melee: Fighter[] = [{ key: "melee", owner: 1, damageMin: 16, damageMax: 16, damageBonus: 0, hp: 100 }];
  const towerAgain: Fighter = { ...tower, damageMin: 1, damageMax: 1 };
  const meleeResult = simulateBattle(melee, [towerAgain], maxRng);
  assert.equal(meleeResult.rounds > 1, true, "without the siege multiplier the tower survives round one");
});

test("winner keeps survivors and loser is wiped out", () => {
  const attackers = Array.from({ length: 4 }, () => hero(3));
  const defenders = maxField("small");
  const result = simulateBattle(attackers, defenders, minRng);
  assert.equal(result.attackerSurvivors.length, 4);
  assert.equal(result.defenderSurvivors.length, 0);
  assert.equal(result.defenderLosses.length, defenders.length);
});
