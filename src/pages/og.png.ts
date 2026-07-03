import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import opentype from "opentype.js";
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
const textWidth = 760;
const titleFontPath = resolve(
  process.cwd(),
  "node_modules/@fontsource/inter/files/inter-latin-800-normal.woff",
);
const subheadlineFontPath = resolve(
  process.cwd(),
  "node_modules/@fontsource/inter/files/inter-latin-500-normal.woff",
);

async function getIconBuffer(iconUrl: string) {
  const localIconPath = resolve(process.cwd(), "public/appicon.png");

  if (existsSync(localIconPath)) {
    return readFileSync(localIconPath);
  }

  const response = await fetch(iconUrl);
  if (!response.ok) {
    throw new Error(
      `Could not fetch app icon for OG image. Apple returned HTTP ${response.status} ${response.statusText}.`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
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

function loadFont(path: string) {
  const buffer = readFileSync(path);
  return opentype.parse(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );
}

function getLinePathData(font: opentype.Font, text: string, fontSize: number) {
  let x = 0;
  let previousGlyph: opentype.Glyph | null = null;
  let pathData = "";
  const scale = fontSize / font.unitsPerEm;

  for (const char of text) {
    const glyph = font.charToGlyph(char);

    if (previousGlyph) {
      x += font.getKerningValue(previousGlyph, glyph) * scale;
    }

    pathData += glyph.getPath(x, fontSize, fontSize).toPathData(2);
    x += (glyph.advanceWidth || font.unitsPerEm) * scale;
    previousGlyph = glyph;
  }

  return pathData;
}

function renderTextLines(
  lines: string[],
  fontSize: number,
  lineHeight: number,
  color: string,
  font: opentype.Font,
) {
  const height = Math.ceil(fontSize + (lines.length - 1) * lineHeight + fontSize * 0.3);
  const paths = lines
    .map((line, index) => {
      const pathData = getLinePathData(font, line, fontSize);
      const translateY = index * lineHeight;
      return `<path d="${pathData}" transform="translate(0 ${translateY})" fill="${color}"/>`;
    })
    .join("");

  return Buffer.from(
    `<svg width="${textWidth}" height="${height}" viewBox="0 0 ${textWidth} ${height}" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`,
  );
}

export async function GET() {
  const settings = getSettings();
  const appData = await getAppStoreData(settings.appID);
  const title = settings.title || appData.trackName;
  const subheadline = settings.subheadline;
  const iconBuffer = await getIconBuffer(appData.iconUrl);
  const titleFont = loadFont(titleFontPath);
  const subheadlineFont = loadFont(subheadlineFontPath);

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

  const roundedIconMask = Buffer.from(
    `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 ${iconSize} ${iconSize}" xmlns="http://www.w3.org/2000/svg"><rect width="${iconSize}" height="${iconSize}" rx="${iconRadius}" ry="${iconRadius}" fill="#fff"/></svg>`,
  );
  const roundedIcon = await sharp(iconBuffer)
    .resize(iconSize, iconSize, { fit: "cover" })
    .composite([{ input: roundedIconMask, blend: "dest-in" }])
    .png()
    .toBuffer();
  const iconBorder = Buffer.from(
    `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 ${iconSize} ${iconSize}" xmlns="http://www.w3.org/2000/svg"><rect x="0.5" y="0.5" width="${iconSize - 1}" height="${iconSize - 1}" rx="${iconRadius}" ry="${iconRadius}" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="1"/></svg>`,
  );
  const titleImage = await renderTextLines(
    titleLines,
    titleFontSize,
    titleLineHeight,
    "#111827",
    titleFont,
  );
  const composites: sharp.OverlayOptions[] = [
    { input: roundedIcon, left: iconX, top: Math.round(iconY) },
    { input: iconBorder, left: iconX, top: Math.round(iconY) },
    { input: titleImage, left: textX, top: Math.round(titleY - titleFontSize) },
  ];

  if (hasSubheadline) {
    const subheadlineImage = await renderTextLines(
      subheadlineLines,
      subheadlineFontSize,
      subheadlineLineHeight,
      "#4b5563",
      subheadlineFont,
    );
    composites.push({
      input: subheadlineImage,
      left: textX,
      top: Math.round(subheadlineY - subheadlineFontSize),
    });
  }

  const png = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#ffffff",
    },
  })
    .composite(composites)
    .png()
    .toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
