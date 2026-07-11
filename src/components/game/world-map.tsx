"use client";
// Interactive world map: left-click sets start, right-/double-click sets target.
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UnitDefinition } from "@/lib/game-data";
import type { WorldTile } from "@/lib/world";
import { fieldInfo } from "./shared";
import { ArmyCommandForm, type CommandUnit } from "./army-command-bar";
import { startTowerBuild } from "@/lib/actions/game";

type ArmyStack = { unit_key: string; x: number; y: number; quantity: number };
type HeroUnit = { hero_key: string; level: number; alive: number; updated_at: string; x: number | null; y: number | null };
type MapMarch = { id: number; sourceX: number; sourceY: number; targetX: number; targetY: number; friendly: boolean; arrivesAt: string; units: { unit_key: string; quantity: number }[] };

export function WorldMap({ tiles, userId, home, startX, totalWidth, leftStart, rightStart, sourceTile, targetTile, stacks, unitDefs, heroUnits, marches }: {
  tiles: WorldTile[]; userId: number; home: { x: number; y: number }; startX: number; totalWidth: number;
  leftStart: number | null; rightStart: number | null; sourceTile: WorldTile | null; targetTile: WorldTile | null;
  stacks: ArmyStack[]; unitDefs: UnitDefinition[];
  heroUnits: HeroUnit[];
  marches: MapMarch[];
}) {
  const router = useRouter();
  const [goTo, setGoTo] = useState({ row: "", col: "" });

  const nameOf = (tile: { x: number; y: number }) => `${tile.y + 1}-${tile.x + 1}`;
  const sourceName = sourceTile ? nameOf(sourceTile) : null;
  const targetName = targetTile ? nameOf(targetTile) : null;
  const feldtyp = (tile: WorldTile) => (tile.is_main_village ? "Hauptdorf" : fieldInfo[tile.field_type].name);

  const isMovable = (unitKey: string) => { const def = unitDefs.find((unit) => unit.key === unitKey); return Boolean(def && !def.worker && def.role !== "hero"); };
  const hasOwnMovable = (x: number, y: number) => stacks.some((stack) => stack.x === x && stack.y === y && stack.quantity > 0 && isMovable(stack.unit_key)) || heroUnits.some((hero) => hero.alive === 1 && hero.x === x && hero.y === y);
  const commandUnits: CommandUnit[] = sourceTile ? stacks.filter((stack) => stack.x === sourceTile.x && stack.y === sourceTile.y && isMovable(stack.unit_key)).map((stack) => {
    const def = unitDefs.find((unit) => unit.key === stack.unit_key);
    return { key: stack.unit_key, name: def?.name ?? stack.unit_key, icon: def?.icon ?? "", supply: def?.supply ?? 1, available: stack.quantity };
  }) : [];
  const commandHeroes: CommandUnit[] = sourceTile ? unitDefs.filter((unit) => unit.role === "hero").map((unit) => {
    const hero = heroUnits.find((entry) => entry.hero_key === unit.key && entry.alive === 1 && entry.x === sourceTile.x && entry.y === sourceTile.y);
    return hero ? { key: unit.key, name: unit.name, icon: unit.icon, supply: unit.supply, available: 1 } : null;
  }).filter((entry): entry is CommandUnit => Boolean(entry)) : [];

  const targetFriendly = Boolean(targetTile && (targetTile.owner_user_id === userId || targetTile.conquered_by_user_id === userId));
  const targetProtected = Boolean(targetTile && targetTile.is_main_village === 1 && targetTile.owner_user_id !== userId);
  const sameField = Boolean(targetTile && sourceTile && targetTile.x === sourceTile.x && targetTile.y === sourceTile.y);
  const targetValid = Boolean(targetTile && !targetProtected && !sameField);
  const targetEnemy = Boolean(targetTile && !targetFriendly && (targetTile.owner_user_id !== null || targetTile.conquered_by_user_id !== null));
  const relation = !targetTile ? null : targetFriendly ? "Freundlich" : targetEnemy ? "Feindlich" : "Neutral";

  const startHref = (name: string) => `/game?view=karte&x=${startX}&command=${name}${targetName ? `&target=${targetName}` : ""}`;
  const targetHref = (name: string) => `/game?view=karte&x=${startX}${sourceName ? `&command=${sourceName}` : ""}&target=${name}`;
  const pagerHref = (x: number) => `/game?view=karte&x=${x}${sourceName ? `&command=${sourceName}` : ""}${targetName ? `&target=${targetName}` : ""}`;
  const fixTarget = (event: { preventDefault: () => void }, name: string) => { event.preventDefault(); router.push(name === sourceName ? `/game?view=karte&x=${startX}` : targetHref(name)); };

  const submitGoTo = (event: FormEvent) => {
    event.preventDefault();
    const col = Number(goTo.col);
    if (!Number.isInteger(col) || col < 1 || col > totalWidth) return;
    const row = Number(goTo.row);
    const x = Math.min(Math.max(0, col - 5), Math.max(0, totalWidth - 10));
    const name = Number.isInteger(row) && row >= 1 && row <= 10 ? `${row}-${col}` : null;
    let href = `/game?view=karte&x=${x}`;
    if (name && hasOwnMovable(col - 1, row - 1)) href += `&command=${name}${targetName ? `&target=${targetName}` : ""}`;
    else href += `${sourceName ? `&command=${sourceName}` : ""}${targetName ? `&target=${targetName}` : ""}`;
    router.push(href);
  };

  return <div className="map-view">
    <div className="map-main">
      <div className="map-summary">
        <div><span className="section-kicker">Gemeinsame Welt</span><h2>Die Grenzlande</h2></div>
        <div className="map-coordinates"><strong>X {home.x + 1} Â· Y {home.y + 1}</strong></div>
      </div>
      <div className="map-pager">
        {leftStart !== null ? <Link className="map-arrow" href={pagerHref(leftStart)} aria-label="Kartenausschnitt nach links"><span aria-hidden="true">{"\u2039"}</span></Link> : <span className="map-arrow disabled" aria-hidden="true">{"\u2039"}</span>}
        <div className="map-frame">
          <div className="map-axis map-axis-x" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <span key={index}>{startX + index + 1}</span>)}</div>
          <div className="map-axis map-axis-y" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
          <div className={`world-grid${sourceTile ? " targeting" : ""}`} role="grid" aria-label={`Kartenausschnitt von Spalte ${startX + 1} bis ${startX + 10}`}>
            <svg className="march-map-overlay" viewBox="0 0 10 10" preserveAspectRatio="none" aria-hidden="true">
              {marches.map((march) => {
                const rawStartX = march.sourceX - startX + 0.5;
                const rawTargetX = march.targetX - startX + 0.5;
                const startVisible = rawStartX >= 0 && rawStartX <= 10;
                const targetVisible = rawTargetX >= 0 && rawTargetX <= 10;
                if (!startVisible && !targetVisible) return null;
                const x1 = Math.min(9.9, Math.max(0.1, rawStartX));
                const x2 = Math.min(9.9, Math.max(0.1, rawTargetX));
                return <g className={march.friendly ? "march-route-friendly" : "march-route-attack"} key={march.id}>
                  <line x1={x1} y1={march.sourceY + 0.5} x2={x2} y2={march.targetY + 0.5} vectorEffect="non-scaling-stroke" />
                  {startVisible && <circle className="march-route-start" cx={x1} cy={march.sourceY + 0.5} r="0.12" vectorEffect="non-scaling-stroke" />}
                  {targetVisible && <circle className="march-route-target" cx={x2} cy={march.targetY + 0.5} r="0.18" vectorEffect="non-scaling-stroke" />}
                </g>;
              })}
            </svg>
            {tiles.map((tile) => {
              const isOwnHome = tile.owner_user_id === userId && tile.is_main_village === 1;
              const isVillage = tile.owner_user_id !== null && tile.is_main_village === 1;
              const isOwnTerritory = tile.conquered_by_user_id === userId;
              const isEnemyTerritory = tile.conquered_by_user_id !== null && tile.conquered_by_user_id !== userId;
              const territoryOwner = isOwnTerritory || isEnemyTerritory ? tile.owner_name : null;
              const visibleOwner = isVillage ? tile.owner_name : territoryOwner;
              const isOwnField = isOwnHome || isOwnTerritory;
              const fieldName = nameOf(tile);
              const isSource = sourceTile?.x === tile.x && sourceTile?.y === tile.y;
              const isTarget = targetTile?.x === tile.x && targetTile?.y === tile.y;
              const label = isOwnHome ? "Dein Hauptdorf" : isVillage ? "Fremdes Hauptdorf" : territoryOwner ? `${fieldInfo[tile.field_type].name} von ${territoryOwner}` : fieldInfo[tile.field_type].name;
              const arrivingMarch = marches.find((march) => march.targetX === tile.x && march.targetY === tile.y);
              const departingMarch = marches.find((march) => march.sourceX === tile.x && march.sourceY === tile.y);
              const href = startHref(fieldName);
              return <Link
                className={`world-tile field-${tile.field_type}${isOwnHome ? " home-tile" : isVillage ? " village-tile" : ""}${isOwnTerritory ? " own-territory" : isEnemyTerritory ? " enemy-territory" : ""}${isSource ? " command-source" : ""}${isTarget ? " command-target" : ""}`}
                href={href}
                onContextMenu={(event) => fixTarget(event, fieldName)} onDoubleClick={(event) => fixTarget(event, fieldName)}
                key={`${tile.x}-${tile.y}`} role="gridcell" aria-label={`${label} auf Feld ${fieldName}`} title={`${label} ${"\u00b7"} Feld ${fieldName}`}>
                <span className="tile-label">{fieldName}</span>
              {tile.tower_count > 0 && <span className="tower-map-marker">{"\u265c"} {tile.tower_count}</span>}
                {arrivingMarch && <span className={`march-tile-marker ${arrivingMarch.friendly ? "march-friendly" : "march-attack"}`} title={arrivingMarch.friendly ? "Truppen treffen hier ein" : "Angriffsziel"}>{arrivingMarch.friendly ? "\u2192" : "\u2694"}</span>}
                {!arrivingMarch && departingMarch && <span className={`march-tile-marker march-departing ${departingMarch.friendly ? "march-friendly" : "march-attack"}`} title="Truppen sind von hier unterwegs">{"\u25cf"}</span>}
                {visibleOwner && <span className={`territory-owner${isOwnField ? " own-owner" : ""}`}>{visibleOwner}</span>}

              </Link>;
            })}
          </div>
        </div>
        {rightStart !== null ? <Link className="map-arrow" href={pagerHref(rightStart)} aria-label="Kartenausschnitt nach rechts"><span aria-hidden="true">{"\u203a"}</span></Link> : <span className="map-arrow disabled" aria-hidden="true">{"\u203a"}</span>}
      </div>
      <div className="map-legend"><span><i className="legend-home" /> Dein Hauptdorf</span><span><i className="legend-village" /> Anderes Dorf</span><span><i /> Unbesetzt</span><strong>Spalten {startX + 1}{"\u2013"}{startX + 10} von {totalWidth}</strong></div>
    </div>

    <aside className="command-panel">
      <header><span className="section-kicker">Armeebefehl</span></header>
      <div className="cp-fields">
        <div className="cp-field"><span className="section-kicker">Startpunkt</span><strong>{sourceName ?? "\u2014"}</strong><small>{sourceTile ? `Feldtyp: ${feldtyp(sourceTile)}` : "Noch nicht gew\u00e4hlt"}</small></div>
        <div className="cp-field"><span className="section-kicker">Ziel</span><strong className={targetEnemy ? "relation-enemy" : targetFriendly ? "relation-friendly" : ""}>{targetName ?? "\u2014"}</strong><small>{targetTile ? `Feldtyp: ${feldtyp(targetTile)} ${"\u00b7"} ${relation}` : "Noch nicht gew\u00e4hlt"}</small></div>
      </div>
      {targetTile && targetFriendly && targetTile.is_main_village === 0 && <form className="tower-build-form" action={startTowerBuild}>
        <input type="hidden" name="target" value={targetName ?? ""} />
        <button type="submit">Freien Arbeiter entsenden Â· Turm bauen Â· Gold 1 Â· Holz 1 Â· 10s</button>
      </form>}      <form className="cp-goto" onSubmit={submitGoTo}>
        <span className="section-kicker">Gehe zu</span>
        <input type="number" min={1} max={10} placeholder="Zeile" value={goTo.row} onChange={(event) => setGoTo((current) => ({ ...current, row: event.target.value }))} aria-label="Zeile" />
        <span aria-hidden="true">-</span>
        <input type="number" min={1} max={totalWidth} placeholder="Spalte" value={goTo.col} onChange={(event) => setGoTo((current) => ({ ...current, col: event.target.value }))} aria-label="Spalte" />
        <button type="submit" aria-label="Springen">{"\u2192"}</button>
      </form>
      {sourceTile
        ? <ArmyCommandForm source={sourceName ?? ""} target={targetName} friendly={targetFriendly} targetValid={targetValid} targetProtected={targetProtected} units={commandUnits} heroes={commandHeroes} />
        : <p className="army-command-hint">Linksklick auf ein Feld w{"\u00e4"}hlt es aus.</p>}
      <Link className="cp-overview" href={`/game?view=ranking&player=${userId}`}>Pers{"\u00f6"}nliche {"\u00dc"}bersicht</Link>
    </aside>
  </div>;
}
