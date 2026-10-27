// Normalizes raw Apify dataset items into one stable record shape.
// Different GetYourGuide actors name fields differently, so every lookup tries several keys.

const pick = (obj, keys) => {
  for (const k of keys) {
    const v = k.split('.').reduce((o, p) => (o == null ? undefined : o[p]), obj);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
};

const num = (v) => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'object') return null;
  const m = String(v).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

const CATEGORY_RULES = [
  ['Food & Drink', /food|wine|tasting|culinary|cooking|beer|cocktail|dinner|brunch|pizza|pasta|tapas/i],
  ['Walking Tour', /walking tour|walk\b|on foot|stroll/i],
  ['Day Trip', /day trip|from .* to|excursion|full-day|full day/i],
  ['Museum & Ticket', /ticket|entry|admission|skip[- ]the[- ]line|museum|gallery|priority access/i],
  ['Boat & Water', /boat|cruise|sail|kayak|snorkel|catamaran|yacht|river|harbor|harbour/i],
  ['Nightlife & Shows', /show|nightlife|pub crawl|bar crawl|concert|cabaret|comedy|club/i],
  ['Bus & Hop-On', /hop-on|hop on|bus tour|sightseeing bus|trolley/i],
  ['Adventure & Outdoor', /hike|hiking|bike|cycling|atv|zipline|helicopter|skydiv|surf|climb|rafting|scooter|segway/i],
  ['Transfers', /transfer|shuttle|airport|private car|chauffeur/i],
  ['Ghost & History', /ghost|haunted|history|historical|war|crime/i],
  ['Theme Park', /disney|universal|theme park|seaworld|legoland/i],
  ['Photo & Workshop', /photo|workshop|class|lesson|masterclass/i],
];

export function inferCategory(title = '', rawCategory = '') {
  if (rawCategory && typeof rawCategory === 'string' && rawCategory.length < 40) return rawCategory;
  for (const [label, re] of CATEGORY_RULES) if (re.test(title)) return label;
  return 'Other';
}

export function normalizeItem(raw, city) {
  const title = String(pick(raw, ['title', 'name', 'activityTitle', 'activity.title']) ?? '').trim();
  if (!title) return null;
  const price = num(pick(raw, ['price.amount', 'price.value', 'priceFrom', 'fromPrice', 'basePrice', 'pricing.from', 'price']));
  const rating = num(pick(raw, ['rating.average', 'reviews.rating', 'averageRating', 'reviewRating', 'ratingValue', 'rating']));
  const reviewCount = num(pick(raw, ['reviewCount', 'numberOfReviews', 'reviewsCount', 'rating.count', 'reviews.count', 'totalReviews'])) ?? 0;
  const url = pick(raw, ['url', 'link', 'activityUrl', 'href']) ?? null;
  const rawCategory = pick(raw, ['category', 'categories.0', 'activityType', 'type']);
  const durationRaw = pick(raw, ['duration', 'durationText', 'durationLabel']);
  const bestseller = Boolean(pick(raw, ['isBestseller', 'bestseller', 'badges.bestseller'])) || /bestseller/i.test(JSON.stringify(raw.badges ?? raw.labels ?? ''));
  const supplier = pick(raw, ['supplier', 'supplierName', 'provider', 'operator']) ?? null;
  const bookings = num(pick(raw, ['bookings', 'bookingCount', 'bookedCount', 'popularity'])) ?? null;

  return {
    id: String(pick(raw, ['id', 'activityId', 'tourId']) ?? url ?? title),
    citySlug: city.slug,
    city: city.name,
    region: city.region,
    title,
    url,
    price,
    currency: pick(raw, ['currency', 'price.currency']) ?? 'USD',
    rating: rating != null && rating > 5 ? rating / 2 : rating, // some actors use 10-scale
    reviewCount: Math.round(reviewCount),
    category: inferCategory(title, typeof rawCategory === 'string' ? rawCategory : ''),
    duration: durationRaw ? String(durationRaw) : null,
    bestseller,
    supplier,
    bookings,
  };
}
