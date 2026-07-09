import Link from "next/link";
import { redirect } from "next/navigation";
import { chooseRace } from "@/lib/actions/race";
import { logout } from "@/lib/actions/auth";
import { getCurrentUser, type Race } from "@/lib/auth";
import { getWorldMap, type WorldTile } from "@/lib/world";
import type { EconomyState } from "@/lib/economy";
import { changeWorkerAssignment } from "@/lib/actions/economy";
import { ResourceHeader } from "@/components/resource-header";
import { getGameState } from "@/lib/game-system";
import { startBuild, trainUnit } from "@/lib/actions/game";
import { getRanking } from "@/lib/ranking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const raceData: Record<Race, { name: string; sigil: string; title: string; description: string }> = {
  human: { name: "Mensch", sigil: "♜", title: "Das Königreich", description: "Disziplin, feste Mauern und unbeugsamer Zusammenhalt." },
  orc: { name: "Orc", sigil: "⚔", title: "Der Kriegsbund", description: "Rohe Kraft, Ehre und der Ruf nach neuen Schlachten." },
  undead: { name: "Untot", sigil: "☠", title: "Das Totenreich", description: "Dunkle Magie, endlose Geduld und Armeen ohne Furcht." },
  nightelf: { name: "Nachtelf", sigil: "☾", title: "Der ewige Hain", description: "Uralte Weisheit, Wildnis und lautlose Entschlossenheit." },
};

const views = {
  karte: { label: "Karte", icon: "⌖", heading: "Die Weltkarte", text: "Hier entsteht die Welt mit ihren Feldern, Grenzen und deinen ersten möglichen Zielen." },
  ranking: { label: "Ranking", icon: "♛", heading: "Rangliste", text: "Vergleiche dein Reich später mit den mächtigsten Herrschern der Welt." },
  arbeiter: { label: "Arbeiter", icon: "⚒", heading: "Arbeiter", text: "Verwalte hier künftig deine Bevölkerung und verteile Arbeitskräfte auf Aufgaben." },
  bauen: { label: "Bauen", icon: "▰", heading: "Bauvorhaben", text: "Plane Gebäude, Erweiterungen und die Entwicklung deiner Gebiete." },
  einheiten: { label: "Einheiten", icon: "♞", heading: "Einheiten", text: "Stelle deine Armee zusammen und bereite sie auf kommende Feldzüge vor." },
} as const;

type View = keyof typeof views;

function RaceSelection({ username }: { username: string }) {
  return <main className="race-selection">
    <div className="selection-glow" />
    <header className="selection-header">
      <span className="brand-mark">G</span>
      <span>Grenzmark</span>
    </header>
    <section className="selection-content">
      <p className="eyebrow">Willkommen, {username}</p>
      <h1>Wähle dein Volk</h1>
      <p className="selection-intro">Diese Entscheidung prägt dein Reich und kann später nicht geändert werden. Wähle mit Bedacht.</p>
      <div className="race-grid">
        {(Object.entries(raceData) as [Race, (typeof raceData)[Race]][]).map(([key, race]) =>
          <form action={chooseRace} className={`race-card race-${key}`} key={key}>
            <input type="hidden" name="race" value={key} />
            <div className="race-sigil" aria-hidden="true">{race.sigil}</div>
            <span className="race-kicker">{race.title}</span>
            <h2>{race.name}</h2>
            <p>{race.description}</p>
            <button type="submit">{race.name} wählen</button>
          </form>
        )}
      </div>
      <p className="permanent-warning">Die Auswahl wird dauerhaft mit deinem Konto verbunden.</p>
    </section>
  </main>;
}

const fieldInfo = {
  small: { name: "Kleines Feld", symbol: "◆", danger: "Leicht bewacht", reward: "Eine unbekannte Goldmenge wartet auf den Sieger." },
  medium: { name: "Mittleres Feld", symbol: "⬟", danger: "Stärker bewacht", reward: "Eine größere, unbekannte Goldmenge wartet auf den Sieger." },
  goldmine: { name: "Goldmine", symbol: "●", danger: "Benötigt eine kleine Armee", reward: "Eroberung schaltet einen weiteren Gold-Arbeitsplatz frei." },
} as const;

function WorldMap({ tiles, userId, home, startX, totalWidth, leftStart, rightStart, selectedTile }: {
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
              {isVillage && <><span className="village-icon" aria-hidden="true">♜</span>{isOwnHome && <small>Hauptdorf</small>}</>}
            </Link>;
          })}
        </div>
      </div>
      {rightStart !== null ? <Link className="map-arrow" href={`/game?view=karte&x=${rightStart}`} aria-label="Kartenausschnitt nach rechts"><span aria-hidden="true">›</span></Link> : <span className="map-arrow disabled" aria-hidden="true">›</span>}
    </div>
    <div className="map-legend"><span><i className="legend-home" /> Dein Hauptdorf</span><span><i className="legend-village" /> Anderes Dorf</span><span><i /> Unbesetzt</span><strong>Spalten {startX + 1}–{startX + 10} von {totalWidth}</strong></div>
    {selectedTile && <div className={`field-details details-${selectedTile.field_type}`}>
      <div className="field-details-heading"><span className="field-detail-symbol">{fieldInfo[selectedTile.field_type].symbol}</span><div><p className="section-kicker">Feld {selectedTile.y + 1}-{selectedTile.x + 1}</p><h3>{selectedTile.is_main_village ? "Hauptdorf" : fieldInfo[selectedTile.field_type].name}</h3></div></div>
      {selectedTile.is_main_village ? <p className="field-description">Ein befestigtes Hauptdorf. Hauptdörfer können nicht wie neutrale Felder angegriffen werden.</p> : <>
        <div className="field-intel"><div><span>Verteidigung</span><strong>{fieldInfo[selectedTile.field_type].danger}</strong></div><div><span>Möglicher Ertrag</span><strong>{fieldInfo[selectedTile.field_type].reward}</strong></div><div><span>Besitzer</span><strong>{selectedTile.owner_name ?? "Neutral"}</strong></div></div>
        <button className="attack-preview" type="button" disabled>Angriff folgt mit Einheiten</button>
      </>}
    </div>}
  </div>;
}

function WorkersView({ economy }: { economy: EconomyState }) {
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
function BuildView({ state }: { state: ReturnType<typeof getGameState> }) {
  const now=new Date(state.economy.updatedAt).getTime();
  return <div className="build-view"><div className="panel-heading"><p className="section-kicker">Hauptdorf</p><h2>Gebäude errichten</h2><p>Jeder Neubau bindet bis zur Fertigstellung einen freien Arbeiter.</p></div>
    <div className="building-grid">{state.buildingDefs.map(def=>{
      const owned=state.buildings.find(b=>b.building_key===def.key); const jobs=state.buildJobs.filter(j=>j.building_key===def.key); const building=jobs.find(j=>j.job_type==="build");
      return <article className={`building-card${owned?" built":""}`} key={def.key}><div className="building-icon">{def.icon}</div><div className="building-info"><h3>{def.name}</h3><div className="cost-line"><span>● {def.gold}</span><span>♣ {def.wood}</span><span>◷ {Math.ceil(def.seconds/60)}m</span></div>
        {def.kind==="main"&&<small>Von Beginn an verfügbar · {owned?.queue_slots??1} Queue</small>}
        {building&&<small>Im Bau · noch {Math.max(1,Math.ceil((new Date(building.finishes_at).getTime()-now)/60000))}m</small>}
        {owned&&def.kind!=="main"&&<small>Errichtet · {owned.queue_slots} Queue{owned.queue_slots>1?"s":""} · Upgrade {owned.upgrade_level}</small>}
      </div><div className="building-actions">
        {!owned&&!building&&def.kind!=="main"&&<form action={startBuild}><input type="hidden" name="building" value={def.key}/><button>Bauen</button></form>}
        {owned&&def.kind==="food"&&<form action={startBuild}><input type="hidden" name="building" value={def.key}/><input type="hidden" name="mode" value="food"/><button>+10 Nahrung</button></form>}
        {owned&&def.kind==="military"&&<form action={startBuild}><input type="hidden" name="building" value={def.key}/><input type="hidden" name="mode" value="queue"/><button>Queue +1</button></form>}
        {owned&&(def.kind==="upgrade"||def.kind==="special")&&<form action={startBuild}><input type="hidden" name="building" value={def.key}/><input type="hidden" name="mode" value="upgrade"/><button>Upgrade +1</button></form>}
      </div></article>})}</div>
    <div className="build-footer"><span>Freie Arbeiter: {state.economy.totalWorkers-state.economy.goldWorkers-state.economy.woodWorkers-state.busyWorkers}</span><span>Nahrung: {state.supplyUsed} / {state.foodCapacity}</span><span>Aktive Bauaufträge: {state.buildJobs.length}</span></div>
  </div>;
}

function UnitsView({ state, home, selectedKey }: { state: ReturnType<typeof getGameState>; home:{x:number;y:number}; selectedKey:string }) {
  const quantities=new Map(state.stacks.map(s=>[s.unit_key,s.quantity]));
  const builtDefs=state.buildingDefs.filter(def=>state.buildings.some(building=>building.building_key===def.key));
  const selected=builtDefs.find(def=>def.key===selectedKey)??builtDefs.find(def=>def.key==="main")!;
  const selectedBuilding=state.buildings.find(building=>building.building_key===selected.key)!;
  const availableUnits=state.unitDefs.filter(unit=>unit.building===selected.key);
  const activeUnitJobs=state.unitJobs.filter(job=>job.building_key===selected.key);
  const activeBuildingJobs=state.buildJobs.filter(job=>job.building_key===selected.key);
  const occupiedQueues=activeUnitJobs.length+activeBuildingJobs.length;
  const hasArmy=state.stacks.some(stack=>stack.quantity>0);
  return <div className="units-view">
    <div className="panel-heading"><p className="section-kicker">Hauptdorf {home.y+1}-{home.x+1}</p><h2>Ausbildung und Gebäude</h2><p>Nahrung: {state.supplyUsed} / {state.foodCapacity}</p></div>
    <div className="unit-building-layout">
      <nav className="unit-building-nav" aria-label="Ausbildungsgebäude">
        <span className="building-nav-label">Hauptdorf</span>
        {builtDefs.filter(def=>def.kind==="main").map(def=><Link className={selected.key===def.key?"active":""} href={`/game?view=einheiten&building=${def.key}`} key={def.key}><i>{def.icon}</i><span><strong>{def.name}</strong><small>Arbeiter und Verwaltung</small></span></Link>)}
        <span className="building-nav-separator">Gebaute Gebäude</span>
        {builtDefs.filter(def=>def.kind!=="main").map(def=><Link className={selected.key===def.key?"active":""} href={`/game?view=einheiten&building=${def.key}`} key={def.key}><i>{def.icon}</i><span><strong>{def.name}</strong><small>{state.unitDefs.some(unit=>unit.building===def.key)?"Einheiten ausbilden":"Upgrades und Verwaltung"}</small></span></Link>)}
        {builtDefs.length===1&&<p className="no-buildings">Noch keine weiteren Gebäude errichtet.</p>}
      </nav>
      <section className="building-queue-panel">
        <header><div className="selected-building-icon">{selected.icon}</div><div><p className="section-kicker">Ausgewählt</p><h3>{selected.name}</h3><span>{occupiedQueues} / {selectedBuilding.queue_slots} Queues belegt</span></div></header>
        <div className="queue-slots">{Array.from({length:selectedBuilding.queue_slots},(_,index)=>{const job=[...activeUnitJobs,...activeBuildingJobs][index];return <div className={`queue-slot${job?" occupied":""}`} key={index}><b>Queue {index+1}</b><span>{job?"Auftrag läuft":"Bereit"}</span></div>})}</div>
        <form className="queue-upgrade-form" action={startBuild}><input type="hidden" name="building" value={selected.key}/><input type="hidden" name="mode" value="queue"/><input type="hidden" name="returnView" value="einheiten"/><button>Weitere Queue bauen</button></form>
        <div className="selected-unit-list">
          {availableUnits.map(unit=><article className="selected-unit" key={unit.key}><span className="unit-icon">{unit.icon}</span><div><h4>{unit.name}</h4><small>{unit.supply} Nahrung · ◷ {Math.ceil(unit.seconds/60)}m</small><p>● {unit.gold} &nbsp; ♣ {unit.wood}</p></div><form action={trainUnit}><input type="hidden" name="unit" value={unit.key}/><button>Ausbilden</button></form></article>)}
          {availableUnits.length===0&&<p className="empty-training">In diesem Gebäude werden keine Einheiten ausgebildet.</p>}
        </div>
      </section>
    </div>
    <div className="army-table-wrap"><table className="game-table"><thead><tr><th>Feld</th><th>Typ</th>{state.unitDefs.filter(unit=>!unit.worker).map(unit=><th title={unit.name} key={unit.key}>{unit.icon}</th>)}</tr></thead><tbody>
      {hasArmy&&<><tr><td>Insgesamt</td><td>—</td>{state.unitDefs.filter(unit=>!unit.worker).map(unit=><td key={unit.key}>{quantities.get(unit.key)??0}</td>)}</tr><tr><td>{home.y+1}-{home.x+1}</td><td>HD</td>{state.unitDefs.filter(unit=>!unit.worker).map(unit=><td key={unit.key}>{quantities.get(unit.key)??0}</td>)}</tr></>}
      {!hasArmy&&<tr><td colSpan={state.unitDefs.length+2}>Noch keine militärischen Einheiten vorhanden.</td></tr>}
    </tbody></table></div>
  </div>;
}

function RankingView({ rows, selectedId }: { rows: ReturnType<typeof getRanking>; selectedId:number|null }) {
  const selected=rows.find(r=>r.id===selectedId);
  return <div className="ranking-view"><div className="panel-heading centered"><p className="section-kicker">Kontinent 1</p><h2>Ranking</h2><p>Aktualisierung alle zehn Minuten · Gilden folgen später</p></div>
    <div className="game-table-wrap"><table className="game-table ranking-table"><thead><tr><th>#</th><th>Name</th><th>Rasse</th><th>Gilde</th><th>Hauptdorf</th><th>Dörfer</th><th>Minen</th><th>Punkte</th></tr></thead><tbody>{rows.map((row,i)=><tr key={row.id}><td>{i+1}</td><td><Link href={`/game?view=ranking&player=${row.id}`}>{row.username}</Link></td><td>{raceData[row.race].name}</td><td>—</td><td>{row.home_y===null?"—":`${row.home_y+1}-${(row.home_x??0)+1}`}</td><td>{row.villages}</td><td>{row.mines}</td><td>{row.points}</td></tr>)}</tbody></table></div>
    {selected&&<div className="score-breakdown"><h3>Punkte von {selected.username}</h3><div><span>Dörfer <b>{selected.villages}</b></span><span>Minen <b>{selected.mines*10}</b></span><span>Einheiten <b>{selected.unit_supply}</b></span><span>Rohstoffe <b>{selected.resource_points}</b></span><span>Helden <b>{selected.hero_points}</b></span><span>Upgrades <b>{Math.floor(selected.upgrade_points)}</b></span></div></div>}
  </div>;
}
export default async function GamePage({ searchParams }: PageProps<"/game">) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!user.race) return <RaceSelection username={user.displayName} />;

  const query = await searchParams;
  const gameState = getGameState(user.id, user.race);
  const economy = gameState.economy;
  const requestedView = query.view;
  const viewKey: View = typeof requestedView === "string" && requestedView in views ? requestedView as View : "karte";
  const requestedStart = typeof query.x === "string" && /^\d+$/.test(query.x) ? Number(query.x) : undefined;
  const activeView = views[viewKey];
  const race = raceData[user.race];
  const world = viewKey === "karte" || viewKey === "einheiten" ? getWorldMap(user.id, requestedStart) : null;
  const selectedField = typeof query.field === "string" ? query.field : null;
  const selectedTile = world?.tiles.find((tile) => `${tile.y + 1}-${tile.x + 1}` === selectedField) ?? null;
  const ranking = viewKey === "ranking" ? getRanking() : [];
  const selectedPlayer = typeof query.player === "string" && /^\d+$/.test(query.player) ? Number(query.player) : null;
  const selectedBuilding = typeof query.building === "string" ? query.building : "main";
  const notices: Record<string, string> = { resources: "Nicht genügend Gold oder Holz.", worker: "Du brauchst einen freien Arbeiter.", queue: "Diese Warteschlange ist bereits belegt.", food: "Dein Nahrungslimit ist erreicht.", building: "Das benötigte Gebäude wurde noch nicht errichtet.", built: "Dieses Gebäude ist bereits vorhanden.", invalid: "Diese Aktion ist nicht verfügbar." };
  const notice = typeof query.notice === "string" ? notices[query.notice] : null;

  return <main className={`game-shell theme-${user.race}`}>
    <aside className="game-sidebar">
      <div className="game-brand"><span className="brand-mark">G</span><span>Grenzmark</span></div>
      <div className="player-card">
        <div className="player-sigil">{race.sigil}</div>
        <div><strong><Link href={`/game?view=ranking&player=${user.id}`}>{user.displayName}</Link></strong><span>{race.name}</span></div>
      </div>
      <nav className="game-menu" aria-label="Spielmenü">
        <form action={logout}><button className="menu-logout" type="submit"><span>↪</span> Logout</button></form>
        {(Object.entries(views) as [View, (typeof views)[View]][]).map(([key, item]) =>
          <Link className={key === viewKey ? "active" : ""} href={`/game?view=${key}`} key={key}><span>{item.icon}</span>{item.label}</Link>
        )}
      </nav>
      <div className="faction-label"><span>{race.title}</span><small>Dein Volk ist dauerhaft gewählt</small></div>
    </aside>
    <section className="game-content">
      <header className="game-topbar"><div><span className="section-kicker">{race.name}</span><h1>{activeView.heading}</h1></div><ResourceHeader initial={{ ...economy, foodUsed: gameState.supplyUsed, foodCapacity: gameState.foodCapacity }} /></header>{notice && <div className="action-notice" role="status">{notice}</div>}
      {viewKey === "arbeiter" ? <WorkersView economy={economy} /> : viewKey === "bauen" ? <BuildView state={gameState} /> : viewKey === "einheiten" ? <UnitsView state={gameState} home={world?.home ?? {x:0,y:0}} selectedKey={selectedBuilding} /> : viewKey === "ranking" ? <RankingView rows={ranking} selectedId={selectedPlayer} /> : world ? <WorldMap tiles={world.tiles} userId={user.id} home={world.home} startX={world.startX} totalWidth={world.totalWidth} leftStart={world.leftStart} rightStart={world.rightStart} selectedTile={selectedTile} /> :
        <div className="content-placeholder">
          <span className="placeholder-icon">{activeView.icon}</span>
          <p className="eyebrow">In Vorbereitung</p>
          <h2>{activeView.heading}</h2>
          <p>{activeView.text}</p>
        </div>
      }
    </section>
  </main>;
}























