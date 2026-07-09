"use server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { accrueResources } from "@/lib/economy";
import { database } from "@/lib/db";

export async function changeWorkerAssignment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const resource = String(formData.get("resource"));
  const delta = Number(formData.get("delta"));
  if ((resource !== "gold" && resource !== "wood") || (delta !== 1 && delta !== -1)) redirect("/game?view=arbeiter");

  const state = accrueResources(user.id);
  const current = resource === "gold" ? state.goldWorkers : state.woodWorkers;
  const capacity = resource === "gold" ? state.goldWorkplaces : state.woodWorkplaces;
  const assigned = state.goldWorkers + state.woodWorkers;
  if (delta === 1 && (current >= capacity || assigned + state.busyWorkers >= state.totalWorkers)) redirect("/game?view=arbeiter");
  if (delta === -1 && current <= 0) redirect("/game?view=arbeiter");

  const column = resource === "gold" ? "gold_workers" : "wood_workers";
  database.prepare(`UPDATE users SET ${column} = ${column} + ? WHERE id = ?`).run(delta, user.id);
  redirect("/game?view=arbeiter");
}
