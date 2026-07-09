import type { getGameState } from "@/lib/game-system";

export function UnitsView({ state, home }: { state: ReturnType<typeof getGameState>; home: { x: number; y: number } }) {
  const quantities = new Map(state.stacks.map((s) => [s.unit_key, s.quantity]));
  const combatUnits = state.unitDefs.filter((unit) => !unit.worker && unit.role !== "hero");

  return <div className="units-view">
    <div className="panel-heading"><p className="section-kicker">Übersicht</p><h2>Einheiten</h2><p>Alle Einheiten deines Volkes und ihr aktueller Standort.</p></div>
    <div className="army-table-wrap"><table className="game-table"><thead><tr><th>Feld</th><th>Typ</th>{combatUnits.map((unit) => <th title={unit.name} key={unit.key}><span className="unit-th-icon">{unit.icon}</span> <span className="unit-th-name">{unit.name}</span></th>)}</tr></thead><tbody>
      <tr><td>Insgesamt</td><td>—</td>{combatUnits.map((unit) => <td key={unit.key}>{quantities.get(unit.key) ?? 0}</td>)}</tr>
      <tr><td>{home.y + 1}-{home.x + 1}</td><td>HD</td>{combatUnits.map((unit) => <td key={unit.key}>{quantities.get(unit.key) ?? 0}</td>)}</tr>
    </tbody></table></div>  </div>;
}




