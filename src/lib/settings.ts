import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { parse, YAMLParseError } from "yaml";

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
  siteUrl?: string;
}

let cached: Settings | null = null;
let cachedMtimeMs = 0;

function settingsError(message: string, cause?: unknown) {
  return new Error(`Invalid settings.yaml: ${message}`, { cause });
}

function formatYamlError(error: unknown) {
  if (error instanceof YAMLParseError) {
    const line = error.linePos?.[0]?.line;
    const col = error.linePos?.[0]?.col;
    const location = line && col ? ` at line ${line}, column ${col}` : "";
    return `${error.message}${location}`;
  }

  return error instanceof Error ? error.message : String(error);
}

function readSettingsFile(path: string) {
  try {
    return readFileSync(path, "utf-8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw settingsError(
        "file not found. Create settings.yaml in the project root and add at least `appID`.",
        error,
      );
    }

    throw settingsError(`could not read the file. ${formatYamlError(error)}`, error);
  }
}

function parseSettings(raw: string) {
  let parsed: unknown;

  try {
    parsed = parse(raw);
  } catch (error) {
    throw settingsError(`could not parse YAML. ${formatYamlError(error)}`, error);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw settingsError(
      "expected a YAML object with keys like `appID`, `email`, and `title`.",
    );
  }

  return parsed as Record<string, unknown>;
}

function optionalString(map: Record<string, unknown>, key: string) {
  const value = map[key];
  if (value === undefined || value === null || value === "") return undefined;

  if (typeof value !== "string" && typeof value !== "number") {
    throw settingsError(
      `\`${key}\` must be a string value, but received ${Array.isArray(value) ? "an array" : typeof value}.`,
    );
  }

  return String(value).trim() || undefined;
}

function requiredString(map: Record<string, unknown>, key: string) {
  const value = optionalString(map, key);
  if (!value) {
    throw settingsError(
      `missing required \`${key}\`. Add ${key}: "1234567890" to settings.yaml.`,
    );
  }

  return value;
}

function requiredAppID(map: Record<string, unknown>) {
  const appID = requiredString(map, "appID");
  if (!/^\d+$/.test(appID)) {
    throw settingsError(
      '`appID` must be the numeric Apple App ID, for example appID: "1234567890".',
    );
  }

  return appID;
}

function optionalUrl(map: Record<string, unknown>, key: string) {
  const value = optionalString(map, key);
  if (!value) return undefined;

  try {
    return new URL(value).toString();
  } catch (error) {
    throw settingsError(
      `\`${key}\` must be a valid absolute URL, for example ${key}: "https://example.com".`,
      error,
    );
  }
}

export function getSettings(): Settings {
  const path = resolve(process.cwd(), "settings.yaml");
  let mtimeMs: number;

  try {
    mtimeMs = statSync(path).mtimeMs;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw settingsError(
        "file not found. Create settings.yaml in the project root and add at least `appID`.",
        error,
      );
    }

    throw settingsError(`could not inspect the file. ${formatYamlError(error)}`, error);
  }

  if (cached && cachedMtimeMs === mtimeMs) return cached;

  const raw = readSettingsFile(path);
  const map = parseSettings(raw);

  cached = {
    appID: requiredAppID(map),
    title: optionalString(map, "title"),
    headline: optionalString(map, "headline"),
    subheadline: optionalString(map, "subheadline"),
    accentColor: optionalString(map, "accent-color") || "#3b82f6",
    accentColorDark:
      optionalString(map, "accent-color-dark") ||
      optionalString(map, "accent-color") ||
      "#3b82f6",
    developer: optionalString(map, "developer"),
    developerLink: optionalString(map, "developer-link"),
    email: optionalString(map, "email"),
    siteUrl: optionalUrl(map, "site-url"),
  };
  cachedMtimeMs = mtimeMs;

  return cached;
}
