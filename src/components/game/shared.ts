import type { Race } from "@/lib/auth";

export const raceData: Record<Race, { name: string; sigil: string; title: string; description: string }> = {
  human: { name: "Mensch", sigil: "♜", title: "Das Königreich", description: "Disziplin, feste Mauern und unbeugsamer Zusammenhalt." },
  orc: { name: "Orc", sigil: "⚔", title: "Der Kriegsbund", description: "Rohe Kraft, Ehre und der Ruf nach neuen Schlachten." },
  undead: { name: "Untot", sigil: "☠", title: "Das Totenreich", description: "Dunkle Magie, endlose Geduld und Armeen ohne Furcht." },
  nightelf: { name: "Nachtelf", sigil: "☾", title: "Der ewige Hain", description: "Uralte Weisheit, Wildnis und lautlose Entschlossenheit." },
};

export const views = {
  karte: { label: "Karte", icon: "⌖", heading: "Die Weltkarte" },
  angriffe: { label: "Angriffe", icon: "⚔", heading: "Laufende Angriffe" },
  ranking: { label: "Ranking", icon: "♛", heading: "Rangliste" },
  arbeiter: { label: "Arbeiter", icon: "⚒", heading: "Arbeiter" },
  bauen: { label: "Bauen", icon: "▰", heading: "Bauvorhaben" },
  einheiten: { label: "Einheiten", icon: "♞", heading: "Einheiten" },
} as const;

export type View = keyof typeof views;

export const fieldInfo = {
  small: { name: "Kleines Feld", symbol: "◆", danger: "Leicht bewacht", reward: "Eine unbekannte Goldmenge wartet auf den Sieger." },
  medium: { name: "Mittleres Feld", symbol: "⬟", danger: "Stärker bewacht", reward: "Eine größere, unbekannte Goldmenge wartet auf den Sieger." },
  goldmine: { name: "Goldmine", symbol: "●", danger: "Benötigt eine kleine Armee", reward: "Eroberung schaltet einen weiteren Gold-Arbeitsplatz frei." },
} as const;
