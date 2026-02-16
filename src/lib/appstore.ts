import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

export interface AppStoreData {
  trackName: string;
  sellerName: string;
  trackViewUrl: string;
  iconUrl: string;
  screenshotUrls: string[];
}

const CACHE_DIR = resolve(process.cwd(), "node_modules/.cache/appstore");
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function getAppStoreData(appID: string): Promise<AppStoreData> {
  const cachePath = resolve(CACHE_DIR, `${appID}.json`);

  // Check cache
  if (existsSync(cachePath)) {
    const stat = statSync(cachePath);
    if (Date.now() - stat.mtimeMs < CACHE_TTL) {
      return JSON.parse(readFileSync(cachePath, "utf-8"));
    }
  }

  const res = await fetch(
    `https://itunes.apple.com/lookup?id=${appID}&country=us`
  );
  const json = await res.json();

  if (!json.results || json.results.length === 0) {
    throw new Error(`No app found for appID: ${appID}`);
  }

  const app = json.results[0];

  // Upgrade icon to 1024px
  const iconUrl = (app.artworkUrl512 || app.artworkUrl100 || "").replace(
    /\d+x\d+bb/,
    "1024x1024bb"
  );

  const data: AppStoreData = {
    trackName: app.trackName || "App",
    sellerName: app.sellerName || app.artistName || "",
    trackViewUrl: app.trackViewUrl || "",
    iconUrl,
    screenshotUrls: app.screenshotUrls?.length
      ? app.screenshotUrls
      : app.ipadScreenshotUrls || [],
  };

  // Write cache
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, JSON.stringify(data, null, 2));

  return data;
}
