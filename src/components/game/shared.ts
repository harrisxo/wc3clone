import type { Race } from "@/lib/auth";

export const raceData: Record<Race, { name: string; sigil: string; title: string; description: string }> = {
  human: { name: "Mensch", sigil: "♜", title: "Das Königreich", description: "Disziplin, feste Mauern und unbeugsamer Zusammenhalt." },
  orc: { name: "Orc", sigil: "⚔", title: "Der Kriegsbund", description: "Rohe Kraft, Ehre und der Ruf nach neuen Schlachten." },
  undead: { name: "Untot", sigil: "☠", title: "Das Totenreich", description: "Dunkle Magie, endlose Geduld und Armeen ohne Furcht." },
  nightelf: { name: "Nachtelf", sigil: "☾", title: "Der ewige Hain", description: "Uralte Weisheit, Wildnis und lautlose Entschlossenheit." },
};

export const views = {
  karte: { label: "Karte", icon: "⌖", heading: "Die Weltkarte", text: "Hier entsteht die Welt mit ihren Feldern, Grenzen und deinen ersten möglichen Zielen." },
  ranking: { label: "Ranking", icon: "♛", heading: "Rangliste", text: "Vergleiche dein Reich später mit den mächtigsten Herrschern der Welt." },
  arbeiter: { label: "Arbeiter", icon: "⚒", heading: "Arbeiter", text: "Verwalte hier künftig deine Bevölkerung und verteile Arbeitskräfte auf Aufgaben." },
  bauen: { label: "Bauen", icon: "▰", heading: "Bauvorhaben", text: "Plane Gebäude, Erweiterungen und die Entwicklung deiner Gebiete." },
  einheiten: { label: "Einheiten", icon: "♞", heading: "Einheiten", text: "Stelle deine Armee zusammen und bereite sie auf kommende Feldzüge vor." },
} as const;

export type View = keyof typeof views;

export const fieldInfo = {
  small: { name: "Kleines Feld", symbol: "◆", danger: "Leicht bewacht", reward: "Eine unbekannte Goldmenge wartet auf den Sieger." },
  medium: { name: "Mittleres Feld", symbol: "⬟", danger: "Stärker bewacht", reward: "Eine größere, unbekannte Goldmenge wartet auf den Sieger." },
  goldmine: { name: "Goldmine", symbol: "●", danger: "Benötigt eine kleine Armee", reward: "Eroberung schaltet einen weiteren Gold-Arbeitsplatz frei." },
} as const;
