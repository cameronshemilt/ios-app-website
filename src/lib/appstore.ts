import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

export interface AppStoreData {
  kind: string;
  trackName: string;
  sellerName: string;
  trackViewUrl: string;
  iconUrl: string;
  description: string;
  fileSizeBytes: string;
  minimumOsVersion: string;
  contentAdvisoryRating: string;
  formattedPrice: string;
  primaryGenreName: string;
  genres: string[];
  languageCodesISO2A: string[];
  version: string;
  currentVersionReleaseDate: string;
  averageUserRating: number;
  userRatingCount: number;
  screenshotUrls: string[];
}

const CACHE_DIR = resolve(process.cwd(), "node_modules/.cache/appstore");
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function hasCurrentCacheShape(value: unknown): value is AppStoreData {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as AppStoreData).description === "string" &&
    typeof (value as AppStoreData).kind === "string" &&
    typeof (value as AppStoreData).fileSizeBytes === "string" &&
    typeof (value as AppStoreData).averageUserRating === "number"
  );
}

export async function getAppStoreData(appID: string): Promise<AppStoreData> {
  const cachePath = resolve(CACHE_DIR, `${appID}.json`);

  // Check cache
  if (existsSync(cachePath)) {
    const stat = statSync(cachePath);
    if (Date.now() - stat.mtimeMs < CACHE_TTL) {
      try {
        const cachedData: unknown = JSON.parse(readFileSync(cachePath, "utf-8"));
        if (hasCurrentCacheShape(cachedData)) {
          return cachedData;
        }
      } catch (error) {
        throw new Error(
          `Could not read cached App Store data for appID "${appID}". Delete ${cachePath} and try again.`,
          { cause: error },
        );
      }
    }
  }

  let json: unknown;

  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${appID}&country=us`,
    );

    if (!res.ok) {
      throw new Error(`Apple returned HTTP ${res.status} ${res.statusText}`);
    }

    json = await res.json();
  } catch (error) {
    throw new Error(
      `Could not fetch App Store data for appID "${appID}" from settings.yaml. Check your internet connection and the appID value.`,
      { cause: error },
    );
  }

  if (!json || typeof json !== "object" || !("results" in json)) {
    throw new Error(
      `Apple returned an unexpected response for appID "${appID}" from settings.yaml.`,
    );
  }

  const lookup = json as { results?: unknown[] };

  if (!lookup.results || lookup.results.length === 0) {
    throw new Error(
      `No App Store app found for appID "${appID}" from settings.yaml. Use the numeric Apple App ID, for example appID: "1234567890".`,
    );
  }

  const app = lookup.results[0];
  if (!app || typeof app !== "object") {
    throw new Error(
      `Apple returned an invalid app record for appID "${appID}" from settings.yaml.`,
    );
  }

  const appRecord = app as Record<string, unknown>;

  // Upgrade icon to 1024px
  const iconUrl = (
    stringValue(appRecord.artworkUrl512) ||
    stringValue(appRecord.artworkUrl100)
  ).replace(
    /\d+x\d+bb/,
    "1024x1024bb",
  );

  const screenshotUrls = stringArrayValue(appRecord.screenshotUrls);
  const ipadScreenshotUrls = stringArrayValue(appRecord.ipadScreenshotUrls);

  const data: AppStoreData = {
    kind: stringValue(appRecord.kind),
    trackName: stringValue(appRecord.trackName) || "App",
    sellerName:
      stringValue(appRecord.sellerName) || stringValue(appRecord.artistName),
    trackViewUrl: stringValue(appRecord.trackViewUrl),
    iconUrl,
    description: stringValue(appRecord.description),
    fileSizeBytes: stringValue(appRecord.fileSizeBytes),
    minimumOsVersion: stringValue(appRecord.minimumOsVersion),
    contentAdvisoryRating:
      stringValue(appRecord.contentAdvisoryRating) ||
      stringValue(appRecord.trackContentRating),
    formattedPrice: stringValue(appRecord.formattedPrice),
    primaryGenreName: stringValue(appRecord.primaryGenreName),
    genres: stringArrayValue(appRecord.genres),
    languageCodesISO2A: stringArrayValue(appRecord.languageCodesISO2A),
    version: stringValue(appRecord.version),
    currentVersionReleaseDate: stringValue(appRecord.currentVersionReleaseDate),
    averageUserRating: numberValue(appRecord.averageUserRating),
    userRatingCount: numberValue(appRecord.userRatingCount),
    screenshotUrls: screenshotUrls.length ? screenshotUrls : ipadScreenshotUrls,
  };

  // Write cache
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, JSON.stringify(data, null, 2));

  return data;
}
