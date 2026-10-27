// Copies the static site + analysis.json into dist/ for Cloudflare Pages.
import fs from 'node:fs/promises';
await fs.rm('dist', { recursive: true, force: true });
await fs.cp('site', 'dist', { recursive: true });
await fs.mkdir('dist/data', { recursive: true });
await fs.copyFile('data/analysis.json', 'dist/data/analysis.json');
console.log('dist/ ready');
