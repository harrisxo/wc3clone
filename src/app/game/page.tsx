import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { getWorldMap } from "@/lib/world";
import { getGameState } from "@/lib/game-system";
import { getRanking } from "@/lib/ranking";
import { ResourceHeader } from "@/components/resource-header";
import { RaceSelection } from "@/components/game/race-selection";
import { WorldMap } from "@/components/game/world-map";
import { WorkersView } from "@/components/game/workers-view";
import { BuildView } from "@/components/game/build-view";
import { UnitsView } from "@/components/game/units-view";
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
