"use client";
import { useEffect, useState } from "react";
import type { EconomyState } from "@/lib/economy";

type HeaderState = EconomyState & { foodUsed: number; foodCapacity: number };

export function ResourceHeader({ initial }: { initial: HeaderState }) {
  const [state, setState] = useState(initial);
  useEffect(() => {
    const refresh = async () => {
      const response = await fetch("/api/resources", { cache: "no-store" });
      if (response.ok) setState(await response.json() as HeaderState);
    };
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, []);
  return <div className="resource-header" aria-label="Ressourcen">
    <div className="resource-value resource-gold"><span>●</span><div><small>Gold</small><strong>{Math.floor(state.gold).toLocaleString("de-DE")} / {state.goldCapacity.toLocaleString("de-DE")}</strong></div></div>
    <div className="resource-value resource-wood"><span>♣</span><div><small>Holz</small><strong>{Math.floor(state.wood).toLocaleString("de-DE")} / {state.woodCapacity.toLocaleString("de-DE")}</strong></div></div>
    <div className="resource-value resource-food"><span>◆</span><div><small>Nahrung</small><strong>{state.foodUsed} / {state.foodCapacity}</strong></div></div>
  </div>;
}



