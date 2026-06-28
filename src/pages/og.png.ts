import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import sharp from "sharp";
import { getAppStoreData } from "../lib/appstore";
import { getSettings } from "../lib/settings";

export const prerender = true;

const width = 1200;
const height = 630;
const iconSize = 184;
const iconRadius = iconSize * 0.2237;
const gap = 44;
const titleFontSize = 64;
const subheadlineFontSize = 34;

function escapeXml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char] ?? char,
  );
}

function contentTypeForPath(path: string) {
  switch (extname(path).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "image/png";
  }
}

async function getIconDataUri(iconUrl: string) {
  const localIconPath = resolve(process.cwd(), "public/appicon.png");

  if (existsSync(localIconPath)) {
    const icon = readFileSync(localIconPath);
    return `data:${contentTypeForPath(localIconPath)};base64,${icon.toString("base64")}`;
  }

  const response = await fetch(iconUrl);
  if (!response.ok) {
    throw new Error(
      `Could not fetch app icon for OG image. Apple returned HTTP ${response.status} ${response.statusText}.`,
    );
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const icon = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${icon.toString("base64")}`;
}

function wrapText(text: string, maxChars: number, maxLines: number) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) {
      line = next;
      continue;
    }

    if (line) lines.push(line);
    line = word;

    if (lines.length === maxLines) break;
  }

  if (line && lines.length < maxLines) lines.push(line);

  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+$/, "")}...`;
  }

  return lines;
}

function renderTextLines(
  lines: string[],
  x: number,
  y: number,
  fontSize: number,
  lineHeight: number,
  color: string,
  weight = 400,
) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" font-family="ui-sans-serif, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${color}">${escapeXml(line)}</text>`,
    )
    .join("");
}

export async function GET() {
  const settings = getSettings();
  const appData = await getAppStoreData(settings.appID);
  const title = settings.title || appData.trackName;
  const subheadline = settings.subheadline;
  const iconDataUri = await getIconDataUri(appData.iconUrl);

  const titleLines = wrapText(title, 24, 2);
  const subheadlineLines = subheadline ? wrapText(subheadline, 46, 2) : [];
  const titleLineHeight = 72;
  const subheadlineLineHeight = 44;
  const hasSubheadline = subheadlineLines.length > 0;
  const textHeight =
    titleLines.length * titleLineHeight +
    (hasSubheadline ? 20 + subheadlineLines.length * subheadlineLineHeight : 0);
  const contentHeight = Math.max(iconSize, textHeight);
  const contentY = (height - contentHeight) / 2;
  const iconX = 120;
  const iconY = contentY + (contentHeight - iconSize) / 2;
  const textX = iconX + iconSize + gap;
  const titleY = hasSubheadline
    ? contentY + 58
    : iconY +
      iconSize / 2 +
      titleFontSize * 0.3 -
      ((titleLines.length - 1) * titleLineHeight) / 2;
  const subheadlineY = titleY + titleLines.length * titleLineHeight + 12;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <defs>
    <clipPath id="app-icon">
      <rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="${iconRadius}" ry="${iconRadius}"/>
    </clipPath>
  </defs>
  <image href="${iconDataUri}" x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#app-icon)"/>
  <rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="${iconRadius}" ry="${iconRadius}" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>
  ${renderTextLines(titleLines, textX, titleY, titleFontSize, titleLineHeight, "#111827", 800)}
  ${renderTextLines(subheadlineLines, textX, subheadlineY, subheadlineFontSize, subheadlineLineHeight, "#4b5563", 500)}
</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
