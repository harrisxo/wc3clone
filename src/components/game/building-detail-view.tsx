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
  const hasFoodJob = activeBuildingJobs.some((job) => job.job_type === "food");
  const hasUpgradeJob = activeBuildingJobs.some((job) => job.job_type === "upgrade");
  const queueCost = queueUpgradeCost(owned.queue_slots);
  const foodCost = foodBuildingCost(state.foodCapacity);
  const upgradeCost = buildingUpgradeCost(owned.upgrade_level);
  const jobs = [...activeUnitJobs.map((job) => ({ label: state.unitDefs.find((unit) => unit.key === job.unit_key)?.name ?? "Einheit", finishes_at: job.finishes_at })), ...activeBuildingJobs.map((job) => ({ label: job.job_type === "food" ? "+10 Nahrung" : job.job_type === "queue" ? "Weitere Queue" : job.job_type === "upgrade" ? "Upgrade" : "Bauauftrag", finishes_at: job.finishes_at }))];
  const cancelableJobs = [...activeUnitJobs.map((job) => ({ id: job.id, type: "unit" as const, label: state.unitDefs.find((unit) => unit.key === job.unit_key)?.name ?? "Einheit", finishes_at: job.finishes_at })), ...activeBuildingJobs.map((job) => ({ id: job.id, type: "build" as const, label: job.job_type === "food" ? "+10 Nahrung" : job.job_type === "queue" ? "Weitere Queue" : job.job_type === "upgrade" ? "Upgrade" : "Bauauftrag", finishes_at: job.finishes_at }))];

  return <div className="units-view">
    <div className="panel-heading"><p className="section-kicker">Hauptdorf {home.y + 1}-{home.x + 1}</p><h2>{def.name}</h2><p>{occupiedQueues} / {owned.queue_slots} Queues belegt{def.kind !== "main" && def.kind !== "food" ? ` · Upgrade ${owned.upgrade_level}` : ""}</p></div>
    <section className="building-queue-panel">
      <header><div className="selected-building-icon">{def.icon}</div><div><p className="section-kicker">Gebäude</p><h3>{def.name}</h3><span>{occupiedQueues} / {owned.queue_slots} Queues belegt</span></div></header>
      <div className="queue-slots">{Array.from({ length: owned.queue_slots }, (_, index) => {
        const job = jobs[index];
        const cancelable = cancelableJobs[index];

        return job ? <form action={cancelJob} key={index}><input type="hidden" name="jobId" value={cancelable.id} /><input type="hidden" name="jobType" value={cancelable.type} /><input type="hidden" name="returnView" value={buildingKey} /><button className="queue-slot queue-slot-button" type="submit"><div className="queue-slot-head"><b>Queue {index + 1}</b><span className="queue-status queue-status-active">Läuft</span></div><strong>{job.label}</strong><span className="queue-time"><Countdown finishesAt={job.finishes_at} initialRemainingSeconds={Math.max(0, Math.ceil((new Date(job.finishes_at).getTime() - now) / 1000))} /></span><small>Klicken zum Abbrechen</small></button></form> : <div className="queue-slot" key={index}><div className="queue-slot-head"><b>Queue {index + 1}</b><span className="queue-status">Bereit</span></div><strong>Kein Auftrag</strong><small>Frei für neue Einträge</small></div>;
      })}</div>
      <form className="queue-upgrade-form" action={startBuild}><input type="hidden" name="building" value={buildingKey} /><input type="hidden" name="mode" value="queue" /><input type="hidden" name="returnView" value={buildingKey} /><button>Weitere Queue bauen · ● {queueCost.gold} ♣ {queueCost.wood} · ◷ {Math.ceil(queueCost.seconds / 60)}m</button></form>
      {def.kind === "food" && <form className="queue-upgrade-form" action={startBuild}><input type="hidden" name="building" value={buildingKey} /><input type="hidden" name="mode" value="food" /><input type="hidden" name="returnView" value={buildingKey} /><button disabled={hasFoodJob}>+10 Nahrung · ● {foodCost.gold} ♣ {foodCost.wood} · ◷ {Math.ceil(foodCost.seconds / 60)}m</button></form>}
      {(def.kind === "upgrade" || def.kind === "special") && <form className="queue-upgrade-form" action={startBuild}><input type="hidden" name="building" value={buildingKey} /><input type="hidden" name="mode" value="upgrade" /><input type="hidden" name="returnView" value={buildingKey} /><button disabled={hasUpgradeJob}>Upgrade +1 · ● {upgradeCost.gold} ♣ {upgradeCost.wood} · ◷ {Math.ceil(upgradeCost.seconds / 60)}m</button></form>}
      {availableUnits.length > 0 && <div className="selected-unit-list">
        {availableUnits.map((unit) => {
          const heroStatus = state.heroUnits.find((hero) => hero.hero_key === unit.key);
          const isHero = unit.role === "hero";

          return <article className="selected-unit" key={unit.key}><span className="unit-icon">{unit.icon}</span><div><h4>{unit.name}</h4><small>{isHero ? `Einmalig · Level ${heroStatus?.level ?? 1}` : `${unit.supply} Nahrung · ◷ ${Math.ceil(unit.seconds / 60)}m`}</small><p>{isHero ? heroStatus?.alive === 0 ? "Gefallen · Wiederbelebung möglich" : "Bereits im Dienst" : `● ${unit.gold} &nbsp; ♣ ${unit.wood}`}</p></div>{isHero ? heroStatus?.alive === 1 ? <button disabled>Einzigartig</button> : <form action={trainUnit}><input type="hidden" name="unit" value={unit.key} /><input type="hidden" name="returnView" value={buildingKey} /><button>Wiederbeleben</button></form> : <form action={trainUnit}><input type="hidden" name="unit" value={unit.key} /><input type="hidden" name="returnView" value={buildingKey} /><button>Ausbilden</button></form>}</article>;
        })}
      </div>}
    </section>
  </div>;
}