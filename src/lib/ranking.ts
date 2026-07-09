import "server-only";
import { database } from "@/lib/db";
import { accrueResources } from "@/lib/economy";
import { processGameJobs } from "@/lib/game-system";
import { unitsByRace } from "@/lib/game-data";
import type { Race } from "@/lib/auth";

export function updateRankingsIfDue(){
  const now=Date.now(); const marker=database.prepare("SELECT value FROM app_meta WHERE key='ranking_last_calculated_at'").get() as {value:string}|undefined;
  if(marker&&now-new Date(marker.value).getTime()<600_000)return;
  const users=database.prepare("SELECT id,race FROM users WHERE race IS NOT NULL").all() as {id:number;race:Race}[];
  for(const user of users){
    processGameJobs(user.id,user.race); const eco=accrueResources(user.id);
    const territory=database.prepare(`SELECT SUM(CASE WHEN field_type IN ('small','medium') THEN 1 ELSE 0 END) villages,SUM(CASE WHEN field_type='goldmine' THEN 1 ELSE 0 END) mines FROM world_tiles WHERE conquered_by_user_id=?`).get(user.id) as {villages:number|null;mines:number|null};
    const stacks=database.prepare("SELECT unit_key,quantity FROM unit_stacks WHERE user_id=?").all(user.id) as {unit_key:string;quantity:number}[];
    const supply=stacks.reduce((s,row)=>s+(unitsByRace[user.race].find(u=>u.key===row.unit_key)?.supply??0)*row.quantity,0);
    const upgrades=database.prepare("SELECT building_key,upgrade_level FROM player_buildings WHERE user_id=?").all(user.id) as {building_key:string;upgrade_level:number}[];
    const upgradePoints=upgrades.reduce((s,u)=>s+u.upgrade_level*(user.race==="orc"&&u.building_key==="forge"?1.5:1),0);
    const villages=territory.villages??0,mines=territory.mines??0,resourcePoints=Math.floor(eco.gold/250+eco.wood/500);
    const points=Math.floor(mines*10+villages+supply+resourcePoints+upgradePoints);
    database.prepare(`INSERT INTO ranking_snapshots(user_id,points,villages,mines,unit_supply,resource_points,hero_points,upgrade_points,calculated_at) VALUES(?,?,?,?,?,?,0,?,?) ON CONFLICT(user_id) DO UPDATE SET points=excluded.points,villages=excluded.villages,mines=excluded.mines,unit_supply=excluded.unit_supply,resource_points=excluded.resource_points,upgrade_points=excluded.upgrade_points,calculated_at=excluded.calculated_at`).run(user.id,points,villages,mines,supply,resourcePoints,upgradePoints,new Date(now).toISOString());
  }
  database.prepare("INSERT INTO app_meta(key,value) VALUES('ranking_last_calculated_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(new Date(now).toISOString());
}

export function getRanking(){
  updateRankingsIfDue();
  return database.prepare(`SELECT u.id,u.display_name AS username,u.race,r.points,r.villages,r.mines,r.unit_supply,r.resource_points,r.hero_points,r.upgrade_points,r.calculated_at,w.x home_x,w.y home_y FROM ranking_snapshots r JOIN users u ON u.id=r.user_id LEFT JOIN world_tiles w ON w.owner_user_id=u.id ORDER BY r.points DESC,u.id ASC`).all() as {id:number;username:string;race:Race;points:number;villages:number;mines:number;unit_supply:number;resource_points:number;hero_points:number;upgrade_points:number;calculated_at:string;home_x:number|null;home_y:number|null}[];
}

