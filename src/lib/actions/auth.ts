"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { database } from "@/lib/db";
import { createSession, deleteSession, hashPassword, verifyPassword } from "@/lib/auth";
import { ensureHomeTile } from "@/lib/world";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";

export type AuthState = { error?: string };
const usernamePattern = /^[\p{L}\p{N}_-]+$/u;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function clientKey() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function register(_previousState: AuthState, formData: FormData): Promise<AuthState> {
  const ip = await clientKey();
  if (isRateLimited("register", ip)) return { error: "Zu viele Registrierungen von dieser Adresse. Bitte versuche es später erneut." };
  recordAttempt("register", ip);

  const username = String(formData.get("username") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (username.length < 3 || username.length > 24 || !usernamePattern.test(username)) return { error: "Der Name muss 3–24 Zeichen lang sein und darf Buchstaben, Zahlen, _ und - enthalten." };
  if (displayName.length < 3 || displayName.length > 24 || !usernamePattern.test(displayName)) return { error: "Der Spielername muss 3–24 Zeichen lang sein und darf Buchstaben, Zahlen, _ und - enthalten." };
  if (email.length > 254 || !emailPattern.test(email)) return { error: "Bitte gib eine gültige E-Mail-Adresse ein." };
  if (password.length < 8 || password.length > 128) return { error: "Das Passwort muss 8–128 Zeichen lang sein." };
  const existing = database.prepare("SELECT username, email FROM users WHERE username = ? OR email = ? OR display_name = ?").get(username, email, displayName) as { username: string; email: string; display_name?: string } | undefined;
  if (existing) return { error: existing.username.toLowerCase() === username.toLowerCase() ? "Dieser Loginname ist bereits vergeben." : existing.email.toLowerCase() === email ? "Für diese E-Mail-Adresse besteht bereits ein Konto." : "Dieser öffentliche Spielername ist bereits vergeben." };

  let userId: number;
  try {
    const result = database.prepare("INSERT INTO users (username, display_name, email, password_hash) VALUES (?, ?, ?, ?)").run(username, displayName, email, await hashPassword(password));
    userId = Number(result.lastInsertRowid);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      if (error.message.includes("users.username")) return { error: "Dieser Loginname ist bereits vergeben." };
      if (error.message.includes("users.email")) return { error: "Für diese E-Mail-Adresse besteht bereits ein Konto." };
      return { error: "Dieser öffentliche Spielername ist bereits vergeben." };
    }
    throw error;
  }
  ensureHomeTile(userId);
  await createSession(userId);
  redirect("/game");
}

export async function login(_previousState: AuthState, formData: FormData): Promise<AuthState> {
  const ip = await clientKey();
  if (isRateLimited("login", ip)) return { error: "Zu viele Fehlversuche. Bitte warte einige Minuten." };

  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) return { error: "Bitte fülle beide Felder aus." };
  const user = database.prepare("SELECT id, password_hash FROM users WHERE username = ? OR email = ?").get(identifier, identifier.toLowerCase()) as { id: number; password_hash: string } | undefined;
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    recordAttempt("login", ip);
    return { error: "Name, E-Mail oder Passwort ist nicht korrekt." };
  }
  ensureHomeTile(user.id);
  await createSession(user.id);
  redirect("/game");
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
