"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function formatRemaining(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function Countdown({ finishesAt, initialRemainingSeconds }: { finishesAt: string; initialRemainingSeconds: number }) {
  const router = useRouter();
  const refreshed = useRef(false);
  const [remainingSeconds, setRemainingSeconds] = useState(Math.max(0, initialRemainingSeconds));

  useEffect(() => {
    const targetTime = new Date(finishesAt).getTime();

    function tick() {
      const nextRemaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
      setRemainingSeconds(nextRemaining);

      if (nextRemaining === 0 && !refreshed.current) {
        refreshed.current = true;
        router.refresh();
      }
    }

    tick();
    const intervalId = window.setInterval(tick, 1000);

    return () => window.clearInterval(intervalId);
  }, [finishesAt, router]);

  return <span>{formatRemaining(remainingSeconds)}</span>;
}
