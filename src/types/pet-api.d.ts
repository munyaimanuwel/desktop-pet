export type PetState = {
  name: string;
  level: number;
  xp: number;
  happiness: number;
  energy: number;
  hunger: number;
  mood: string;
  state: string;
  lastActivity: number;
  consecutiveFailures: number;
  lastWokeUp: number;
  facing?: number;
  hatchedAt?: number;
  lastGreetingDay?: string | null;
};

export type PetSettings = {
  name: string;
  roam: boolean;
  speech: 'off' | 'quiet' | 'normal';
  alwaysOnTop: boolean;
  launchAtLogin: boolean;
  repoDir: string;
  hasApiKey: boolean;
};

export type PetIntent = 'pet' | 'feed';

export type PetStateUpdate = {
  state: PetState;
  message: string | null;
  settings?: PetSettings;
};

declare global {
  interface Window {
    petAPI: {
      getState: () => Promise<PetState>;
      getSettings: () => Promise<PetSettings>;
      setSettings: (patch: Partial<PetSettings> & { apiKey?: string }) => void;
      onState: (fn: (update: PetStateUpdate) => void) => () => void;
      onSettings: (fn: (settings: PetSettings) => void) => () => void;
      sendIntent: (type: PetIntent) => void;
      dragStart: (offset: [number, number]) => void;
      dragMove: () => void;
      dragEnd: () => void;
      toggleHide: () => void;
      show: () => void;
      hide: () => void;
      setMouseIgnore: (ignore: boolean) => void;
      setHover: (on: boolean) => void;
      openMenu: () => void;
      onToggleHide: (fn: (hidden: boolean) => void) => void;
    };
  }
}
