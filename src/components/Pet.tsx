'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PetState } from '../types/pet-api';

export default function Pet({
  state,
  onClick,
  onDragChange,
}: {
  state: PetState;
  onClick: () => void;
  onDragChange?: (dragging: boolean) => void;
}) {
  const expression = FACE[state.state] || FACE.idle;
  const sleeping = state.state === 'sleeping' || state.state === 'sleepy';
  const facingLeft = (state.facing || 1) < 0;
  const moved = useRef(false);
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (sleeping) {
      setBlink(false);
      return;
    }
    let timeout: ReturnType<typeof setTimeout>;
    const loop = () => {
      timeout = setTimeout(() => {
        setBlink(true);
        timeout = setTimeout(() => {
          setBlink(false);
          loop();
        }, 140);
      }, 2800 + Math.random() * 4200);
    };
    loop();
    return () => clearTimeout(timeout);
  }, [sleeping]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      moved.current = false;
      onDragChange?.(true);
      window.petAPI?.setMouseIgnore(false);
      window.petAPI?.dragStart([e.clientX, e.clientY]);
      const startX = e.screenX;
      const startY = e.screenY;
      const move = (ev: MouseEvent) => {
        if (Math.abs(ev.screenX - startX) + Math.abs(ev.screenY - startY) > 3) {
          moved.current = true;
        }
        window.petAPI?.dragMove();
      };
      const up = (ev: MouseEvent) => {
        onDragChange?.(false);
        window.petAPI?.dragEnd();
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        if (!el || !el.closest('.hitbox')) window.petAPI?.setMouseIgnore(true);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    },
    [onDragChange]
  );

  const onClickPet = useCallback(
    (e: React.MouseEvent) => {
      if (moved.current) {
        e.preventDefault();
        return;
      }
      onClick();
    },
    [onClick]
  );

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    window.petAPI?.openMenu();
  }, []);

  const eyesClosed = sleeping || blink;

  return (
    <button
      type="button"
      className={`pet pet--${state.state} ${facingLeft ? 'pet--left' : ''}`}
      onMouseDown={onMouseDown}
      onClick={onClickPet}
      onContextMenu={onContextMenu}
      aria-label={`Pet ${state.name}`}
      title={state.name}
    >
      <svg viewBox="0 0 120 120" role="img">
        <ellipse className="pet-shadow" cx="60" cy="108" rx="32" ry="6" />
        <g className="pet-facing">
          <g className="pet-figure">
            <ellipse className="pet-ear" cx="36" cy="32" rx="10" ry="12" />
            <ellipse className="pet-ear" cx="84" cy="32" rx="10" ry="12" />
            <ellipse className="pet-ear-inner" cx="36" cy="34" rx="5" ry="6" />
            <ellipse className="pet-ear-inner" cx="84" cy="34" rx="5" ry="6" />
            <ellipse className="pet-foot pet-foot--l" cx="44" cy="98" rx="8" ry="5" />
            <ellipse className="pet-foot pet-foot--r" cx="76" cy="98" rx="8" ry="5" />
            <ellipse className="pet-body" cx="60" cy="66" rx="40" ry="38" />
            <ellipse className="pet-shine" cx="44" cy="50" rx="10" ry="7" />
            <g className="pet-face">
              {state.state === 'angry' && (
                <>
                  <path className="pet-brow" d="M36 50 L50 54" />
                  <path className="pet-brow" d="M84 50 L70 54" />
                </>
              )}
              {eyesClosed ? (
                <>
                  <path className="pet-eye-closed" d="M40 58 Q46 62 52 58" />
                  <path className="pet-eye-closed" d="M68 58 Q74 62 80 58" />
                </>
              ) : (
                <>
                  <ellipse className="pet-eye" cx="46" cy="58" rx="6" ry="7" />
                  <ellipse className="pet-eye" cx="74" cy="58" rx="6" ry="7" />
                  <ellipse className="pet-eye-shine" cx="44" cy="55" rx="2" ry="2.4" />
                  <ellipse className="pet-eye-shine" cx="72" cy="55" rx="2" ry="2.4" />
                </>
              )}
              {(state.state === 'happy' || state.state === 'excited' || state.state === 'celebrating') && (
                <>
                  <ellipse className="pet-blush" cx="34" cy="70" rx="6" ry="3.5" />
                  <ellipse className="pet-blush" cx="86" cy="70" rx="6" ry="3.5" />
                </>
              )}
              {expression.mouth}
            </g>
            {state.state === 'sleeping' && (
              <text className="pet-zzz" x="88" y="28" fontSize="16">
                z
              </text>
            )}
            {state.state === 'thinking' && (
              <g className="pet-thought">
                <circle cx="96" cy="38" r="3" />
                <circle cx="104" cy="26" r="5" />
              </g>
            )}
            {state.state === 'celebrating' && (
              <g className="pet-sparkles">
                <text x="14" y="44" fontSize="12">
                  ✦
                </text>
                <text x="96" y="36" fontSize="10">
                  ✦
                </text>
                <text x="22" y="86" fontSize="8">
                  ✦
                </text>
              </g>
            )}
          </g>
        </g>
      </svg>
    </button>
  );
}

const FACE: Record<string, { mouth: React.ReactNode }> = {
  happy: { mouth: <path className="pet-mouth pet-mouth--happy" d="M50 74 Q60 84 70 74" /> },
  excited: { mouth: <path className="pet-mouth pet-mouth--happy" d="M48 72 Q60 88 72 72" /> },
  celebrating: { mouth: <path className="pet-mouth pet-mouth--happy" d="M48 72 Q60 88 72 72" /> },
  sad: { mouth: <path className="pet-mouth pet-mouth--sad" d="M50 82 Q60 72 70 82" /> },
  angry: { mouth: <path className="pet-mouth pet-mouth--angry" d="M48 80 L60 72 L72 80" /> },
  sleepy: { mouth: <path className="pet-mouth pet-mouth--sleepy" d="M50 78 Q60 74 70 78" /> },
  sleeping: { mouth: <path className="pet-mouth pet-mouth--sleepy" d="M50 78 Q60 74 70 78" /> },
  eating: { mouth: <ellipse className="pet-mouth pet-mouth--eat" cx="60" cy="76" rx="8" ry="5" /> },
  curious: { mouth: <circle className="pet-mouth pet-mouth--o" cx="60" cy="76" r="4" /> },
  thinking: { mouth: <path className="pet-mouth pet-mouth--sleepy" d="M52 76 Q60 72 68 76" /> },
  walking: { mouth: <path className="pet-mouth pet-mouth--idle" d="M52 78 Q60 74 68 78" /> },
  idle: { mouth: <path className="pet-mouth pet-mouth--idle" d="M52 78 Q60 74 68 78" /> },
};
