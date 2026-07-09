"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function MapScroller({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = viewport.current;
    const home = container?.querySelector<HTMLElement>(".home-tile");
    if (!container || !home) return;
    container.scrollLeft = Math.max(0, home.offsetLeft - container.clientWidth / 2 + home.clientWidth / 2);
  }, []);

  return <div className="map-scroll" ref={viewport}>{children}</div>;
}
