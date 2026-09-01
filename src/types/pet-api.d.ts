// Types for the Electron bridge exposed to the static renderer via preload.js.
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
};

export type PetIntent = 'pet' | 'feed';

export type PetStateUpdate = {
  state: PetState;
  message: string | null;
};

declare global {
  interface Window {
    petAPI: {
      getState: () => Promise<PetState>;
      onState: (fn: (update: PetStateUpdate) => void) => () => void;
      sendIntent: (type: PetIntent) => void;
      drag: (offset: [number, number]) => void;
      toggleHide: () => void;
      show: () => void;
      hide: () => void;
      onToggleHide: (fn: (hidden: boolean) => void) => void;
    };
  }
}
