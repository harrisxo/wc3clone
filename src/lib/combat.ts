import { randomInt } from "node:crypto";
import { SIEGE_VS_TOWER_MULTIPLIER } from "@/lib/game-data";

// Round-based battle: the attacker strikes first each round, damage is applied
// to the weakest defenders first (defense acts as hit points, overkill carries
// over), then the surviving defenders strike back. Repeats until one side is
// wiped out; the winner keeps its survivors.

export type Fighter = {
  key: string; // unit key, "tower" or "creep" — used for reporting and XP
  owner: number | null; // user id; null for neutral creeps
  hero?: boolean;
  tower?: boolean;
  siege?: boolean; // deals SIEGE_VS_TOWER_MULTIPLIER x damage against towers
  damageMin: number;
  damageMax: number;
  damageBonus: number; // flat research bonus added to every roll
  hp: number; // rolled defense at battle start
};

export type BattleResult = {
  attackerWon: boolean;
  rounds: number;
  attackerSurvivors: Fighter[];
  defenderSurvivors: Fighter[];
  attackerLosses: Fighter[];
  defenderLosses: Fighter[];
};

export type Rng = (min: number, maxInclusive: number) => number;
const defaultRng: Rng = (min, maxInclusive) => randomInt(min, maxInclusive + 1);

const MAX_ROUNDS = 50;

function rollDamage(side: Fighter[], rng: Rng) {
  let siege = 0;
  let normal = 0;
  for (const fighter of side) {
    const damage = rng(fighter.damageMin, fighter.damageMax) + fighter.damageBonus;
    if (fighter.siege) siege += damage;
    else normal += damage;
  }
  return { siege, normal };
}

// Applies a damage pool to targets (weakest hp first); overkill carries over.
// Returns the unspent remainder of the pool.
function applyDamage(pool: number, targets: Fighter[], multiplier: number) {
  for (const target of [...targets].sort((a, b) => a.hp - b.hp)) {
    if (pool <= 0) break;
    const needed = Math.ceil(target.hp / multiplier);
    const spent = Math.min(pool, needed);
    target.hp -= spent * multiplier;
    pool -= spent;
  }
  return pool;
}

function strike(damage: { siege: number; normal: number }, defenders: Fighter[]) {
  // Siege damage batters towers first (at the multiplier), then joins the
  // normal pool; the normal pool hits everything weakest-first.
  const towers = defenders.filter((fighter) => fighter.tower && fighter.hp > 0);
  const leftoverSiege = applyDamage(damage.siege, towers, SIEGE_VS_TOWER_MULTIPLIER);
  applyDamage(damage.normal + leftoverSiege, defenders.filter((fighter) => fighter.hp > 0), 1);
}

export function simulateBattle(attackers: Fighter[], defenders: Fighter[], rng: Rng = defaultRng): BattleResult {
  const attackerForce = attackers.map((fighter) => ({ ...fighter }));
  const defenderForce = defenders.map((fighter) => ({ ...fighter }));
  const alive = (side: Fighter[]) => side.filter((fighter) => fighter.hp > 0);

  let rounds = 0;
  while (rounds < MAX_ROUNDS && alive(attackerForce).length > 0 && alive(defenderForce).length > 0) {
    rounds += 1;
    strike(rollDamage(alive(attackerForce), rng), defenderForce);
    if (alive(defenderForce).length === 0) break;
    strike(rollDamage(alive(defenderForce), rng), attackerForce);
  }

  const attackerSurvivors = alive(attackerForce);
  return {
    attackerWon: alive(defenderForce).length === 0 && attackerSurvivors.length > 0,
    rounds,
    attackerSurvivors,
    defenderSurvivors: alive(defenderForce),
    attackerLosses: attackerForce.filter((fighter) => fighter.hp <= 0),
    defenderLosses: defenderForce.filter((fighter) => fighter.hp <= 0),
  };
}
