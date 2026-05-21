# Gildan 64000 mockup backgrounds

Drop one PNG (or JPG) per shirt color into this directory. The mockup
generator reads this folder at request time and creates one product image
per file by compositing the uploaded design onto each background.

## File naming

Use kebab-case for the color name. The filename (without extension) is
both the slug and the display name (hyphens are converted to spaces and
title-cased when shown in Shopify alt text).

Examples:

```
black.png
white.png
sport-grey.png
navy.png
royal.png
heather-military-green.png
```

## Image requirements

- Dimensions: all backgrounds should be the same size (recommended:
  2000x2000 px or larger, square).
- Format: PNG preferred. JPG works too.
- The shirt should be centered on a neutral background. The design will
  be composited at a fixed position relative to the image's top-left
  origin — see `app/lib/mockup-layout.ts` for the placement constants
  (default: design centered horizontally, top of design at ~28% from
  the top of the image, scaled so its width is ~32% of the background
  width). Tune those constants once for your specific photos.

## What gets uploaded

The slug is used as the image alt text ("Mockup — Sport Grey"). In v1,
mockups are added as product-level images on the selected product.
Linking each mockup to its corresponding color variant is a planned
follow-up — it requires waiting on Shopify's async media processing
before calling `productVariantAppendMedia`.
