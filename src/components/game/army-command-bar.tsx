"use client";
import { useState } from "react";
import { executeArmyCommand } from "@/lib/actions/game";

export type CommandUnit = { key: string; name: string; icon: string; supply: number; available: number };

export function ArmyCommandForm({ source, target, friendly, targetValid, targetProtected, units }: {
  source: string; target: string | null; friendly: boolean; targetValid: boolean; targetProtected: boolean; units: CommandUnit[];
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const clamp = (value: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(value) ? Math.floor(value) : 0));
  const set = (key: string, value: number, max: number) => setCounts((current) => ({ ...current, [key]: clamp(value, max) }));
  const adjust = (key: string, delta: number, max: number) => setCounts((current) => ({ ...current, [key]: clamp((current[key] ?? 0) + delta, max) }));
  const totalUnits = units.reduce((sum, unit) => sum + (counts[unit.key] ?? 0), 0);
  const power = units.reduce((sum, unit) => sum + (counts[unit.key] ?? 0) * Math.max(1, unit.supply), 0);
  const canSubmit = Boolean(target) && targetValid && !targetProtected && totalUnits > 0;

  if (units.length === 0) return <p className="army-command-empty">Auf dem Startpunkt stehen keine beweglichen Einheiten.</p>;
  if (!target) return <p className="army-command-hint">Rechts- oder Doppelklick auf ein Feld wählt das Ziel.</p>;

  return <form className="army-command-body" action={executeArmyCommand}>
    <input type="hidden" name="source" value={source} />
    <input type="hidden" name="target" value={target} />
    <div className="army-stepper-list">
      {units.map((unit) => {
        const value = counts[unit.key] ?? 0;
        return <div className="army-stepper" key={unit.key}>
          <span className="army-stepper-name">{unit.icon} {unit.name}<small>{unit.available} verfügbar</small></span>
          <div className="army-stepper-controls">
            <button type="button" onClick={() => adjust(unit.key, -1, unit.available)} aria-label={`Weniger ${unit.name}`} disabled={value <= 0}>−</button>
            <input type="number" name={`unit_${unit.key}`} min={0} max={unit.available} value={value} onChange={(event) => set(unit.key, Number(event.target.value), unit.available)} />
            <button type="button" onClick={() => adjust(unit.key, 1, unit.available)} aria-label={`Mehr ${unit.name}`} disabled={value >= unit.available}>+</button>
          </div>
        </div>;
      })}
    </div>
    <div className="army-command-footer">
      <p>{targetProtected ? "Fremde Hauptdörfer sind derzeit geschützt." : friendly ? `${totalUnits} Einheiten auf dein eigenes Feld verlegen.` : `Kraft ${power} · ${totalUnits} Einheiten entsenden.`}</p>
      <button type="submit" disabled={!canSubmit}>{friendly ? "Einheiten verlegen" : "Angriff"}</button>
    </div>
  </form>;
}
