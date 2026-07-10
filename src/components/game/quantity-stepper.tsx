"use client";
import { useState } from "react";

export function QuantityStepper({ name, defaultValue = 1, min = 1, max = 999 }: { name: string; defaultValue?: number; min?: number; max?: number }) {
  const clamp = (value: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? Math.floor(value) : min));
  const [value, setValue] = useState(() => clamp(defaultValue));

  return <div className="quantity-stepper">
    <button type="button" onClick={() => setValue((current) => clamp(current - 1))} disabled={value <= min} aria-label="Weniger">−</button>
    <input type="number" name={name} min={min} max={max} value={value} onChange={(event) => setValue(clamp(Number(event.target.value)))} />
    <button type="button" onClick={() => setValue((current) => clamp(current + 1))} disabled={value >= max} aria-label="Mehr">+</button>
  </div>;
}
