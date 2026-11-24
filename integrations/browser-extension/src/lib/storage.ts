import { ext } from "./browser.ts";
import type { LinkCache } from "./link-cache.ts";

export type ConnectStatus = { status: "pending" | "error"; message?: string; at: number };

type LocalShape = { token?: string; autoShorten?: boolean };
type SessionShape = { linkCache?: LinkCache; connectStatus?: ConnectStatus };

// The token lives in storage.local only: never storage.sync, so it doesn't leave this browser.
export const local = {
  async get<K extends keyof LocalShape>(key: K): Promise<LocalShape[K]> {
    const result = await ext.storage.local.get(key);
    return result[key] as LocalShape[K]; // stored by `set` below with the same key and type
  },
  async set<K extends keyof LocalShape>(key: K, value: LocalShape[K]): Promise<void> {
    await ext.storage.local.set({ [key]: value });
  },
  async remove(key: keyof LocalShape): Promise<void> {
    await ext.storage.local.remove(key);
  },
};

// storage.session is cleared when the browser closes. Fall back to memory where a browser
// doesn't provide it; in the popup that means the cache lasts as long as the popup.
const memory: SessionShape = {};
const sessionArea = (): chrome.storage.StorageArea | undefined =>
  (ext.storage as { session?: chrome.storage.StorageArea }).session;

export const session = {
  async get<K extends keyof SessionShape>(key: K): Promise<SessionShape[K]> {
    const area = sessionArea();
    if (!area) return memory[key];
    try {
      const result = await area.get(key);
      return result[key] as SessionShape[K]; // written by `set` below with the same key
    } catch {
      return memory[key];
    }
  },
  async set<K extends keyof SessionShape>(key: K, value: SessionShape[K]): Promise<void> {
    memory[key] = value;
    const area = sessionArea();
    if (!area) return;
    try {
      await area.set({ [key]: value });
    } catch {
      // memory copy above is enough for this popup
    }
  },
  async remove(key: keyof SessionShape): Promise<void> {
    delete memory[key];
    try {
      await sessionArea()?.remove(key);
    } catch {
      // ignore
    }
  },
};
