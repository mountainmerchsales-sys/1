import sharp from "sharp";
import { MOCKUP_LAYOUT } from "./mockup-layout";

type AdminGraphql = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type MockupBackground = {
  slug: string;
  displayName: string;
  imageUrl: string;
};

// Files should be named "Tee Mockups - {Color Name}.jpg" in Shopify Files
const FILE_SEARCH_TERM = "Tee Mockups";
const FILE_SEPARATOR = " - ";

export async function listBackgrounds(
  admin: AdminGraphql,
): Promise<MockupBackground[]> {
  const res = await admin.graphql(
    `#graphql
      query getMockupFiles($query: String!) {
        files(first: 250, query: $query) {
          edges {
            node {
              alt
              ... on MediaImage {
                id
                image { url }
              }
              ... on GenericFile {
                id
                url
              }
            }
          }
        }
      }`,
    { variables: { query: `filename:${FILE_SEARCH_TERM}` } },
  );

  const json = (await res.json()) as {
    data?: {
      files?: {
        edges?: {
          node: {
            alt?: string | null;
            image?: { url: string };
            url?: string;
          };
        }[];
      };
    };
  };

  const backgrounds: MockupBackground[] = [];
  for (const edge of json.data?.files?.edges ?? []) {
    const imageUrl = edge.node.image?.url ?? edge.node.url ?? "";
    if (!imageUrl) continue;

    // Prefer alt text (Shopify often sets this to the original filename minus extension)
    // Fall back to parsing the CDN URL path
    const colorName =
      extractColorFromAlt(edge.node.alt ?? "") ??
      extractColorFromUrl(imageUrl);

    if (!colorName) continue;
    const slug = colorNameToSlug(colorName);
    backgrounds.push({
      slug,
      displayName: colorName,
      imageUrl,
    });
  }

  backgrounds.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return backgrounds;
}

function extractColorFromAlt(alt: string): string | null {
  // alt: "Tee Mockups - Heather indigo" or "Tee Mockups - Heather indigo.jpg"
  const cleaned = alt.replace(/\.[^.]+$/, "").trim();
  const idx = cleaned.indexOf(FILE_SEPARATOR);
  if (idx === -1) return null;
  const color = cleaned.slice(idx + FILE_SEPARATOR.length).trim();
  return color || null;
}

function extractColorFromUrl(imageUrl: string): string | null {
  try {
    const urlFilename = new URL(imageUrl).pathname.split("/").pop() ?? "";
    // e.g. "Tee_Mockups_-_Heather_indigo_abc12345.jpg"
    const bare = urlFilename.split("?")[0].replace(/\.[^.]+$/, "");
    // Replace underscores with spaces
    const withSpaces = bare.replace(/_/g, " ");
    // Strip trailing Shopify hash: a short lowercase alphanumeric segment
    const dehashed = withSpaces.replace(/\s+[0-9a-f]{6,16}$/i, "").trim();
    const idx = dehashed.indexOf(FILE_SEPARATOR);
    if (idx === -1) return null;
    const color = dehashed.slice(idx + FILE_SEPARATOR.length).trim();
    return color || null;
  } catch {
    return null;
  }
}

function colorNameToSlug(colorName: string): string {
  return colorName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
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
  const bgRes = await fetch(background.imageUrl);
  if (!bgRes.ok) {
    throw new Error(
      `Failed to fetch background ${background.slug}: ${bgRes.status}`,
    );
  }
  const bgBuffer = Buffer.from(await bgRes.arrayBuffer());

  const bg = sharp(bgBuffer);
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

  const centerX = Math.round(bgMeta.width * MOCKUP_LAYOUT.designCenterXFraction);
  const centerY = Math.round(bgMeta.height * MOCKUP_LAYOUT.designCenterYFraction);
  const left = Math.max(0, centerX - Math.round(designW / 2));
  const top = Math.max(0, centerY - Math.round(designH / 2));

  return sharp(bgBuffer)
    .composite([{ input: resizedDesign.data, left, top }])
    .jpeg({ quality: 92 })
    .toBuffer();
}
