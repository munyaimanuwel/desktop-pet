'use client';

import { useEffect, useState } from 'react';
import Pet from '../components/Pet';
import SpeechBubble from '../components/SpeechBubble';
import HUD from '../components/HUD';
import type { PetState } from '../types/pet-api';

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
};

export default function Home() {
  const [state, setState] = useState<PetState>(FALLBACK_STATE);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Outside Electron (plain browser) the bridge is absent — show the fallback.
    if (!window.petAPI) return;

    window.petAPI.getState().then(setState);
    const unsubscribe = window.petAPI.onState(({ state, message }) => {
      setState(state);
      if (message) {
        setMessage(message);
        const t = setTimeout(() => setMessage(null), 6000);
        return () => clearTimeout(t);
      }
    });
    return unsubscribe;
  }, []);

  // Pet clicks and the feed button map to intents.
  const pet = () => window.petAPI?.sendIntent('pet');
  const feed = () => window.petAPI?.sendIntent('feed');

  return (
    <main className="stage">
      <div className="speech-slot">
        {message && <SpeechBubble text={message} />}
      </div>
      <Pet state={state} onClick={pet} />
      <HUD state={state} onFeed={feed} />
    </main>
  );
}
