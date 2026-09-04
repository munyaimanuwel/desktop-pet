'use client';

import { useEffect, useState } from 'react';
import type { PetSettings, PetState } from '../types/pet-api';

export default function HUD({
  state,
  settings,
  pinned,
  onFeed,
  onPinnedChange,
}: {
  state: PetState;
  settings: PetSettings;
  pinned: boolean;
  onFeed: () => void;
  onPinnedChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(settings.name);
  const [repoDir, setRepoDir] = useState(settings.repoDir);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    setName(settings.name);
    setRepoDir(settings.repoDir);
  }, [settings.name, settings.repoDir]);

  const save = (patch: Partial<PetSettings> & { apiKey?: string }) => {
    window.petAPI?.setSettings(patch);
  };

  return (
    <div className={`hud ${pinned ? 'hud--pinned' : ''}`}>
      <div className="hud-row">
        <span className="hud-name">
          {state.name} · Lv {state.level}
        </span>
        <span className="hud-mood">{state.mood}</span>
      </div>
      {state.lastEvent && (
        <div className="hud-row">
          <span className="hud-mood">last: {state.lastEvent}</span>
        </div>
      )}
      <Bar label="XP" value={state.xp} max={Math.max(1, state.level * 100)} accent="xp" />
      <Bar label="Happy" value={state.happiness} max={100} accent="happy" />
      <Bar label="Energy" value={state.energy} max={100} accent="energy" />
      <Bar label="Hunger" value={state.hunger} max={100} accent="hunger" />
      <div className="hud-actions">
        <button type="button" className="hud-feed" onClick={onFeed}>
          Feed
        </button>
        <button
          type="button"
          className="hud-gear"
          aria-expanded={pinned}
          onClick={() => onPinnedChange(!pinned)}
        >
          {pinned ? 'Close' : 'Settings'}
        </button>
      </div>
      {pinned && (
        <form
          className="hud-settings"
          onSubmit={(e) => {
            e.preventDefault();
            const patch: Partial<PetSettings> & { apiKey?: string } = { name: name.trim() || 'Pip', repoDir };
            if (apiKey.trim()) patch.apiKey = apiKey.trim();
            save(patch);
            setApiKey('');
          }}
        >
          <label>
            Name
            <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="hud-check">
            <input type="checkbox" checked={settings.roam} onChange={(e) => save({ roam: e.target.checked })} />
            Wander the desktop
          </label>
          <label>
            Speech
            <select
              value={settings.speech}
              onChange={(e) => save({ speech: e.target.value as PetSettings['speech'] })}
            >
              <option value="normal">Normal</option>
              <option value="quiet">Quiet</option>
              <option value="off">Off</option>
            </select>
          </label>
          <label className="hud-check">
            <input
              type="checkbox"
              checked={settings.alwaysOnTop}
              onChange={(e) => save({ alwaysOnTop: e.target.checked })}
            />
            Always on top
          </label>
          <label className="hud-check">
            <input
              type="checkbox"
              checked={settings.clickThrough !== false}
              onChange={(e) => save({ clickThrough: e.target.checked })}
            />
            Click-through when not hovering
          </label>
          <label className="hud-check">
            <input
              type="checkbox"
              checked={settings.launchAtLogin}
              onChange={(e) => save({ launchAtLogin: e.target.checked })}
            />
            Start with the computer
          </label>
          <label>
            Watch repo
            <input
              value={repoDir}
              placeholder="Leave empty for this folder"
              onChange={(e) => setRepoDir(e.target.value)}
            />
          </label>
          <label>
            xAI key {settings.hasApiKey ? '(saved)' : '(optional)'}
            <input
              type="password"
              value={apiKey}
              placeholder={settings.hasApiKey ? '••••••••' : 'XAI_API_KEY'}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
          </label>
          <button type="submit" className="hud-feed">
            Save
          </button>
        </form>
      )}
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
