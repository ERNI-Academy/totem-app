"use client";

import { useEffect, useState } from "react";

type Props = { label: string; value: string; onChange: (value: string) => void };
type Hsl = { h: number; s: number; l: number };

const PRESETS = ["#17366f", "#033778", "#00aadb", "#00bef4", "#ffffff", "#404040", "#7a7d80", "#f2f2f2", "#e53935", "#fb8c00", "#fdd835", "#43a047", "#00897b", "#3949ab", "#8e24aa", "#d81b60"];

function toHsl(hex: string): Hsl {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "17366f";
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

function toHex({ h, s, l }: Hsl): string {
  const saturation = s / 100, lightness = l / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = lightness - c / 2;
  const sector = Math.floor(h / 60);
  const [r, g, b] = sector === 0 ? [c, x, 0] : sector === 1 ? [x, c, 0] : sector === 2 ? [0, c, x] : sector === 3 ? [0, x, c] : sector === 4 ? [x, 0, c] : [c, 0, x];
  return "#" + [r, g, b].map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("");
}

export function ColorPicker({ label, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  const { h, s, l } = toHsl(value);
  const setHsl = (next: Partial<Hsl>) => onChange(toHex({ h, s, l, ...next }));
  const setHexValue = (next: string) => {
    setHex(next);
    if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next.toLowerCase());
  };

  return <div className={"colour-control" + (open ? " is-open" : "")}>
    <div className="colour-control-heading"><span>{label}</span><button type="button" className="colour-picker-toggle" aria-label={"Choose " + label.toLowerCase()} aria-expanded={open} onClick={() => setOpen(v => !v)}><i style={{ backgroundColor: value }} />{open ? "Close" : value.toUpperCase()}</button></div>
    {open && <div className="colour-picker-panel">
      <label className="colour-slider"><span>Hue</span><input aria-label={label + " hue"} type="range" min="0" max="359" value={h} onChange={e => setHsl({ h: Number(e.target.value) })} className="hue-slider" /></label>
      <label className="colour-slider"><span>Saturation</span><input aria-label={label + " saturation"} type="range" min="0" max="100" value={s} onChange={e => setHsl({ s: Number(e.target.value) })} style={{ background: "linear-gradient(90deg, hsl(" + h + " 0% " + l + "%), hsl(" + h + " 100% " + l + "%))" }} /></label>
      <label className="colour-slider"><span>Lightness</span><input aria-label={label + " lightness"} type="range" min="0" max="100" value={l} onChange={e => setHsl({ l: Number(e.target.value) })} style={{ background: "linear-gradient(90deg, #000, hsl(" + h + " " + s + "% 50%), #fff)" }} /></label>
      <label className="colour-hex"><span>HEX</span><input aria-label={label + " HEX value"} value={hex} maxLength={7} spellCheck={false} onChange={e => setHexValue(e.target.value)} onBlur={() => { if (!/^#[0-9a-f]{6}$/i.test(hex)) setHex(value); }} /></label>
      <div className="colour-presets" aria-label={label + " colour presets"}>{PRESETS.map(color => <button type="button" key={color} aria-label={"Use " + color} aria-pressed={color.toLowerCase() === value.toLowerCase()} onClick={() => onChange(color)} style={{ backgroundColor: color }} />)}</div>
    </div>}
  </div>;
}
