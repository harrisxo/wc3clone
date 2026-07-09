import Link from "next/link";
import { startBuild, trainUnit } from "@/lib/actions/game";
import type { getGameState } from "@/lib/game-system";

export function UnitsView({ state, home, selectedKey }: { state: ReturnType<typeof getGameState>; home:{x:number;y:number}; selectedKey:string }) {
  const quantities=new Map(state.stacks.map(s=>[s.unit_key,s.quantity]));
  const builtDefs=state.buildingDefs.filter(def=>state.buildings.some(building=>building.building_key===def.key));
  const selected=builtDefs.find(def=>def.key===selectedKey)??builtDefs.find(def=>def.key==="main")!;
  const selectedBuilding=state.buildings.find(building=>building.building_key===selected.key)!;
  const availableUnits=state.unitDefs.filter(unit=>unit.building===selected.key);
  const activeUnitJobs=state.unitJobs.filter(job=>job.building_key===selected.key);
  const activeBuildingJobs=state.buildJobs.filter(job=>job.building_key===selected.key);
  const occupiedQueues=activeUnitJobs.length+activeBuildingJobs.length;
  const orderedDefs=[...builtDefs.filter(def=>def.kind!=="main"),...builtDefs.filter(def=>def.kind==="main")];
  return <div className="units-view">
    <div className="panel-heading"><p className="section-kicker">Hauptdorf {home.y+1}-{home.x+1}</p><h2>Ausbildung und Gebäude</h2><p>Nahrung: {state.supplyUsed} / {state.foodCapacity}</p></div>
    <div className="unit-building-layout">
      <nav className="unit-building-nav" aria-label="Ausbildungsgebäude">
        {orderedDefs.map(def=><Link className={selected.key===def.key?"active":""} href={`/game?view=einheiten&building=${def.key}`} key={def.key}><i>{def.icon}</i><span><strong>{def.name}</strong><small>{def.kind==="main"?"Arbeiter und Verwaltung":state.unitDefs.some(unit=>unit.building===def.key)?"Einheiten ausbilden":"Upgrades und Verwaltung"}</small></span></Link>)}
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
      <tr><td>Insgesamt</td><td>—</td>{state.unitDefs.filter(unit=>!unit.worker).map(unit=><td key={unit.key}>{quantities.get(unit.key)??0}</td>)}</tr>
      <tr><td>{home.y+1}-{home.x+1}</td><td>HD</td>{state.unitDefs.filter(unit=>!unit.worker).map(unit=><td key={unit.key}>{quantities.get(unit.key)??0}</td>)}</tr>
    </tbody></table></div>
  </div>;
}
