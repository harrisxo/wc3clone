"use server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { database } from "@/lib/db";
import { getGameState } from "@/lib/game-system";

export async function startBuild(formData:FormData){
  const user=await getCurrentUser(); if(!user?.race) redirect("/");
  const key=String(formData.get("building")); const mode=String(formData.get("mode")||"build");
  const returnView=formData.get("returnView")==="einheiten"?"einheiten":"bauen";
  const state=getGameState(user.id,user.race); const def=state.buildingDefs.find(b=>b.key===key); if(!def||(def.kind==="main"&&mode!=="queue")) redirect(`/game?view=${returnView}&notice=invalid`);
  const owned=state.buildings.find(b=>b.building_key===key); const active=state.buildJobs.filter(j=>j.building_key===key).length;
  let gold=def.gold,wood=def.wood,seconds=def.seconds,jobType="build";
  if(mode==="food"&&owned&&def.kind==="food"){gold=100+Math.floor((state.foodCapacity-10)/10)*35;wood=60+Math.floor((state.foodCapacity-10)/10)*20;seconds=120;jobType="food";}
  else if(mode==="queue"&&owned){gold=300*owned.queue_slots;wood=250*owned.queue_slots;seconds=300;jobType="queue";}
  else if(mode==="upgrade"&&owned){gold=180+(owned.upgrade_level*120);wood=140+(owned.upgrade_level*90);seconds=240+(owned.upgrade_level*60);jobType="upgrade";}
  else if(owned||state.buildJobs.some(j=>j.building_key===key&&j.job_type==="build")) redirect(`/game?view=${returnView}`);
  if(owned&&active>=owned.queue_slots) redirect(`/game?view=${returnView}`);
  const idle=state.economy.totalWorkers-state.economy.goldWorkers-state.economy.woodWorkers-state.busyWorkers;
  if(jobType==="build"&&idle<1) redirect(`/game?view=${returnView}&notice=worker`);
  if(state.economy.gold<gold||state.economy.wood<wood) redirect(`/game?view=${returnView}&notice=resources`);
  database.prepare("UPDATE users SET gold=gold-?,wood=wood-? WHERE id=?").run(gold,wood,user.id);
  database.prepare("INSERT INTO build_jobs(user_id,building_key,job_type,finishes_at) VALUES(?,?,?,?)").run(user.id,key,jobType,new Date(Date.now()+seconds*1000).toISOString());
  redirect(`/game?view=${returnView}`);
}

export async function trainUnit(formData:FormData){
  const user=await getCurrentUser(); if(!user?.race) redirect("/");
  const key=String(formData.get("unit")); const state=getGameState(user.id,user.race); const def=state.unitDefs.find(u=>u.key===key); if(!def) redirect("/game?view=einheiten&notice=invalid");
  const building=state.buildings.find(b=>b.building_key===def.building); if(!building) redirect("/game?view=einheiten&notice=building");
  const active=state.unitJobs.filter(j=>j.building_key===def.building).length; if(active>=building.queue_slots) redirect("/game?view=einheiten&notice=queue");
  if(state.supplyUsed+def.supply>state.foodCapacity) redirect("/game?view=einheiten&notice=food");
  if(state.economy.gold<def.gold||state.economy.wood<def.wood) redirect("/game?view=einheiten&notice=resources");
  database.prepare("UPDATE users SET gold=gold-?,wood=wood-? WHERE id=?").run(def.gold,def.wood,user.id);
  database.prepare("INSERT INTO unit_jobs(user_id,building_key,unit_key,finishes_at) VALUES(?,?,?,?)").run(user.id,def.building,key,new Date(Date.now()+def.seconds*1000).toISOString());
  redirect("/game?view=einheiten");
}





