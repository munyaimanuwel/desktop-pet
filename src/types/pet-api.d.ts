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
  lastEvent?: string | null;
};

export type PetSettings = {
  name: string;
  roam: boolean;
  speech: 'off' | 'quiet' | 'normal';
  alwaysOnTop: boolean;
  clickThrough: boolean;
  launchAtLogin: boolean;
  repoDir: string;
  repoIsGit: boolean;
  autoUpdate: boolean;
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
      setHudPinned: (pinned: boolean) => void;
      installHooks: () => void;
      dragStart: (offset: [number, number]) => void;
      dragMove: () => void;
      dragEnd: () => void;
      toggleHide: () => void;
      show: () => void;
      hide: () => void;
      setMouseIgnore: (ignore: boolean) => void;
      setHover: (on: boolean) => void;
      openMenu: () => void;
      onOpenSettings: (fn: () => void) => () => void;
      onToggleHide: (fn: (hidden: boolean) => void) => void;
    };
  }
}
