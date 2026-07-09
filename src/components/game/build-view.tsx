import { startBuild } from "@/lib/actions/game";
import type { getGameState } from "@/lib/game-system";

export function BuildView({ state }: { state: ReturnType<typeof getGameState> }) {
  const now=new Date(state.economy.updatedAt).getTime();
  const buildable=state.buildingDefs.filter(def=>def.kind!=="main"&&!state.buildings.some(b=>b.building_key===def.key));
  return <div className="build-view"><div className="panel-heading"><p className="section-kicker">Hauptdorf</p><h2>Gebäude errichten</h2><p>Jeder Neubau bindet bis zur Fertigstellung einen freien Arbeiter. Errichtete Gebäude findest du links in der Navigation.</p></div>
    <div className="building-grid">{buildable.map(def=>{
      const jobs=state.buildJobs.filter(j=>j.building_key===def.key); const building=jobs.find(j=>j.job_type==="build");
      return <article className="building-card" key={def.key}><div className="building-icon">{def.icon}</div><div className="building-info"><h3>{def.name}</h3><div className="cost-line"><span>● {def.gold}</span><span>♣ {def.wood}</span><span>◷ {Math.ceil(def.seconds/60)}m</span></div>
        {building&&<small>Im Bau · noch {Math.max(1,Math.ceil((new Date(building.finishes_at).getTime()-now)/60000))}m</small>}
      </div><div className="building-actions">
        {!building&&<form action={startBuild}><input type="hidden" name="building" value={def.key}/><button>Bauen</button></form>}
      </div></article>})}</div>
    {buildable.length===0&&<p className="no-buildings">Alle verfügbaren Gebäude sind bereits errichtet.</p>}
    <div className="build-footer"><span>Freie Arbeiter: {state.economy.totalWorkers-state.economy.goldWorkers-state.economy.woodWorkers-state.busyWorkers}</span><span>Nahrung: {state.supplyUsed} / {state.foodCapacity}</span><span>Aktive Bauaufträge: {state.buildJobs.length}</span></div>
  </div>;
}
