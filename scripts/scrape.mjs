// Runs the Apify GetYourGuide actor once per city and writes data/raw/<slug>.json.
// Usage: APIFY_TOKEN=... node scripts/scrape.mjs [--only paris,rome] [--region us|eu]
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadCities } from './cities.mjs';

const TOKEN = process.env.APIFY_TOKEN;
if (!TOKEN) { console.error('APIFY_TOKEN is required'); process.exit(1); }

const ACTOR = process.env.APIFY_ACTOR ?? 'automation-lab~getyourguide-activities-scraper';
const MAX_ITEMS = Number(process.env.MAX_ITEMS_PER_CITY ?? 150);
const CURRENCY = process.env.CURRENCY ?? 'USD';
const BASE = 'https://api.apify.com/v2';
const args = process.argv.slice(2);
const argVal = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const only = argVal('--only')?.split(',').map((s) => s.trim());
const region = argVal('--region');

// Input builder. Edit this if you swap actors (see README "Changing the actor").
function buildInput(city) {
  return {
    searchQuery: city.query,
    query: city.query,            // alias used by some actors
    maxItems: MAX_ITEMS,
    maxPages: Math.ceil(MAX_ITEMS / 20),
    currency: CURRENCY,
    locale: 'en-US',
    proxyConfiguration: { useApifyProxy: true },
  };
}

async function runActor(city) {
  const url = `${BASE}/acts/${ACTOR}/run-sync-get-dataset-items?token=${TOKEN}&timeout=600&format=json&clean=true`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(buildInput(city)),
  });
  if (!res.ok) throw new Error(`${city.name}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

const cities = loadCities().filter((c) => (!region || c.region === region) && (!only || only.includes(c.slug)));
await fs.mkdir('data/raw', { recursive: true });
const summary = [];
for (const city of cities) {
  const started = Date.now();
  try {
    const items = await runActor(city);
    await fs.writeFile(path.join('data/raw', `${city.slug}.json`),
      JSON.stringify({ city, actor: ACTOR, scrapedAt: new Date().toISOString(), items }, null, 2));
    summary.push({ city: city.name, items: items.length, secs: Math.round((Date.now() - started) / 1000) });
    console.log(`✔ ${city.name}: ${items.length} items`);
  } catch (err) {
    summary.push({ city: city.name, error: String(err.message).slice(0, 200) });
    console.error(`✖ ${city.name}: ${err.message}`);
  }
}
console.table(summary);
if (summary.every((s) => s.error)) process.exit(1);
