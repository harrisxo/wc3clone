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

  if (isHeroUnit(def)) {
    const hero = database.prepare("SELECT level,alive FROM hero_units WHERE user_id=? AND hero_key=?").get(user.id, key) as { level: number; alive: number } | undefined;
    if (hero?.alive === 1) redirect(`/game?view=${returnView}&notice=built`);
    const cost = hero ? heroReviveCost(hero.level) : { gold: def.gold, wood: def.wood, seconds: def.seconds };
    if (state.economy.gold < cost.gold || state.economy.wood < cost.wood) redirect(`/game?view=${returnView}&notice=resources`);
    const deduction = database.prepare("UPDATE users SET gold=gold-?,wood=wood-? WHERE id=? AND gold>=? AND wood>=?").run(cost.gold, cost.wood, user.id, cost.gold, cost.wood);
    if (deduction.changes !== 1) redirect(`/game?view=${returnView}&notice=resources`);
    const heroLevel = hero?.level ?? 1;
    database.prepare("INSERT INTO hero_units(user_id,hero_key,level,alive,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,hero_key) DO UPDATE SET alive=1, updated_at=excluded.updated_at").run(user.id, key, heroLevel, 1, new Date().toISOString());
    redirect(`/game?view=${returnView}`);
  }

  const requestedQuantity = Math.floor(Number(formData.get("quantity")));
  const quantity = Number.isFinite(requestedQuantity) ? Math.min(999, Math.max(1, requestedQuantity)) : 1;

  const building = state.buildings.find((b) => b.building_key === def.building);
  if (!building) redirect(`/game?view=${returnView}&notice=building`);
  const active = state.unitJobs.filter((j) => j.building_key === def.building).length;
  if (active >= building.queue_slots) redirect(`/game?view=${returnView}&notice=queue`);
  const totalGold = def.gold * quantity;
  const totalWood = def.wood * quantity;
  const totalSeconds = def.seconds * quantity;
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