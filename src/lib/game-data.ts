import type { Race } from "@/lib/auth";

export type BuildingDefinition = { key: string; name: string; icon: string; gold: number; wood: number; seconds: number; kind: "main" | "military" | "food" | "upgrade" | "special" };
export type UnitDefinition = { key: string; name: string; icon: string; building: string; gold: number; wood: number; seconds: number; supply: number; worker?: boolean };

const commonCosts = {
  barracks: { gold: 120, wood: 80, seconds: 180, kind: "military" as const },
  food: { gold: 80, wood: 50, seconds: 120, kind: "food" as const },
  forge: { gold: 150, wood: 120, seconds: 240, kind: "upgrade" as const },
  magic: { gold: 220, wood: 160, seconds: 300, kind: "military" as const },
  siege: { gold: 280, wood: 220, seconds: 360, kind: "military" as const },
  air: { gold: 350, wood: 280, seconds: 420, kind: "military" as const },
  defense: { gold: 180, wood: 200, seconds: 300, kind: "special" as const },
};
const b = (key:string,name:string,icon:string,c:keyof typeof commonCosts): BuildingDefinition => ({key,name,icon,...commonCosts[c]});

export const buildingsByRace: Record<Race, BuildingDefinition[]> = {
  human: [
    {key:"main",name:"Königssitz",icon:"♜",gold:0,wood:0,seconds:0,kind:"main"}, b("barracks","Kaserne","⚔","barracks"), b("food","Hof","⌂","food"), b("forge","Königsschmiede","⚒","forge"), b("magic","Arkaner Turm","✦","magic"), b("siege","Werkhof","⚙","siege"), b("air","Greifenwarte","◆","air"), b("defense","Grenzbollwerk","▣","defense")
  ],
  orc: [
    {key:"main",name:"Kriegshalle",icon:"♜",gold:0,wood:0,seconds:0,kind:"main"}, b("barracks","Kampfgrube","⚔","barracks"), b("food","Vorratshaus","⌂","food"), b("forge","Eisenhütte","⚒","forge"), b("magic","Schamanenzelt","✦","magic"), b("siege","Belagerungswerk","⚙","siege"), b("air","Wyvernhorst","◆","air"), b("defense","Wachtotem","▣","defense")
  ],
  undead: [
    {key:"main",name:"Nekropole",icon:"♜",gold:0,wood:0,seconds:0,kind:"main"}, b("barracks","Knochengruft","⚔","barracks"), b("food","Seelenbrunnen","⌂","food"), b("forge","Knochenesse","⚒","forge"), b("magic","Schattenzirkel","✦","magic"), b("siege","Seuchenwerk","⚙","siege"), b("air","Frosthorst","◆","air"), b("defense","Geisterwall","▣","defense")
  ],
  nightelf: [
    {key:"main",name:"Weltenbaum",icon:"♜",gold:0,wood:0,seconds:0,kind:"main"}, b("barracks","Kriegerhain","⚔","barracks"), b("food","Mondbrunnen","⌂","food"), b("forge","Sternenschmiede","⚒","forge"), b("magic","Ältestenhain","✦","magic"), b("siege","Wurzelwerk","⚙","siege"), b("air","Chimärennest","◆","air"), b("defense","Wächterbaum","▣","defense")
  ],
};

const units = (worker:string, infantry:string, ranged:string, caster:string, siege:string, air:string): UnitDefinition[] => [
  {key:"worker",name:worker,icon:"♟",building:"main",gold:50,wood:0,seconds:90,supply:1,worker:true},
  {key:"infantry",name:infantry,icon:"⚔",building:"barracks",gold:90,wood:20,seconds:120,supply:2},
  {key:"ranged",name:ranged,icon:"➶",building:"barracks",gold:120,wood:40,seconds:150,supply:2},
  {key:"caster",name:caster,icon:"✦",building:"magic",gold:180,wood:80,seconds:210,supply:3},
  {key:"siege",name:siege,icon:"⚙",building:"siege",gold:260,wood:160,seconds:300,supply:4},
  {key:"air",name:air,icon:"◆",building:"air",gold:320,wood:180,seconds:360,supply:5},
];
export const unitsByRace: Record<Race, UnitDefinition[]> = {
  human: units("Siedler","Schildwache","Langbogenschütze","Runenmagier","Feldballiste","Himmelsgreif"),
  orc: units("Peon","Klingenkrieger","Speerjäger","Sturmrufer","Rammenwagen","Windreiter"),
  undead: units("Akolyth","Knochenwächter","Grabesschütze","Seelenweber","Fleischkoloss","Frostschwinge"),
  nightelf: units("Irrlicht","Hainwächter","Mondschützin","Sternenseher","Uralter Werfer","Nachtchimäre"),
};
