"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, type Race } from "@/lib/auth";
import { database } from "@/lib/db";

const races: Race[] = ["human", "orc", "undead", "nightelf"];

export async function chooseRace(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.race) redirect("/game");

  const race = String(formData.get("race") ?? "") as Race;
  if (!races.includes(race)) redirect("/game");

  database.prepare("UPDATE users SET race = ? WHERE id = ? AND race IS NULL").run(race, user.id);

  redirect("/game");
}
