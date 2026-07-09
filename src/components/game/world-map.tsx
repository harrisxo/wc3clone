import Link from "next/link";
import type { WorldTile } from "@/lib/world";
import { fieldInfo } from "./shared";
import { CastleIcon } from "./castle-icon";

export function WorldMap({ tiles, userId, home, startX, totalWidth, leftStart, rightStart, selectedTile }: {
  tiles: WorldTile[]; userId: number; home: { x: number; y: number }; startX: number; totalWidth: number;
  leftStart: number | null; rightStart: number | null; selectedTile: WorldTile | null;
}) {
  return <div className="map-view">
    <div className="map-summary">
      <div><span className="section-kicker">Gemeinsame Welt</span><h2>Die Grenzlande</h2></div>
      <div className="map-coordinates"><span>Hauptdorf</span><strong>X {home.x + 1} · Y {home.y + 1}</strong></div>
    </div>
    <div className="map-pager">
      {leftStart !== null ? <Link className="map-arrow" href={`/game?view=karte&x=${leftStart}`} aria-label="Kartenausschnitt nach links"><span aria-hidden="true">‹</span></Link> : <span className="map-arrow disabled" aria-hidden="true">‹</span>}
      <div className="map-frame">
        <div className="map-axis map-axis-x" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <span key={index}>{startX + index + 1}</span>)}</div>
        <div className="map-axis map-axis-y" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
        <div className="world-grid" role="grid" aria-label={`Kartenausschnitt von Spalte ${startX + 1} bis ${startX + 10}`}>
          {tiles.map((tile) => {
            const isOwnHome = tile.owner_user_id === userId && tile.is_main_village === 1;
            const isVillage = tile.owner_user_id !== null && tile.is_main_village === 1;
            const isOwnTerritory = tile.conquered_by_user_id === userId;
            const isEnemyTerritory = tile.conquered_by_user_id !== null && tile.conquered_by_user_id !== userId;
            const fieldName = `${tile.y + 1}-${tile.x + 1}`;
            const label = isOwnHome ? "Dein Hauptdorf" : isVillage ? "Fremdes Hauptdorf" : fieldInfo[tile.field_type].name;
            return <Link
              className={`world-tile field-${tile.field_type}${isOwnHome ? " home-tile" : isVillage ? " village-tile" : ""}${isOwnTerritory ? " own-territory" : isEnemyTerritory ? " enemy-territory" : ""}${selectedTile?.x === tile.x && selectedTile?.y === tile.y ? " selected-tile" : ""}`}
              href={`/game?view=karte&x=${startX}&field=${fieldName}`}
              key={`${tile.x}-${tile.y}`}
              role="gridcell"
              aria-label={`${label} auf Feld ${fieldName}`}
              title={`${label} · Feld ${fieldName}`}
            >
              <span className="tile-label">{fieldName}</span>
              {isVillage && <><span className="village-icon" aria-hidden="true"><CastleIcon /></span>{isOwnHome && <small>Hauptdorf</small>}</>}
            </Link>;
          })}
        </div>
      </div>
      {rightStart !== null ? <Link className="map-arrow" href={`/game?view=karte&x=${rightStart}`} aria-label="Kartenausschnitt nach rechts"><span aria-hidden="true">›</span></Link> : <span className="map-arrow disabled" aria-hidden="true">›</span>}
    </div>
    <div className="map-legend"><span><i className="legend-home" /> Dein Hauptdorf</span><span><i className="legend-village" /> Anderes Dorf</span><span><i /> Unbesetzt</span><strong>Spalten {startX + 1}–{startX + 10} von {totalWidth}</strong></div>
    {selectedTile && <div className={`field-details details-${selectedTile.field_type}`}>
      <div className="field-details-heading"><span className="field-detail-symbol">{fieldInfo[selectedTile.field_type].symbol}</span><div><p className="section-kicker">Feld {selectedTile.y + 1}-{selectedTile.x + 1}</p><h3>{selectedTile.is_main_village ? "Hauptdorf" : fieldInfo[selectedTile.field_type].name}</h3></div></div>
      {selectedTile.is_main_village ? <>
        <div className="field-owner"><span>Besitzer</span><strong>{selectedTile.owner_name ?? "Unbekannt"}</strong></div>
        <p className="field-description">Ein befestigtes Hauptdorf. Hauptdörfer können nicht wie neutrale Felder angegriffen werden.</p>
      </> : <>
        <div className="field-intel"><div><span>Verteidigung</span><strong>{fieldInfo[selectedTile.field_type].danger}</strong></div><div><span>Möglicher Ertrag</span><strong>{fieldInfo[selectedTile.field_type].reward}</strong></div><div><span>Besitzer</span><strong>{selectedTile.owner_name ?? "Neutral"}</strong></div></div>
        <button className="attack-preview" type="button" disabled>Angriff folgt mit Einheiten</button>
      </>}
    </div>}
  </div>;
}
