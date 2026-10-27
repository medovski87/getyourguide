# GetYourGuide Market Radar

Scrapes GetYourGuide listings for **10 US + 10 EU cities** through an Apify actor, scores which experiences and categories actually sell, and publishes a static dashboard to **Cloudflare Pages** from **GitHub Actions**.

```
config/cities.json      the 20 cities (edit freely)
scripts/scrape.mjs      calls the Apify actor once per city -> data/raw/<city>.json
scripts/normalize.mjs   maps any actor's output onto one record shape + infers category
scripts/analyze.mjs     scoring + aggregation -> data/analysis.json
scripts/build.mjs       site/ + analysis.json -> dist/
scripts/sample.mjs      fake data so the dashboard works before any scrape
site/                   dashboard (vanilla JS + Chart.js)
.github/workflows/      scrape.yml (weekly, commits data) and deploy.yml (Cloudflare Pages)
```

## How the market is analyzed

| Metric | Meaning |
|---|---|
| **Demand score** | `log10(1 + reviews) × Bayesian-adjusted rating`. Review volume is the closest public proxy for bookings; the adjustment stops a 5.0 with 3 reviews beating a 4.8 with 9,000. |
| **Review share vs listing share** | Per category and price band, per city and per region. |
| **Opportunity index** | `review share ÷ listing share`. Above 1 means demand outpaces supply in that category: the gap to build into. |
| **Hidden gems** | ★ ≥ 4.8 with 20–300 reviews: formats that convert but haven't saturated. |
| **Category × City heatmap** | Where each format dominates, so you can compare e.g. food tours in Rome vs New Orleans. |

Categories are inferred from titles when the actor doesn't supply one (`scripts/normalize.mjs`, `CATEGORY_RULES`).

## Setup

1. **Apify**: create a token at apify.com → Settings → Integrations. Default actor is `automation-lab~getyourguide-activities-scraper`.
2. **GitHub secrets** (repo → Settings → Secrets and variables → Actions):
   - `APIFY_TOKEN`
   - `CLOUDFLARE_API_TOKEN` (Pages: Edit permission) and `CLOUDFLARE_ACCOUNT_ID`
   - optional variables: `APIFY_ACTOR`, `CF_PAGES_PROJECT` (default `gyg-market-radar`)
3. **Cloudflare**: create a Pages project named `gyg-market-radar` (Direct Upload), or let the first `wrangler pages deploy` create it.
4. Run the **Scrape** workflow manually (Actions tab). It commits `data/` and the deploy workflow publishes the dashboard.

Cost control: `MAX_ITEMS_PER_CITY` (default 150) caps each actor run. 20 cities × 150 listings is a few dollars per run on most actors.

## Local

```bash
cp .env.example .env            # add APIFY_TOKEN
npm run sample                  # or: npm run pipeline  (real scrape)
npm run serve                   # http://localhost:3000
node scripts/scrape.mjs --only paris,rome --region eu   # partial runs
```

## Changing the actor

Apify has several GetYourGuide actors with different input fields. Two places to touch:

- `buildInput()` in `scripts/scrape.mjs`: the actor's input (search query, item cap, currency).
- `normalizeItem()` in `scripts/normalize.mjs`: field lookups try a list of common names (`price.amount`, `reviewCount`, `numberOfReviews`...). Add the actor's names to the lists if a column shows up empty.

Check the actor's exact schema on its Input tab before the first full run. Try one city first:

```bash
node scripts/scrape.mjs --only paris && node -e "console.log(require('./data/raw/paris.json').items[0])"
```
