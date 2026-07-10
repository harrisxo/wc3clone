import Image from "next/image";
import Link from "next/link";
import type { Race } from "@/lib/auth";
import type { getGameState } from "@/lib/game-system";

export function UnitsView({ state, home, race }: { state: ReturnType<typeof getGameState>; home: { x: number; y: number }; race: Race }) {
  const quantities = new Map<string, number>();
  const homeQuantities = new Map<string, number>();
  for (const stack of state.stacks) {
    quantities.set(stack.unit_key, (quantities.get(stack.unit_key) ?? 0) + stack.quantity);
    if (stack.x === home.x && stack.y === home.y) homeQuantities.set(stack.unit_key, (homeQuantities.get(stack.unit_key) ?? 0) + stack.quantity);
  }
  const combatUnits = state.unitDefs.filter((unit) => !unit.worker && unit.role !== "hero");
  const livingHeroes = state.heroUnits
    .filter((hero) => hero.alive === 1)
    .map((hero) => ({ ...hero, definition: state.unitDefs.find((unit) => unit.key === hero.hero_key) }))
    .filter((hero) => hero.definition);

  return <div className="units-view">
    <div className="panel-heading"><p className="section-kicker">Übersicht</p><h2>Einheiten</h2><p>Alle Einheiten deines Volkes und ihr aktueller Standort.</p></div>
    <div className="army-table-wrap"><table className="game-table army-overview-table"><thead>
      <tr><th rowSpan={2}>Feld</th><th rowSpan={2}>Typ</th><th colSpan={combatUnits.length}>Einheiten</th>{livingHeroes.length > 0 && <th className="hero-column-group" colSpan={livingHeroes.length}>Helden</th>}</tr>
      <tr>{combatUnits.map((unit) => <th title={unit.name} key={unit.key}><span className="unit-th-icon">{unit.icon}</span> <span className="unit-th-name">{unit.name}</span></th>)}{livingHeroes.map((hero) => <th className="hero-column-name" key={hero.hero_key}>{hero.definition!.name}</th>)}</tr>
    </thead><tbody>
      <tr><td>Insgesamt</td><td>—</td>{combatUnits.map((unit) => <td key={unit.key}>{quantities.get(unit.key) ?? 0}</td>)}{livingHeroes.map((hero) => <td className="hero-total-cell" key={hero.hero_key}>Level {hero.level}</td>)}</tr>
      <tr><td><Link href={`/game?view=karte&x=${Math.max(0, home.x - 4)}&field=${home.y + 1}-${home.x + 1}`}>{home.y + 1}-{home.x + 1}</Link></td><td>HD</td>{combatUnits.map((unit) => <td key={unit.key}>{homeQuantities.get(unit.key) ?? 0}</td>)}{livingHeroes.map((hero) => <td className="hero-table-cell" key={hero.hero_key}><Image src={`/heroes/${race}-${hero.hero_key.replace("_", "-")}.jpg`} alt={`Porträt von ${hero.definition!.name}`} title={`${hero.definition!.name}, Level ${hero.level}`} width={30} height={30} /></td>)}</tr>
    </tbody></table></div>
  </div>;
}











