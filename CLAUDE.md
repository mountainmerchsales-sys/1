# Mockup Generator — Project Context

## What this is
A Shopify mockup generator for Mountain Merch Sales (mountainmerchsales@gmail.com).
The user uploads a design, the system composites it onto Gildan 64000 t-shirt
backgrounds (stored in Shopify Files), and the finished mockups get attached
to a Shopify product as images.

## Branch
All development happens on `claude/shopify-mockup-generator-rq2JT`.

## Where the code lives
- `shopify-app/app/routes/app.mockups.tsx` — Remix UI page (`/app/mockups`)
- `shopify-app/app/lib/mockups.server.ts` — fetches backgrounds from Shopify Files,
  composites the design over each via `sharp`
- `shopify-app/app/lib/shopify-media.server.ts` — `stagedUploadsCreate` +
  `productCreateMedia` helpers
- `shopify-app/app/lib/mockup-layout.ts` — placement constants
  (32% width, centered horizontally, vertical center at 38% from top)

## Backgrounds — already in Shopify Files
User has uploaded 58 clean Gildan 64000 backgrounds to Shopify Admin → Content → Files.
Naming pattern: `Tee Mockups - {Color}.jpg` (e.g. `Tee Mockups - Sand.jpg`).
Shopify replaces spaces with underscores in the CDN URL.
The code finds them with `query: "filename:Tee Mockups"` and parses the color
from the filename, with a number-suffix filter to exclude old per-product mockups
(`Tee_Mockups_-_Black_4.jpg` etc., which are NOT clean backgrounds).

## Where we got stuck
Outbound network is blocked in the current session (`x-deny-reason: host_not_allowed`).
Direct `fetch`/`curl` from the container can't reach Shopify CDN, so in-session
compositing failed. MCP tools still work because they route through Anthropic's proxy.

**To finish the manual generation flow next session**, the user needs to start a
new Claude Code session with **"Full network access"** enabled in the environment
settings. Once outbound is open:
1. Pull background URLs from Shopify Files via MCP `graphql_query`
2. Download via `fetch`, composite with `sharp` (already in `shopify-app/node_modules`)
3. `stagedUploadsCreate` → POST to staged URL → `productCreateMedia`

## Open PR
https://github.com/mountainmerchsales-sys/1/pull/10 (draft) — adds the mockup
generator route + helpers. Not deployed; would need to be installed as a Shopify
app to use the self-serve UI.

## Current task
The Big Bend National Park Rustic Graphic T-Shirt product
(`gid://shopify/Product/9447912636584`) needs 4 mockups generated:
**Sand, Natural, Athletic Heather (Sport Grey), Ice Grey**. The design is
"Big Bend National Park" rustic graphic. (Design from previous session was
saved at `/tmp/design.webp` but `/tmp` is ephemeral — user will need to
re-upload it in the new session.)

## Notes
- Sharp 0.33 is installed in `shopify-app/node_modules`. Node 20+ required.
- The Dockerfile uses `node:18-alpine` — bump to `node:20-alpine` before deploying.
- Pre-existing TS error in `shopify.server.ts` from Prisma session storage type
  mismatch is not from this work.
