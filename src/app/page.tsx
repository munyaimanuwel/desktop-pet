'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Pet from '../components/Pet';
import SpeechBubble from '../components/SpeechBubble';
import HUD from '../components/HUD';
import type { PetSettings, PetState } from '../types/pet-api';

const FALLBACK_STATE: PetState = {
  name: 'Pip',
  level: 1,
  xp: 0,
  happiness: 70,
  energy: 80,
  hunger: 40,
  mood: 'content',
  state: 'idle',
  lastActivity: Date.now(),
  consecutiveFailures: 0,
  lastWokeUp: Date.now(),
  facing: 1,
  lastEvent: null,
};

const FALLBACK_SETTINGS: PetSettings = {
  name: 'Pip',
  roam: true,
  speech: 'normal',
  alwaysOnTop: true,
  clickThrough: true,
  launchAtLogin: false,
  repoDir: '',
  repoIsGit: false,
  hasApiKey: false,
};

export default function Home() {
  const [state, setState] = useState<PetState>(FALLBACK_STATE);
  const [settings, setSettings] = useState<PetSettings>(FALLBACK_SETTINGS);
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hudOpen, setHudOpen] = useState(false);
  const hovering = useRef(false);

  useEffect(() => {
    if (!window.petAPI) return;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    window.petAPI.getState().then(setState);
    window.petAPI.getSettings().then(setSettings);
    const unsubState = window.petAPI.onState(({ state, message, settings }) => {
      setState(state);
      if (settings) setSettings(settings);
      if (message) {
        setMessage(message);
        clearTimeout(timeout);
        timeout = setTimeout(() => setMessage(null), 6000);
      }
    });
    const unsubSettings = window.petAPI.onSettings(setSettings);
    return () => {
      clearTimeout(timeout);
      unsubState();
      unsubSettings();
    };
  }, []);

  // Restore click-through when settings close or drag ends while pointer is outside.
  useEffect(() => {
    if (hudOpen || dragging || hovering.current) return;
    if (settings.clickThrough === false) return;
    window.petAPI?.setHover(false);
    window.petAPI?.setMouseIgnore(true);
  }, [hudOpen, dragging, settings.clickThrough]);

  const pet = () => window.petAPI?.sendIntent('pet');
  const feed = () => window.petAPI?.sendIntent('feed');

  const onHitEnter = useCallback(() => {
    hovering.current = true;
    window.petAPI?.setMouseIgnore(false);
    window.petAPI?.setHover(true);
  }, []);

  const onHitLeave = useCallback(() => {
    hovering.current = false;
    if (dragging || hudOpen) return;
    window.petAPI?.setHover(false);
    if (settings.clickThrough !== false) window.petAPI?.setMouseIgnore(true);
  }, [dragging, hudOpen, settings.clickThrough]);

  return (
    <main className="stage">
      <div className="hitbox" onMouseEnter={onHitEnter} onMouseLeave={onHitLeave}>
        <div className="speech-slot">{message && <SpeechBubble text={message} />}</div>
        <Pet state={state} onClick={pet} onDragChange={setDragging} />
        <HUD
          state={state}
          settings={settings}
          pinned={hudOpen}
          onFeed={feed}
          onPinnedChange={setHudOpen}
        />
      </div>
    </main>
  );
}
