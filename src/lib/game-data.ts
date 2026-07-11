import type { Race } from "@/lib/auth";

export type BuildingDefinition = { key: string; name: string; icon: string; gold: number; wood: number; seconds: number; kind: "main" | "military" | "food" | "upgrade" | "special" };
export type UnitDefinition = { key: string; name: string; icon: string; building: string; gold: number; wood: number; seconds: number; supply: number; worker?: boolean; role: "worker" | "melee" | "ranged" | "air" | "siege" | "hero"; unique?: boolean };

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

const heroUnit = (key: string, name: string): UnitDefinition => ({ key, name, icon: "✪", building: "magic", gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, supply: 1, role: "hero", unique: true });

const units = (
  worker: string,
  melee: string,
  ranged: string,
  antiTower: string,
  air: string,
  heroes: [string, string, string, string],
): UnitDefinition[] => [
  { key: "worker", name: worker, icon: "♟", building: "main", gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, supply: 1, worker: true, role: "worker" },
  { key: "melee", name: melee, icon: "⚔", building: "barracks", gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, supply: 1, role: "melee" },
  { key: "ranged", name: ranged, icon: "➶", building: "barracks", gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, supply: 1, role: "ranged" },
  { key: "siege", name: antiTower, icon: "⚙", building: "siege", gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, supply: 1, role: "siege" },
  { key: "air", name: air, icon: "◆", building: "air", gold: 1, wood: 1, seconds: DEVELOPMENT_UNIT_SECONDS, supply: 1, role: "air" },
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
  human: units("Bauer", "Schwertkämpfer", "Bogenschütze", "Belagerungsramme", "Himmelsgreif", ["Paladin", "Großmagier", "Blutmagier", "Todesritter"]),
  orc: units("Peon", "Klingenkrieger", "Speerjäger", "Kriegsbock", "Windreiter", ["Klingenmeister", "Seher", "Taurenhäuptling", "Schattenjäger"]),
  undead: units("Akolyth", "Knochenwächter", "Grabesschütze", "Seuchenkatapult", "Frostschwinge", ["Todesritter", "Lich", "Todesfürst", "Gruftlord"]),
  nightelf: units("Irrlicht", "Hainwächter", "Mondschütze", "Urwurfer", "Nachtchimäre", ["Dämonenjäger", "Hüter des Hains", "Mondpriesterin", "Wächterin"]),
};