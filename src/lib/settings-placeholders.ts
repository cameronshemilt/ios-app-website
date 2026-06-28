import { getAppStoreData } from "./appstore";
import { getSettings } from "./settings";

const placeholderPattern = /\$\{(\w+)\}/g;
const htmlCommentPattern = /<!--[\s\S]*?-->/g;

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char,
  );
}

async function getSettingsVars(): Promise<Record<string, string>> {
  const settings = getSettings();
  const appData = await getAppStoreData(settings.appID);

  const vars: Record<string, string> = {
    appID: settings.appID,
    title: settings.title || appData.trackName,
    headline: settings.headline || appData.trackName,
    accentColor: settings.accentColor,
    developer: settings.developer || appData.sellerName,
  };
  if (settings.subheadline) vars.subheadline = settings.subheadline;
  if (settings.developerLink) vars.developerLink = settings.developerLink;
  if (settings.email) vars.email = settings.email;

  return Object.fromEntries(
    Object.entries(vars).map(([key, value]) => [key, escapeHtml(value)]),
  );
}

function replacePlaceholders(value: string, vars: Record<string, string>) {
  return value.replace(placeholderPattern, (match, key) => vars[key] ?? match);
}

export async function replaceSettingsPlaceholders(html: string) {
  const vars = await getSettingsVars();
  let cursor = 0;
  let replaced = "";

  for (const match of html.matchAll(htmlCommentPattern)) {
    const start = match.index ?? 0;
    replaced += replacePlaceholders(html.slice(cursor, start), vars);
    replaced += match[0];
    cursor = start + match[0].length;
  }

  replaced += replacePlaceholders(html.slice(cursor), vars);
  return replaced;
}
