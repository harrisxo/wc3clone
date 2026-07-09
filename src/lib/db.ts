import "server-only";
import { mkdirSync } from "node:fs";
import { randomInt } from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDirectory = path.join(process.cwd(), "data");
mkdirSync(dataDirectory, { recursive: true });
const database = new DatabaseSync(path.join(dataDirectory, "grenzmark.db"));
database.exec("PRAGMA journal_mode = WAL;");

function seedWorld() {
  const coordinates: { x: number; y: number }[] = [];
  for (let y = 0; y < 10; y += 1) for (let x = 0; x < 10; x += 1) coordinates.push({ x, y });
  for (let index = coordinates.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [coordinates[index], coordinates[swapIndex]] = [coordinates[swapIndex], coordinates[index]];
  }
  const smallCount = Math.round(coordinates.length * 0.34);
  const mediumCount = Math.round(coordinates.length * 0.34);
  const insert = database.prepare("INSERT INTO world_tiles (x, y, field_type, monster_count, gold_reward) VALUES (?, ?, ?, ?, ?)");
  coordinates.forEach((tile, index) => {
    if (index < smallCount) insert.run(tile.x, tile.y, "small", 20, randomInt(100, 201));
    else if (index < smallCount + mediumCount) insert.run(tile.x, tile.y, "medium", 50, randomInt(200, 501));
    else insert.run(tile.x, tile.y, "goldmine", 100, 0);
  });
}

const migrations: { version: number; run: () => void }[] = [
  {
    version: 1,
    run: () => {
      database.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL COLLATE NOCASE UNIQUE,
          display_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          email TEXT NOT NULL COLLATE NOCASE UNIQUE,
          password_hash TEXT NOT NULL,
          race TEXT CHECK (race IN ('human', 'orc', 'undead', 'nightelf') OR race IS NULL),
          is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
          gold INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
          wood REAL NOT NULL DEFAULT 0 CHECK (wood >= 0),
          total_workers INTEGER NOT NULL DEFAULT 5 CHECK (total_workers >= 5),
          gold_workers INTEGER NOT NULL DEFAULT 0 CHECK (gold_workers >= 0),
          wood_workers INTEGER NOT NULL DEFAULT 0 CHECK (wood_workers >= 0),
          food_capacity INTEGER NOT NULL DEFAULT 10 CHECK (food_capacity >= 10),
          resources_updated_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_hash TEXT NOT NULL UNIQUE,
          user_id INTEGER NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
        CREATE TABLE world_tiles (
          x INTEGER NOT NULL CHECK (x >= 0),
          y INTEGER NOT NULL CHECK (y BETWEEN 0 AND 9),
          owner_user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
          is_main_village INTEGER NOT NULL DEFAULT 0 CHECK (is_main_village IN (0, 1)),
          field_type TEXT NOT NULL DEFAULT 'small' CHECK (field_type IN ('small', 'medium', 'goldmine')),
          monster_count INTEGER NOT NULL DEFAULT 0 CHECK (monster_count >= 0),
          gold_reward INTEGER NOT NULL DEFAULT 0 CHECK (gold_reward >= 0),
          conquered_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          PRIMARY KEY (x, y)
        );
        CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE player_buildings (
          user_id INTEGER NOT NULL, building_key TEXT NOT NULL, queue_slots INTEGER NOT NULL DEFAULT 1,
          upgrade_level INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, building_key),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE build_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, building_key TEXT NOT NULL,
          job_type TEXT NOT NULL CHECK (job_type IN ('build','food','queue','upgrade')),
          finishes_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX build_jobs_user_idx ON build_jobs(user_id, finishes_at);
        CREATE TABLE unit_stacks (
          user_id INTEGER NOT NULL, unit_key TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, unit_key), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE unit_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, building_key TEXT NOT NULL,
          unit_key TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, finishes_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX unit_jobs_user_idx ON unit_jobs(user_id, finishes_at);
        CREATE TABLE ranking_snapshots (
          user_id INTEGER PRIMARY KEY, points INTEGER NOT NULL DEFAULT 0, villages INTEGER NOT NULL DEFAULT 0,
          mines INTEGER NOT NULL DEFAULT 0, unit_supply INTEGER NOT NULL DEFAULT 0, resource_points INTEGER NOT NULL DEFAULT 0,
          hero_points INTEGER NOT NULL DEFAULT 0, upgrade_points REAL NOT NULL DEFAULT 0,
          calculated_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      seedWorld();
    },
  },
  {
    // gold was declared INTEGER even though accrueResources() always wrote
    // fractional hourly accrual into it; align it with wood's REAL type.
    version: 2,
    run: () => {
      database.exec(`
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL COLLATE NOCASE UNIQUE,
          display_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          email TEXT NOT NULL COLLATE NOCASE UNIQUE,
          password_hash TEXT NOT NULL,
          race TEXT CHECK (race IN ('human', 'orc', 'undead', 'nightelf') OR race IS NULL),
          is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
          gold REAL NOT NULL DEFAULT 0 CHECK (gold >= 0),
          wood REAL NOT NULL DEFAULT 0 CHECK (wood >= 0),
          total_workers INTEGER NOT NULL DEFAULT 5 CHECK (total_workers >= 5),
          gold_workers INTEGER NOT NULL DEFAULT 0 CHECK (gold_workers >= 0),
          wood_workers INTEGER NOT NULL DEFAULT 0 CHECK (wood_workers >= 0),
          food_capacity INTEGER NOT NULL DEFAULT 10 CHECK (food_capacity >= 10),
          resources_updated_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO users_new (id, username, display_name, email, password_hash, race, is_admin, gold, wood, total_workers, gold_workers, wood_workers, food_capacity, resources_updated_at, created_at)
          SELECT id, username, display_name, email, password_hash, race, is_admin, gold, wood, total_workers, gold_workers, wood_workers, food_capacity, resources_updated_at, created_at FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `);
    },
  },
];

const { user_version: currentVersion } = database.prepare("PRAGMA user_version").get() as { user_version: number };
const pendingMigrations = migrations.filter((m) => m.version > currentVersion);
if (pendingMigrations.length > 0) {
  // Table-rebuild migrations (DROP + RENAME) would otherwise cascade-delete every
  // row referencing users(id) via ON DELETE CASCADE; foreign_keys can only be
  // toggled outside a transaction, so it wraps the whole migration run.
  database.exec("PRAGMA foreign_keys = OFF");
  for (const migration of pendingMigrations) {
    database.exec("BEGIN IMMEDIATE");
    try {
      migration.run();
      database.exec(`PRAGMA user_version = ${migration.version}`);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      database.exec("PRAGMA foreign_keys = ON");
      throw error;
    }
  }
}
database.exec("PRAGMA foreign_keys = ON");

// Not a schema migration: keeps exactly one admin assigned as users come and go.
if (!database.prepare("SELECT 1 FROM users WHERE is_admin = 1 LIMIT 1").get()) {
  const founder = database.prepare("SELECT id FROM users ORDER BY id LIMIT 1").get() as { id: number } | undefined;
  if (founder) database.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(founder.id);
}

export { database };
