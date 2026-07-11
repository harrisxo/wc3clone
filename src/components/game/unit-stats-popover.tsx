"use client";
import { useState, type ReactNode } from "react";
import type { DomainDamage } from "@/lib/game-data";

// Wraps a unit image; clicking it opens a small stats card. The card is
// position:fixed so it escapes the table's overflow clipping.
export function UnitStatsPopover({ name, subtitle, damage, defense, supply, gold, wood, note, children }: {
  name: string; subtitle?: string; damage: DomainDamage; defense: [number, number];
  supply?: number; gold?: number; wood?: number; note?: string; children: ReactNode;
}) {
  const noAir = damage.air[0] === 0 && damage.air[1] === 0;
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  return <>
    <button
      type="button"
      className="unit-stats-trigger"
      aria-label={`Werte von ${name} anzeigen`}
      onClick={(event) => {
        if (position) return setPosition(null);
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
      }}>
      {children}
    </button>
    {position && <>
      <div className="unit-stats-overlay" onClick={() => setPosition(null)} />
      <div className="unit-stats-card" style={{ top: position.top, left: position.left }} role="dialog" aria-label={`Werte von ${name}`}>
        <strong>{name}</strong>
        {subtitle && <small>{subtitle}</small>}
        <span>⚔ Boden {damage.ground[0]}–{damage.ground[1]}</span>
        <span>☁ Luft {noAir ? "kann nicht angreifen" : `${damage.air[0]}–${damage.air[1]}`}</span>
        <span>▣ Verteidigung {defense[0]}–{defense[1]}</span>
        {supply !== undefined && <span>◆ Nahrung {supply}</span>}
        {gold !== undefined && wood !== undefined && <span>● Gold {gold} · ♣ Holz {wood}</span>}
        {note && <em>{note}</em>}
      </div>
    </>}
  </>;
}
