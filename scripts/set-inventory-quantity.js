#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const result = dotenv.config({ path: path.join(__dirname, '../.env') });
if (result.error && result.error.code !== 'ENOENT') {
  console.error('Error loading .env:', result.error);
}

const STORE = process.env.SHOPIFY_STORE;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const QUANTITY = 999;
const BATCH_SIZE = 10; // Inventory adjustments in parallel

if (!STORE || !ACCESS_TOKEN) {
  console.error('Error: SHOPIFY_STORE and SHOPIFY_ACCESS_TOKEN must be set in .env');
  process.exit(1);
}

const GRAPHQL_URL = `https://${STORE}/admin/api/2025-01/graphql.json`;

async function graphql(query, variables = {}) {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await response.json();

  if (data.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

async function getTrackedInventoryItems(first = 250, after = null) {
  const query = `
    query GetTrackedInventory($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            variants(first: 100) {
              edges {
                node {
                  id
                  sku
                  inventoryItem {
                    id
                    tracked
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  return graphql(query, { first, after });
}

async function getInventoryLevels(inventoryItemIds) {
  if (inventoryItemIds.length === 0) return [];

  const query = `
    query GetInventoryLevels($ids: [ID!]!) {
      inventoryItems(first: 100, filter: { ids: $ids }) {
        edges {
          node {
            id
            inventoryLevels(first: 1) {
              edges {
                node {
                  id
                  quantities(names: ["available"]) {
                    name
                    quantity
                  }
                  location {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  return graphql(query, { ids: inventoryItemIds });
}

async function setInventoryQuantities(adjustments) {
  if (adjustments.length === 0) return [];

  const mutations = adjustments
    .map(
      ({ inventoryLevelId, available }, idx) => `
    adjustment${idx}: inventoryAdjustQuantities(
      input: {
        reason: "correction"
        quantities: [
          {
            inventoryLevelId: "${inventoryLevelId}"
            availableDelta: ${QUANTITY - available}
          }
        ]
      }
    ) {
      inventoryAdjustmentGroup {
        reason
        createdAt
      }
      userErrors {
        field
        message
      }
    }
  `
    )
    .join('\n');

  const mutation = `
    mutation {
      ${mutations}
    }
  `;

  const result = await graphql(mutation);

  return Object.entries(result)
    .filter(([key]) => key.startsWith('adjustment'))
    .map(([, response]) => ({
      success: !response.userErrors || response.userErrors.length === 0,
      errors: response.userErrors,
    }));
}

async function main() {
  console.log(`Setting inventory quantity to ${QUANTITY} for ${STORE}...`);

  let totalProcessed = 0;
  let totalUpdated = 0;
  let after = null;
  let hasNextPage = true;

  while (hasNextPage) {
    console.log('\nFetching tracked inventory items...');

    try {
      const data = await getTrackedInventoryItems(250, after);
      const { pageInfo, edges } = data.products;

      // Collect all tracked inventory items
      const trackedItems = [];

      for (const { node: product } of edges) {
        for (const { node: variant } of product.variants.edges) {
          const { inventoryItem } = variant;
          if (inventoryItem && inventoryItem.tracked) {
            trackedItems.push({
              inventoryItemId: inventoryItem.id,
              sku: variant.sku,
              product: product.title,
            });
          }
        }
      }

      console.log(`Found ${trackedItems.length} tracked inventory items`);

      if (trackedItems.length > 0) {
        // Get current inventory levels
        console.log('Fetching current inventory levels...');
        const itemIds = trackedItems.map(item => item.inventoryItemId);

        const levelData = await getInventoryLevels(itemIds);
        const adjustments = [];

        for (const { node: item } of levelData.inventoryItems.edges) {
          for (const { node: level } of item.inventoryLevels.edges) {
            const available = level.quantities.find(q => q.name === 'available')
              ?.quantity || 0;

            adjustments.push({
              inventoryLevelId: level.id,
              available: available,
              location: level.location.name,
              delta: QUANTITY - available,
            });
          }
        }

        console.log(`Adjusting ${adjustments.length} inventory levels...`);

        // Update in batches
        for (let i = 0; i < adjustments.length; i += BATCH_SIZE) {
          const batch = adjustments.slice(i, i + BATCH_SIZE);

          console.log(
            `Updating batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(adjustments.length / BATCH_SIZE)} (${batch.length} items)...`
          );

          try {
            const results = await setInventoryQuantities(batch);

            let successCount = 0;
            for (const result of results) {
              if (result.success) {
                successCount++;
                totalUpdated++;
              } else {
                console.warn(`Error:`, result.errors);
              }
            }

            console.log(`✓ Updated ${successCount}/${batch.length} items`);
            totalProcessed += batch.length;
          } catch (error) {
            console.error(`Error in batch: ${error.message}`);
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      hasNextPage = pageInfo.hasNextPage;
      after = pageInfo.endCursor;

      if (hasNextPage) {
        console.log(`\nProgress: ${totalProcessed} items updated so far...`);
        // Small delay between pages
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error('Error during processing:', error.message);
      hasNextPage = false;
    }
  }

  console.log('\n✅ Complete!');
  console.log(`Total inventory levels updated: ${totalUpdated}`);
  console.log(`All tracked items set to quantity: ${QUANTITY}`);
}

main().catch(console.error);
