"use server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { database } from "@/lib/db";
import { getGameState } from "@/lib/game-system";
import { foodBuildingCost, maxQueueSlots, queueUpgradeCost, researchCost } from "@/lib/costs";
import { researchDefs } from "@/lib/game-data";

// Marching time scales with Manhattan distance to the target (seconds per field).
const MARCH_SECONDS_PER_FIELD = 20;

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
  // Defense buildings sell hero items instantly: they have no queues or upgrades.
  if (key === "defense" && mode !== "build") redirect(`/game?view=${returnView}&notice=invalid`);
  // Generic building upgrades were replaced by forge research.
  if (mode === "upgrade") redirect(`/game?view=${returnView}&notice=invalid`);
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
    const pendingQueueJobs = state.buildJobs.filter((j) => j.building_key === key && j.job_type === "queue").length;
    if (owned.queue_slots + pendingQueueJobs >= maxQueueSlots(key)) redirect(`/game?view=${returnView}&notice=invalid`);
    ({ gold, wood, seconds } = queueUpgradeCost(owned.queue_slots));
    jobType = "queue";
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

// Hero inventory: 2 slots (one stack per item kind), combined capacity 6 items.
const HERO_ITEM_CAPACITY = 6;
const heroItemCost = { gold: 1, wood: 1 };

export async function buyHeroItem(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.race) redirect("/");
  const heroKey = String(formData.get("hero"));
  const item = String(formData.get("item"));
  const returnView = safeView(formData.get("returnView"), "defense");
  if (item !== "tower" && item !== "teleport") redirect(`/game?view=${returnView}&notice=invalid`);
  const state = getGameState(user.id, user.race);
  if (!state.buildings.some((b) => b.building_key === "defense")) redirect(`/game?view=${returnView}&notice=building`);
  if (!state.unitDefs.some((u) => u.key === heroKey && u.role === "hero")) redirect(`/game?view=${returnView}&notice=invalid`);

  const home = database.prepare("SELECT x,y FROM world_tiles WHERE owner_user_id=? AND is_main_village=1").get(user.id) as { x: number; y: number } | undefined;
  const hero = state.heroUnits.find((h) => h.hero_key === heroKey);
  if (!home || !hero || hero.alive !== 1 || hero.x !== home.x || hero.y !== home.y) redirect(`/game?view=${returnView}&notice=herohome`);
  if (hero.item_towers + hero.item_teleports >= HERO_ITEM_CAPACITY) redirect(`/game?view=${returnView}&notice=inventory`);
  if (state.economy.gold < heroItemCost.gold || state.economy.wood < heroItemCost.wood) redirect(`/game?view=${returnView}&notice=resources`);

  const deduction = database.prepare("UPDATE users SET gold=gold-?,wood=wood-? WHERE id=? AND gold>=? AND wood>=?").run(heroItemCost.gold, heroItemCost.wood, user.id, heroItemCost.gold, heroItemCost.wood);
  if (deduction.changes !== 1) redirect(`/game?view=${returnView}&notice=resources`);
  const column = item === "tower" ? "item_towers" : "item_teleports";
  const purchase = database.prepare(`UPDATE hero_units SET ${column}=${column}+1 WHERE user_id=? AND hero_key=? AND alive=1 AND item_towers+item_teleports<?`).run(user.id, heroKey, HERO_ITEM_CAPACITY);
  if (purchase.changes !== 1) {
    database.prepare("UPDATE users SET gold=gold+?,wood=wood+? WHERE id=?").run(heroItemCost.gold, heroItemCost.wood, user.id);
    redirect(`/game?view=${returnView}&notice=inventory`);
  }
  redirect(`/game?view=${returnView}`);
}

// Research is queued in the forge; each of the four upgrades levels endlessly,
// but only one job per upgrade may run at a time.
export async function startResearch(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.race) redirect("/");
  const key = String(formData.get("research"));
  const returnView = safeView(formData.get("returnView"), "forge");
  const def = researchDefs.find((entry) => entry.key === key);
  if (!def) redirect(`/game?view=${returnView}&notice=invalid`);

  const state = getGameState(user.id, user.race);
  const forge = state.buildings.find((b) => b.building_key === "forge");
  if (!forge) redirect(`/game?view=${returnView}&notice=building`);
  if (state.researchJobs.some((job) => job.research_key === def.key)) redirect(`/game?view=${returnView}&notice=queue`);
  const occupied = state.researchJobs.length + state.unitJobs.filter((j) => j.building_key === "forge").length + state.buildJobs.filter((j) => j.building_key === "forge").length;
  if (occupied >= forge.queue_slots) redirect(`/game?view=${returnView}&notice=queue`);

  const { gold, wood, seconds } = researchCost(state.researchLevels[def.key]);
  if (state.economy.gold < gold || state.economy.wood < wood) redirect(`/game?view=${returnView}&notice=resources`);
  const deduction = database.prepare("UPDATE users SET gold=gold-?,wood=wood-? WHERE id=? AND gold>=? AND wood>=?").run(gold, wood, user.id, gold, wood);
  if (deduction.changes !== 1) redirect(`/game?view=${returnView}&notice=resources`);
  database.prepare("INSERT INTO research_jobs(user_id,research_key,finishes_at) VALUES(?,?,?)").run(user.id, def.key, new Date(Date.now() + seconds * 1000).toISOString());
  redirect(`/game?view=${returnView}`);
}

export async function cancelJob(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.race) redirect("/");
  const jobId = Number(formData.get("jobId"));
  const jobType = String(formData.get("jobType"));
  const returnView = safeView(formData.get("returnView"), "bauen");

  if (Number.isNaN(jobId) || (jobType !== "build" && jobType !== "unit" && jobType !== "research")) {
    redirect(`/game?view=${returnView}&notice=invalid`);
  }

  getGameState(user.id, user.race);

  if (jobType === "build") {
    database.prepare("DELETE FROM build_jobs WHERE id = ? AND user_id = ?").run(jobId, user.id);
  } else if (jobType === "research") {
    database.prepare("DELETE FROM research_jobs WHERE id = ? AND user_id = ?").run(jobId, user.id);
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
  if (targetTile.is_main_village === 1 && targetTile.owner_user_id !== user.id) redirect(`/game?view=karte&x=${Math.max(0, target.x - 4)}&command=${source.y + 1}-${source.x + 1}&target=${target.y + 1}-${target.x + 1}&field=${target.y + 1}-${target.x + 1}&notice=protected`);

  const definitions = getGameState(user.id, user.race).unitDefs.filter((unit) => !unit.worker);
  const selected = definitions.map((definition) => {
    const requested = Math.max(0, Math.floor(Number(formData.get(`unit_${definition.key}`)) || 0));
    if (definition.role === "hero") {
      const hero = database.prepare("SELECT alive,x,y FROM hero_units WHERE user_id=? AND hero_key=?").get(user.id, definition.key) as { alive: number; x: number | null; y: number | null } | undefined;
      const atSource = hero?.alive === 1 && hero.x === source.x && hero.y === source.y;
      return { definition, quantity: atSource && requested > 0 ? 1 : 0, hero: true };
    }
    const stack = database.prepare("SELECT quantity FROM unit_stacks WHERE user_id=? AND unit_key=? AND x=? AND y=?").get(user.id, definition.key, source.x, source.y) as { quantity: number } | undefined;
    return { definition, quantity: Math.min(requested, stack?.quantity ?? 0), hero: false };
  }).filter((entry) => entry.quantity > 0);
  if (selected.length === 0) redirect(`/game?view=karte&x=${Math.max(0, source.x - 4)}&command=${source.y + 1}-${source.x + 1}&target=${target.y + 1}-${target.x + 1}&field=${target.y + 1}-${target.x + 1}&notice=units`);

  const friendly = targetTile.owner_user_id === user.id || targetTile.conquered_by_user_id === user.id;
  const distance = Math.abs(source.x - target.x) + Math.abs(source.y - target.y);
  const arrivesAt = new Date(Date.now() + Math.max(15, distance * MARCH_SECONDS_PER_FIELD) * 1000).toISOString();
  const payload = JSON.stringify(selected.map((entry) => ({ unit_key: entry.definition.key, quantity: entry.quantity, hero: entry.definition.role === "hero" })));

  database.exec("BEGIN IMMEDIATE");
  try {
    for (const entry of selected) {
      if (entry.hero) {
        // NULL position marks the hero as in transit until the march resolves.
        const departure = database.prepare("UPDATE hero_units SET x=NULL, y=NULL WHERE user_id=? AND hero_key=? AND alive=1 AND x=? AND y=?").run(user.id, entry.definition.key, source.x, source.y);
        if (departure.changes !== 1) throw new Error("Der Held ist nicht mehr auf dem Startfeld.");
        continue;
      }
      const deduction = database.prepare("UPDATE unit_stacks SET quantity=quantity-? WHERE user_id=? AND unit_key=? AND x=? AND y=? AND quantity>=?").run(entry.quantity, user.id, entry.definition.key, source.x, source.y, entry.quantity);
      if (deduction.changes !== 1) throw new Error("Der Einheitenbestand hat sich ge\u00e4ndert.");
    }
    database.prepare("DELETE FROM unit_stacks WHERE quantity<=0").run();
    database.prepare("INSERT INTO army_marches(user_id,source_x,source_y,target_x,target_y,units,friendly,arrives_at) VALUES(?,?,?,?,?,?,?,?)").run(user.id, source.x, source.y, target.x, target.y, payload, friendly ? 1 : 0, arrivesAt);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  redirect("/game?view=angriffe&notice=marching");
}



