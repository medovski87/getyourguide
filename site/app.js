const $ = (s) => document.querySelector(s);
const fmt = (n) => (n == null ? '–' : n.toLocaleString('en-US'));
const money = (n) => (n == null ? '–' : '$' + Math.round(n));
let D, view = 'overview', charts = [];

fetch('data/analysis.json').then((r) => r.json()).then((d) => {
  D = d;
  $('#meta').textContent = `${fmt(d.totals.listings)} listings · ${fmt(d.totals.reviews)} reviews · updated ${new Date(d.generatedAt).toLocaleDateString()}`;
  $('#sampleBanner').hidden = !d.sample;
  render();
});
document.querySelectorAll('nav button').forEach((b) => b.onclick = () => { view = b.dataset.view; document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('active', x === b)); render(); });

function render() {
  charts.forEach((c) => c.destroy()); charts = [];
  const app = $('#app');
  if (view === 'overview') app.innerHTML = overview();
  else if (view === 'us' || view === 'eu') app.innerHTML = region(view);
  else if (view === 'cities') { app.innerHTML = cityShell(); bindCity(); }
  else app.innerHTML = matrix();
  drawCharts();
}

const statCard = (label, value, sub = '') => `<div class="card"><div class="stat">${value}<small>${label}${sub ? ' · ' + sub : ''}</small></div></div>`;

function overview() {
  const us = D.regions.us, eu = D.regions.eu;
  return `
  <div class="grid">
    ${statCard('US listings', fmt(us.listings), `${fmt(us.totalReviews)} reviews`)}
    ${statCard('EU listings', fmt(eu.listings), `${fmt(eu.totalReviews)} reviews`)}
    ${statCard('US median price', money(us.medianPrice), `avg ★ ${us.avgRating}`)}
    ${statCard('EU median price', money(eu.medianPrice), `avg ★ ${eu.avgRating}`)}
  </div>
  <h2>Which categories win: US vs EU (share of reviews)</h2>
  <div class="card"><canvas id="catCompare"></canvas></div>
  <h2>Price band share of reviews</h2>
  <div class="card"><canvas id="priceCompare"></canvas></div>
  <h2>Top 50 experiences overall</h2>
  ${expTable(D.overall.top, true)}`;
}

function region(r) {
  const R = D.regions[r];
  return `
  <div class="grid">
    ${statCard('Listings', fmt(R.listings))}${statCard('Reviews', fmt(R.totalReviews))}${statCard('Median price', money(R.medianPrice))}${statCard('Bestseller rate', R.bestsellerRate + '%')}
  </div>
  <h2>Categories ranked by demand</h2>${catTable(R.categories)}
  <h2>Cities ranked by total reviews</h2>${cityTable(R.cities)}
  <h2>Top 25 experiences</h2>${expTable(R.topExperiences, true)}`;
}

function cityShell() {
  const opts = D.cityList.map((c) => `<option value="${c.slug}">${c.name} (${c.region.toUpperCase()})</option>`).join('');
  return `<p><select id="citySel">${opts}</select></p><div id="cityBody"></div>`;
}
function bindCity() { const sel = $('#citySel'); sel.onchange = () => cityView(sel.value); cityView(sel.value); }
function cityView(slug) {
  const C = D.cities[slug];
  $('#cityBody').innerHTML = `
  <div class="grid">${statCard('Listings', fmt(C.itemCount))}${statCard('Reviews', fmt(C.totalReviews))}${statCard('Median price', money(C.medianPrice))}${statCard('Avg rating', C.avgRating)}</div>
  <h2>Category breakdown</h2>${catTable(C.categories)}
  <h2>Price bands</h2>${catTable(C.priceBands)}
  <h2>Top 15 by demand</h2>${expTable(C.top)}
  <h2>Hidden gems (★ ≥ 4.8, 20–300 reviews)</h2>${C.hiddenGems.length ? expTable(C.hiddenGems) : '<p class="sub">None found.</p>'}`;
}

function catTable(rows) {
  return `<div class="tablewrap"><table><tr><th>Category</th><th>Listings</th><th>Reviews</th><th>Review share</th><th>Listing share</th><th>Opportunity</th><th>Avg ★</th><th>Median $</th><th>Bestseller %</th><th>Top listing</th></tr>
  ${rows.map((c) => `<tr><td>${c.name}</td><td>${fmt(c.listings)}</td><td>${fmt(c.totalReviews)}</td><td>${c.reviewShare}%</td><td>${c.listingShare}%</td><td class="${c.opportunityIndex >= 1 ? 'pos' : 'neg'}">${c.opportunityIndex}×</td><td>${c.avgRating ?? '–'}</td><td>${money(c.medianPrice)}</td><td>${c.bestsellerRate}%</td><td class="t">${c.top[0] ? link(c.top[0]) : ''}</td></tr>`).join('')}</table></div>`;
}
function cityTable(rows) {
  return `<div class="tablewrap"><table><tr><th>City</th><th>Listings</th><th>Reviews</th><th>Avg ★</th><th>Median $</th><th>Bestseller %</th><th>Top listing</th></tr>
  ${rows.map((c) => `<tr><td>${c.name}</td><td>${fmt(c.listings)}</td><td>${fmt(c.totalReviews)}</td><td>${c.avgRating ?? '–'}</td><td>${money(c.medianPrice)}</td><td>${c.bestsellerRate}%</td><td class="t">${c.top[0] ? link(c.top[0]) : ''}</td></tr>`).join('')}</table></div>`;
}
function expTable(rows, showCity = false) {
  return `<div class="tablewrap"><table><tr><th>#</th><th>Experience</th>${showCity ? '<th>City</th>' : ''}<th>Category</th><th>Reviews</th><th>★</th><th>Price</th><th>Demand</th></tr>
  ${rows.map((x, i) => `<tr><td>${i + 1}</td><td class="t">${link(x)}${x.bestseller ? '<span class="tag">bestseller</span>' : ''}</td>${showCity ? `<td>${x.city}</td>` : ''}<td>${x.category ?? ''}</td><td>${fmt(x.reviewCount)}</td><td>${x.rating ?? '–'}</td><td>${money(x.price)}</td><td>${x.demandScore ?? ''}</td></tr>`).join('')}</table></div>`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const link = (x) => x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>` : esc(x.title);

function matrix() {
  const cats = D.categoryNames;
  const cell = (v) => { const a = Math.min(1, (v ?? 0) / 40); return `<td class="v" style="background:rgba(255,85,51,${a.toFixed(2)})">${v ?? 0}%</td>`; };
  return `<p class="sub">Share of each city's reviews by category. Darker = category dominates that market.</p>
  <div class="tablewrap"><table class="heat"><tr><th>City</th>${cats.map((c) => `<th>${c}</th>`).join('')}</tr>
  ${D.matrix.map((r) => `<tr><td>${r.city} <span class="tag">${r.region.toUpperCase()}</span></td>${cats.map((c) => cell(r[c])).join('')}</tr>`).join('')}</table></div>`;
}

function drawCharts() {
  if (typeof Chart === 'undefined') return;
  const mk = (id, cfg) => { const el = document.getElementById(id); if (el) charts.push(new Chart(el, cfg)); };
  const bar = (key, field) => {
    const labels = [...new Set([...D.regions.us[key], ...D.regions.eu[key]].map((c) => c.name))];
    const ds = (r, color) => ({ label: r.toUpperCase(), backgroundColor: color, data: labels.map((l) => D.regions[r][key].find((c) => c.name === l)?.[field] ?? 0) });
    return { type: 'bar', data: { labels, datasets: [ds('us', '#2f6fed'), ds('eu', '#e0a500')] }, options: { responsive: true, scales: { y: { title: { display: true, text: '% of reviews' } } } } };
  };
  mk('catCompare', bar('categories', 'reviewShare'));
  mk('priceCompare', bar('priceBands', 'reviewShare'));
}
