'use client';

import { useCallback, useRef } from 'react';
import type { PetState } from '../types/pet-api';

// A small CSS/SVG blob creature. The `state` prop drives which animation
// class and face expression are applied.
// Dragging the pet moves the window; a click that barely moves still counts
// as a pet interaction.
export default function Pet({ state, onClick }: { state: PetState; onClick: () => void }) {
  const expression = FACE[state.state] || FACE.idle;

  const drag = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // left button only
    drag.current = { startX: e.screenX, startY: e.screenY, moved: false };
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      // screenX/Y are physical pixels; window positions are logical, so scale
      // the delta by the DPI ratio.
      const scale = window.devicePixelRatio || 1;
      const dx = (e.screenX - d.startX) / scale;
      const dy = (e.screenY - d.startY) / scale;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      if (d.moved) window.petAPI?.drag([Math.round(dx), Math.round(dy)]);
    },
    []
  );

  const onMouseUp = useCallback(() => {
    drag.current = null;
  }, []);

  const onClickCapture = useCallback(
    (e: React.MouseEvent) => {
      // Suppress the click if this was actually a drag.
      if (drag.current?.moved) e.stopPropagation();
    },
    []
  );

  return (
    <button
      type="button"
      className={`pet pet--${state.state}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onClickCapture={onClickCapture}
      onClick={onClick}
      aria-label={`Pet ${state.name}`}
      title={state.name}
    >
      <svg viewBox="0 0 120 120" role="img">
        <ellipse className="pet-shadow" cx="60" cy="106" rx="34" ry="7" />
        <ellipse className="pet-body" cx="60" cy="64" rx="38" ry="40" />
        <g className="pet-face">
          <ellipse className="pet-eye" cx="45" cy="56" rx="5" ry="6" />
          <ellipse className="pet-eye" cx="75" cy="56" rx="5" ry="6" />
          {expression.mouth}
        </g>
        {state.state === 'sleeping' && (
          <text className="pet-zzz" x="82" y="30" fontSize="16">
            z
          </text>
        )}
      </svg>
    </button>
  );
}

const FACE: Record<string, { mouth: React.ReactNode }> = {
  happy: { mouth: <path className="pet-mouth pet-mouth--happy" d="M50 72 Q60 82 70 72" /> },
  excited: { mouth: <path className="pet-mouth pet-mouth--happy" d="M48 70 Q60 86 72 70" /> },
  celebrating: { mouth: <path className="pet-mouth pet-mouth--happy" d="M48 70 Q60 86 72 70" /> },
  sad: { mouth: <path className="pet-mouth pet-mouth--sad" d="M50 80 Q60 70 70 80" /> },
  angry: { mouth: <path className="pet-mouth pet-mouth--angry" d="M48 78 L60 70 L72 78" /> },
  sleepy: { mouth: <path className="pet-mouth pet-mouth--sleepy" d="M50 76 Q60 72 70 76" /> },
  sleeping: { mouth: <path className="pet-mouth pet-mouth--sleepy" d="M50 76 Q60 72 70 76" /> },
  eating: { mouth: <ellipse className="pet-mouth pet-mouth--eat" cx="60" cy="74" rx="8" ry="5" /> },
  curious: { mouth: <circle className="pet-mouth pet-mouth--o" cx="60" cy="74" r="4" /> },
  thinking: { mouth: <path className="pet-mouth pet-mouth--sleepy" d="M52 74 Q60 70 68 74" /> },
  idle: { mouth: <path className="pet-mouth pet-mouth--idle" d="M52 76 Q60 72 68 76" /> },
};
