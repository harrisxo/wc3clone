import "server-only";
import { randomInt } from "node:crypto";
import { database } from "@/lib/db";

export type FieldType = "small" | "medium" | "goldmine";
export type WorldTile = {
  x: number;
  y: number;
  owner_user_id: number | null;
  is_main_village: number;
  field_type: FieldType;
  monster_count: number;
  gold_reward: number;
  conquered_by_user_id: number | null;
  owner_name: string | null;
};
type Coordinate = { x: number; y: number };

function randomField() {
  const roll = randomInt(100);
  if (roll < 34) return { type: "small" as const, monsters: 20, gold: randomInt(100, 201) };
  if (roll < 68) return { type: "medium" as const, monsters: 50, gold: randomInt(200, 501) };
  return { type: "goldmine" as const, monsters: 100, gold: 0 };
}

function addColumns(startX: number, count: number) {
  const insert = database.prepare("INSERT INTO world_tiles (x, y, field_type, monster_count, gold_reward) VALUES (?, ?, ?, ?, ?)");
  for (let x = startX; x < startX + count; x += 1)
    for (let y = 0; y < 10; y += 1) {
      const stats = randomField();
      insert.run(x, y, stats.type, stats.monsters, stats.gold);
    }
}

export function expandWorldByTime() {
  database.exec("BEGIN IMMEDIATE");
  try {
    const now = new Date();
    const stored = database.prepare("SELECT value FROM app_meta WHERE key = 'world_last_expanded_at'").get() as { value: string } | undefined;
    if (!stored) {
      database.prepare("INSERT INTO app_meta (key, value) VALUES ('world_last_expanded_at', ?)").run(now.toISOString());
      database.exec("COMMIT");
      return 0;
    }

    const previous = new Date(stored.value);
    if (Number.isNaN(previous.getTime())) {
      database.prepare("UPDATE app_meta SET value = ? WHERE key = 'world_last_expanded_at'").run(now.toISOString());
      database.exec("COMMIT");
      return 0;
    }

    const elapsedHours = Math.floor((now.getTime() - previous.getTime()) / 3_600_000);
    if (elapsedHours <= 0) {
      database.exec("COMMIT");
      return 0;
    }

    const edge = database.prepare("SELECT COALESCE(MAX(x), 9) + 1 AS start_x FROM world_tiles").get() as { start_x: number };
    addColumns(edge.start_x, elapsedHours * 3);
    const advanced = new Date(previous.getTime() + elapsedHours * 3_600_000);
    database.prepare("UPDATE app_meta SET value = ? WHERE key = 'world_last_expanded_at'").run(advanced.toISOString());
    database.exec("COMMIT");
    return elapsedHours * 3;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function ensureHomeTile(userId: number): Coordinate {
  expandWorldByTime();
  database.exec("BEGIN IMMEDIATE");
  try {
    const existing = database.prepare("SELECT x, y FROM world_tiles WHERE owner_user_id = ?").get(userId) as Coordinate | undefined;
    if (existing) {
      database.exec("COMMIT");
      return existing;
    }

    let user = database.prepare("SELECT is_admin FROM users WHERE id = ?").get(userId) as { is_admin: number } | undefined;
    if (!user) throw new Error("Der Spieler existiert nicht.");
    if (!database.prepare("SELECT 1 FROM users WHERE is_admin = 1 LIMIT 1").get()) {
      database.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(userId);
      user = { is_admin: 1 };
    }

    let home: Coordinate;
    if (user.is_admin === 1) {
      home = (database.prepare("SELECT x, y FROM world_tiles WHERE x < 10 AND owner_user_id IS NULL ORDER BY ABS(x - 4) + ABS(y - 4), y, x LIMIT 1").get() as Coordinate | undefined) ?? { x: 4, y: 4 };
    } else {
      const edge = database.prepare("SELECT COALESCE(MAX(x), 9) + 1 AS start_x FROM world_tiles").get() as { start_x: number };
      addColumns(edge.start_x, 5);
      home = { x: randomInt(edge.start_x, edge.start_x + 5), y: randomInt(0, 10) };
    }

    const result = database.prepare("UPDATE world_tiles SET owner_user_id = ?, is_main_village = 1, monster_count = 0, gold_reward = 0 WHERE x = ? AND y = ? AND owner_user_id IS NULL").run(userId, home.x, home.y);
    if (result.changes !== 1) throw new Error("Das Hauptdorf konnte nicht platziert werden.");
    database.exec("COMMIT");
    return home;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function getOwnedTiles(userId: number) {
  return database
    .prepare("SELECT x, y, field_type, is_main_village FROM world_tiles WHERE owner_user_id = ? OR conquered_by_user_id = ? ORDER BY y, x")
    .all(userId, userId) as unknown as { x: number; y: number; field_type: FieldType; is_main_village: number }[];
}

export function getWorldMap(userId: number, requestedStart?: number) {
  const home = ensureHomeTile(userId);
  const dimensions = database.prepare("SELECT COALESCE(MAX(x), 9) + 1 AS width, 10 AS height FROM world_tiles").get() as { width: number; height: number };
  const maxStart = Math.max(0, dimensions.width - 10);
  const homeStart = Math.min(maxStart, Math.max(0, home.x - 4));
  const startX = requestedStart === undefined ? homeStart : Math.min(maxStart, Math.max(0, Math.floor(requestedStart)));
  const tiles = database
    .prepare("SELECT wt.x, wt.y, wt.owner_user_id, wt.is_main_village, wt.field_type, wt.monster_count, wt.gold_reward, wt.conquered_by_user_id, COALESCE(village_owner.display_name, field_owner.display_name) AS owner_name FROM world_tiles wt LEFT JOIN users village_owner ON village_owner.id = wt.owner_user_id LEFT JOIN users field_owner ON field_owner.id = wt.conquered_by_user_id WHERE wt.x BETWEEN ? AND ? ORDER BY wt.y, wt.x")
    .all(startX, startX + 9) as unknown as WorldTile[];
  return { tiles, home, startX, height: dimensions.height, totalWidth: dimensions.width, leftStart: startX > 0 ? Math.max(0, startX - 10) : null, rightStart: startX < maxStart ? Math.min(maxStart, startX + 10) : null };
}
