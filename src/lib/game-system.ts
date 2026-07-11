import "server-only";
import { randomInt } from "node:crypto";
import { database } from "@/lib/db";
import { accrueResources, previewResources } from "@/lib/economy";
import { buildingsByRace, creepXp, heroStats, researchDefs, towerStats, unitsByRace, xpForNextLevel, CREEP_XP_SOFTCAP_FACTOR, CREEP_XP_SOFTCAP_LEVEL, HERO_KILL_XP, UNIT_KILL_XP, type ResearchKey } from "@/lib/game-data";
import { simulateBattle, type Fighter } from "@/lib/combat";
import type { Race } from "@/lib/auth";
import { ensureHomeTile } from "@/lib/world";
import { createSystemMessage } from "@/lib/messages";

function fieldLabel(x: number, y: number) {
  return `${y + 1}-${x + 1}`;
}

export function researchLevel(userId: number, key: ResearchKey) {
  return (database.prepare("SELECT level FROM research_levels WHERE user_id=? AND research_key=?").get(userId, key) as { level: number } | undefined)?.level ?? 0;
}

function formatUnitsForReport(race: Race, units: { unit_key: string; quantity: number }[]) {
  return units.map((unit) => {
    const def = unitsByRace[race].find((entry) => entry.key === unit.unit_key);
    return `${unit.quantity}x ${def?.name ?? unit.unit_key}`;
  }).join(", ");
}

const roll = ([min, max]: [number, number]) => randomInt(min, max + 1);

// Research adds +1 damage/defense per level to melee and ranged units.
function researchBonuses(userId: number, role: string) {
  if (role !== "melee" && role !== "ranged") return { damage: 0, defense: 0 };
  return { damage: researchLevel(userId, `${role}_damage` as ResearchKey), defense: researchLevel(userId, `${role}_defense` as ResearchKey) };
}

function unitFighters(owner: number, race: Race, unitKey: string, quantity: number): Fighter[] {
  const def = unitsByRace[race].find((entry) => entry.key === unitKey);
  if (!def) return [];
  const bonus = researchBonuses(owner, def.role);
  return Array.from({ length: quantity }, () => ({ key: unitKey, owner, siege: def.role === "siege", damageMin: def.damage[0], damageMax: def.damage[1], damageBonus: bonus.damage, hp: roll(def.defense) + bonus.defense }));
}

function heroFighter(owner: number, heroKey: string, level: number): Fighter {
  const stats = heroStats(level);
  return { key: heroKey, owner, hero: true, damageMin: stats.damage[0], damageMax: stats.damage[1], damageBonus: 0, hp: roll(stats.defense) };
}

// Groups fallen fighters into a readable report line, resolving unit names via
// each owner's race so orc losses are not labelled with human unit names.
function describeLosses(losses: Fighter[], raceByOwner: Map<number, Race>) {
  if (losses.length === 0) return "keine";
  const counts = new Map<string, number>();
  for (const fighter of losses) {
    const race = fighter.owner !== null ? raceByOwner.get(fighter.owner) : undefined;
    const label = fighter.key === "creep" ? "Feldwache" : fighter.tower ? "Turm" : (race && unitsByRace[race].find((entry) => entry.key === fighter.key)?.name) || fighter.key;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => `${count}x ${label}`).join(", ");
}

// Every participating hero receives an equal share of the battle's kill XP.
// Creep XP is soft-capped per hero level; kills of player units and heroes
// always pay in full. Level-ups are applied immediately.
function awardHeroXp(heroes: { owner: number; heroKey: string }[], opposingLosses: Fighter[], fieldType: string) {
  if (heroes.length === 0) return;
  let creepTotal = 0;
  let killTotal = 0;
  for (const loss of opposingLosses) {
    if (loss.key === "creep") creepTotal += creepXp[fieldType as keyof typeof creepXp] ?? creepXp.small;
    else if (loss.hero) killTotal += HERO_KILL_XP;
    else killTotal += UNIT_KILL_XP;
  }
  for (const hero of heroes) {
    const row = database.prepare("SELECT level,xp FROM hero_units WHERE user_id=? AND hero_key=?").get(hero.owner, hero.heroKey) as { level: number; xp: number } | undefined;
    if (!row) continue;
    const creepShare = row.level >= CREEP_XP_SOFTCAP_LEVEL ? creepTotal * CREEP_XP_SOFTCAP_FACTOR : creepTotal;
    const gained = Math.floor((creepShare + killTotal) / heroes.length);
    if (gained <= 0) continue;
    let level = row.level;
    let xp = row.xp + gained;
    while (xp >= xpForNextLevel(level)) {
      xp -= xpForNextLevel(level);
      level += 1;
    }
    database.prepare("UPDATE hero_units SET level=?, xp=? WHERE user_id=? AND hero_key=?").run(level, xp, hero.owner, hero.heroKey);
  }
}

function heroHomeOf(userId: number) {
  return database.prepare("SELECT x,y FROM world_tiles WHERE owner_user_id=? AND is_main_village=1").get(userId) as { x: number; y: number } | undefined;
}
export function processGameJobs(userId: number, race: Race) {
  const now = new Date().toISOString();
  const home = ensureHomeTile(userId);
  const builds = database.prepare("SELECT id,building_key,job_type FROM build_jobs WHERE user_id=? AND finishes_at<=?").all(userId, now) as { id: number; building_key: string; job_type: string }[];
  for (const job of builds) {
    if (job.job_type === "build") {
      const completed = database.prepare("INSERT OR IGNORE INTO player_buildings(user_id,building_key) VALUES(?,?)").run(userId, job.building_key);
      if (job.building_key === "food" && completed.changes === 1) database.prepare("UPDATE users SET food_capacity=food_capacity+10 WHERE id=?").run(userId);
    }
    else if (job.job_type === "food") database.prepare("UPDATE users SET food_capacity=food_capacity+10 WHERE id=?").run(userId);
    else if (job.job_type === "queue") database.prepare("UPDATE player_buildings SET queue_slots=queue_slots+1 WHERE user_id=? AND building_key=?").run(userId, job.building_key);
    else database.prepare("UPDATE player_buildings SET upgrade_level=upgrade_level+1 WHERE user_id=? AND building_key=?").run(userId, job.building_key);
    database.prepare("DELETE FROM build_jobs WHERE id=?").run(job.id);
  }
  const towerJobs = database.prepare("SELECT id,target_x,target_y FROM tower_jobs WHERE user_id=? AND finishes_at<=?").all(userId, now) as { id: number; target_x: number; target_y: number }[];
  for (const job of towerJobs) {
    database.prepare("UPDATE world_tiles SET tower_count=tower_count+1 WHERE x=? AND y=? AND is_main_village=0 AND tower_count<5 AND (owner_user_id=? OR conquered_by_user_id=?)").run(job.target_x, job.target_y, userId, userId);
    database.prepare("DELETE FROM tower_jobs WHERE id=?").run(job.id);
  }  const units = database.prepare("SELECT id,unit_key,quantity FROM unit_jobs WHERE user_id=? AND finishes_at<=?").all(userId, now) as { id: number; unit_key: string; quantity: number }[];
  for (const job of units) {
    const def = unitsByRace[race].find((u) => u.key === job.unit_key);
    if (def?.worker) database.prepare("UPDATE users SET total_workers=total_workers+? WHERE id=?").run(job.quantity, userId);
    else if (def?.role === "hero") database.prepare("INSERT INTO hero_units(user_id,hero_key,level,alive,updated_at,x,y) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,hero_key) DO UPDATE SET alive=1, updated_at=excluded.updated_at, x=excluded.x, y=excluded.y").run(userId, job.unit_key, 1, 1, now, home.x, home.y);
    else database.prepare("INSERT INTO unit_stacks(user_id,unit_key,x,y,quantity) VALUES(?,?,?,?,?) ON CONFLICT(user_id,unit_key,x,y) DO UPDATE SET quantity=quantity+excluded.quantity").run(userId, job.unit_key, home.x, home.y, job.quantity);
    database.prepare("DELETE FROM unit_jobs WHERE id=?").run(job.id);
  }
  const research = database.prepare("SELECT id,research_key FROM research_jobs WHERE user_id=? AND finishes_at<=?").all(userId, now) as { id: number; research_key: string }[];
  for (const job of research) {
    database.prepare("INSERT INTO research_levels(user_id,research_key,level) VALUES(?,?,1) ON CONFLICT(user_id,research_key) DO UPDATE SET level=level+1").run(userId, job.research_key);
    database.prepare("DELETE FROM research_jobs WHERE id=?").run(job.id);
  }
  const marches = database.prepare("SELECT id,target_x,target_y,units FROM army_marches WHERE user_id=? AND arrives_at<=?").all(userId, now) as { id: number; target_x: number; target_y: number; units: string }[];
  for (const march of marches) {
    const units = JSON.parse(march.units) as { unit_key: string; quantity: number; hero?: boolean }[];
    const target = database.prepare("SELECT owner_user_id,conquered_by_user_id,gold_reward,field_type,tower_count,creeps FROM world_tiles WHERE x=? AND y=?").get(march.target_x, march.target_y) as { owner_user_id: number | null; conquered_by_user_id: number | null; gold_reward: number; field_type: string; tower_count: number; creeps: string | null } | undefined;
    const targetName = fieldLabel(march.target_x, march.target_y);
    const unitSummary = formatUnitsForReport(race, units);
    database.exec("BEGIN IMMEDIATE");
    try {
      if (target) {
        const friendly = target.owner_user_id === userId || target.conquered_by_user_id === userId;
        const defenderId = target.conquered_by_user_id ?? target.owner_user_id;
        if (friendly) {
          createSystemMessage(userId, `Truppen auf ${targetName} angekommen`, `Deine Truppen sind auf Feld ${targetName} angekommen.\nEinheiten: ${unitSummary}`);
          for (const u of units) {
            if (u.hero) database.prepare("UPDATE hero_units SET x=?, y=?, updated_at=? WHERE user_id=? AND hero_key=?").run(march.target_x, march.target_y, now, userId, u.unit_key);
            else database.prepare("INSERT INTO unit_stacks(user_id,unit_key,x,y,quantity) VALUES(?,?,?,?,?) ON CONFLICT(user_id,unit_key,x,y) DO UPDATE SET quantity=quantity+excluded.quantity").run(userId, u.unit_key, march.target_x, march.target_y, u.quantity);
          }
        } else {
          // Attacker force: marching units and heroes, defense rolled per battle.
          const raceByOwner = new Map<number, Race>([[userId, race]]);
          const attackers: Fighter[] = [];
          const attackerHeroes: { owner: number; heroKey: string }[] = [];
          for (const u of units) {
            if (u.hero) {
              const hero = database.prepare("SELECT level FROM hero_units WHERE user_id=? AND hero_key=?").get(userId, u.unit_key) as { level: number } | undefined;
              attackers.push(heroFighter(userId, u.unit_key, hero?.level ?? 1));
              attackerHeroes.push({ owner: userId, heroKey: u.unit_key });
            } else attackers.push(...unitFighters(userId, race, u.unit_key, u.quantity));
          }

          // Defender force: fixed creeps on neutral fields, otherwise the
          // owner's stationed units, heroes and towers.
          const defenders: Fighter[] = [];
          if (!defenderId && target.creeps) {
            for (const creep of JSON.parse(target.creeps) as { damage: number; defense: number }[]) {
              defenders.push({ key: "creep", owner: null, damageMin: creep.damage, damageMax: creep.damage, damageBonus: 0, hp: creep.defense });
            }
          }
          const enemyStacks = database.prepare("SELECT s.user_id,s.unit_key,s.quantity,u.race FROM unit_stacks s JOIN users u ON u.id=s.user_id WHERE s.x=? AND s.y=? AND s.user_id<>? AND s.quantity>0").all(march.target_x, march.target_y, userId) as { user_id: number; unit_key: string; quantity: number; race: Race | null }[];
          for (const stack of enemyStacks) {
            const ownerRace = stack.race ?? "human";
            raceByOwner.set(stack.user_id, ownerRace);
            defenders.push(...unitFighters(stack.user_id, ownerRace, stack.unit_key, stack.quantity));
          }
          const defenderHeroes = database.prepare("SELECT h.user_id,h.hero_key,h.level,u.race FROM hero_units h JOIN users u ON u.id=h.user_id WHERE h.x=? AND h.y=? AND h.alive=1 AND h.user_id<>?").all(march.target_x, march.target_y, userId) as { user_id: number; hero_key: string; level: number; race: Race | null }[];
          for (const hero of defenderHeroes) {
            raceByOwner.set(hero.user_id, hero.race ?? "human");
            defenders.push(heroFighter(hero.user_id, hero.hero_key, hero.level));
          }
          for (let index = 0; index < target.tower_count; index += 1) {
            defenders.push({ key: "tower", owner: defenderId, tower: true, damageMin: towerStats.damage[0], damageMax: towerStats.damage[1], damageBonus: 0, hp: roll(towerStats.defense) });
          }

          const result = simulateBattle(attackers, defenders);

          // Both sides' heroes learn from the kills their side scored, even if
          // they fell — XP and levels survive death and revival.
          awardHeroXp(attackerHeroes, result.defenderLosses, target.field_type);
          awardHeroXp(defenderHeroes.map((hero) => ({ owner: hero.user_id, heroKey: hero.hero_key })), result.attackerLosses, target.field_type);

          const attackerLossReport = describeLosses(result.attackerLosses, raceByOwner);
          const defenderLossReport = describeLosses(result.defenderLosses, raceByOwner);
          const deadAttackerHeroKeys = new Set(result.attackerLosses.filter((fighter) => fighter.hero).map((fighter) => fighter.key));
          for (const heroKey of deadAttackerHeroKeys) database.prepare("UPDATE hero_units SET alive=0, x=?, y=?, updated_at=? WHERE user_id=? AND hero_key=?").run(home.x, home.y, now, userId, heroKey);

          if (result.attackerWon) {
            // The defense is wiped out: conquered fields lose their towers
            // (mines grant the conqueror one fresh tower) and their creeps.
            database.prepare("DELETE FROM unit_stacks WHERE x=? AND y=? AND user_id<>?").run(march.target_x, march.target_y, userId);
            for (const hero of defenderHeroes) {
              const heroHome = heroHomeOf(hero.user_id);
              database.prepare("UPDATE hero_units SET alive=0, x=?, y=?, updated_at=? WHERE user_id=? AND hero_key=?").run(heroHome?.x ?? null, heroHome?.y ?? null, now, hero.user_id, hero.hero_key);
            }
            database.prepare("UPDATE world_tiles SET conquered_by_user_id=?,monster_count=0,gold_reward=0,creeps=NULL,tower_count=CASE WHEN field_type='goldmine' THEN 1 ELSE 0 END WHERE x=? AND y=?").run(userId, march.target_x, march.target_y);
            if (target.gold_reward > 0) database.prepare("UPDATE users SET gold=gold+? WHERE id=?").run(target.gold_reward, userId);

            const survivorCounts = new Map<string, number>();
            for (const fighter of result.attackerSurvivors) {
              if (fighter.hero) database.prepare("UPDATE hero_units SET x=?, y=?, updated_at=? WHERE user_id=? AND hero_key=?").run(march.target_x, march.target_y, now, userId, fighter.key);
              else survivorCounts.set(fighter.key, (survivorCounts.get(fighter.key) ?? 0) + 1);
            }
            for (const [unitKey, quantity] of survivorCounts) {
              database.prepare("INSERT INTO unit_stacks(user_id,unit_key,x,y,quantity) VALUES(?,?,?,?,?) ON CONFLICT(user_id,unit_key,x,y) DO UPDATE SET quantity=quantity+excluded.quantity").run(userId, unitKey, march.target_x, march.target_y, quantity);
            }

            createSystemMessage(userId, `Angriff auf ${targetName} gewonnen`, `Deine Truppen haben Feld ${targetName} nach ${result.rounds} Runden eingenommen.\nEingesetzt: ${unitSummary}\nEigene Verluste: ${attackerLossReport}\nGegner vernichtet: ${defenderLossReport}\nGold erbeutet: ${target.gold_reward}`);
            if (defenderId && defenderId !== userId) createSystemMessage(defenderId, `Feld ${targetName} verloren`, `Ein Angriff auf Feld ${targetName} war erfolgreich.\nDeine Verluste: ${defenderLossReport}\nAngreifer verloren: ${attackerLossReport}\nDas Feld wurde vom Angreifer eingenommen.`);
          } else {
            // The attack failed: the whole attacking force is gone, defenders
            // keep their survivors. Creeps on neutral fields recover fully.
            const stackLosses = new Map<string, { owner: number; unitKey: string; count: number }>();
            let towersLost = 0;
            for (const fighter of result.defenderLosses) {
              if (fighter.key === "creep") continue;
              if (fighter.tower) towersLost += 1;
              else if (fighter.hero && fighter.owner !== null) {
                const heroHome = heroHomeOf(fighter.owner);
                database.prepare("UPDATE hero_units SET alive=0, x=?, y=?, updated_at=? WHERE user_id=? AND hero_key=?").run(heroHome?.x ?? null, heroHome?.y ?? null, now, fighter.owner, fighter.key);
              } else if (fighter.owner !== null) {
                const lossKey = `${fighter.owner}:${fighter.key}`;
                const entry = stackLosses.get(lossKey) ?? { owner: fighter.owner, unitKey: fighter.key, count: 0 };
                entry.count += 1;
                stackLosses.set(lossKey, entry);
              }
            }
            for (const loss of stackLosses.values()) {
              database.prepare("UPDATE unit_stacks SET quantity=MAX(quantity-?,0) WHERE user_id=? AND unit_key=? AND x=? AND y=?").run(loss.count, loss.owner, loss.unitKey, march.target_x, march.target_y);
            }
            database.prepare("DELETE FROM unit_stacks WHERE quantity<=0").run();
            if (towersLost > 0) database.prepare("UPDATE world_tiles SET tower_count=MAX(tower_count-?,0) WHERE x=? AND y=?").run(towersLost, march.target_x, march.target_y);

            createSystemMessage(userId, `Angriff auf ${targetName} verloren`, `Dein Angriff auf Feld ${targetName} wurde nach ${result.rounds} Runden abgewehrt.\nVerlorene Einheiten: ${unitSummary}\nGegner vernichtet: ${defenderLossReport}\nGold erbeutet: 0`);
            if (defenderId && defenderId !== userId) createSystemMessage(defenderId, `Angriff auf ${targetName} abgewehrt`, `Ein Angriff auf dein Feld ${targetName} wurde abgewehrt.\nAngreifer vernichtet: ${attackerLossReport}\nDeine Verluste: ${defenderLossReport}`);
          }
        }
      } else {
        for (const u of units) if (u.hero) database.prepare("UPDATE hero_units SET alive=0, x=?, y=?, updated_at=? WHERE user_id=? AND hero_key=?").run(home.x, home.y, now, userId, u.unit_key);
        createSystemMessage(userId, `Marsch auf ${targetName} beendet`, `Das Ziel ${targetName} konnte nicht mehr gefunden werden.\nVerlorene Einheiten: ${unitSummary}`);
      }
      database.prepare("DELETE FROM army_marches WHERE id=?").run(march.id);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
  database.prepare("INSERT OR IGNORE INTO player_buildings(user_id,building_key) VALUES(?,'main')").run(userId);
}

export function getGameState(userId: number, race: Race, options?: { persist?: boolean }) {
  processGameJobs(userId, race);
  const economy = options?.persist === false ? previewResources(userId) : accrueResources(userId);
  const profile = database.prepare("SELECT food_capacity FROM users WHERE id=?").get(userId) as { food_capacity: number };
  const buildings = database.prepare("SELECT building_key,queue_slots,upgrade_level FROM player_buildings WHERE user_id=?").all(userId) as { building_key: string; queue_slots: number; upgrade_level: number }[];
  const buildJobs = database.prepare("SELECT id,building_key,job_type,finishes_at FROM build_jobs WHERE user_id=? ORDER BY finishes_at").all(userId) as { id: number; building_key: string; job_type: string; finishes_at: string }[];
  const stacks = database.prepare("SELECT s.unit_key,s.x,s.y,s.quantity,wt.field_type,wt.is_main_village FROM unit_stacks s LEFT JOIN world_tiles wt ON wt.x=s.x AND wt.y=s.y WHERE s.user_id=? AND s.quantity>0").all(userId) as { unit_key: string; x: number; y: number; quantity: number; field_type: string | null; is_main_village: number | null }[];
  const unitJobs = database.prepare("SELECT id,building_key,unit_key,quantity,finishes_at FROM unit_jobs WHERE user_id=? ORDER BY finishes_at").all(userId) as { id: number; building_key: string; unit_key: string; quantity: number; finishes_at: string }[];
  const heroUnits = database.prepare("SELECT h.hero_key,h.level,h.xp,h.alive,h.updated_at,h.x,h.y,h.item_towers,h.item_teleports,wt.field_type,wt.is_main_village FROM hero_units h LEFT JOIN world_tiles wt ON wt.x=h.x AND wt.y=h.y WHERE h.user_id=?").all(userId) as { hero_key: string; level: number; xp: number; alive: number; updated_at: string; x: number | null; y: number | null; item_towers: number; item_teleports: number; field_type: string | null; is_main_village: number | null }[];
  const towerJobs = database.prepare("SELECT id,target_x,target_y,finishes_at FROM tower_jobs WHERE user_id=? ORDER BY finishes_at").all(userId) as { id: number; target_x: number; target_y: number; finishes_at: string }[];
  const marchRows = database.prepare("SELECT m.id,m.source_x,m.source_y,m.target_x,m.target_y,m.units,m.friendly,m.arrives_at,wt.field_type,wt.is_main_village,COALESCE(v.display_name,f.display_name) AS owner_name FROM army_marches m LEFT JOIN world_tiles wt ON wt.x=m.target_x AND wt.y=m.target_y LEFT JOIN users v ON v.id=wt.owner_user_id LEFT JOIN users f ON f.id=wt.conquered_by_user_id WHERE m.user_id=? ORDER BY m.arrives_at").all(userId) as { id: number; source_x: number; source_y: number; target_x: number; target_y: number; units: string; friendly: number; arrives_at: string; field_type: string; is_main_village: number; owner_name: string | null }[];
  const marches = marchRows.map((row) => ({ id: row.id, sourceX: row.source_x, sourceY: row.source_y, targetX: row.target_x, targetY: row.target_y, friendly: row.friendly === 1, arrivesAt: row.arrives_at, fieldType: row.field_type, isMainVillage: row.is_main_village === 1, ownerName: row.owner_name, units: JSON.parse(row.units) as { unit_key: string; quantity: number }[] }));
  const researchJobs = database.prepare("SELECT id,research_key,finishes_at FROM research_jobs WHERE user_id=? ORDER BY finishes_at").all(userId) as { id: number; research_key: string; finishes_at: string }[];
  const researchLevels = Object.fromEntries(researchDefs.map((def) => [def.key, researchLevel(userId, def.key)])) as Record<ResearchKey, number>;
  const unitSupply = stacks.reduce((sum, s) => sum + (unitsByRace[race].find((u) => u.key === s.unit_key)?.supply ?? 0) * s.quantity, 0);
  const pendingSupply = unitJobs.reduce((sum, j) => sum + (unitsByRace[race].find((u) => u.key === j.unit_key)?.supply ?? 0) * j.quantity, 0);
  return { economy, buildings, buildJobs, towerJobs, stacks, unitJobs, heroUnits, marches, researchJobs, researchLevels, foodCapacity: profile.food_capacity, supplyUsed: economy.totalWorkers + unitSupply + pendingSupply, busyWorkers: buildJobs.filter((j) => j.job_type === "build").length + towerJobs.length, buildingDefs: buildingsByRace[race], unitDefs: unitsByRace[race] };
}





