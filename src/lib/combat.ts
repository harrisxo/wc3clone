import { randomInt } from "node:crypto";
import { SIEGE_VS_TOWER_MULTIPLIER } from "@/lib/game-data";

// Round-based battle: the attacker strikes first each round, damage is applied
// to the weakest defenders first (defense acts as hit points, overkill carries
// over), then the surviving defenders strike back. Repeats until one side is
// wiped out; the winner keeps its survivors.
//
// Damage is split by target domain: a fighter's ground-damage range only ever
// hits "ground" targets, its air-damage range only ever hits "air" targets.
// Melee units carry an air range of [0,0], so they simply cannot scratch air
// targets. Ranged, air and hero units carry a real range for both domains.

export type Domain = "ground" | "air";

export type Fighter = {
  key: string; // unit key, "tower" or "creep" — used for reporting and XP
  owner: number | null; // user id; null for neutral creeps
  hero?: boolean;
  tower?: boolean;
  siege?: boolean; // deals SIEGE_VS_TOWER_MULTIPLIER x damage against towers
  domain?: Domain; // which pool of incoming damage can hurt this fighter; defaults to "ground"
  damageGroundMin: number;
  damageGroundMax: number;
  damageAirMin: number;
  damageAirMax: number;
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
const isAir = (fighter: Fighter) => fighter.domain === "air";

function rollDamage(side: Fighter[], rng: Rng) {
  let groundSiege = 0;
  let groundNormal = 0;
  let air = 0;
  for (const fighter of side) {
    const ground = rng(fighter.damageGroundMin, fighter.damageGroundMax);
    if (fighter.siege) groundSiege += ground;
    else groundNormal += ground;
    air += rng(fighter.damageAirMin, fighter.damageAirMax);
  }
  return { groundSiege, groundNormal, air };
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

function strike(damage: { groundSiege: number; groundNormal: number; air: number }, defenders: Fighter[]) {
  const groundDefenders = defenders.filter((fighter) => !isAir(fighter) && fighter.hp > 0);
  const airDefenders = defenders.filter((fighter) => isAir(fighter) && fighter.hp > 0);
  // Siege damage batters towers first (at the multiplier), then joins the
  // normal ground pool; the normal pool hits everything weakest-first.
  const towers = groundDefenders.filter((fighter) => fighter.tower);
  const leftoverSiege = applyDamage(damage.groundSiege, towers, SIEGE_VS_TOWER_MULTIPLIER);
  applyDamage(damage.groundNormal + leftoverSiege, groundDefenders, 1);
  applyDamage(damage.air, airDefenders, 1);
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
