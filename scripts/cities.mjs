import { readFileSync } from 'node:fs';
export function loadCities() {
  const cfg = JSON.parse(readFileSync(new URL('../config/cities.json', import.meta.url)));
  return [...cfg.us.map((c) => ({ ...c, region: 'us' })), ...cfg.eu.map((c) => ({ ...c, region: 'eu' }))];
}
