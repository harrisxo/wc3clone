import { startBuild } from "@/lib/actions/game";
import type { getGameState } from "@/lib/game-system";

export function BuildView({ state }: { state: ReturnType<typeof getGameState> }) {
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
