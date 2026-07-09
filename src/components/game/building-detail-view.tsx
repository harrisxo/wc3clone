import { cancelJob, startBuild, trainUnit } from "@/lib/actions/game";
import type { getGameState } from "@/lib/game-system";
import { buildingUpgradeCost, foodBuildingCost, queueUpgradeCost } from "@/lib/costs";
import { Countdown } from "@/components/game/countdown";

export function BuildingDetailView({ state, home, buildingKey }: { state: ReturnType<typeof getGameState>; home: { x: number; y: number }; buildingKey: string }) {
  const now = new Date(state.economy.updatedAt).getTime();
  const def = state.buildingDefs.find((d) => d.key === buildingKey)!;
  const owned = state.buildings.find((b) => b.building_key === buildingKey)!;
  const availableUnits = state.unitDefs.filter((unit) => unit.building === buildingKey);
  const activeUnitJobs = state.unitJobs.filter((job) => job.building_key === buildingKey);
  const activeBuildingJobs = state.buildJobs.filter((job) => job.building_key === buildingKey);
  const occupiedQueues = activeUnitJobs.length + activeBuildingJobs.length;
  const hasUpgradeJob = activeBuildingJobs.some((job) => job.job_type === "upgrade");
  const queueCost = queueUpgradeCost(owned.queue_slots);
  const foodCost = foodBuildingCost(state.foodCapacity);
  const upgradeCost = buildingUpgradeCost(owned.upgrade_level);
  const activeJobs = [
    ...activeUnitJobs.map((job) => ({ id: job.id, type: "unit" as const, label: `${state.unitDefs.find((unit) => unit.key === job.unit_key)?.name ?? "Einheit"}${job.quantity > 1 ? ` ×${job.quantity}` : ""}`, finishes_at: job.finishes_at })),
    ...activeBuildingJobs.map((job) => ({ id: job.id, type: "build" as const, label: job.job_type === "food" ? "+10 Nahrung" : job.job_type === "queue" ? "Weitere Queue" : job.job_type === "upgrade" ? "Upgrade" : "Bauauftrag", finishes_at: job.finishes_at })),
  ];
  const freeSlots = owned.queue_slots - occupiedQueues;

  return <div className="units-view">
    <div className="panel-heading"><p className="section-kicker">Hauptdorf {home.y + 1}-{home.x + 1}</p><h2>{def.name}</h2><p>{occupiedQueues} / {owned.queue_slots} Queues belegt{def.kind !== "main" && def.kind !== "food" ? ` · Upgrade ${owned.upgrade_level}` : ""}</p></div>
    <section className="building-queue-panel">
      <header><div className="selected-building-icon">{def.icon}</div><div><p className="section-kicker">Gebäude</p><h3>{def.name}</h3><span>{occupiedQueues} / {owned.queue_slots} Queues belegt</span></div></header>
      <p className="queue-summary">{occupiedQueues} / {owned.queue_slots} Queues belegt{freeSlots > 0 ? ` · ${freeSlots} frei` : ""}</p>
      {activeJobs.length > 0 ? <div className="queue-list-wrap"><ul className="queue-list">
        {activeJobs.map((job) => <li key={`${job.type}-${job.id}`}><form className="queue-row" action={cancelJob}><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="jobType" value={job.type} /><input type="hidden" name="returnView" value={buildingKey} /><span className="queue-row-label">{job.label}</span><span className="queue-row-time"><Countdown finishesAt={job.finishes_at} initialRemainingSeconds={Math.max(0, Math.ceil((new Date(job.finishes_at).getTime() - now) / 1000))} /></span><button className="queue-row-cancel" type="submit" title="Abbrechen" aria-label={`${job.label} abbrechen`}>✕</button></form></li>)}
      </ul></div> : <p className="no-buildings">Keine aktiven Aufträge.</p>}
      <form className="queue-upgrade-form" action={startBuild}><input type="hidden" name="building" value={buildingKey} /><input type="hidden" name="mode" value="queue" /><input type="hidden" name="returnView" value={buildingKey} /><button>Weitere Queue bauen · Gold {queueCost.gold} · Holz {queueCost.wood} · {Math.ceil(queueCost.seconds / 60)}m</button></form>
      {def.kind === "food" && <form className="queue-upgrade-form" action={startBuild}><input type="hidden" name="building" value={buildingKey} /><input type="hidden" name="mode" value="food" /><input type="hidden" name="returnView" value={buildingKey} /><button>+10 Nahrung · Gold {foodCost.gold} · Holz {foodCost.wood} · {Math.ceil(foodCost.seconds / 60)}m</button></form>}      {(def.kind === "upgrade" || def.kind === "special") && <form className="queue-upgrade-form" action={startBuild}><input type="hidden" name="building" value={buildingKey} /><input type="hidden" name="mode" value="upgrade" /><input type="hidden" name="returnView" value={buildingKey} /><button disabled={hasUpgradeJob}>Upgrade +1 · Gold {upgradeCost.gold} · Holz {upgradeCost.wood} · {Math.ceil(upgradeCost.seconds / 60)}m</button></form>}
      <div className="selected-unit-list">
        {availableUnits.filter((unit) => unit.role !== "hero").map((unit) => <form className="selected-unit" action={trainUnit} key={unit.key}>
          <input type="hidden" name="unit" value={unit.key} />
          <input type="hidden" name="returnView" value={buildingKey} />
          <button type="submit" className="selected-unit-trigger">
            <span className="unit-icon">{unit.icon}</span>
            <span className="selected-unit-info"><h4>{unit.name}</h4><small>{unit.supply} Nahrung · {Math.ceil(unit.seconds / 60)}m</small><p>Gold {unit.gold} · Holz {unit.wood}</p></span>
          </button>
          <label className="selected-unit-quantity"><span>Anzahl</span><input type="number" name="quantity" min={1} max={999} defaultValue={1} /></label>
        </form>)}
      </div>
      {availableUnits.some((unit) => unit.role === "hero") && <section className="hero-unit-section">
        <h3>Helden</h3>
        <div className="selected-unit-list">
          {availableUnits.filter((unit) => unit.role === "hero").map((unit) => {
            const heroStatus = state.heroUnits.find((hero) => hero.hero_key === unit.key);
            const isBuilt = heroStatus?.alive === 1;
            const isDead = heroStatus?.alive === 0;
            const statusText = !heroStatus ? "Unbeschworen" : isDead ? "Gefallen" : "Im Einsatz";
            const actionLabel = !heroStatus || isDead ? (!heroStatus ? "Bauen" : "Wiederbeleben") : "Einzigartig";

            return <article className="selected-unit selected-unit-hero" key={unit.key}><div><h4>{unit.name}</h4><small>Level {heroStatus?.level ?? 1} · {statusText}</small><p>{!heroStatus ? "Noch nicht beschworen" : isDead ? "Kann im Heldenturm wiederbelebt werden" : "Bereits im Dienst"}</p></div>{isBuilt ? <button disabled>Einzigartig</button> : <form action={trainUnit}><input type="hidden" name="unit" value={unit.key} /><input type="hidden" name="returnView" value={buildingKey} /><button>{actionLabel}</button></form>}</article>;
          })}
        </div>
      </section>}
    </section>
  </div>;
}






