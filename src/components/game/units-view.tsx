import Image from "next/image";
import Link from "next/link";
import type { Race } from "@/lib/auth";
import type { getGameState } from "@/lib/game-system";
import { fieldInfo } from "./shared";

const typeCodes: Record<string, string> = { small: "Dorf", medium: "Dorf", goldmine: "Mine" };

type OwnedTile = { x: number; y: number; field_type: string; is_main_village: number; tower_count: number };

export function UnitsView({ state, home, race, ownedTiles, showAll }: { state: ReturnType<typeof getGameState>; home: { x: number; y: number }; race: Race; ownedTiles: OwnedTile[]; showAll: boolean }) {
  const combatUnits = state.unitDefs.filter((unit) => !unit.worker && unit.role !== "hero");
  const livingHeroes = state.heroUnits
    .filter((hero) => hero.alive === 1)
    .map((hero) => ({ ...hero, definition: state.unitDefs.find((unit) => unit.key === hero.hero_key) }))
    .filter((hero) => hero.definition);

  // One row per field that hosts units or heroes; home is always listed first.
  type LocationRow = { x: number; y: number; isHome: boolean; typeCode: string; typeName: string; quantities: Map<string, number>; towers: number };
  const locations = new Map<string, LocationRow>();
  const locationFor = (x: number, y: number, fieldType: string | null, isMainVillage: number | null) => {
    const key = `${x}:${y}`;
    let row = locations.get(key);
    if (!row) {
      const isHome = x === home.x && y === home.y;
      const typeCode = isMainVillage === 1 ? "HD" : typeCodes[fieldType ?? ""] ?? "—";
      const typeName = isMainVillage === 1 ? "Hauptdorf" : fieldInfo[fieldType as keyof typeof fieldInfo]?.name ?? "Unbekannt";
      row = { x, y, isHome, typeCode, typeName, quantities: new Map(), towers: 0 };
      locations.set(key, row);
    }
    return row;
  };
  locationFor(home.x, home.y, null, 1);
  for (const tile of ownedTiles) if (showAll || tile.tower_count > 0) { const row = locationFor(tile.x, tile.y, tile.field_type, tile.is_main_village); row.towers = tile.tower_count; }
  const totals = new Map<string, number>();
  const totalTowers = ownedTiles.reduce((sum, tile) => sum + tile.tower_count, 0);
  for (const stack of state.stacks) {
    totals.set(stack.unit_key, (totals.get(stack.unit_key) ?? 0) + stack.quantity);
    const row = locationFor(stack.x, stack.y, stack.field_type, stack.is_main_village);
    row.quantities.set(stack.unit_key, (row.quantities.get(stack.unit_key) ?? 0) + stack.quantity);
  }
  for (const hero of livingHeroes) if (hero.x !== null && hero.y !== null) locationFor(hero.x, hero.y, hero.field_type, hero.is_main_village);
  const rows = [...locations.values()].sort((a, b) => (a.isHome !== b.isHome ? (a.isHome ? -1 : 1) : a.y - b.y || a.x - b.x));

  // Troops on the road appear as their own row so nothing "disappears" mid-march.
  const marchingQuantities = new Map<string, number>();
  for (const march of state.marches) for (const unit of march.units) marchingQuantities.set(unit.unit_key, (marchingQuantities.get(unit.unit_key) ?? 0) + unit.quantity);
  const marchingHeroes = livingHeroes.filter((hero) => hero.x === null || hero.y === null);
  const hasMarchRow = state.marches.length > 0 || marchingHeroes.length > 0;

  const heroCell = (hero: (typeof livingHeroes)[number]) => <Image src={`/heroes/${race}-${hero.hero_key.replace("_", "-")}.jpg`} alt={`Porträt von ${hero.definition!.name}`} title={`${hero.definition!.name}, Level ${hero.level}`} width={30} height={30} />;

  return <div className="units-view">
    <div className="panel-heading"><p className="section-kicker">Übersicht</p><h2>Einheiten</h2><p>Alle Einheiten deines Volkes und ihr aktueller Standort.</p></div>
    <div className="army-table-wrap"><table className="game-table army-overview-table"><thead>
      <tr><th rowSpan={2}>Feld</th><th rowSpan={2}>Typ</th><th colSpan={combatUnits.length + 1}>Einheiten</th>{livingHeroes.length > 0 && <th className="hero-column-group" colSpan={livingHeroes.length}>Helden</th>}</tr>
      <tr>{combatUnits.map((unit) => <th title={unit.name} key={unit.key}><Image className="unit-th-image" src={`/units/${race}-${unit.key}.png`} alt="" width={32} height={32} /></th>)}<th title="Verteidigungsturm"><Image className="unit-th-image" src="/units/tower.png" alt="" width={32} height={32} /></th>{livingHeroes.map((hero) => <th className="hero-column-name" key={hero.hero_key}>{hero.definition!.name}</th>)}</tr>
    </thead><tbody>
      <tr><td>Insgesamt</td><td>—</td>{combatUnits.map((unit) => <td className="unit-count-cell" key={unit.key}>{(totals.get(unit.key) ?? 0) + (marchingQuantities.get(unit.key) ?? 0)}</td>)}<td className="unit-count-cell">{totalTowers}</td>{livingHeroes.map((hero) => <td className="hero-total-cell" key={hero.hero_key}>Level {hero.level}</td>)}</tr>
      {rows.map((row) => <tr key={`${row.x}:${row.y}`}>
        <td><Link href={`/game?view=karte&x=${Math.max(0, row.x - 4)}&field=${row.y + 1}-${row.x + 1}`}>{row.y + 1}-{row.x + 1}</Link></td>
        <td title={row.typeName}>{row.typeCode}</td>
        {combatUnits.map((unit) => <td className="unit-count-cell" key={unit.key}>{row.quantities.get(unit.key) ?? 0}</td>)}
        <td className="unit-count-cell">{row.towers}</td>
        {livingHeroes.map((hero) => <td className="hero-table-cell" key={hero.hero_key}>{hero.x === row.x && hero.y === row.y ? heroCell(hero) : ""}</td>)}
      </tr>)}
      {hasMarchRow && <tr className="marching-row">
        <td>Unterwegs</td>
        <td title="Truppen auf dem Marsch">⚔</td>
        {combatUnits.map((unit) => <td className="unit-count-cell" key={unit.key}>{marchingQuantities.get(unit.key) ?? 0}</td>)}
        <td className="unit-count-cell">0</td>
        {livingHeroes.map((hero) => <td className="hero-table-cell" key={hero.hero_key}>{hero.x === null || hero.y === null ? heroCell(hero) : ""}</td>)}
      </tr>}
    </tbody></table></div>
    <div className="units-toggle">
      {showAll
        ? <Link href="/game?view=einheiten">Nur Felder mit Einheiten anzeigen</Link>
        : <Link href="/game?view=einheiten&all=1">Alle Dörfer anzeigen</Link>}
    </div>
  </div>;
}
