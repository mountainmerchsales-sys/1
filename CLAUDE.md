# Parks Apparel — Brand Memory

Load these facts at the start of every session so emails, designs, discounts, and
campaigns stay on-brand without re-asking.

## Identity
- **Store name:** Parks Apparel
- **Domain:** parksapparel.com
- **Contact email:** info@parksapparel.com
- **Industry:** Ecommerce / Apparel & Accessories / Activewear, National Park-themed merchandise (apparel, drinkware, mugs, tumblers)
- **Klaviyo default sender:** Parks Apparel <Info@ParksApparel.com>
- **Klaviyo org address:** 121 Pine Lakes Parkway North, Suite 1010, Palm Coast, FL 32137
- **Currency:** USD
- **Timezone:** US/Eastern (Klaviyo) / PDT (Shopify) — schedule sends in ET

## Brand Colors (use these — do not substitute)
| Token       | Hex       | Use                                      |
|-------------|-----------|------------------------------------------|
| Sage Green  | `#515a47` | Primary background, headers              |
| Khaki Tan   | `#d7be82` | Accent, secondary buttons, dividers      |
| Rust Brown  | `#7a4419` | Primary CTA button, links                |
| Dark Gold   | `#755c1b` | Secondary accents, badges                |
| Deep Burgundy | `#400406` | Hero accents, emphasis blocks          |
| White       | `#ffffff` | Text on dark backgrounds                 |
| Black       | `#000000` | Text on light backgrounds                |

Pair dark backgrounds (#515a47, #400406, #7a4419) with white text.
Pair light backgrounds (#d7be82, #ffffff) with black or #400406 text.

## Logo
- **Primary logo URL:** https://cdn.shopify.com/s/files/1/0653/5685/7512/files/Crater_Lake_-_Parks_Apparel_Logo.png?v=1768792812
- **Dimensions:** 2499×1557 PNG (transparent)
- **Description:** "Parks Apparel · Est. 2024" wordmark in a vintage National Park-sign style

## Typography
- **Header + body font:** Fjalla One (web)
- **Email fallback stack:** `'Fjalla One', 'Oswald', 'Impact', Helvetica, Arial, sans-serif`
- Use ALL CAPS sparingly for the National Park sign aesthetic on headlines.

## Voice
- Adventurous, outdoorsy, vintage NPS-inspired
- "Insider" framing for VIP/email subscribers
- Reference parks, trails, the outdoors when natural

## Repo Layout (this repo)
- `/shopify-app` — Shopify Remix app template
- `/marketing/email-templates` — Klaviyo email HTML (source of truth before upload)

## Active Discount Codes
| Code | Offer | Audience | Active Window (ET) | Shopify ID | Notes |
|------|-------|----------|--------------------|------------|-------|
| `PSMD202625` | 25% off entire order | All customers | Fri May 22, 2026 00:00 → Mon May 25, 2026 23:59 | `gid://shopify/DiscountCodeNode/4946810568872` | Insider Memorial Day Weekend campaign. Auto-apply URL: `https://parksapparel.com/discount/PSMD202625` |

## Campaign Assets
- **Insider Memorial Day Weekend 2026** (code `PSMD202625`)
  - Klaviyo template: `WPGqrx` — https://www.klaviyo.com/email-editor/WPGqrx/edit
  - Source HTML: `marketing/email-templates/insider-memorial-day-2026.html`
  - Planned send: Fri May 22, 2026 morning ET, all subscribers
