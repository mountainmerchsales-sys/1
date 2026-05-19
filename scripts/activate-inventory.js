#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const STORE = process.env.SHOPIFY_STORE;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const BATCH_SIZE = 25; // GraphQL batch size

if (!STORE || !ACCESS_TOKEN) {
  console.error(
    'Error: SHOPIFY_STORE and SHOPIFY_ACCESS_TOKEN must be set in .env'
  );
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

async function getProductsWithInventory(first = 250, after = null) {
  const query = `
    query GetProducts($first: Int!, $after: String) {
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
                    requiresShipping
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

async function activateInventoryItems(inventoryItemIds) {
  if (inventoryItemIds.length === 0) return [];

  const mutations = inventoryItemIds
    .map(
      (id, idx) => `
    item${idx}: inventoryItemUpdate(input: { id: "${id}", tracked: true }) {
      inventoryItem {
        id
        tracked
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
    .filter(([key]) => key.startsWith('item'))
    .map(([, response]) => ({
      id: response.inventoryItem?.id,
      tracked: response.inventoryItem?.tracked,
      errors: response.userErrors,
    }));
}

async function main() {
  console.log(`Starting inventory activation for ${STORE}...`);

  let totalProcessed = 0;
  let totalActivated = 0;
  let after = null;
  let hasNextPage = true;

  while (hasNextPage) {
    console.log('\nFetching products...');

    try {
      const data = await getProductsWithInventory(250, after);
      const { pageInfo, edges } = data.products;

      // Collect all untracked inventory items
      const inventoryToActivate = [];

      for (const { node: product } of edges) {
        for (const { node: variant } of product.variants.edges) {
          const { inventoryItem } = variant;
          if (inventoryItem && !inventoryItem.tracked) {
            inventoryToActivate.push({
              id: inventoryItem.id,
              sku: variant.sku,
              product: product.title,
            });
          }
        }
      }

      // Activate in batches
      for (let i = 0; i < inventoryToActivate.length; i += BATCH_SIZE) {
        const batch = inventoryToActivate.slice(i, i + BATCH_SIZE);
        const batchIds = batch.map(item => item.id);

        console.log(
          `Activating batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(inventoryToActivate.length / BATCH_SIZE)} (${batch.length} items)...`
        );

        try {
          const results = await activateInventoryItems(batchIds);

          let successCount = 0;
          for (const result of results) {
            if (result.tracked) {
              successCount++;
              totalActivated++;
            } else if (result.errors?.length > 0) {
              console.warn(
                `Error activating ${result.id}:`,
                result.errors
              );
            }
          }

          console.log(`✓ Activated ${successCount}/${batch.length} items`);
          totalProcessed += batch.length;
        } catch (error) {
          console.error(`Error in batch: ${error.message}`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      hasNextPage = pageInfo.hasNextPage;
      after = pageInfo.endCursor;

      if (hasNextPage) {
        console.log(`\nProgress: ${totalProcessed} items processed so far...`);
        // Small delay between pages
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error('Error during processing:', error.message);
      hasNextPage = false;
    }
  }

  console.log('\n✅ Complete!');
  console.log(`Total items processed: ${totalProcessed}`);
  console.log(`Total items activated: ${totalActivated}`);
}

main().catch(console.error);
