import "server-only";
import { mkdirSync } from "node:fs";
import { randomInt } from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// Overridable so tests can point at an isolated file or ":memory:" instead of the real dev database.
const databasePath =
  process.env.DATABASE_PATH ??
  (() => {
    const dataDirectory = path.join(process.cwd(), "data");
    mkdirSync(dataDirectory, { recursive: true });
    return path.join(dataDirectory, "grenzmark.db");
  })();
const database = new DatabaseSync(databasePath);
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
  {
    version: 3,
    run: () => {
      database.exec(`
        CREATE TABLE auth_attempts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scope TEXT NOT NULL CHECK (scope IN ('login', 'register')),
          key TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX auth_attempts_lookup_idx ON auth_attempts(scope, key, created_at);
      `);
    },
  },
  {
    version: 4,
    run: () => {
      database.exec(`
        CREATE TABLE hero_units (
          user_id INTEGER NOT NULL,
          hero_key TEXT NOT NULL,
          level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
          alive INTEGER NOT NULL DEFAULT 1 CHECK (alive IN (0, 1)),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, hero_key),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX hero_units_user_idx ON hero_units(user_id, alive);
      `);
    },
  },
  {
    version: 5,
    run: () => {
      database.exec(`
        CREATE TABLE unit_stacks_new (
          user_id INTEGER NOT NULL, unit_key TEXT NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL, quantity INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, unit_key, x, y),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (x, y) REFERENCES world_tiles(x, y) ON DELETE CASCADE
        );
        INSERT INTO unit_stacks_new(user_id,unit_key,x,y,quantity)
          SELECT s.user_id,s.unit_key,w.x,w.y,s.quantity FROM unit_stacks s JOIN world_tiles w ON w.owner_user_id=s.user_id AND w.is_main_village=1;
        DROP TABLE unit_stacks;
        ALTER TABLE unit_stacks_new RENAME TO unit_stacks;
        CREATE INDEX unit_stacks_location_idx ON unit_stacks(x,y,user_id);
      `);
    },
  },
  {
    version: 6,
    run: () => {
      database.exec(`
        CREATE TABLE army_marches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          source_x INTEGER NOT NULL, source_y INTEGER NOT NULL,
          target_x INTEGER NOT NULL, target_y INTEGER NOT NULL,
          units TEXT NOT NULL,
          friendly INTEGER NOT NULL DEFAULT 0 CHECK (friendly IN (0, 1)),
          arrives_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX army_marches_user_idx ON army_marches(user_id, arrives_at);
      `);
    },
  },
  {
    version: 7,
    run: () => {
      database.exec(`
        CREATE TABLE messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sender_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind TEXT NOT NULL DEFAULT 'player' CHECK (kind IN ('player', 'report')),
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          read_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX messages_recipient_idx ON messages(recipient_user_id, created_at DESC);
        CREATE INDEX messages_unread_idx ON messages(recipient_user_id, read_at);
      `);
    },
  },
  {
    // Heroes gain a map position so they can be stationed on conquered fields.
    // NULL x/y means "in transit" (marching); existing heroes start at home.
    version: 8,
    run: () => {
      database.exec(`
        ALTER TABLE hero_units ADD COLUMN x INTEGER;
        ALTER TABLE hero_units ADD COLUMN y INTEGER;
        UPDATE hero_units SET
          x = (SELECT wt.x FROM world_tiles wt WHERE wt.owner_user_id = hero_units.user_id AND wt.is_main_village = 1),
          y = (SELECT wt.y FROM world_tiles wt WHERE wt.owner_user_id = hero_units.user_id AND wt.is_main_village = 1);
      `);
    },
  },
  {
    // Hero inventory: one stack per item kind, combined capacity is capped in
    // the buy action (6 items total). Items survive hero death intentionally.
    version: 9,
    run: () => {
      database.exec(`
        ALTER TABLE hero_units ADD COLUMN item_towers INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE hero_units ADD COLUMN item_teleports INTEGER NOT NULL DEFAULT 0;
      `);
    },
  },
  {
    // Forge research: four unlimited combat upgrades researched in the forge
    // building; levels are permanent, jobs occupy the forge queue.
    version: 10,
    run: () => {
      database.exec(`
        CREATE TABLE research_levels (
          user_id INTEGER NOT NULL,
          research_key TEXT NOT NULL CHECK (research_key IN ('melee_damage','melee_defense','ranged_damage','ranged_defense')),
          level INTEGER NOT NULL DEFAULT 0 CHECK (level >= 0),
          PRIMARY KEY (user_id, research_key),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE research_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          research_key TEXT NOT NULL CHECK (research_key IN ('melee_damage','melee_defense','ranged_damage','ranged_defense')),
          finishes_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX research_jobs_user_idx ON research_jobs(user_id, finishes_at);
      `);
    },
  },
  {
    // Towers belong to individual owned fields. Existing conquered mines get
    // the same automatic first tower as newly conquered mines.
    version: 11,
    run: () => {
      database.exec(`
        ALTER TABLE world_tiles ADD COLUMN tower_count INTEGER NOT NULL DEFAULT 0 CHECK (tower_count BETWEEN 0 AND 5);
        CREATE TABLE tower_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          target_x INTEGER NOT NULL,
          target_y INTEGER NOT NULL,
          finishes_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (target_x, target_y) REFERENCES world_tiles(x, y) ON DELETE CASCADE
        );
        CREATE INDEX tower_jobs_user_idx ON tower_jobs(user_id, finishes_at);
        UPDATE world_tiles SET tower_count=1 WHERE field_type='goldmine' AND conquered_by_user_id IS NOT NULL;
      `);
    },
  },
  {
    // Neutral creeps get individual combat stats, rolled once and stored as
    // JSON so a field keeps its strength forever. Heroes start collecting XP.
    // Ranges are frozen copies of the balance values at migration time.
    version: 12,
    run: () => {
      database.exec(`
        ALTER TABLE world_tiles ADD COLUMN creeps TEXT;
        ALTER TABLE hero_units ADD COLUMN xp INTEGER NOT NULL DEFAULT 0;
      `);
      const ranges: Record<string, { count: [number, number]; damage: [number, number]; defense: [number, number] }> = {
        small: { count: [3, 5], damage: [1, 3], defense: [1, 3] },
        medium: { count: [6, 10], damage: [2, 5], defense: [2, 5] },
        goldmine: { count: [10, 15], damage: [3, 6], defense: [3, 6] },
      };
      const tiles = database.prepare("SELECT x, y, field_type FROM world_tiles WHERE owner_user_id IS NULL AND conquered_by_user_id IS NULL AND is_main_village = 0").all() as { x: number; y: number; field_type: string }[];
      const update = database.prepare("UPDATE world_tiles SET creeps = ?, monster_count = ? WHERE x = ? AND y = ?");
      for (const tile of tiles) {
        const range = ranges[tile.field_type] ?? ranges.small;
        const count = randomInt(range.count[0], range.count[1] + 1);
        const creeps = Array.from({ length: count }, () => ({ damage: randomInt(range.damage[0], range.damage[1] + 1), defense: randomInt(range.defense[0], range.defense[1] + 1) }));
        update.run(JSON.stringify(creeps), count, tile.x, tile.y);
      }
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


