import "server-only";
import { database } from "@/lib/db";
import { accrueResources, previewResources } from "@/lib/economy";
import { buildingsByRace, unitsByRace } from "@/lib/game-data";
import type { Race } from "@/lib/auth";
import { ensureHomeTile } from "@/lib/world";

export function processGameJobs(userId: number, race: Race) {
  const now = new Date().toISOString();
  const home = ensureHomeTile(userId);
  const builds = database.prepare("SELECT id,building_key,job_type FROM build_jobs WHERE user_id=? AND finishes_at<=?").all(userId, now) as { id: number; building_key: string; job_type: string }[];
  for (const job of builds) {
    if (job.job_type === "build") database.prepare("INSERT OR IGNORE INTO player_buildings(user_id,building_key) VALUES(?,?)").run(userId, job.building_key);
    else if (job.job_type === "food") database.prepare("UPDATE users SET food_capacity=food_capacity+10 WHERE id=?").run(userId);
    else if (job.job_type === "queue") database.prepare("UPDATE player_buildings SET queue_slots=queue_slots+1 WHERE user_id=? AND building_key=?").run(userId, job.building_key);
    else database.prepare("UPDATE player_buildings SET upgrade_level=upgrade_level+1 WHERE user_id=? AND building_key=?").run(userId, job.building_key);
    database.prepare("DELETE FROM build_jobs WHERE id=?").run(job.id);
  }
  const units = database.prepare("SELECT id,unit_key,quantity FROM unit_jobs WHERE user_id=? AND finishes_at<=?").all(userId, now) as { id: number; unit_key: string; quantity: number }[];
  for (const job of units) {
    const def = unitsByRace[race].find((u) => u.key === job.unit_key);
    if (def?.worker) database.prepare("UPDATE users SET total_workers=total_workers+? WHERE id=?").run(job.quantity, userId);
    else if (def?.role === "hero") database.prepare("INSERT INTO hero_units(user_id,hero_key,level,alive,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,hero_key) DO UPDATE SET alive=1, updated_at=excluded.updated_at").run(userId, job.unit_key, 1, 1, now);
    else database.prepare("INSERT INTO unit_stacks(user_id,unit_key,x,y,quantity) VALUES(?,?,?,?,?) ON CONFLICT(user_id,unit_key,x,y) DO UPDATE SET quantity=quantity+excluded.quantity").run(userId, job.unit_key, home.x, home.y, job.quantity);
    database.prepare("DELETE FROM unit_jobs WHERE id=?").run(job.id);
  }
  const marches = database.prepare("SELECT id,target_x,target_y,units FROM army_marches WHERE user_id=? AND arrives_at<=?").all(userId, now) as { id: number; target_x: number; target_y: number; units: string }[];
  for (const march of marches) {
    const units = JSON.parse(march.units) as { unit_key: string; quantity: number }[];
    const target = database.prepare("SELECT owner_user_id,conquered_by_user_id,monster_count,gold_reward FROM world_tiles WHERE x=? AND y=?").get(march.target_x, march.target_y) as { owner_user_id: number | null; conquered_by_user_id: number | null; monster_count: number; gold_reward: number } | undefined;
    database.exec("BEGIN IMMEDIATE");
    try {
      if (target) {
        const friendly = target.owner_user_id === userId || target.conquered_by_user_id === userId;
        const attackPower = units.reduce((sum, u) => sum + u.quantity * Math.max(1, unitsByRace[race].find((d) => d.key === u.unit_key)?.supply ?? 1), 0);
        const enemy = database.prepare("SELECT COALESCE(SUM(quantity),0) quantity FROM unit_stacks WHERE x=? AND y=? AND user_id<>?").get(march.target_x, march.target_y, userId) as { quantity: number };
        const victory = friendly || attackPower >= target.monster_count + enemy.quantity * 2;
        if (victory) {
          if (!friendly) {
            database.prepare("DELETE FROM unit_stacks WHERE x=? AND y=? AND user_id<>?").run(march.target_x, march.target_y, userId);
            database.prepare("UPDATE world_tiles SET conquered_by_user_id=?,monster_count=0,gold_reward=0 WHERE x=? AND y=?").run(userId, march.target_x, march.target_y);
            if (target.gold_reward > 0) database.prepare("UPDATE users SET gold=gold+? WHERE id=?").run(target.gold_reward, userId);
          }
          for (const u of units) database.prepare("INSERT INTO unit_stacks(user_id,unit_key,x,y,quantity) VALUES(?,?,?,?,?) ON CONFLICT(user_id,unit_key,x,y) DO UPDATE SET quantity=quantity+excluded.quantity").run(userId, u.unit_key, march.target_x, march.target_y, u.quantity);
        }
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
  const stacks = database.prepare("SELECT unit_key,x,y,quantity FROM unit_stacks WHERE user_id=? AND quantity>0").all(userId) as { unit_key: string; x: number; y: number; quantity: number }[];
  const unitJobs = database.prepare("SELECT id,building_key,unit_key,quantity,finishes_at FROM unit_jobs WHERE user_id=? ORDER BY finishes_at").all(userId) as { id: number; building_key: string; unit_key: string; quantity: number; finishes_at: string }[];
  const heroUnits = database.prepare("SELECT hero_key,level,alive,updated_at FROM hero_units WHERE user_id=?").all(userId) as { hero_key: string; level: number; alive: number; updated_at: string }[];
  const marchRows = database.prepare("SELECT m.id,m.source_x,m.source_y,m.target_x,m.target_y,m.units,m.friendly,m.arrives_at,wt.field_type,wt.is_main_village,COALESCE(v.display_name,f.display_name) AS owner_name FROM army_marches m LEFT JOIN world_tiles wt ON wt.x=m.target_x AND wt.y=m.target_y LEFT JOIN users v ON v.id=wt.owner_user_id LEFT JOIN users f ON f.id=wt.conquered_by_user_id WHERE m.user_id=? ORDER BY m.arrives_at").all(userId) as { id: number; source_x: number; source_y: number; target_x: number; target_y: number; units: string; friendly: number; arrives_at: string; field_type: string; is_main_village: number; owner_name: string | null }[];
  const marches = marchRows.map((row) => ({ id: row.id, sourceX: row.source_x, sourceY: row.source_y, targetX: row.target_x, targetY: row.target_y, friendly: row.friendly === 1, arrivesAt: row.arrives_at, fieldType: row.field_type, isMainVillage: row.is_main_village === 1, ownerName: row.owner_name, units: JSON.parse(row.units) as { unit_key: string; quantity: number }[] }));
  const unitSupply = stacks.reduce((sum, s) => sum + (unitsByRace[race].find((u) => u.key === s.unit_key)?.supply ?? 0) * s.quantity, 0);
  const pendingSupply = unitJobs.reduce((sum, j) => sum + (unitsByRace[race].find((u) => u.key === j.unit_key)?.supply ?? 0) * j.quantity, 0);
  return { economy, buildings, buildJobs, stacks, unitJobs, heroUnits, marches, foodCapacity: profile.food_capacity, supplyUsed: economy.totalWorkers + unitSupply + pendingSupply, busyWorkers: buildJobs.filter((j) => j.job_type === "build").length, buildingDefs: buildingsByRace[race], unitDefs: unitsByRace[race] };
}

