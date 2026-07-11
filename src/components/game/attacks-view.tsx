import type { UnitDefinition } from "@/lib/game-data";
import { fieldInfo } from "./shared";
import { Countdown } from "./countdown";

type March = {
  id: number; sourceX: number; sourceY: number; targetX: number; targetY: number;
  friendly: boolean; arrivesAt: string; fieldType: string; isMainVillage: boolean; ownerName: string | null;
  units: { unit_key: string; quantity: number }[];
};

export function AttacksView({ marches, unitDefs, now }: { marches: March[]; unitDefs: UnitDefinition[]; now: number }) {
  const nameOf = (x: number, y: number) => `${y + 1}-${x + 1}`;
  const feldtyp = (march: March) => (march.isMainVillage ? "Hauptdorf" : fieldInfo[march.fieldType as keyof typeof fieldInfo]?.name ?? march.fieldType);

  return <div className="attacks-view">
    <div className="attacks-intro"><div><p className="section-kicker">FeldzÃ¼ge</p><h2>Laufende Angriffe</h2><p>Deine Truppen sind unterwegs. Die Marschdauer richtet sich nach der Entfernung.</p></div><div className="attacks-count"><span>Unterwegs</span><strong>{marches.length}</strong></div></div>

    {marches.length === 0
      ? <p className="attacks-empty">Derzeit sind keine Truppen unterwegs. Sende von der Karte aus einen Angriff oder eine Verlegung.</p>
      : <div className="attacks-list">{marches.map((march) => {
          const units = march.units.map((unit) => { const def = unitDefs.find((entry) => entry.key === unit.unit_key); return { icon: def?.icon ?? "", name: def?.name ?? unit.unit_key, quantity: unit.quantity, supply: def?.supply ?? 1 }; });
          const power = units.reduce((sum, unit) => sum + unit.quantity * Math.max(1, unit.supply), 0);
          const total = units.reduce((sum, unit) => sum + unit.quantity, 0);
          const initialRemaining = Math.max(0, Math.ceil((new Date(march.arrivesAt).getTime() - now) / 1000));
          return <div className={`attack-row ${march.friendly ? "attack-move" : "attack-strike"}`} key={march.id}>
            <div className="attack-head">
              <span className={`attack-kind ${march.friendly ? "kind-move" : "kind-strike"}`}>{march.friendly ? "Verlegung" : "Angriff"}</span>
              <div className="attack-route"><strong>{nameOf(march.sourceX, march.sourceY)}</strong><span aria-hidden="true">â†’</span><strong>{nameOf(march.targetX, march.targetY)}</strong></div>
              <div className="attack-timer"><small>Ankunft in</small><Countdown finishesAt={march.arrivesAt} initialRemainingSeconds={initialRemaining} /></div>
            </div>
            <div className="attack-body">
              <div className="attack-target"><span>Ziel</span><strong>{feldtyp(march)}</strong><small>{march.ownerName ?? "Neutral"}</small></div>
              <ul className="attack-units">{units.map((unit) => <li key={unit.name}>{unit.icon} {unit.name} <b>Ã—{unit.quantity}</b></li>)}</ul>
              <div className="attack-power"><span>{march.friendly ? "Einheiten" : "Kraft"}</span><strong>{march.friendly ? total : power}</strong></div>
            </div>
          </div>;
        })}</div>}
  </div>;
}
