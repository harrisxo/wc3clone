import Link from "next/link";
import { executeArmyCommand } from "@/lib/actions/game";
import type { UnitDefinition } from "@/lib/game-data";
import type { WorldTile } from "@/lib/world";
import { fieldInfo } from "./shared";
import { CastleIcon } from "./castle-icon";

type ArmyStack = { unit_key: string; x: number; y: number; quantity: number };

export function WorldMap({ tiles, userId, home, startX, totalWidth, leftStart, rightStart, selectedTile, sourceTile, targetTile, stacks, unitDefs }: {
  tiles: WorldTile[]; userId: number; home: { x: number; y: number }; startX: number; totalWidth: number;
  leftStart: number | null; rightStart: number | null; selectedTile: WorldTile | null; sourceTile: WorldTile | null; targetTile: WorldTile | null;
  stacks: ArmyStack[]; unitDefs: UnitDefinition[];
}) {
  const sourceName = sourceTile ? `${sourceTile.y + 1}-${sourceTile.x + 1}` : null;
  const targetName = targetTile ? `${targetTile.y + 1}-${targetTile.x + 1}` : null;
  const sourceStacks = sourceTile ? stacks.filter((stack) => stack.x === sourceTile.x && stack.y === sourceTile.y) : [];
  const targetFriendly = Boolean(targetTile && (targetTile.owner_user_id === userId || targetTile.conquered_by_user_id === userId));
  const targetEnemy = Boolean(targetTile && !targetFriendly && (targetTile.owner_user_id !== null || targetTile.conquered_by_user_id !== null));
  const targetRelation = !targetTile ? null : targetFriendly ? "Freundlich" : targetEnemy ? "Feindlich" : "Neutral";
  const commandLabel = targetFriendly ? "Einheiten verlegen" : "Angriff best\u00e4tigen";
  const distance = sourceTile && targetTile ? Math.abs(sourceTile.x - targetTile.x) + Math.abs(sourceTile.y - targetTile.y) : 0;

  return <div className="map-view">
    <div className="map-summary">
      <div><span className="section-kicker">Gemeinsame Welt</span><h2>Die Grenzlande</h2></div>
      <div className="map-coordinates"><span>Hauptdorf</span><strong>X {home.x + 1} · Y {home.y + 1}</strong></div>
    </div>
    <div className="map-pager">
      {leftStart !== null ? <Link className="map-arrow" href={`/game?view=karte&x=${leftStart}${sourceName ? `&from=${sourceName}` : ""}`} aria-label="Kartenausschnitt nach links"><span aria-hidden="true">‹</span></Link> : <span className="map-arrow disabled" aria-hidden="true">‹</span>}
      <div className="map-frame">
        <div className="map-axis map-axis-x" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <span key={index}>{startX + index + 1}</span>)}</div>
        <div className="map-axis map-axis-y" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
        <div className="world-grid" role="grid" aria-label={`Kartenausschnitt von Spalte ${startX + 1} bis ${startX + 10}`}>
          {tiles.map((tile) => {
            const isOwnHome = tile.owner_user_id === userId && tile.is_main_village === 1;
            const isVillage = tile.owner_user_id !== null && tile.is_main_village === 1;
            const isOwnTerritory = tile.conquered_by_user_id === userId;
            const isEnemyTerritory = tile.conquered_by_user_id !== null && tile.conquered_by_user_id !== userId;
            const isOwnField = isOwnHome || isOwnTerritory;
            const fieldName = `${tile.y + 1}-${tile.x + 1}`;
            const isSource = sourceTile?.x === tile.x && sourceTile?.y === tile.y;
            const isTarget = targetTile?.x === tile.x && targetTile?.y === tile.y;
            const label = isOwnHome ? "Dein Hauptdorf" : isVillage ? "Fremdes Hauptdorf" : fieldInfo[tile.field_type].name;
            const href = !sourceTile
              ? isOwnField ? `/game?view=karte&x=${startX}&from=${fieldName}&field=${fieldName}` : `/game?view=karte&x=${startX}&field=${fieldName}`
              : isSource ? `/game?view=karte&x=${startX}&field=${fieldName}` : `/game?view=karte&x=${startX}&from=${sourceName}&target=${fieldName}&field=${fieldName}`;
            return <Link
              className={`world-tile field-${tile.field_type}${isOwnHome ? " home-tile" : isVillage ? " village-tile" : ""}${isOwnTerritory ? " own-territory" : isEnemyTerritory ? " enemy-territory" : ""}${selectedTile?.x === tile.x && selectedTile?.y === tile.y ? " selected-tile" : ""}${isSource ? " command-source" : ""}${isTarget ? " command-target" : ""}`}
              href={href} key={`${tile.x}-${tile.y}`} role="gridcell" aria-label={`${label} auf Feld ${fieldName}`} title={`${label} · Feld ${fieldName}`}>
              <span className="tile-label">{fieldName}</span>
              {isVillage && <><span className="village-icon" aria-hidden="true"><CastleIcon /></span>{isOwnHome && <small>Hauptdorf</small>}</>}
            </Link>;
          })}
        </div>
      </div>
      {rightStart !== null ? <Link className="map-arrow" href={`/game?view=karte&x=${rightStart}${sourceName ? `&from=${sourceName}` : ""}`} aria-label="Kartenausschnitt nach rechts"><span aria-hidden="true">›</span></Link> : <span className="map-arrow disabled" aria-hidden="true">›</span>}
    </div>
    <div className="map-legend"><span><i className="legend-home" /> Dein Hauptdorf</span><span><i className="legend-village" /> Anderes Dorf</span><span><i /> Unbesetzt</span><strong>Spalten {startX + 1}–{startX + 10} von {totalWidth}</strong></div>

    {sourceTile && <section className="army-command-panel">
      <header><div><span className="section-kicker">Armeebefehl</span><h3>Start {sourceName}{targetName ? ` → Ziel ${targetName}` : ""}</h3></div><Link href={`/game?view=karte&x=${startX}`}>Auswahl aufheben</Link></header>
      <div className="army-command-summary"><span>Startfeld <strong>{sourceName}</strong></span><span>Ziel <strong>{targetName ?? "Bitte auf der Karte w\u00e4hlen"}</strong></span><span>Beziehung <strong className={targetEnemy ? "relation-enemy" : targetFriendly ? "relation-friendly" : ""}>{targetRelation ?? "—"}</strong></span><span>Entfernung <strong>{targetTile ? `${distance} Felder` : "—"}</strong></span></div>
      {sourceStacks.length === 0 ? <p className="army-command-empty">Auf diesem Feld stehen keine beweglichen Einheiten.</p> : <form className="army-command-form" action={executeArmyCommand}>
        <input type="hidden" name="source" value={sourceName ?? ""} /><input type="hidden" name="target" value={targetName ?? ""} />
        <div className="army-unit-picker">{sourceStacks.map((stack) => { const definition = unitDefs.find((unit) => unit.key === stack.unit_key); return <label key={stack.unit_key}><span>{definition?.icon} {definition?.name ?? stack.unit_key}<small>{stack.quantity} verf\u00fcgbar</small></span><input type="number" name={`unit_${stack.unit_key}`} min={0} max={stack.quantity} defaultValue={0} /></label>; })}</div>
        <div className="army-command-action"><p>{targetFriendly ? "Die Einheiten werden auf ein eigenes Feld verlegt." : targetEnemy ? "Das Ziel ist feindlich. Der Befehl wird als Angriff ausgef\u00fchrt." : "Das neutrale Feld wird gegen seine Wachen angegriffen."}</p><button type="submit" disabled={!targetTile}>{targetTile ? commandLabel : "Ziel ausw\u00e4hlen"}</button></div>
      </form>}
    </section>}

    {selectedTile && <div className={`field-details details-${selectedTile.field_type}`}>
      <div className="field-details-heading"><span className="field-detail-symbol">{fieldInfo[selectedTile.field_type].symbol}</span><div><p className="section-kicker">Feld {selectedTile.y + 1}-{selectedTile.x + 1}</p><h3>{selectedTile.is_main_village ? "Hauptdorf" : fieldInfo[selectedTile.field_type].name}</h3></div></div>
      {selectedTile.is_main_village ? <><div className="field-owner"><span>Besitzer</span><strong>{selectedTile.owner_name ?? "Unbekannt"}</strong></div><p className="field-description">Ein befestigtes Hauptdorf. Fremde Hauptd\u00f6rfer sind derzeit gesch\u00fctzt.</p></> : <><div className="field-intel"><div><span>Verteidigung</span><strong>{fieldInfo[selectedTile.field_type].danger}</strong></div><div><span>M\u00f6glicher Ertrag</span><strong>{fieldInfo[selectedTile.field_type].reward}</strong></div><div><span>Besitzer</span><strong>{selectedTile.owner_name ?? "Neutral"}</strong></div></div></>}
    </div>}
  </div>;
}
