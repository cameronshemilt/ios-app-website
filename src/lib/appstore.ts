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
const APP_STORE_COUNTRY = "us";
const APP_STORE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36";
const SCREENSHOT_ARTWORK_PATTERN =
  /"template":"(https:\/\/[^"]+mzstatic\.com\/image\/thumb\/[^"]+)","width":(\d+),"height":(\d+)/g;
const SCREENSHOT_TEMPLATE_PATTERN = /\/(?:iPhone|iPad)[^/]*\.(?:png|jpe?g)\//;

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

function appStoreArtworkUrl(template: string, width: number, height: number) {
  const imageWidth = Math.min(width, 600);
  const imageHeight = Math.round((imageWidth / width) * height);

  return template
    .replace("{w}", String(imageWidth))
    .replace("{h}", String(imageHeight))
    .replace("{c}", "bb")
    .replace("{f}", "jpg");
}

function screenshotUrlsFromLookup(appRecord: Record<string, unknown>) {
  const iphoneScreenshots = stringArrayValue(appRecord.screenshotUrls);
  const ipadScreenshots = stringArrayValue(appRecord.ipadScreenshotUrls);

  return iphoneScreenshots.length ? iphoneScreenshots : ipadScreenshots;
}

function screenshotUrlsFromAppStorePage(html: string) {
  const screenshots = new Map<string, string>();

  for (const match of html.matchAll(SCREENSHOT_ARTWORK_PATTERN)) {
    const [, rawTemplate, rawWidth, rawHeight] = match;
    const template = rawTemplate.replaceAll("\\/", "/");

    if (!SCREENSHOT_TEMPLATE_PATTERN.test(template)) continue;

    const width = Number.parseInt(rawWidth, 10);
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue;

    screenshots.set(template, appStoreArtworkUrl(template, width, height));
  }

  return [...screenshots.values()];
}

async function getAppStorePageScreenshotUrls(appID: string) {
  try {
    // Apple's lookup API sometimes omits screenshots that are still on the public product page.
    const res = await fetch(
      `https://itunes.apple.com/${APP_STORE_COUNTRY}/app/id${appID}?mt=8`,
      {
        headers: {
          "user-agent": APP_STORE_USER_AGENT,
        },
      },
    );

    if (!res.ok) return [];

    const html = await res.text();
    return screenshotUrlsFromAppStorePage(html);
  } catch {
    return [];
  }
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

function readCachedAppStoreData(cachePath: string) {
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

  return null;
}

async function fetchAppStoreLookup(appID: string) {
  let json: unknown;

  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${appID}&country=${APP_STORE_COUNTRY}`,
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

  return app as Record<string, unknown>;
}

function appIconUrl(appRecord: Record<string, unknown>) {
  const iconUrl = (
    stringValue(appRecord.artworkUrl512) ||
    stringValue(appRecord.artworkUrl100)
  ).replace(
    /\d+x\d+bb/,
    "1024x1024bb",
  );

  return iconUrl;
}

async function resolveScreenshotUrls(
  appID: string,
  appRecord: Record<string, unknown>,
) {
  const lookupScreenshots = screenshotUrlsFromLookup(appRecord);
  if (lookupScreenshots.length) return lookupScreenshots;

  return getAppStorePageScreenshotUrls(appID);
}

export async function getAppStoreData(appID: string): Promise<AppStoreData> {
  const cachePath = resolve(CACHE_DIR, `${appID}.json`);
  const cachedData = readCachedAppStoreData(cachePath);
  if (cachedData) return cachedData;

  const appRecord = await fetchAppStoreLookup(appID);
  const screenshotUrls = await resolveScreenshotUrls(appID, appRecord);

  const data: AppStoreData = {
    kind: stringValue(appRecord.kind),
    trackName: stringValue(appRecord.trackName) || "App",
    sellerName:
      stringValue(appRecord.sellerName) || stringValue(appRecord.artistName),
    trackViewUrl: stringValue(appRecord.trackViewUrl),
    iconUrl: appIconUrl(appRecord),
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
    screenshotUrls,
  };

  // Cache after fallbacks so later builds do not repeat network work.
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, JSON.stringify(data, null, 2));

  return data;
}
