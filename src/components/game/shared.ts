import type { Race } from "@/lib/auth";

export const raceData: Record<Race, { name: string; sigil: string; title: string; description: string }> = {
  human: { name: "Mensch", sigil: "\u265c", title: "Das K\u00f6nigreich", description: "Disziplin, feste Mauern und unbeugsamer Zusammenhalt." },
  orc: { name: "Orc", sigil: "\u2694", title: "Der Kriegsbund", description: "Rohe Kraft, Ehre und der Ruf nach neuen Schlachten." },
  undead: { name: "Untot", sigil: "\u2620", title: "Das Totenreich", description: "Dunkle Magie, endlose Geduld und Armeen ohne Furcht." },
  nightelf: { name: "Nachtelf", sigil: "\u263e", title: "Der ewige Hain", description: "Uralte Weisheit, Wildnis und lautlose Entschlossenheit." },
};

export const views = {
  karte: { label: "Karte", icon: "\u2316", heading: "Die Weltkarte" },
  angriffe: { label: "Angriffe", icon: "\u2694", heading: "Laufende Angriffe" },
  nachrichten: { label: "Nachrichten", icon: "\u2709", heading: "Nachrichten" },
  ranking: { label: "Ranking", icon: "\u265b", heading: "Rangliste" },
  arbeiter: { label: "Arbeiter", icon: "\u2692", heading: "Arbeiter" },
  bauen: { label: "Bauen", icon: "\u25b0", heading: "Bauvorhaben" },
  einheiten: { label: "Einheiten", icon: "\u265e", heading: "Einheiten" },
} as const;

export type View = keyof typeof views;

export const fieldInfo = {
  small: { name: "Kleines Feld", symbol: "\u25c6", danger: "Leicht bewacht", reward: "Eine unbekannte Goldmenge wartet auf den Sieger." },
  medium: { name: "Mittleres Feld", symbol: "\u2b1f", danger: "St\u00e4rker bewacht", reward: "Eine gr\u00f6\u00dfere, unbekannte Goldmenge wartet auf den Sieger." },
  goldmine: { name: "Goldmine", symbol: "\u25cf", danger: "Ben\u00f6tigt eine kleine Armee", reward: "Eroberung schaltet einen weiteren Gold-Arbeitsplatz frei." },
} as const;
