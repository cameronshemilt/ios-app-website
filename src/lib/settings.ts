import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

export interface Settings {
  appID: string;
  title?: string;
  headline?: string;
  subheadline?: string;
  accentColor: string;
  accentColorDark: string;
  developer?: string;
  developerLink?: string;
  email?: string;
}

let cached: Settings | null = null;
let cachedMtimeMs = 0;

export function getSettings(): Settings {
  const path = resolve(process.cwd(), "settings.yaml");
  const mtimeMs = statSync(path).mtimeMs;

  if (cached && cachedMtimeMs === mtimeMs) return cached;

  const raw = readFileSync(path, "utf-8");
  const map = parse(raw) as Record<string, string>;

  if (!map.appID) {
    throw new Error("settings.yaml must contain an appID");
  }

  cached = {
    appID: String(map.appID),
    title: map.title || undefined,
    headline: map.headline || undefined,
    subheadline: map.subheadline || undefined,
    accentColor: map["accent-color"] || "#3b82f6",
    accentColorDark:
      map["accent-color-dark"] || map["accent-color"] || "#3b82f6",
    developer: map.developer || undefined,
    developerLink: map["developer-link"] || undefined,
    email: map.email || undefined,
  };
  cachedMtimeMs = mtimeMs;

  return cached;
}
