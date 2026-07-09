import { changeWorkerAssignment } from "@/lib/actions/economy";
import type { EconomyState } from "@/lib/economy";

export function WorkersView({ economy }: { economy: EconomyState }) {
  const assigned = economy.goldWorkers + economy.woodWorkers;
  const idle = economy.totalWorkers - assigned - economy.busyWorkers;
  const rows = [
    { key: "gold", name: "Goldmine", icon: "●", workers: economy.goldWorkers, capacity: economy.goldWorkplaces, rate: economy.goldWorkers * 10 },
    { key: "wood", name: "Holzfäller", icon: "♣", workers: economy.woodWorkers, capacity: economy.woodWorkplaces, rate: economy.woodWorkers * 10 },
  ] as const;
  return <div className="workers-view">
    <div className="workers-intro"><div><p className="section-kicker">Bevölkerung</p><h2>Arbeiter zuweisen</h2><p>Jeder eingesetzte Arbeiter erzeugt 10 Ressourcen pro Stunde.</p></div><div className="idle-workers"><span>Freie Arbeiter</span><strong>{idle} / {economy.totalWorkers}</strong></div></div>
    <div className="worker-list">{rows.map((row) => <div className="worker-row" key={row.key}>
      <div className={`worker-resource worker-${row.key}`}><span>{row.icon}</span><div><h3>{row.name}</h3><small>+{row.rate} pro Stunde</small></div></div>
      <div className="worker-controls">
        <form action={changeWorkerAssignment}><input type="hidden" name="resource" value={row.key} /><input type="hidden" name="delta" value="-1" /><button disabled={row.workers === 0} aria-label={`Arbeiter von ${row.name} abziehen`}>−</button></form>
        <strong>{row.workers} / {row.capacity}</strong>
        <form action={changeWorkerAssignment}><input type="hidden" name="resource" value={row.key} /><input type="hidden" name="delta" value="1" /><button disabled={idle === 0 || row.workers >= row.capacity} aria-label={`Arbeiter ${row.name} zuweisen`}>+</button></form>
      </div>
    </div>)}</div>
    <p className="worker-note">Weitere Gold-Arbeitsplätze erhältst du durch eroberte Goldminen. Neue Arbeiter werden später gebaut.</p>
  </div>;
}
