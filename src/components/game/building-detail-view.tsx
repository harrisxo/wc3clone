import { startBuild, trainUnit } from "@/lib/actions/game";
import type { getGameState } from "@/lib/game-system";

export function BuildingDetailView({ state, home, buildingKey }: { state: ReturnType<typeof getGameState>; home: { x: number; y: number }; buildingKey: string }) {
  const def=state.buildingDefs.find(d=>d.key===buildingKey)!;
  const owned=state.buildings.find(b=>b.building_key===buildingKey)!;
  const availableUnits=state.unitDefs.filter(unit=>unit.building===buildingKey);
  const activeUnitJobs=state.unitJobs.filter(job=>job.building_key===buildingKey);
  const activeBuildingJobs=state.buildJobs.filter(job=>job.building_key===buildingKey);
  const occupiedQueues=activeUnitJobs.length+activeBuildingJobs.length;
  const hasFoodJob=activeBuildingJobs.some(job=>job.job_type==="food");
  const hasUpgradeJob=activeBuildingJobs.some(job=>job.job_type==="upgrade");
  return <div className="units-view">
    <div className="panel-heading"><p className="section-kicker">Hauptdorf {home.y+1}-{home.x+1}</p><h2>{def.name}</h2><p>{occupiedQueues} / {owned.queue_slots} Queues belegt{def.kind!=="main"&&def.kind!=="food"?` · Upgrade ${owned.upgrade_level}`:""}</p></div>
    <section className="building-queue-panel">
      <header><div className="selected-building-icon">{def.icon}</div><div><p className="section-kicker">Gebäude</p><h3>{def.name}</h3><span>{occupiedQueues} / {owned.queue_slots} Queues belegt</span></div></header>
      <div className="queue-slots">{Array.from({length:owned.queue_slots},(_,index)=>{const job=[...activeUnitJobs,...activeBuildingJobs][index];return <div className={`queue-slot${job?" occupied":""}`} key={index}><b>Queue {index+1}</b><span>{job?"Auftrag läuft":"Bereit"}</span></div>})}</div>
      <form className="queue-upgrade-form" action={startBuild}><input type="hidden" name="building" value={buildingKey}/><input type="hidden" name="mode" value="queue"/><input type="hidden" name="returnView" value={buildingKey}/><button>Weitere Queue bauen</button></form>
      {def.kind==="food"&&<form className="queue-upgrade-form" action={startBuild}><input type="hidden" name="building" value={buildingKey}/><input type="hidden" name="mode" value="food"/><input type="hidden" name="returnView" value={buildingKey}/><button disabled={hasFoodJob}>+10 Nahrung</button></form>}
      {(def.kind==="upgrade"||def.kind==="special")&&<form className="queue-upgrade-form" action={startBuild}><input type="hidden" name="building" value={buildingKey}/><input type="hidden" name="mode" value="upgrade"/><input type="hidden" name="returnView" value={buildingKey}/><button disabled={hasUpgradeJob}>Upgrade +1</button></form>}
      {availableUnits.length>0&&<div className="selected-unit-list">
        {availableUnits.map(unit=><article className="selected-unit" key={unit.key}><span className="unit-icon">{unit.icon}</span><div><h4>{unit.name}</h4><small>{unit.supply} Nahrung · ◷ {Math.ceil(unit.seconds/60)}m</small><p>● {unit.gold} &nbsp; ♣ {unit.wood}</p></div><form action={trainUnit}><input type="hidden" name="unit" value={unit.key}/><input type="hidden" name="returnView" value={buildingKey}/><button>Ausbilden</button></form></article>)}
      </div>}
    </section>
  </div>;
}
