# Prioritized TODO List - SEO & AI Sales

## Week 1: Quick Wins + Foundation (Do These First)

### Day 1: Super Quick (2-3 hours) - Do TODAY
- [ ] **1. Update landing page text** (30 min)
  - File: `app/routes/_index/route.tsx`
  - Change: "[your app]" → actual app name/benefit
  - Change: generic features → real features
  - This is visible to users NOW, fix first

- [ ] **2. Add robots.txt** (15 min)
  - Create: `public/robots.txt`
  - Tells Google what to index
  - Simple file, immediate impact

- [ ] **3. Update app scopes** (10 min)
  - File: `shopify.app.toml`
  - Add: `read_products,read_inventory` to scopes
  - Required for all other features

- [ ] **4. Add basic SEO meta tags** (45 min)
  - File: `app/root.tsx`
  - Add: title, description, og:tags
  - Add: viewport, charset (already there)
  - Add: theme-color, favicon

**Commit after:** `feat: quick wins - landing page, robots.txt, basic SEO`

---

### Day 2: Build Foundation (3-4 hours)

- [ ] **5. Create sitemap.xml** (20 min)
  - Create: `public/sitemap.xml`
  - List all public URLs
  - Submit to Google Search Console

- [ ] **6. Add structured data (schema.org)** (1 hour)
  - Add JSON-LD to `root.tsx`
  - Type: Organization
  - Include: name, description, logo, contact

- [ ] **7. Create API docs skeleton** (30 min)
  - Create: `public/api-docs.json`
  - This will document what you build next
  - Swagger/OpenAPI format

**Commit after:** `feat: add sitemap, structured data, API docs skeleton`

---

## Week 2: Core APIs (These Enable Everything)

### Day 3-4: Public Products API (4-5 hours) ⭐ CRITICAL
This is the foundation for AI integration

- [ ] **8. Create `/api/products` endpoint** (3 hours)
  - File: `app/routes/api/products.tsx`
  - Implements: GET `/api/products`
  - Features:
    - [ ] List all products
    - [ ] Pagination (limit, offset)
    - [ ] Search query support
    - [ ] Cache headers
    - [ ] Error handling
  - Test with: `curl http://localhost:3000/api/products?limit=5`

- [ ] **9. Create `/api/products/:id` endpoint** (1-2 hours)
  - Get single product details
  - Include: all relevant fields
  - Test with: `curl http://localhost:3000/api/products/123`

**Commit after:** `feat: add public product API endpoints`

---

### Day 5: Inventory & Search (3-4 hours)

- [ ] **10. Create `/api/inventory` endpoint** (1-2 hours)
  - File: `app/routes/api/inventory.tsx`
  - Real-time inventory status
  - Support: single or bulk queries

- [ ] **11. Add `/api/search` with filtering** (1-2 hours)
  - Search by: title, tags, price range
  - Filter by: inStock, price range
  - Sort by: relevance, price, newest
  - Example: `/api/search?q=jacket&minPrice=50&maxPrice=150`

**Commit after:** `feat: add inventory and search endpoints`

---

## Week 3: AI Integration

### Day 6: Claude API Setup (2-3 hours)

- [ ] **12. Set up Claude API integration** (1 hour)
  - Create: `app/services/ai-content.server.ts`
  - Install: `@anthropic-ai/sdk`
  - Set env: `ANTHROPIC_API_KEY`
  - Add basic function to generate descriptions

- [ ] **13. Update Prisma schema** (1 hour)
  - File: `prisma/schema.prisma`
  - Add: `ProductDescription` model
  - Store: AI-generated content
  - Run: `npx prisma migrate dev --name add_product_descriptions`

- [ ] **14. Generate descriptions for products** (1 hour)
  - Script to batch-generate descriptions
  - Cache in database
  - Update products with AI copy

**Commit after:** `feat: add Claude API integration for content generation`

---

### Day 7: AI-Optimized Feed (2-3 hours)

- [ ] **15. Create `/api/feeds/products` endpoint** (2-3 hours)
  - File: `app/routes/api/feeds/products.tsx`
  - Return: all products in LLM-friendly format
  - Include: AI descriptions, sales points, tags
  - Format: JSON-LD schema
  - Use case: ChatGPT plugins, AI agents

**Commit after:** `feat: add AI-optimized product feed`

---

## Week 4: Sales Channels & Polish

### Day 8-9: ChatGPT Integration (3-4 hours)

- [ ] **16. Create OpenAPI spec** (2 hours)
  - File: `public/.well-known/openapi.yaml`
  - Document: `/api/products`, `/api/search`, `/api/feeds/products`
  - Include: auth, examples, schemas
  - Validate in: https://editor.swagger.io/

- [ ] **17. Set up ChatGPT plugin** (1-2 hours)
  - Register plugin with OpenAI
  - Test in ChatGPT
  - Document: How to use

**Commit after:** `feat: add ChatGPT plugin and OpenAPI docs`

---

### Day 10: Performance & Monitoring (2-3 hours)

- [ ] **18. Add caching headers** (1 hour)
  - Products: Cache-Control: max-age=3600
  - Inventory: Cache-Control: max-age=300
  - Search: Cache-Control: max-age=300

- [ ] **19. Add error logging** (1 hour)
  - Log API errors
  - Track failed requests
  - Monitor performance

- [ ] **20. Add rate limiting** (30 min)
  - Limit requests per IP
  - Prevent abuse

**Commit after:** `feat: add caching, logging, rate limiting`

---

## Post-Launch Monitoring

- [ ] **21. Set up Google Search Console**
  - Submit sitemap
  - Monitor index status
  - Track search queries

- [ ] **22. Set up analytics**
  - Track API usage
  - Monitor sales from each channel
  - Track organic traffic

- [ ] **23. Gather customer feedback**
  - Survey merchants
  - Track adoption
  - Iterate on features

---

## Priority Order (If Time is Limited)

**MUST DO (Week 1):**
1. Landing page text
2. robots.txt
3. App scopes
4. SEO meta tags
5. Products API

**SHOULD DO (Week 2):**
6. Inventory endpoint
7. Search endpoint
8. Claude API setup
9. AI-optimized feed

**NICE TO HAVE (Week 3-4):**
10. ChatGPT plugin
11. Caching/logging
12. Rate limiting

---

## Dependencies (What Blocks What)

```
Landing Page Text (1) → Nothing blocks this
robots.txt (2) → Nothing blocks this
App Scopes (3) → Blocks: everything else
SEO Meta Tags (4) → Nothing blocks this

Products API (8) → Blocked by: Scopes (3)
Inventory API (10) → Blocked by: Scopes (3)
Search API (11) → Blocked by: Products API (8)

Claude Setup (12) → Nothing blocks this
AI Feed (15) → Blocked by: Products API (8) + Claude (12)

OpenAPI Docs (16) → Blocked by: All APIs done
ChatGPT Plugin (17) → Blocked by: OpenAPI Docs (16)
```

---

## Testing Checklist

After each section, test:

**After Week 1:**
- [ ] Landing page loads without errors
- [ ] Meta tags visible in page source
- [ ] robots.txt accessible at `/robots.txt`

**After Week 2:**
- [ ] `/api/products` returns JSON
- [ ] Pagination works
- [ ] `/api/inventory` returns stock data
- [ ] Search filters work

**After Week 3:**
- [ ] Claude API generates descriptions
- [ ] Descriptions cached in database
- [ ] `/api/feeds/products` returns all products

**After Week 4:**
- [ ] OpenAPI doc validates
- [ ] ChatGPT can call your API
- [ ] Cache headers present in responses
- [ ] Rate limiting works

---

## Success Metrics

Track these numbers as you go:

| Metric | Current | Goal |
|--------|---------|------|
| Organic traffic | 0 | 100+/week |
| API calls/day | 0 | 50+/day |
| ChatGPT plugin users | 0 | 1+ |
| Products indexed | 0 | All of them |

---

## How to Track Progress

Use this checklist daily:
```bash
# Each morning
- [ ] What did I complete yesterday?
- [ ] What's blocking me?
- [ ] What's my goal for today?

# Each evening  
- [ ] Did I hit my goal?
- [ ] Is my code committed?
- [ ] Are tests passing?
```

---

## Questions Before Starting?

1. Can you access Claude API key?
2. Should landing page say a specific product/benefit?
3. Any features you want in products API?
4. Priority: Speed (2 weeks) or Quality (4 weeks)?

**Ready to start? Pick Day 1 items and go!** 🚀
