// Reads data/raw/*.json, normalizes, and writes data/analysis.json consumed by the site.
import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeItem } from './normalize.mjs';

const RAW = 'data/raw';
const files = (await fs.readdir(RAW).catch(() => [])).filter((f) => f.endsWith('.json'));
if (!files.length) { console.error('No raw data in data/raw. Run `npm run scrape` or `npm run sample`.'); process.exit(1); }

let all = [];
const cityMeta = [];
for (const f of files) {
  const { city, items, scrapedAt } = JSON.parse(await fs.readFile(path.join(RAW, f), 'utf8'));
  const norm = items.map((i) => normalizeItem(i, city)).filter(Boolean);
  cityMeta.push({ ...city, scrapedAt, itemCount: norm.length });
  all = all.concat(norm);
}

// --- scoring -------------------------------------------------------------
// "Demand score" blends review volume (log-scaled, a proxy for bookings) with rating.
// Bayesian-adjusted rating stops a 5.0 with 3 reviews from beating a 4.8 with 9,000.
const C = 50; // prior weight (reviews)
const globalMean = mean(all.filter((a) => a.rating != null).map((a) => a.rating)) ?? 4.5;
for (const a of all) {
  const r = a.rating ?? globalMean;
  a.adjRating = (C * globalMean + a.reviewCount * r) / (C + a.reviewCount);
  a.demandScore = round(Math.log10(1 + a.reviewCount) * a.adjRating, 2);
  a.priceBand = a.price == null ? 'unknown' : a.price < 30 ? '<$30' : a.price < 75 ? '$30–75' : a.price < 150 ? '$75–150' : '$150+';
}

function mean(xs) { return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null; }
function median(xs) { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function round(x, d = 1) { return x == null ? null : Math.round(x * 10 ** d) / 10 ** d; }
function sum(xs) { return xs.reduce((s, x) => s + x, 0); }

function groupStats(items, key) {
  const groups = new Map();
  for (const it of items) { const k = it[key] ?? 'unknown'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
  return [...groups.entries()].map(([name, g]) => {
    const prices = g.map((x) => x.price).filter((p) => p != null);
    const reviews = sum(g.map((x) => x.reviewCount));
    return {
      name, listings: g.length,
      totalReviews: reviews,
      reviewShare: 0, // filled below
      avgRating: round(mean(g.map((x) => x.rating).filter((r) => r != null)), 2),
      medianPrice: round(median(prices), 0),
      avgDemand: round(mean(g.map((x) => x.demandScore)), 2),
      bestsellerRate: round(100 * g.filter((x) => x.bestseller).length / g.length, 0),
      // A category whose share of reviews exceeds its share of listings is "under-supplied"
      top: [...g].sort((a, b) => b.demandScore - a.demandScore).slice(0, 3).map((x) => ({ title: x.title, city: x.city, reviewCount: x.reviewCount, rating: x.rating, price: x.price, url: x.url })),
    };
  }).map((s, _, arr) => {
    const totalR = sum(arr.map((x) => x.totalReviews)) || 1, totalL = sum(arr.map((x) => x.listings)) || 1;
    s.reviewShare = round(100 * s.totalReviews / totalR, 1);
    s.listingShare = round(100 * s.listings / totalL, 1);
    s.opportunityIndex = round(s.reviewShare / (s.listingShare || 1), 2); // >1 = demand outpaces supply
    return s;
  }).sort((a, b) => b.totalReviews - a.totalReviews);
}

const byRegion = {};
for (const region of ['us', 'eu']) {
  const items = all.filter((a) => a.region === region);
  byRegion[region] = {
    listings: items.length,
    totalReviews: sum(items.map((x) => x.reviewCount)),
    avgRating: round(mean(items.map((x) => x.rating).filter((r) => r != null)), 2),
    medianPrice: round(median(items.map((x) => x.price).filter((p) => p != null)), 0),
    bestsellerRate: round(100 * items.filter((x) => x.bestseller).length / (items.length || 1), 0),
    categories: groupStats(items, 'category'),
    priceBands: groupStats(items, 'priceBand'),
    cities: groupStats(items, 'city').map((c) => ({ ...c, slug: cityMeta.find((m) => m.name === c.name)?.slug })),
    topExperiences: [...items].sort((a, b) => b.demandScore - a.demandScore).slice(0, 25),
  };
}

const perCity = {};
for (const m of cityMeta) {
  const items = all.filter((a) => a.citySlug === m.slug);
  perCity[m.slug] = {
    ...m,
    totalReviews: sum(items.map((x) => x.reviewCount)),
    avgRating: round(mean(items.map((x) => x.rating).filter((r) => r != null)), 2),
    medianPrice: round(median(items.map((x) => x.price).filter((p) => p != null)), 0),
    categories: groupStats(items, 'category'),
    priceBands: groupStats(items, 'priceBand'),
    top: [...items].sort((a, b) => b.demandScore - a.demandScore).slice(0, 15),
    hiddenGems: items.filter((x) => x.rating >= 4.8 && x.reviewCount >= 20 && x.reviewCount < 300).sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount).slice(0, 8),
  };
}

// Category matrix: which categories win per city (review share)
const categoryNames = [...new Set(all.map((a) => a.category))];
const matrix = cityMeta.map((m) => {
  const items = all.filter((a) => a.citySlug === m.slug); const tot = sum(items.map((x) => x.reviewCount)) || 1;
  const row = { city: m.name, slug: m.slug, region: m.region };
  for (const c of categoryNames) row[c] = round(100 * sum(items.filter((x) => x.category === c).map((x) => x.reviewCount)) / tot, 1);
  return row;
});

const out = {
  generatedAt: new Date().toISOString(),
  sample: cityMeta.some((m) => m.sample),
  totals: { listings: all.length, cities: cityMeta.length, reviews: sum(all.map((x) => x.reviewCount)) },
  categoryNames,
  regions: byRegion,
  cities: perCity,
  cityList: cityMeta.map(({ slug, name, region, itemCount, scrapedAt }) => ({ slug, name, region, itemCount, scrapedAt })),
  matrix,
  overall: { categories: groupStats(all, 'category'), top: [...all].sort((a, b) => b.demandScore - a.demandScore).slice(0, 50) },
};
await fs.writeFile('data/analysis.json', JSON.stringify(out));
console.log(`analysis.json: ${all.length} listings across ${cityMeta.length} cities, ${out.totals.reviews} reviews`);
