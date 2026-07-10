import Link from "next/link";
import type { getRanking } from "@/lib/ranking";
import { raceData } from "./shared";

export function RankingView({ rows, selectedId }: { rows: ReturnType<typeof getRanking>; selectedId:number|null }) {
  const selected=rows.find(r=>r.id===selectedId);
  return <div className="ranking-view"><div className="panel-heading centered"><p className="section-kicker">Kontinent 1</p><h2>Ranking</h2><p>{"Aktualisierung alle zehn Minuten \u00b7 Gilden folgen sp\u00e4ter"}</p></div>
    <div className="game-table-wrap"><table className="game-table ranking-table"><thead><tr><th>#</th><th>Name</th><th>Rasse</th><th>Gilde</th><th>Hauptdorf</th><th>{"D\u00f6rfer"}</th><th>Minen</th><th>Punkte</th></tr></thead><tbody>{rows.map((row,i)=><tr key={row.id}><td>{i+1}</td><td><Link href={`/game?view=ranking&player=${row.id}`}>{row.username}</Link></td><td>{raceData[row.race].name}</td><td>&mdash;</td><td>{row.home_y === null || row.home_x === null ? "\u2014" : <Link href={`/game?view=karte&x=${Math.max(0, row.home_x - 4)}&field=${row.home_y + 1}-${row.home_x + 1}`}>{row.home_y + 1}-{row.home_x + 1}</Link>}</td><td>{row.villages}</td><td>{row.mines}</td><td>{row.points}</td></tr>)}</tbody></table></div>
    {selected&&<div className="score-breakdown"><h3>Punkte von {selected.username}</h3><div><span>{"D\u00f6rfer"} <b>{selected.villages}</b></span><span>Minen <b>{selected.mines*10}</b></span><span>Einheiten <b>{selected.unit_supply}</b></span><span>Rohstoffe <b>{selected.resource_points}</b></span><span>Helden <b>{selected.hero_points}</b></span><span>Upgrades <b>{Math.floor(selected.upgrade_points)}</b></span></div></div>}
  </div>;
}




