import "server-only";
import { mkdirSync } from "node:fs";
import { randomInt } from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDirectory = path.join(process.cwd(), "data");
mkdirSync(dataDirectory, { recursive: true });
const database = new DatabaseSync(path.join(dataDirectory, "grenzmark.db"));
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
`);

const userColumns = database.prepare("PRAGMA table_info(users)").all() as { name: string }[];
if (!userColumns.some((column) => column.name === "display_name")) {
  database.exec("ALTER TABLE users ADD COLUMN display_name TEXT");
  database.exec("UPDATE users SET display_name = username WHERE display_name IS NULL");
}
database.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_display_name_idx ON users(display_name COLLATE NOCASE)");
if (!userColumns.some((column) => column.name === "race")) database.exec("ALTER TABLE users ADD COLUMN race TEXT CHECK (race IN ('human', 'orc', 'undead', 'nightelf') OR race IS NULL)");
if (!userColumns.some((column) => column.name === "is_admin")) database.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1))");
if (!userColumns.some((column) => column.name === "gold")) database.exec("ALTER TABLE users ADD COLUMN gold INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0)");
if (!userColumns.some((column) => column.name === "wood")) database.exec("ALTER TABLE users ADD COLUMN wood REAL NOT NULL DEFAULT 0 CHECK (wood >= 0)");
if (!userColumns.some((column) => column.name === "total_workers")) database.exec("ALTER TABLE users ADD COLUMN total_workers INTEGER NOT NULL DEFAULT 5 CHECK (total_workers >= 5)");
if (!userColumns.some((column) => column.name === "gold_workers")) database.exec("ALTER TABLE users ADD COLUMN gold_workers INTEGER NOT NULL DEFAULT 0 CHECK (gold_workers >= 0)");
if (!userColumns.some((column) => column.name === "wood_workers")) database.exec("ALTER TABLE users ADD COLUMN wood_workers INTEGER NOT NULL DEFAULT 0 CHECK (wood_workers >= 0)");
if (!userColumns.some((column) => column.name === "food_capacity")) database.exec("ALTER TABLE users ADD COLUMN food_capacity INTEGER NOT NULL DEFAULT 10 CHECK (food_capacity >= 10)");
if (!userColumns.some((column) => column.name === "resources_updated_at")) {
  database.exec("ALTER TABLE users ADD COLUMN resources_updated_at TEXT");
  database.prepare("UPDATE users SET resources_updated_at = ? WHERE resources_updated_at IS NULL").run(new Date().toISOString());
}

const oldWorldSchema = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'world_tiles'").get() as { sql: string } | undefined;
if (oldWorldSchema?.sql.includes("x BETWEEN 0 AND 9")) {
  database.exec(`
    ALTER TABLE world_tiles RENAME TO world_tiles_fixed_width;
    CREATE TABLE world_tiles (
      x INTEGER NOT NULL CHECK (x >= 0), y INTEGER NOT NULL CHECK (y BETWEEN 0 AND 9),
      owner_user_id INTEGER UNIQUE, is_main_village INTEGER NOT NULL DEFAULT 0 CHECK (is_main_village IN (0, 1)),
      PRIMARY KEY (x, y), FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    INSERT INTO world_tiles (x, y, owner_user_id, is_main_village) SELECT x, y, owner_user_id, is_main_village FROM world_tiles_fixed_width;
    DROP TABLE world_tiles_fixed_width;
  `);
} else {
  database.exec(`CREATE TABLE IF NOT EXISTS world_tiles (
    x INTEGER NOT NULL CHECK (x >= 0), y INTEGER NOT NULL CHECK (y BETWEEN 0 AND 9),
    owner_user_id INTEGER UNIQUE, is_main_village INTEGER NOT NULL DEFAULT 0 CHECK (is_main_village IN (0, 1)),
    PRIMARY KEY (x, y), FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
  )`);
}

const worldColumns = database.prepare("PRAGMA table_info(world_tiles)").all() as { name: string }[];
const needsFieldMigration = !worldColumns.some((column) => column.name === "field_type");
if (needsFieldMigration) database.exec("ALTER TABLE world_tiles ADD COLUMN field_type TEXT NOT NULL DEFAULT 'small' CHECK (field_type IN ('small', 'medium', 'goldmine'))");
if (!worldColumns.some((column) => column.name === "monster_count")) database.exec("ALTER TABLE world_tiles ADD COLUMN monster_count INTEGER NOT NULL DEFAULT 0 CHECK (monster_count >= 0)");
if (!worldColumns.some((column) => column.name === "gold_reward")) database.exec("ALTER TABLE world_tiles ADD COLUMN gold_reward INTEGER NOT NULL DEFAULT 0 CHECK (gold_reward >= 0)");
if (!worldColumns.some((column) => column.name === "conquered_by_user_id")) database.exec("ALTER TABLE world_tiles ADD COLUMN conquered_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL");

function fieldStats(x: number, y: number) {
  const value = Math.abs((x * 37 + y * 61 + 13) % 100);
  const roll = value % 10;
  if (roll === 0) return { type: "goldmine", monsters: 70 + (value % 31), gold: 1000 + (value * 17) % 501 };
  if (roll <= 3) return { type: "medium", monsters: 35 + (value % 21), gold: 350 + (value * 11) % 251 };
  return { type: "small", monsters: 10 + (value % 16), gold: 100 + (value * 7) % 101 };
}

if (needsFieldMigration) {
  const oldTiles = database.prepare("SELECT x, y, is_main_village FROM world_tiles").all() as { x: number; y: number; is_main_village: number }[];
  const update = database.prepare("UPDATE world_tiles SET field_type = ?, monster_count = ?, gold_reward = ? WHERE x = ? AND y = ?");
  for (const tile of oldTiles) {
    const stats = fieldStats(tile.x, tile.y);
    update.run(stats.type, tile.is_main_village ? 0 : stats.monsters, tile.is_main_village ? 0 : stats.gold, tile.x, tile.y);
  }
}

const insertTile = database.prepare("INSERT OR IGNORE INTO world_tiles (x, y, field_type, monster_count, gold_reward) VALUES (?, ?, ?, ?, ?)");
for (let y = 0; y < 10; y += 1) for (let x = 0; x < 10; x += 1) {
  const stats = fieldStats(x, y);
  insertTile.run(x, y, stats.type, stats.monsters, stats.gold);
}

if (!(database.prepare("SELECT 1 FROM users WHERE is_admin = 1 LIMIT 1").get())) {
  const founder = database.prepare("SELECT id FROM users ORDER BY id LIMIT 1").get() as { id: number } | undefined;
  if (founder) database.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(founder.id);
}

database.exec("CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
if (!database.prepare("SELECT 1 FROM app_meta WHERE key = 'field_balance_v2'").get()) {
  const balanceTiles = database.prepare("SELECT x, y, field_type, is_main_village FROM world_tiles").all() as { x: number; y: number; field_type: string; is_main_village: number }[];
  const rebalance = database.prepare("UPDATE world_tiles SET monster_count = ?, gold_reward = ? WHERE x = ? AND y = ?");
  for (const tile of balanceTiles) {
    if (tile.is_main_village) rebalance.run(0, 0, tile.x, tile.y);
    else if (tile.field_type === "small") rebalance.run(20, 100 + Math.abs((tile.x * 31 + tile.y * 17) % 101), tile.x, tile.y);
    else if (tile.field_type === "medium") rebalance.run(50, 200 + Math.abs((tile.x * 43 + tile.y * 29) % 301), tile.x, tile.y);
    else rebalance.run(100, 0, tile.x, tile.y);
  }
  database.prepare("INSERT INTO app_meta (key, value) VALUES ('field_balance_v2', 'done')").run();
}

if (!database.prepare("SELECT 1 FROM app_meta WHERE key = 'world_field_reroll_v3'").get()) {
  const tilesToReroll = database.prepare("SELECT x, y FROM world_tiles WHERE is_main_village = 0").all() as { x: number; y: number }[];
  const updateField = database.prepare("UPDATE world_tiles SET field_type = ?, monster_count = ?, gold_reward = ? WHERE x = ? AND y = ?");
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const tile of tilesToReroll) {
      const roll = randomInt(100);
      if (roll < 38) updateField.run("small", 20, randomInt(100, 201), tile.x, tile.y);
      else if (roll < 76) updateField.run("medium", 50, randomInt(200, 501), tile.x, tile.y);
      else updateField.run("goldmine", 100, 0, tile.x, tile.y);
    }
    database.prepare("INSERT INTO app_meta (key, value) VALUES ('world_field_reroll_v3', ?)").run(new Date().toISOString());
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

if (!database.prepare("SELECT 1 FROM app_meta WHERE key = 'world_field_reroll_final_v4'").get()) {
  const finalTiles = database.prepare("SELECT x, y FROM world_tiles WHERE is_main_village = 0").all() as { x: number; y: number }[];
  const updateFinalField = database.prepare("UPDATE world_tiles SET field_type = ?, monster_count = ?, gold_reward = ? WHERE x = ? AND y = ?");
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const tile of finalTiles) {
      const roll = randomInt(100);
      if (roll < 35) updateFinalField.run("small", 20, randomInt(100, 201), tile.x, tile.y);
      else if (roll < 70) updateFinalField.run("medium", 50, randomInt(200, 501), tile.x, tile.y);
      else updateFinalField.run("goldmine", 100, 0, tile.x, tile.y);
    }
    database.prepare("INSERT INTO app_meta (key, value) VALUES ('world_field_reroll_final_v4', ?)").run(new Date().toISOString());
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

if (!database.prepare("SELECT 1 FROM app_meta WHERE key = 'world_distribution_34_34_32_v5'").get()) {
  const distributionTiles = database.prepare("SELECT x, y FROM world_tiles WHERE is_main_village = 0").all() as { x: number; y: number }[];
  for (let index = distributionTiles.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [distributionTiles[index], distributionTiles[swapIndex]] = [distributionTiles[swapIndex], distributionTiles[index]];
  }
  const smallCount = Math.round(distributionTiles.length * 0.34);
  const mediumCount = Math.round(distributionTiles.length * 0.34);
  const updateDistribution = database.prepare("UPDATE world_tiles SET field_type = ?, monster_count = ?, gold_reward = ? WHERE x = ? AND y = ?");
  database.exec("BEGIN IMMEDIATE");
  try {
    distributionTiles.forEach((tile, index) => {
      if (index < smallCount) updateDistribution.run("small", 20, randomInt(100, 201), tile.x, tile.y);
      else if (index < smallCount + mediumCount) updateDistribution.run("medium", 50, randomInt(200, 501), tile.x, tile.y);
      else updateDistribution.run("goldmine", 100, 0, tile.x, tile.y);
    });
    database.prepare("INSERT INTO app_meta (key, value) VALUES ('world_distribution_34_34_32_v5', ?)").run(new Date().toISOString());
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

database.exec(`
  CREATE TABLE IF NOT EXISTS player_buildings (
    user_id INTEGER NOT NULL, building_key TEXT NOT NULL, queue_slots INTEGER NOT NULL DEFAULT 1,
    upgrade_level INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, building_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS build_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, building_key TEXT NOT NULL,
    job_type TEXT NOT NULL CHECK (job_type IN ('build','food','queue','upgrade')),
    finishes_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS build_jobs_user_idx ON build_jobs(user_id, finishes_at);
  CREATE TABLE IF NOT EXISTS unit_stacks (
    user_id INTEGER NOT NULL, unit_key TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, unit_key), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS unit_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, building_key TEXT NOT NULL,
    unit_key TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, finishes_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS unit_jobs_user_idx ON unit_jobs(user_id, finishes_at);
  CREATE TABLE IF NOT EXISTS ranking_snapshots (
    user_id INTEGER PRIMARY KEY, points INTEGER NOT NULL DEFAULT 0, villages INTEGER NOT NULL DEFAULT 0,
    mines INTEGER NOT NULL DEFAULT 0, unit_supply INTEGER NOT NULL DEFAULT 0, resource_points INTEGER NOT NULL DEFAULT 0,
    hero_points INTEGER NOT NULL DEFAULT 0, upgrade_points REAL NOT NULL DEFAULT 0,
    calculated_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);
export { database };






