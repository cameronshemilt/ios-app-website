import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import { getSettings } from "./settings";
import { getAppStoreData } from "./appstore";

export function remarkSettings() {
  const settings = getSettings();

  return async (tree: Root) => {
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

    visit(tree, "text", (node) => {
      node.value = node.value.replace(
        /\$\{(\w+)\}/g,
        (match, key) => vars[key] ?? match,
      );
    });

    visit(tree, "link", (node) => {
      node.url = node.url.replace(
        /\$\{(\w+)\}/g,
        (match, key) => vars[key] ?? match,
      );
    });
  };
}
