import "server-only";
import { database } from "@/lib/db";
import { accrueResources, previewResources } from "@/lib/economy";
import { buildingsByRace, unitsByRace } from "@/lib/game-data";
import type { Race } from "@/lib/auth";

export function processGameJobs(userId:number, race:Race) {
  const now=new Date().toISOString();
  const builds=database.prepare("SELECT id,building_key,job_type FROM build_jobs WHERE user_id=? AND finishes_at<=?").all(userId,now) as {id:number;building_key:string;job_type:string}[];
  for(const job of builds){
    if(job.job_type==="build") database.prepare("INSERT OR IGNORE INTO player_buildings(user_id,building_key) VALUES(?,?)").run(userId,job.building_key);
    else if(job.job_type==="food") database.prepare("UPDATE users SET food_capacity=food_capacity+10 WHERE id=?").run(userId);
    else if(job.job_type==="queue") database.prepare("UPDATE player_buildings SET queue_slots=queue_slots+1 WHERE user_id=? AND building_key=?").run(userId,job.building_key);
    else database.prepare("UPDATE player_buildings SET upgrade_level=upgrade_level+1 WHERE user_id=? AND building_key=?").run(userId,job.building_key);
    database.prepare("DELETE FROM build_jobs WHERE id=?").run(job.id);
  }
  const units=database.prepare("SELECT id,unit_key,quantity FROM unit_jobs WHERE user_id=? AND finishes_at<=?").all(userId,now) as {id:number;unit_key:string;quantity:number}[];
  for(const job of units){
    const def=unitsByRace[race].find(u=>u.key===job.unit_key);
    if(def?.worker) database.prepare("UPDATE users SET total_workers=total_workers+? WHERE id=?").run(job.quantity,userId);
    else database.prepare("INSERT INTO unit_stacks(user_id,unit_key,quantity) VALUES(?,?,?) ON CONFLICT(user_id,unit_key) DO UPDATE SET quantity=quantity+excluded.quantity").run(userId,job.unit_key,job.quantity);
    database.prepare("DELETE FROM unit_jobs WHERE id=?").run(job.id);
  }
  database.prepare("INSERT OR IGNORE INTO player_buildings(user_id,building_key) VALUES(?,'main')").run(userId);
}

export function getGameState(userId:number,race:Race,options?:{persist?:boolean}){
  processGameJobs(userId,race);
  const economy=options?.persist===false?previewResources(userId):accrueResources(userId);
  const profile=database.prepare("SELECT food_capacity FROM users WHERE id=?").get(userId) as {food_capacity:number};
  const buildings=database.prepare("SELECT building_key,queue_slots,upgrade_level FROM player_buildings WHERE user_id=?").all(userId) as {building_key:string;queue_slots:number;upgrade_level:number}[];
  const buildJobs=database.prepare("SELECT id,building_key,job_type,finishes_at FROM build_jobs WHERE user_id=? ORDER BY finishes_at").all(userId) as {id:number;building_key:string;job_type:string;finishes_at:string}[];
  const stacks=database.prepare("SELECT unit_key,quantity FROM unit_stacks WHERE user_id=? AND quantity>0").all(userId) as {unit_key:string;quantity:number}[];
  const unitJobs=database.prepare("SELECT id,building_key,unit_key,quantity,finishes_at FROM unit_jobs WHERE user_id=? ORDER BY finishes_at").all(userId) as {id:number;building_key:string;unit_key:string;quantity:number;finishes_at:string}[];
  const unitSupply=stacks.reduce((sum,s)=>sum+(unitsByRace[race].find(u=>u.key===s.unit_key)?.supply??0)*s.quantity,0);
  const pendingSupply=unitJobs.reduce((sum,j)=>sum+(unitsByRace[race].find(u=>u.key===j.unit_key)?.supply??0)*j.quantity,0);
  return {economy,buildings,buildJobs,stacks,unitJobs,foodCapacity:profile.food_capacity,supplyUsed:economy.totalWorkers+unitSupply+pendingSupply,busyWorkers:buildJobs.filter(j=>j.job_type==="build").length,buildingDefs:buildingsByRace[race],unitDefs:unitsByRace[race]};
}

