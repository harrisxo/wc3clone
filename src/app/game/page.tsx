import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { getWorldMap, ensureHomeTile } from "@/lib/world";
import { getGameState } from "@/lib/game-system";
import { getRanking } from "@/lib/ranking";
import { ResourceHeader } from "@/components/resource-header";
import { RaceSelection } from "@/components/game/race-selection";
import { WorldMap } from "@/components/game/world-map";
import { WorkersView } from "@/components/game/workers-view";
import { BuildView } from "@/components/game/build-view";
import { UnitsView } from "@/components/game/units-view";
import { BuildingDetailView } from "@/components/game/building-detail-view";
import { RankingView } from "@/components/game/ranking-view";
import { raceData, views, type View } from "@/components/game/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function GamePage({ searchParams }: PageProps<"/game">) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!user.race) return <RaceSelection username={user.displayName} />;

  const query = await searchParams;
  const gameState = getGameState(user.id, user.race);
  const economy = gameState.economy;
  const builtDefs = gameState.buildingDefs.filter((def) => gameState.buildings.some((b) => b.building_key === def.key));
  const buildingKeys = new Set(builtDefs.map((def) => def.key));

  const requestedView = query.view;
  const isFixedView = typeof requestedView === "string" && requestedView in views;
  const buildingViewKey = !isFixedView && typeof requestedView === "string" && buildingKeys.has(requestedView) ? requestedView : null;
  const viewKey: View = isFixedView ? (requestedView as View) : "karte";

  const requestedStart = typeof query.x === "string" && /^\d+$/.test(query.x) ? Number(query.x) : undefined;
  const race = raceData[user.race];
  const world = !buildingViewKey && viewKey === "karte" ? getWorldMap(user.id, requestedStart) : null;
  const home = world?.home ?? ensureHomeTile(user.id);
  const sourceField = typeof query.command === "string" ? query.command : null;
  const targetField = typeof query.target === "string" ? query.target : null;
  const sourceTile = world?.tiles.find((tile) => `${tile.y + 1}-${tile.x + 1}` === sourceField) ?? null;
  const targetTile = world?.tiles.find((tile) => `${tile.y + 1}-${tile.x + 1}` === targetField) ?? null;
  const ranking = viewKey === "ranking" ? getRanking() : [];
  const selectedPlayer = typeof query.player === "string" && /^\d+$/.test(query.player) ? Number(query.player) : null;
  const notices: Record<string, string> = { resources: "Nicht gen\u00fcgend Gold oder Holz.", worker: "Du brauchst einen freien Arbeiter.", queue: "Diese Warteschlange ist bereits belegt.", food: "Dein Nahrungslimit ist erreicht.", building: "Das ben\u00f6tigte Geb\u00e4ude wurde noch nicht errichtet.", built: "Dieses Geb\u00e4ude ist bereits vorhanden.", invalid: "Diese Aktion ist nicht verf\u00fcgbar.", units: "Auf dem Startfeld wurden keine Einheiten ausgew\u00e4hlt.", moved: "Die Einheiten wurden verlegt.", victory: "Angriff gewonnen. Das Feld wurde eingenommen.", defeat: "Angriff verloren. Die entsandten Einheiten sind gefallen.", protected: "Fremde Hauptd\u00f6rfer sind derzeit gesch\u00fctzt." };
  const notice = typeof query.notice === "string" ? notices[query.notice] : null;
  const heading = buildingViewKey ? builtDefs.find((def) => def.key === buildingViewKey)!.name : views[viewKey].heading;

  return <main className={`game-shell theme-${user.race}`}>
    <aside className="game-sidebar">
      <div className="game-brand"><span className="brand-mark">G</span><span>Grenzmark</span></div>
      <div className="player-card">
        <div className="player-sigil">{race.sigil}</div>
        <div><strong><Link href={`/game?view=ranking&player=${user.id}`}>{user.displayName}</Link></strong><span>{race.name}</span></div>
      </div>
      <nav className="game-menu" aria-label={"Spielmen\u00fc"}>
        <form action={logout}><button className="menu-logout" type="submit"><span aria-hidden="true">&#8618;</span> Logout</button></form>
        {(Object.entries(views) as [View, (typeof views)[View]][]).map(([key, item]) =>
          <Link className={!buildingViewKey && key === viewKey ? "active" : ""} href={`/game?view=${key}`} key={key}><span>{item.icon}</span>{item.label}</Link>
        )}
        {builtDefs.map((def) =>
          <Link className={buildingViewKey === def.key ? "active" : ""} href={`/game?view=${def.key}`} key={def.key}><span>{def.icon}</span>{def.name}</Link>
        )}
      </nav>
      <div className="faction-label"><span>{race.title}</span><small>{"Dein Volk ist dauerhaft gew\u00e4hlt"}</small></div>
    </aside>
    <section className="game-content">
      <header className="game-topbar"><div><span className="section-kicker">{race.name}</span><h1>{heading}</h1></div><ResourceHeader initial={{ ...economy, foodUsed: gameState.supplyUsed, foodCapacity: gameState.foodCapacity }} /></header>{notice && <div className="action-notice" role="status">{notice}</div>}
      {buildingViewKey ? <BuildingDetailView state={gameState} home={home} buildingKey={buildingViewKey} race={user.race} /> : viewKey === "arbeiter" ? <WorkersView economy={economy} /> : viewKey === "bauen" ? <BuildView state={gameState} /> : viewKey === "einheiten" ? <UnitsView state={gameState} home={home} race={user.race} /> : viewKey === "ranking" ? <RankingView rows={ranking} selectedId={selectedPlayer} /> : <WorldMap tiles={world!.tiles.map((tile) => ({ ...tile }))} userId={user.id} home={{ x: world!.home.x, y: world!.home.y }} startX={world!.startX} totalWidth={world!.totalWidth} leftStart={world!.leftStart} rightStart={world!.rightStart} sourceTile={sourceTile ? { ...sourceTile } : null} targetTile={targetTile ? { ...targetTile } : null} stacks={gameState.stacks.map((stack) => ({ ...stack }))} unitDefs={gameState.unitDefs.map((def) => ({ ...def }))} />}
    </section>
  </main>;
}






