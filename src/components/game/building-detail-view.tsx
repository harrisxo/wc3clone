import Image from "next/image";
import { buyHeroItem, cancelJob, startBuild, startResearch, trainUnit } from "@/lib/actions/game";
import type { Race } from "@/lib/auth";
import type { getGameState } from "@/lib/game-system";
import { foodBuildingCost, maxQueueSlots, queueUpgradeCost, researchCost } from "@/lib/costs";
import { researchDefs } from "@/lib/game-data";
import { Countdown } from "@/components/game/countdown";
import { UnitQuantityControls } from "@/components/game/unit-quantity-controls";

export function BuildingDetailView({ state, home, buildingKey, race }: { state: ReturnType<typeof getGameState>; home: { x: number; y: number }; buildingKey: string; race: Race }) {
  const now = new Date(state.economy.updatedAt).getTime();
  const def = state.buildingDefs.find((d) => d.key === buildingKey)!;
  const owned = state.buildings.find((b) => b.building_key === buildingKey)!;
  const availableUnits = state.unitDefs.filter((unit) => unit.building === buildingKey);
  const activeUnitJobs = state.unitJobs.filter((job) => job.building_key === buildingKey);
  const activeBuildingJobs = state.buildJobs.filter((job) => job.building_key === buildingKey);
  const isForge = buildingKey === "forge";
  const activeResearchJobs = isForge ? state.researchJobs : [];
  const occupiedQueues = activeUnitJobs.reduce((sum, job) => sum + job.quantity, 0) + activeBuildingJobs.length + activeResearchJobs.length;
  const queueCost = queueUpgradeCost(owned.queue_slots);
  const foodCost = foodBuildingCost(state.foodCapacity);
  const pendingQueueJobs = activeBuildingJobs.filter((job) => job.job_type === "queue").length;
  const queueCapReached = owned.queue_slots + pendingQueueJobs >= maxQueueSlots(buildingKey);
  const activeJobs = [
    ...activeUnitJobs.map((job) => ({ id: job.id, type: "unit" as const, label: `${state.unitDefs.find((unit) => unit.key === job.unit_key)?.name ?? "Einheit"}${job.quantity > 1 ? ` ×${job.quantity}` : ""}`, finishes_at: job.finishes_at })),
    ...activeBuildingJobs.map((job) => ({ id: job.id, type: "build" as const, label: job.job_type === "food" ? "+10 Nahrung" : job.job_type === "queue" ? "Weitere Warteschlange" : job.job_type === "upgrade" ? "Upgrade" : "Bauauftrag", finishes_at: job.finishes_at })),
    ...activeResearchJobs.map((job) => ({ id: job.id, type: "research" as const, label: researchDefs.find((def) => def.key === job.research_key)?.name ?? "Forschung", finishes_at: job.finishes_at })),
  ].sort((a, b) => a.finishes_at.localeCompare(b.finishes_at));
  const freeSlots = owned.queue_slots - occupiedQueues;
  // Defense buildings sell hero items instantly: no queues, no upgrades.
  const isDefense = buildingKey === "defense";

  return <div className="units-view">
    <div className="panel-heading"><p className="section-kicker">Hauptdorf {home.y + 1}-{home.x + 1}</p><h2>{def.name}</h2><p>{isDefense ? "Sofortkauf ohne Warteschlange" : `${occupiedQueues} / ${owned.queue_slots} Warteschlangen belegt`}</p></div>
    <section className="building-queue-panel">
      <header><div className="selected-building-icon">{def.icon}</div><div><p className="section-kicker">Gebäude</p><h3>{def.name}</h3><span>{isDefense ? "Sofortkauf ohne Warteschlange" : `${occupiedQueues} / ${owned.queue_slots} Warteschlangen belegt`}</span></div>{!isDefense && !queueCapReached && <form className="header-queue-upgrade" action={startBuild}><input type="hidden" name="building" value={buildingKey} /><input type="hidden" name="mode" value="queue" /><input type="hidden" name="returnView" value={buildingKey} /><button>Warteschlange erweitern · Gold {queueCost.gold} · Holz {queueCost.wood} · {Math.ceil(queueCost.seconds / 60)}m</button></form>}{!isDefense && queueCapReached && <span className="queue-cap-note">Max. {maxQueueSlots(buildingKey)} Warteschlangen</span>}</header>
      {!isDefense && <>
        <p className="queue-summary">{occupiedQueues} / {owned.queue_slots} Warteschlangen belegt{freeSlots > 0 ? ` · ${freeSlots} frei` : ""}</p>
        {activeJobs.length > 0 ? <div className="queue-list-wrap"><ul className="queue-list">
          {activeJobs.map((job) => <li key={`${job.type}-${job.id}`}><form className="queue-row" action={cancelJob}><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="jobType" value={job.type} /><input type="hidden" name="returnView" value={buildingKey} /><span className="queue-row-label">{job.label}</span><span className="queue-row-time"><Countdown finishesAt={job.finishes_at} initialRemainingSeconds={Math.max(0, Math.ceil((new Date(job.finishes_at).getTime() - now) / 1000))} /></span><button className="queue-row-cancel" type="submit" title="Abbrechen" aria-label={`${job.label} abbrechen`}>✕</button></form></li>)}
        </ul></div> : <p className="no-buildings">Keine aktiven Aufträge.</p>}
      </>}
      {def.kind === "food" && <form className="queue-upgrade-form" action={startBuild}><input type="hidden" name="building" value={buildingKey} /><input type="hidden" name="mode" value="food" /><input type="hidden" name="returnView" value={buildingKey} /><button>+10 Nahrung · Gold {foodCost.gold} · Holz {foodCost.wood} · {Math.ceil(foodCost.seconds / 60)}m</button></form>}
      {isForge && <section className="research-section">
        <h3>Forschung</h3>
        <div className="research-grid">
          {researchDefs.map((research) => {
            const level = state.researchLevels[research.key];
            const cost = researchCost(level);
            const running = activeResearchJobs.some((job) => job.research_key === research.key);
            const queueFull = occupiedQueues >= owned.queue_slots;
            return <form className="research-card" action={startResearch} key={research.key}>
              <input type="hidden" name="research" value={research.key} />
              <input type="hidden" name="returnView" value={buildingKey} />
              <div className="research-icon">{research.icon}</div>
              <div className="research-info">
                <h4>{research.name}</h4>
                <small>Level {level}{running ? " · In Forschung" : ""}</small>
                <p>{research.description}</p>
              </div>
              <button type="submit" disabled={running || queueFull}>
                {running ? "Läuft" : <>Level {level + 1} · Gold {cost.gold} · Holz {cost.wood} · {Math.ceil(cost.seconds / 60)}m</>}
              </button>
            </form>;
          })}
        </div>
      </section>}
      <div className="selected-unit-list">
        {availableUnits.filter((unit) => unit.role !== "hero").map((unit) => <form className="selected-unit" action={trainUnit} key={unit.key}>
          <input type="hidden" name="unit" value={unit.key} />
          <input type="hidden" name="returnView" value={buildingKey} />
          <button type="submit" name="quantity" value={1} className="selected-unit-trigger">
            <Image className="unit-icon-image" src={`/units/${race}-${unit.key}.png`} alt="" width={42} height={42} />
            <span className="selected-unit-info"><h4>{unit.name}</h4><small>{unit.supply} Nahrung · {Math.ceil(unit.seconds / 60)}m · ⚔ {unit.damage[0]}–{unit.damage[1]} · ▣ {unit.defense[0]}–{unit.defense[1]}</small><p>Gold {unit.gold} · Holz {unit.wood}</p></span>
          </button>
          <div className="selected-unit-quantity"><span>Anzahl</span><UnitQuantityControls /></div>
        </form>)}
      </div>
      {buildingKey === "defense" && <section className="hero-unit-section hero-item-shop">
        <h3>Ausrüstung für Helden</h3>
        {(() => {
          const heroesAtHome = state.heroUnits.filter((hero) => hero.alive === 1 && hero.x === home.x && hero.y === home.y);
          if (heroesAtHome.length === 0) return <p className="no-buildings">Mindestens ein Held muss sich im Hauptdorf befinden, um Türme oder Teleports zu kaufen.</p>;
          return <div className="selected-unit-list">
            {heroesAtHome.map((hero) => {
              const heroDef = state.unitDefs.find((unit) => unit.key === hero.hero_key);
              const total = hero.item_towers + hero.item_teleports;
              const full = total >= 6;
              return <article className="selected-unit selected-unit-hero" key={hero.hero_key}>
                <span className="selected-unit-trigger selected-unit-static">
                  <Image className="hero-portrait" src={`/heroes/${race}-${hero.hero_key.replace("_", "-")}.jpg`} alt={`Porträt von ${heroDef?.name ?? hero.hero_key}`} width={42} height={42} />
                  <span className="selected-unit-info"><h4>{heroDef?.name ?? hero.hero_key}</h4><small>Level {hero.level} · Inventar {total} / 6</small><p>♜ {hero.item_towers} Türme · ✦ {hero.item_teleports} Teleports</p></span>
                </span>
                <div className="hero-item-actions">
                  <form action={buyHeroItem}><input type="hidden" name="hero" value={hero.hero_key} /><input type="hidden" name="item" value="tower" /><input type="hidden" name="returnView" value={buildingKey} /><button disabled={full}>Turm · Gold 1 · Holz 1</button></form>
                  <form action={buyHeroItem}><input type="hidden" name="hero" value={hero.hero_key} /><input type="hidden" name="item" value="teleport" /><input type="hidden" name="returnView" value={buildingKey} /><button disabled={full}>Teleport · Gold 1 · Holz 1</button></form>
                </div>
              </article>;
            })}
          </div>;
        })()}
      </section>}
      {availableUnits.some((unit) => unit.role === "hero") && <section className="hero-unit-section">
        <h3>Helden</h3>
        <div className="selected-unit-list">
          {availableUnits.filter((unit) => unit.role === "hero").map((unit) => {
            const heroStatus = state.heroUnits.find((hero) => hero.hero_key === unit.key);
            const isBuilt = heroStatus?.alive === 1;
            const isDead = heroStatus?.alive === 0;
            const isPending = activeUnitJobs.some((job) => job.unit_key === unit.key);
            const statusText = isBuilt ? "Im Einsatz" : isPending ? "In Auftrag" : isDead ? "Gefallen" : "Unbeschworen";
            const actionLabel = !heroStatus ? "Bauen" : "Wiederbeleben";
            const description = isBuilt ? "Bereits im Dienst" : isPending ? "Ausbildung läuft bereits" : isDead ? "Kann im Heldenturm wiederbelebt werden" : "Noch nicht beschworen";
            const portrait = `/heroes/${race}-${unit.key.replace("_", "-")}.jpg`;
            const info = <span className="selected-unit-info"><h4>{unit.name}</h4><small>Level {heroStatus?.level ?? 1} · {statusText}</small><p>{description}</p></span>;

            if (isBuilt || isPending) return <article className="selected-unit selected-unit-hero" key={unit.key}>
              <span className="selected-unit-trigger selected-unit-static"><Image className="hero-portrait" src={portrait} alt={`Porträt von ${unit.name}`} width={42} height={42} />{info}</span>
              {isPending && <button className="selected-unit-action" disabled>In Auftrag</button>}
            </article>;

            return <form className="selected-unit selected-unit-hero" action={trainUnit} key={unit.key}>
              <input type="hidden" name="unit" value={unit.key} />
              <input type="hidden" name="returnView" value={buildingKey} />
              <button type="submit" className="selected-unit-trigger"><Image className="hero-portrait" src={portrait} alt={`Porträt von ${unit.name}`} width={42} height={42} />{info}</button>
              <span className="selected-unit-action-label">{actionLabel}</span>
            </form>;
          })}
        </div>
      </section>}
    </section>
  </div>;
}

