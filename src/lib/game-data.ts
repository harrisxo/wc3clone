import type { Race } from "@/lib/auth";

export type BuildingDefinition = { key: string; name: string; icon: string; gold: number; wood: number; seconds: number; kind: "main" | "military" | "food" | "upgrade" | "special" };
export type StatRange = [number, number];
export type UnitDefinition = { key: string; name: string; icon: string; building: string; gold: number; wood: number; seconds: number; supply: number; worker?: boolean; role: "worker" | "melee" | "ranged" | "air" | "siege" | "hero"; unique?: boolean; damage: StatRange; defense: StatRange };

// TESTING: all gold/wood costs below are temporarily set to 1.
export const DEVELOPMENT_UNIT_SECONDS = 10;
const commonCosts = {
  barracks: { gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, kind: "military" as const },
  food: { gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, kind: "food" as const },
  forge: { gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, kind: "upgrade" as const },
  magic: { gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, kind: "special" as const },
  siege: { gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, kind: "military" as const },
  air: { gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, kind: "military" as const },
  defense: { gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, kind: "special" as const },
};
const b = (key: string, name: string, icon: string, c: keyof typeof commonCosts): BuildingDefinition => ({ key, name, icon, ...commonCosts[c] });

export const buildingsByRace: Record<Race, BuildingDefinition[]> = {
  human: [{ key: "main", name: "Königssitz", icon: "♜", gold: 1, wood: 1, seconds: 0, kind: "main" }, b("barracks", "Kaserne", "⚔", "barracks"), b("food", "Hof", "⌂", "food"), b("forge", "Königsschmiede", "⚒", "forge"), b("magic", "Heldenturm", "✦", "magic"), b("siege", "Werkhof", "⚙", "siege"), b("air", "Greifenwarte", "◆", "air"), b("defense", "Grenzbollwerk", "▣", "defense")],
  orc: [{ key: "main", name: "Kriegshalle", icon: "♜", gold: 1, wood: 1, seconds: 0, kind: "main" }, b("barracks", "Kampfgrube", "⚔", "barracks"), b("food", "Vorratshaus", "⌂", "food"), b("forge", "Eisenhütte", "⚒", "forge"), b("magic", "Heldenturm", "✦", "magic"), b("siege", "Belagerungswerk", "⚙", "siege"), b("air", "Wyvernhorst", "◆", "air"), b("defense", "Wachtotem", "▣", "defense")],
  undead: [{ key: "main", name: "Nekropole", icon: "♜", gold: 1, wood: 1, seconds: 0, kind: "main" }, b("barracks", "Knochengruft", "⚔", "barracks"), b("food", "Seelenbrunnen", "⌂", "food"), b("forge", "Knochenesse", "⚒", "forge"), b("magic", "Heldenturm", "✦", "magic"), b("siege", "Seuchenwerk", "⚙", "siege"), b("air", "Frosthorst", "◆", "air"), b("defense", "Geisterwall", "▣", "defense")],
  nightelf: [{ key: "main", name: "Weltenbaum", icon: "♜", gold: 1, wood: 1, seconds: 0, kind: "main" }, b("barracks", "Kriegerhain", "⚔", "barracks"), b("food", "Mondbrunnen", "⌂", "food"), b("forge", "Sternenschmiede", "⚒", "forge"), b("magic", "Heldenturm", "✦", "magic"), b("siege", "Wurzelwerk", "⚙", "siege"), b("air", "Chimärennest", "◆", "air"), b("defense", "Wächterbaum", "▣", "defense")],
};

// Combat stats per race and role. Every role has the same stat budget across
// races (sum of all four numbers), only shifted between damage and defense:
// orc hits harder, undead is tankier, nightelf shoots harder, human is even.
type CombatStats = { damage: StatRange; defense: StatRange };
const combatStatsByRace: Record<Race, Record<"melee" | "ranged" | "siege" | "air", CombatStats>> = {
  human: { melee: { damage: [2, 4], defense: [3, 5] }, ranged: { damage: [3, 5], defense: [1, 3] }, siege: { damage: [5, 8], defense: [2, 4] }, air: { damage: [4, 7], defense: [4, 6] } },
  orc: { melee: { damage: [3, 5], defense: [2, 4] }, ranged: { damage: [4, 5], defense: [1, 2] }, siege: { damage: [6, 9], defense: [1, 3] }, air: { damage: [5, 8], defense: [3, 5] } },
  undead: { melee: { damage: [1, 3], defense: [4, 6] }, ranged: { damage: [2, 4], defense: [2, 4] }, siege: { damage: [4, 7], defense: [3, 5] }, air: { damage: [3, 6], defense: [5, 7] } },
  nightelf: { melee: { damage: [2, 4], defense: [3, 5] }, ranged: { damage: [3, 6], defense: [1, 2] }, siege: { damage: [5, 8], defense: [2, 4] }, air: { damage: [5, 7], defense: [4, 5] } },
};

// Heroes: identical across races, strong enough that four of them at level 1
// always creep a medium field (4x13 damage >= 50 max defense) without losses
// (each hero's 15+ defense exceeds any single round of field damage they soak).
// +2 damage and +2 defense per level.
export function heroStats(level: number): CombatStats {
  const bonus = (level - 1) * 2;
  return { damage: [13 + bonus, 18 + bonus], defense: [15 + bonus, 20 + bonus] };
}

// Placed field towers: very strong defenders; siege units deal triple damage to them.
export const towerStats: CombatStats = { damage: [10, 15], defense: [20, 30] };
export const SIEGE_VS_TOWER_MULTIPLIER = 3;

// Neutral creeps: count and per-creep stats are rolled once at world creation
// and stay fixed. 4 melee + 4 ranged (min 20 damage) always clear a small
// field (max 15 total defense); 2+2 needs a weakly rolled field plus luck.
export const creepRanges: Record<"small" | "medium" | "goldmine", { count: StatRange; damage: StatRange; defense: StatRange }> = {
  small: { count: [3, 5], damage: [1, 3], defense: [1, 3] },
  medium: { count: [6, 10], damage: [2, 5], defense: [2, 5] },
  goldmine: { count: [10, 15], damage: [3, 6], defense: [3, 6] },
};

// Hero XP: kills feed every participating hero equally (split). Creep XP is
// cut to 10% from the soft-cap level on; player kills always pay in full.
export const creepXp: Record<"small" | "medium" | "goldmine", number> = { small: 5, medium: 10, goldmine: 15 };
export const UNIT_KILL_XP = 50;
export const HERO_KILL_XP = 250;
export const CREEP_XP_SOFTCAP_LEVEL = 10;
export const CREEP_XP_SOFTCAP_FACTOR = 0.1;
export function xpForNextLevel(level: number) {
  return 100 * level * level;
}

const heroUnit = (key: string, name: string): UnitDefinition => ({ key, name, icon: "✪", building: "magic", gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, supply: 1, role: "hero", unique: true, ...heroStats(1) });

const units = (
  race: Race,
  worker: string,
  melee: string,
  ranged: string,
  antiTower: string,
  air: string,
  heroes: [string, string, string, string],
): UnitDefinition[] => [
  { key: "worker", name: worker, icon: "♟", building: "main", gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, supply: 1, worker: true, role: "worker", damage: [1, 1], defense: [1, 2] },
  { key: "melee", name: melee, icon: "⚔", building: "barracks", gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, supply: 1, role: "melee", ...combatStatsByRace[race].melee },
  { key: "ranged", name: ranged, icon: "➶", building: "barracks", gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, supply: 1, role: "ranged", ...combatStatsByRace[race].ranged },
  { key: "siege", name: antiTower, icon: "⚙", building: "siege", gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, supply: 1, role: "siege", ...combatStatsByRace[race].siege },
  { key: "air", name: air, icon: "◆", building: "air", gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, supply: 1, role: "air", ...combatStatsByRace[race].air },
  heroUnit("hero_1", heroes[0]),
  heroUnit("hero_2", heroes[1]),
  heroUnit("hero_3", heroes[2]),
  heroUnit("hero_4", heroes[3]),
];

// Forge research: identical for every race, +1 per level on the matching stat.
export type ResearchKey = "melee_damage" | "melee_defense" | "ranged_damage" | "ranged_defense";
export const researchDefs: { key: ResearchKey; name: string; icon: string; description: string }[] = [
  { key: "melee_damage", name: "Nahkampf-Schaden", icon: "⚔", description: "+1 Angriffskraft pro Nahkämpfer und Level" },
  { key: "melee_defense", name: "Nahkampf-Verteidigung", icon: "▣", description: "+1 Verteidigung pro Nahkämpfer und Level" },
  { key: "ranged_damage", name: "Fernkampf-Schaden", icon: "➶", description: "+1 Angriffskraft pro Fernkämpfer und Level" },
  { key: "ranged_defense", name: "Fernkampf-Verteidigung", icon: "◈", description: "+1 Verteidigung pro Fernkämpfer und Level" },
];

export const unitsByRace: Record<Race, UnitDefinition[]> = {
  human: units("human", "Bauer", "Schwertkämpfer", "Bogenschütze", "Belagerungsramme", "Himmelsgreif", ["Paladin", "Großmagier", "Blutmagier", "Todesritter"]),
  orc: units("orc", "Peon", "Klingenkrieger", "Speerjäger", "Kriegsbock", "Windreiter", ["Klingenmeister", "Seher", "Taurenhäuptling", "Schattenjäger"]),
  undead: units("undead", "Akolyth", "Knochenwächter", "Grabesschütze", "Seuchenkatapult", "Frostschwinge", ["Todesritter", "Lich", "Todesfürst", "Gruftlord"]),
  nightelf: units("nightelf", "Irrlicht", "Hainwächter", "Mondschütze", "Urwurfer", "Nachtchimäre", ["Dämonenjäger", "Hüter des Hains", "Mondpriesterin", "Wächterin"]),
};