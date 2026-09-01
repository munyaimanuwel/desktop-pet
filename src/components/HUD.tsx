'use client';

import type { PetState } from '../types/pet-api';

// A small overlay with level/XP and the three need bars. Shown on hover.
export default function HUD({ state, onFeed }: { state: PetState; onFeed: () => void }) {
  return (
    <div className="hud">
      <div className="hud-row">
        <span className="hud-name">
          {state.name} · Lv {state.level}
        </span>
        <span className="hud-mood">{state.mood}</span>
      </div>
      <Bar label="XP" value={state.xp} max={100} accent="xp" />
      <Bar label="Happy" value={state.happiness} max={100} accent="happy" />
      <Bar label="Energy" value={state.energy} max={100} accent="energy" />
      <Bar label="Hunger" value={state.hunger} max={100} accent="hunger" />
      <button type="button" className="hud-feed" onClick={onFeed}>
        Feed
      </button>
    </div>
  );
}

function Bar({ label, value, max, accent }: { label: string; value: number; max: number; accent: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="hud-bar">
      <span className="hud-bar-label">{label}</span>
      <div className="hud-bar-track">
        <div className={`hud-bar-fill hud-bar-fill--${accent}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
