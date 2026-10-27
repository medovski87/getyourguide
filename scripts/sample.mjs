// Generates deterministic fake raw data so the dashboard can be built without an Apify run.
import fs from 'node:fs/promises';
import { loadCities } from './cities.mjs';
let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const TEMPLATES = ['{c} Food Tour with Local Tastings', 'Skip-the-Line {c} Museum Ticket', '{c} Hop-On Hop-Off Bus Tour', '{c} Sunset Boat Cruise', 'Ghost & Legends Walking Tour of {c}', 'Day Trip from {c} to the Countryside', '{c} Pub Crawl Nightlife Experience', 'Guided Bike Tour of {c} Highlights', '{c} Airport Private Transfer', 'Cooking Class in {c}', '{c} Helicopter Sightseeing Flight', 'Street Art Walking Tour {c}', '{c} Wine Tasting Evening', 'Old Town Photo Walk {c}', '{c} Rooftop Comedy Show'];
await fs.mkdir('data/raw', { recursive: true });
for (const city of loadCities()) {
  const items = [];
  for (let i = 0; i < 60; i++) {
    const t = TEMPLATES[i % TEMPLATES.length].replace('{c}', city.name) + (i >= TEMPLATES.length ? ` #${Math.floor(i / TEMPLATES.length) + 1}` : '');
    const reviews = Math.floor(Math.pow(10, rnd() * 4));
    items.push({ title: t, url: `https://www.getyourguide.com/${city.slug}/${i}`, price: { amount: Math.round(15 + rnd() * 200), currency: 'USD' }, rating: Math.round((3.8 + rnd() * 1.2) * 10) / 10, reviewCount: reviews, isBestseller: reviews > 2000 && rnd() > 0.5, duration: `${1 + Math.floor(rnd() * 8)} hours` });
  }
  await fs.writeFile(`data/raw/${city.slug}.json`, JSON.stringify({ city: { ...city, sample: true }, actor: 'sample', scrapedAt: new Date().toISOString(), items }));
}
console.log('sample data written to data/raw (flagged sample:true)');
