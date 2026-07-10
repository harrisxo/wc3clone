"use server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { database } from "@/lib/db";
import { getGameState } from "@/lib/game-system";
import { buildingUpgradeCost, foodBuildingCost, queueUpgradeCost } from "@/lib/costs";

function safeView(value: FormDataEntryValue | null, fallback: string) {
  const s = String(value ?? "");
  return /^[a-z]+$/.test(s) ? s : fallback;
}

function isHeroUnit(def: { role?: string; unique?: boolean } | undefined) {
  return Boolean(def && (def.role === "hero" || def.unique));
}

function heroReviveCost(level: number) {
  const base = 1;
  const step = 1;
  return { gold: base + level * step, wood: base + level * step, seconds: 180 + level * 60 };
}

export async function startBuild(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.race) redirect("/");
  const key = String(formData.get("building"));
  const mode = String(formData.get("mode") || "build");
  const returnView = safeView(formData.get("returnView"), "bauen");
  const state = getGameState(user.id, user.race);
  const def = state.buildingDefs.find((b) => b.key === key);
  if (!def || (def.kind === "main" && mode !== "queue")) redirect(`/game?view=${returnView}&notice=invalid`);
  const owned = state.buildings.find((b) => b.building_key === key);
  const active = state.buildJobs.filter((j) => j.building_key === key).length;
  let gold = def.gold,
    wood = def.wood,
    seconds = def.seconds,
    jobType = "build";
  if (mode === "food" && owned && def.kind === "food") {
    ({ gold, wood, seconds } = foodBuildingCost(state.foodCapacity));
    jobType = "food";
  } else if (mode === "queue" && owned) {
    ({ gold, wood, seconds } = queueUpgradeCost(owned.queue_slots));
    jobType = "queue";
  } else if (mode === "upgrade" && owned) {
    ({ gold, wood, seconds } = buildingUpgradeCost(owned.upgrade_level));
    jobType = "upgrade";
  } else if (owned || state.buildJobs.some((j) => j.building_key === key && j.job_type === "build")) redirect(`/game?view=${returnView}`);
  if (owned && active >= owned.queue_slots) redirect(`/game?view=${returnView}`);
  const idle = state.economy.totalWorkers - state.economy.goldWorkers - state.economy.woodWorkers - state.busyWorkers;
  if (jobType === "build" && idle < 1) redirect(`/game?view=${returnView}&notice=worker`);
  if (state.economy.gold < gold || state.economy.wood < wood) redirect(`/game?view=${returnView}&notice=resources`);
  const deduction = database.prepare("UPDATE users SET gold=gold-?,wood=wood-? WHERE id=? AND gold>=? AND wood>=?").run(gold, wood, user.id, gold, wood);
  if (deduction.changes !== 1) redirect(`/game?view=${returnView}&notice=resources`);
  database.prepare("INSERT INTO build_jobs(user_id,building_key,job_type,finishes_at) VALUES(?,?,?,?)").run(user.id, key, jobType, new Date(Date.now() + seconds * 1000).toISOString());
  redirect(`/game?view=${returnView}`);
}

export async function trainUnit(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.race) redirect("/");
  const key = String(formData.get("unit"));
  const state = getGameState(user.id, user.race);
  const def = state.unitDefs.find((u) => u.key === key);
  const returnView = safeView(formData.get("returnView"), def?.building ?? "main");
  if (!def) redirect(`/game?view=${returnView}&notice=invalid`);

  const building = state.buildings.find((b) => b.building_key === def.building);
  if (!building) redirect(`/game?view=${returnView}&notice=building`);
  const active = state.unitJobs.filter((j) => j.building_key === def.building).length;
  if (active >= building.queue_slots) redirect(`/game?view=${returnView}&notice=queue`);

  let quantity = 1;
  let unitCost = { gold: def.gold, wood: def.wood, seconds: def.seconds };

  if (isHeroUnit(def)) {
    const hero = database.prepare("SELECT level,alive FROM hero_units WHERE user_id=? AND hero_key=?").get(user.id, key) as { level: number; alive: number } | undefined;
    if (hero?.alive === 1) redirect(`/game?view=${returnView}&notice=built`);
    if (state.unitJobs.some((j) => j.unit_key === key)) redirect(`/game?view=${returnView}&notice=queue`);
    if (hero) unitCost = heroReviveCost(hero.level);
  } else {
    const requestedQuantity = Math.floor(Number(formData.get("quantity")));
    quantity = Number.isFinite(requestedQuantity) ? Math.min(999, Math.max(1, requestedQuantity)) : 1;
  }

  const totalGold = unitCost.gold * quantity;
  const totalWood = unitCost.wood * quantity;
  const totalSeconds = unitCost.seconds * quantity;
  if (state.supplyUsed + def.supply * quantity > state.foodCapacity) redirect(`/game?view=${returnView}&notice=food`);
  if (state.economy.gold < totalGold || state.economy.wood < totalWood) redirect(`/game?view=${returnView}&notice=resources`);
  const deduction = database.prepare("UPDATE users SET gold=gold-?,wood=wood-? WHERE id=? AND gold>=? AND wood>=?").run(totalGold, totalWood, user.id, totalGold, totalWood);
  if (deduction.changes !== 1) redirect(`/game?view=${returnView}&notice=resources`);
  database.prepare("INSERT INTO unit_jobs(user_id,building_key,unit_key,quantity,finishes_at) VALUES(?,?,?,?,?)").run(user.id, def.building, key, quantity, new Date(Date.now() + totalSeconds * 1000).toISOString());
  redirect(`/game?view=${returnView}`);
}

export async function cancelJob(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.race) redirect("/");
  const jobId = Number(formData.get("jobId"));
  const jobType = String(formData.get("jobType"));
  const returnView = safeView(formData.get("returnView"), "bauen");

  if (Number.isNaN(jobId) || (jobType !== "build" && jobType !== "unit")) {
    redirect(`/game?view=${returnView}&notice=invalid`);
  }

  getGameState(user.id, user.race);

  if (jobType === "build") {
    database.prepare("DELETE FROM build_jobs WHERE id = ? AND user_id = ?").run(jobId, user.id);
  } else {
    database.prepare("DELETE FROM unit_jobs WHERE id = ? AND user_id = ?").run(jobId, user.id);
  }

  redirect(`/game?view=${returnView}`);
}
function parseCoordinate(value: FormDataEntryValue | null) {
  const match = /^(\d+)-(\d+)$/.exec(String(value ?? ""));
  if (!match) return null;
  return { y: Number(match[1]) - 1, x: Number(match[2]) - 1 };
}

export async function executeArmyCommand(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.race) redirect("/");
  const source = parseCoordinate(formData.get("source"));
  const target = parseCoordinate(formData.get("target"));
  if (!source || !target || (source.x === target.x && source.y === target.y)) redirect("/game?view=karte&notice=invalid");
  const sourceTile = database.prepare("SELECT owner_user_id,conquered_by_user_id FROM world_tiles WHERE x=? AND y=?").get(source.x, source.y) as { owner_user_id: number | null; conquered_by_user_id: number | null } | undefined;
  const targetTile = database.prepare("SELECT owner_user_id,conquered_by_user_id,is_main_village,monster_count,gold_reward FROM world_tiles WHERE x=? AND y=?").get(target.x, target.y) as { owner_user_id: number | null; conquered_by_user_id: number | null; is_main_village: number; monster_count: number; gold_reward: number } | undefined;
  if (!sourceTile || !targetTile || (sourceTile.owner_user_id !== user.id && sourceTile.conquered_by_user_id !== user.id)) redirect("/game?view=karte&notice=invalid");
  if (targetTile.is_main_village === 1 && targetTile.owner_user_id !== user.id) redirect(`/game?view=karte&x=${Math.max(0, target.x - 4)}&field=${target.y + 1}-${target.x + 1}&notice=protected`);

  const definitions = getGameState(user.id, user.race).unitDefs.filter((unit) => !unit.worker && unit.role !== "hero");
  const selected = definitions.map((definition) => {
    const requested = Math.max(0, Math.floor(Number(formData.get(`unit_${definition.key}`)) || 0));
    const stack = database.prepare("SELECT quantity FROM unit_stacks WHERE user_id=? AND unit_key=? AND x=? AND y=?").get(user.id, definition.key, source.x, source.y) as { quantity: number } | undefined;
    return { definition, quantity: Math.min(requested, stack?.quantity ?? 0) };
  }).filter((entry) => entry.quantity > 0);
  if (selected.length === 0) redirect(`/game?view=karte&x=${Math.max(0, source.x - 4)}&from=${source.y + 1}-${source.x + 1}&notice=units`);

  const friendly = targetTile.owner_user_id === user.id || targetTile.conquered_by_user_id === user.id;
  const attackPower = selected.reduce((sum, entry) => sum + entry.quantity * Math.max(1, entry.definition.supply), 0);
  const stationedEnemies = database.prepare("SELECT COALESCE(SUM(quantity),0) quantity FROM unit_stacks WHERE x=? AND y=? AND user_id<>?").get(target.x, target.y, user.id) as { quantity: number };
  const defensePower = targetTile.monster_count + stationedEnemies.quantity * 2;
  const victory = friendly || attackPower >= defensePower;

  database.exec("BEGIN IMMEDIATE");
  try {
    for (const entry of selected) {
      const deduction = database.prepare("UPDATE unit_stacks SET quantity=quantity-? WHERE user_id=? AND unit_key=? AND x=? AND y=? AND quantity>=?").run(entry.quantity, user.id, entry.definition.key, source.x, source.y, entry.quantity);
      if (deduction.changes !== 1) throw new Error("Der Einheitenbestand hat sich ge\u00e4ndert.");
    }
    database.prepare("DELETE FROM unit_stacks WHERE quantity<=0").run();
    if (victory) {
      if (!friendly) {
        database.prepare("DELETE FROM unit_stacks WHERE x=? AND y=? AND user_id<>?").run(target.x, target.y, user.id);
        database.prepare("UPDATE world_tiles SET conquered_by_user_id=?,monster_count=0,gold_reward=0 WHERE x=? AND y=?").run(user.id, target.x, target.y);
        if (targetTile.gold_reward > 0) database.prepare("UPDATE users SET gold=gold+? WHERE id=?").run(targetTile.gold_reward, user.id);
      }
      for (const entry of selected) database.prepare("INSERT INTO unit_stacks(user_id,unit_key,x,y,quantity) VALUES(?,?,?,?,?) ON CONFLICT(user_id,unit_key,x,y) DO UPDATE SET quantity=quantity+excluded.quantity").run(user.id, entry.definition.key, target.x, target.y, entry.quantity);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  const notice = friendly ? "moved" : victory ? "victory" : "defeat";
  redirect(`/game?view=karte&x=${Math.max(0, target.x - 4)}&field=${target.y + 1}-${target.x + 1}&notice=${notice}`);
}

