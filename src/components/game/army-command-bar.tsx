"use client";
import { useState } from "react";
import { executeArmyCommand } from "@/lib/actions/game";

export type CommandUnit = { key: string; name: string; icon: string; supply: number; available: number };

export function ArmyCommandForm({ source, target, friendly, targetValid, targetProtected, units, heroes }: {
  source: string; target: string | null; friendly: boolean; targetValid: boolean; targetProtected: boolean; units: CommandUnit[]; heroes: CommandUnit[];
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const clamp = (value: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(value) ? Math.floor(value) : 0));
  const set = (key: string, value: number, max: number) => setCounts((current) => ({ ...current, [key]: clamp(value, max) }));
  const adjust = (key: string, delta: number, max: number) => setCounts((current) => ({ ...current, [key]: clamp((current[key] ?? 0) + delta, max) }));
  const selectAll = () => setCounts((current) => {
    const next = { ...current };
    for (const unit of units) next[unit.key] = unit.available;
    for (const hero of heroes) next[hero.key] = hero.available;
    return next;
  });
  const totalUnits = units.reduce((sum, unit) => sum + (counts[unit.key] ?? 0), 0) + heroes.reduce((sum, hero) => sum + (counts[hero.key] ?? 0), 0);
  const power = units.reduce((sum, unit) => sum + (counts[unit.key] ?? 0) * Math.max(1, unit.supply), 0) + heroes.reduce((sum, hero) => sum + (counts[hero.key] ?? 0) * Math.max(1, hero.supply), 0);
  const canSubmit = Boolean(target) && targetValid && !targetProtected && totalUnits > 0;

  if (units.length === 0 && heroes.length === 0) return <p className="army-command-empty">Auf dem Startpunkt stehen keine beweglichen Einheiten.</p>;

  return <form className="army-command-body" action={executeArmyCommand} key={`army-${source}-${target ?? "none"}`}>
    <input type="hidden" name="source" value={source} />
    <input type="hidden" name="target" value={target ?? ""} />
    <div className="army-stepper-list">
      <div className="army-stepper-toolbar">
        <button type="button" className="army-select-all" onClick={selectAll} disabled={units.length === 0}>Alle auswählen</button>
      </div>
      {units.map((unit) => {
        const value = counts[unit.key] ?? 0;
        return <div className="army-stepper" key={unit.key}>
          <span className="army-stepper-name">{unit.icon} {unit.name}<small>{unit.available} verfügbar</small></span>
          <div className="army-stepper-controls">
            <button type="button" onClick={() => adjust(unit.key, -1, unit.available)} aria-label={`Weniger ${unit.name}`} disabled={value <= 0}>−</button>
            <input type="number" name={`unit_${unit.key}`} min={0} max={unit.available} value={value} onChange={(event) => set(unit.key, Number(event.target.value), unit.available)} />
            <button type="button" onClick={() => adjust(unit.key, 1, unit.available)} aria-label={`Mehr ${unit.name}`} disabled={value >= unit.available}>+</button>
            <button type="button" className="army-stepper-max" onClick={() => set(unit.key, unit.available, unit.available)} disabled={value >= unit.available}>Max</button>
          </div>
        </div>;
      })}
      {heroes.length > 0 && <div className="army-hero-section"><span className="army-hero-kicker">Helden</span>{heroes.map((hero) => {
        const value = counts[hero.key] ?? 0;
        return <div className="army-stepper army-stepper-hero" key={hero.key}>
          <span className="army-stepper-name">{hero.icon} {hero.name}<small>Einzeln entsendbar</small></span>
          <div className="army-stepper-controls">
            <button type="button" onClick={() => set(hero.key, 0, hero.available)} aria-label={`Kein ${hero.name}`} disabled={value <= 0}>−</button>
            <input type="number" name={`unit_${hero.key}`} min={0} max={hero.available} value={value} readOnly />
            <button type="button" onClick={() => set(hero.key, 1, hero.available)} aria-label={`${hero.name} mitnehmen`} disabled={value >= 1}>+</button>
          </div>
        </div>;
      })}</div>}
    </div>
    <div className="army-command-footer">
      <p>{!target ? "Rechts- oder Doppelklick auf ein Feld wählt das Ziel." : targetProtected ? "Fremde Hauptdörfer sind derzeit geschützt." : friendly ? `${totalUnits} Einheiten auf dein eigenes Feld verlegen.` : `Kraft ${power} · ${totalUnits} Einheiten entsenden.`}</p>
      <button type="submit" disabled={!canSubmit}>{friendly ? "Einheiten verlegen" : "Angriff"}</button>
    </div>
  </form>;
}
