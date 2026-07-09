import "server-only";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { database } from "@/lib/db";

const SESSION_COOKIE = "grenzmark_session";
const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 30;
export type Race = "human" | "orc" | "undead" | "nightelf";
export type User = { id: number; username: string; displayName: string; email: string; race: Race | null };

function scrypt(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCallback(password, salt, 64, (error, key) => (error ? reject(error) : resolve(key))));
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await scrypt(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const storedKey = Buffer.from(hash, "hex");
  const suppliedKey = await scrypt(password, salt);
  return storedKey.length === suppliedKey.length && timingSafeEqual(storedKey, suppliedKey);
}
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  database.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(hashToken(token), userId, expiresAt.toISOString());
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
}
export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  cookieStore.delete(SESSION_COOKIE);
}
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const user = database.prepare(`SELECT users.id, users.username, users.display_name AS displayName, users.email, users.race FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?`).get(hashToken(token), new Date().toISOString()) as User | undefined;
  return user ?? null;
}
