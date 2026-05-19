# Shopify Inventory Activation Script

This script efficiently activates inventory tracking for all Shopify products that require shipping but aren't currently tracked.

## Setup

1. **Create a `.env` file** in the root directory with your Shopify credentials:
   ```env
   SHOPIFY_STORE=your-store.myshopify.com
   SHOPIFY_ACCESS_TOKEN=your-admin-api-token
   ```

2. **Get your credentials:**
   - Store domain: Your Shopify admin URL (e.g., `my-store.myshopify.com`)
   - Access token: Create a custom app at Admin → Settings → Apps and sales channels → Develop apps → Create an app
     - Required scopes: `write_inventory`

## Usage

```bash
# From the project root
node scripts/activate-inventory.js
```

## How It Works

1. Fetches all products and their variants from your Shopify store
2. Identifies variants with untracked inventory that require shipping
3. Activates tracking in batches of 25 items (optimized for Shopify's API)
4. Includes rate limiting to stay within API limits
5. Logs progress and results

## Performance

- Processes ~250 products per API call
- Batches activation mutations (25 per request) to minimize API calls
- Much faster than sequential single-item mutations
- Typically activates 1000+ items in a few minutes

## What It Does

- ✅ Activates inventory tracking (sets `tracked: true`)
- ✅ Only affects items that require shipping
- ✅ Skips items already tracked
- ✅ Reports errors for items that fail

## Error Handling

The script will log any errors encountered during activation and continue processing remaining items. Check the output for any items that failed.
