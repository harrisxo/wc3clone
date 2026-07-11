"use client";
import { useRef } from "react";

// Renders inside the same <form action={trainUnit}> as the main trigger
// button. Preset buttons submit immediately with their own quantity; the
// exact-input's "Bauen" button carries no name so it doesn't shadow the
// input's value. The main trigger button (rendered by the caller, earlier in
// the DOM) always carries name="quantity" value="1", so FormData.get picks
// that up first regardless of what's typed here — building 1 as usual.
const PRESETS = [5, 10, 20, 50, 100];

export function UnitQuantityControls() {
  const buildButtonRef = useRef<HTMLButtonElement>(null);

  return <div className="unit-quantity-controls">
    <div className="quantity-presets">
      {PRESETS.map((amount) => <button type="submit" name="quantity" value={amount} key={amount}>{amount}</button>)}
    </div>
    <div className="quantity-exact">
      <input
        type="number"
        name="quantity"
        min={1}
        max={999}
        defaultValue={1}
        aria-label="Genaue Anzahl"
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); buildButtonRef.current?.click(); } }}
      />
      <button type="submit" ref={buildButtonRef}>Bauen</button>
    </div>
  </div>;
}
