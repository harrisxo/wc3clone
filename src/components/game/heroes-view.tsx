import Image from "next/image";
import Link from "next/link";
import type { Race } from "@/lib/auth";
import type { getGameState } from "@/lib/game-system";
import { fieldInfo } from "./shared";

export function HeroesView({ state, home, race }: { state: ReturnType<typeof getGameState>; home: { x: number; y: number }; race: Race }) {
  const heroDefs = state.unitDefs.filter((unit) => unit.role === "hero");

  return <div className="units-view">
    <div className="panel-heading"><p className="section-kicker">Übersicht</p><h2>Helden</h2><p>Status, Standort und Ausrüstung deiner Helden. Jeder Held trägt bis zu 6 Items in 2 Slots.</p></div>
    <div className="heroes-view-grid">
      {heroDefs.map((def) => {
        const hero = state.heroUnits.find((entry) => entry.hero_key === def.key);
        const status = !hero ? "Unbeschworen" : hero.alive === 0 ? "Gefallen" : hero.x === null || hero.y === null ? "Unterwegs" : "Lebend";
        const statusKind = !hero ? "none" : hero.alive === 0 ? "dead" : "alive";
        const atHome = Boolean(hero && hero.alive === 1 && hero.x === home.x && hero.y === home.y);
        const location = !hero || hero.alive === 0 || hero.x === null || hero.y === null
          ? null
          : { name: hero.is_main_village === 1 ? "Hauptdorf" : fieldInfo[hero.field_type as keyof typeof fieldInfo]?.name ?? "Unbekannt", field: `${hero.y + 1}-${hero.x + 1}`, x: hero.x };
        const towers = hero?.item_towers ?? 0;
        const teleports = hero?.item_teleports ?? 0;

        return <article className={`hv-card hv-${statusKind}`} key={def.key}>
          <header className="hv-head">
            <Image className="hv-portrait" src={`/heroes/${race}-${def.key.replace("_", "-")}.jpg`} alt={`Porträt von ${def.name}`} width={56} height={56} />
            <div className="hv-title"><h3>{def.name}</h3><small>Level {hero?.level ?? 1}</small></div>
            <span className={`hv-status hv-status-${statusKind}`}>{status}</span>
          </header>
          <div className="hv-row">
            <span className="hv-label">Standort</span>
            {location
              ? <Link className="hv-location" href={`/game?view=karte&x=${Math.max(0, location.x - 4)}&field=${location.field}`}>{location.name} · Feld {location.field}{atHome ? " (HD)" : ""}</Link>
              : <span className="hv-location hv-muted">{status === "Unterwegs" ? "Auf dem Marsch" : "—"}</span>}
          </div>
          <div className="hv-row hv-inventory">
            <span className="hv-label">Inventar <em>{towers + teleports} / 6</em></span>
            <div className="hv-slots">
              <div className={`hv-slot${towers > 0 ? " filled" : ""}`} title="Türme">
                <span className="hv-slot-icon" aria-hidden="true">♜</span>
                <span className="hv-slot-count">{towers}</span>
                <span className="hv-slot-name">Türme</span>
              </div>
              <div className={`hv-slot${teleports > 0 ? " filled" : ""}`} title="Teleports">
                <span className="hv-slot-icon" aria-hidden="true">✦</span>
                <span className="hv-slot-count">{teleports}</span>
                <span className="hv-slot-name">Teleports</span>
              </div>
            </div>
          </div>
        </article>;
      })}
    </div>
    <p className="worker-note">Türme und Teleports kaufst du im Verteidigungsgebäude, solange der Held im Hauptdorf steht.</p>
  </div>;
}
