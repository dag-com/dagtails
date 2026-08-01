import type { DagTailsHubApi, HubActions, HubSnapshot } from "./types";

const listeners = new Set<(snapshot: HubSnapshot | null) => void>();
let snapshot: HubSnapshot | null = null;
let actions: HubActions | null = null;

function notify() {
  for (const listener of listeners) listener(snapshot);
}

export function createHubBridge(): DagTailsHubApi {
  const api: DagTailsHubApi = {
    refresh(next) {
      snapshot = next;
      notify();
    },
    getSnapshot() {
      return snapshot;
    },
    setActions(next) {
      actions = next;
    },
    getActions() {
      return actions;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot);
      return () => listeners.delete(listener);
    },
  };
  window.DagTailsHub = api;
  return api;
}
