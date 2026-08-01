export type HubSnapshot = {
  profileVisible: boolean;
  profileChip: string;
  mocktailMode: boolean;
  streak: number;
  levelLabel: string;
  rankName: string;
  stars: number;
  welcomeMain: string;
  welcomeSub: string;
  mascotTier: "" | "tier-2" | "tier-3";
  cotdName: string;
  cotdDone: boolean;
  cotdBtnLabel: string;
  journeyLabel: string;
  modesUnlocked: boolean;
  unlockLeft: number;
  endlessSub: string;
  mixSub: string;
  playMeta: string;
  badgesLabel: string;
  bestLine: string;
  footerHtml: string;
};

export type HubActions = {
  playJourney: () => void;
  openEndless: () => void;
  openMixologist: () => void;
  openCotd: () => void;
  openTraining: () => void;
  openHelp: () => void;
  openBadges: () => void;
  openSettings: () => void;
  editProfile: () => void;
};

export type DagTailsHubApi = {
  refresh: (snapshot: HubSnapshot) => void;
  getSnapshot: () => HubSnapshot | null;
  setActions: (actions: HubActions) => void;
  getActions: () => HubActions | null;
  subscribe: (listener: (snapshot: HubSnapshot | null) => void) => () => void;
};

declare global {
  interface Window {
    DagTailsHub?: DagTailsHubApi;
  }
}
