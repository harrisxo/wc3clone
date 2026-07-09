import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getGameState } from "@/lib/game-system";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!user.race) return NextResponse.json({ error: "Keine Rasse" }, { status: 409 });
  const state = getGameState(user.id, user.race);
  return NextResponse.json({ ...state.economy, foodUsed: state.supplyUsed, foodCapacity: state.foodCapacity });
}

