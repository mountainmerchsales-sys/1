import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { MOCKUP_LAYOUT } from "./mockup-layout";

const MOCKUPS_ROOT = path.join(process.cwd(), "mockups", "gildan-64000");
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export type MockupBackground = {
  slug: string;
  displayName: string;
  filePath: string;
};

export async function listBackgrounds(): Promise<MockupBackground[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(MOCKUPS_ROOT);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const backgrounds: MockupBackground[] = [];
  for (const name of entries) {
    const ext = path.extname(name).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) continue;
    const slug = path.basename(name, ext);
    backgrounds.push({
      slug,
      displayName: slugToDisplayName(slug),
      filePath: path.join(MOCKUPS_ROOT, name),
    });
  }
  backgrounds.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return backgrounds;
}

export function slugToDisplayName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function composeMockup(
  designBuffer: Buffer,
  background: MockupBackground,
): Promise<Buffer> {
  const bg = sharp(background.filePath);
  const bgMeta = await bg.metadata();
  if (!bgMeta.width || !bgMeta.height) {
    throw new Error(`Background ${background.slug} has no dimensions`);
  }

  const targetDesignWidth = Math.round(
    bgMeta.width * MOCKUP_LAYOUT.designWidthFraction,
  );
  const resizedDesign = await sharp(designBuffer)
    .resize({ width: targetDesignWidth, withoutEnlargement: false })
    .png()
    .toBuffer({ resolveWithObject: true });

  const designW = resizedDesign.info.width;
  const designH = resizedDesign.info.height;

  const centerX = Math.round(
    bgMeta.width * MOCKUP_LAYOUT.designCenterXFraction,
  );
  const centerY = Math.round(
    bgMeta.height * MOCKUP_LAYOUT.designCenterYFraction,
  );
  const left = Math.max(0, centerX - Math.round(designW / 2));
  const top = Math.max(0, centerY - Math.round(designH / 2));

  return sharp(background.filePath)
    .composite([{ input: resizedDesign.data, left, top }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

export function normalizeColorName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
