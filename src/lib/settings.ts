import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface Settings {
  appID: string;
  title?: string;
  headline?: string;
  subheadline?: string;
  accentColor: string;
  developer?: string;
  developerLink?: string;
}

let cached: Settings | null = null;

export function getSettings(): Settings {
  if (cached) return cached;

  const path = resolve(process.cwd(), "settings.txt");
  const raw = readFileSync(path, "utf-8");

  const map: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key && value) map[key] = value;
  }

  if (!map.appID) {
    throw new Error("settings.txt must contain an appID");
  }

  cached = {
    appID: map.appID,
    title: map.title || undefined,
    headline: map.headline || undefined,
    subheadline: map.subheadline || undefined,
    accentColor: map["accent-color"] || "#3b82f6",
    developer: map.developer || undefined,
    developerLink: map["developer-link"] || undefined,
  };

  return cached;
}
