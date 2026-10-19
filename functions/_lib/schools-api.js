// Pure logic for GET /api/schools (see ../api/schools.js). A port of server.py's school adapter
// so the same request/response contract works on Cloudflare Pages, where server.py does not run.
// Kept free of Cloudflare-specific APIs so it can be unit-tested with plain Node.

export const FEED = 'https://app.getaptly.com/api/portal/listings/DbctJZ4fgyMFqyZ8M';
// GreatSchools v2, the same base URL the Aptly app and the Spradley site use.
export const NEARBY_URL = 'https://gs-api.greatschools.org/v2/nearby-schools';
const SCHOOL_HOSTS = ['greatschools.org', 'www.greatschools.org'];
const LISTING_ID = /^[A-Za-z0-9]{1,64}$/;

/** { 'columbus-ga': {name, center}, <guide slug>: {name, center} } from neighborhoods.json. */
export function buildCities(guides) {
  const cities = { 'columbus-ga': { name: 'Columbus', center: [32.460976, -84.987709] } };
  for (const guide of Array.isArray(guides) ? guides : []) {
    if (guide && guide.slug && guide.name && Array.isArray(guide.center)) {
      cities[guide.slug] = { name: guide.name, center: guide.center };
    }
  }
  return cities;
}

export function validPoint(lat, lon) {
  return [lat, lon].every(v => typeof v === 'number' && Number.isFinite(v) && v !== 0) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/**
 * Accepts exactly one of ?listing=<id> or ?city=<slug>. Returns { listing } or { city },
 * or null when the query is anything else (extra keys, repeats, bad id, unknown city).
 */
export function parseSchoolsQuery(searchParams, cities) {
  const keys = [...new Set(searchParams.keys())];
  if (keys.length !== 1 || !['listing', 'city'].includes(keys[0])) return null;
  const values = searchParams.getAll(keys[0]);
  if (values.length !== 1) return null;
  const value = values[0];
  if (keys[0] === 'listing') return LISTING_ID.test(value) ? { listing: value } : null;
  return Object.prototype.hasOwnProperty.call(cities, value) ? { city: value } : null;
}

const str = value => (value === undefined || value === null ? '' : String(value));

/** Maps a GreatSchools response to the shape schools.js renders. Never throws on odd rows. */
export function normalizeSchools(payload) {
  const rows = payload && payload.schools;
  if (!Array.isArray(rows)) throw new Error('Unexpected school response');
  const schools = [];
  const seen = new Set();
  for (const row of rows.slice(0, 50)) {
    if (!row || typeof row !== 'object') continue;
    const key = str(row['universal-id'] || `${row.name},${row.street}`);
    if (seen.has(key)) continue;
    seen.add(key);

    let lat = Number(row.lat);
    let lon = Number(row.lon);
    if (row.lat == null || row.lon == null || Number.isNaN(lat) || Number.isNaN(lon)) {
      lat = null;
      lon = null;
    }

    let url = str(row['overview-url']);
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !SCHOOL_HOSTS.includes(parsed.hostname)) url = '';
    } catch {
      url = '';
    }

    schools.push({
      id: key,
      name: (row.name === undefined ? 'School' : str(row.name)).slice(0, 300),
      type: str(row.type).slice(0, 50),
      grades: str(row.level).slice(0, 120),
      address: ['street', 'city', 'state', 'zip']
        .filter(k => row[k])
        .map(k => str(row[k]))
        .join(', '),
      distance: typeof row.distance === 'number' ? row.distance : null,
      coordinates: validPoint(lat, lon) ? [lat, lon] : null,
      url
    });
  }
  return schools;
}

/** Where to search: a published listing's point (from the Aptly feed) or a guide's fixed point. */
export function resolveCenter(query, { feedRecords, cities }) {
  if (query.listing) {
    const home = (feedRecords || []).find(r => r && r._id === query.listing && r.publishedForRent !== false);
    if (!home) return { error: 'listing_unavailable', status: 404 };
    const point = home.address && home.address.geopoint;
    // The feed stores geopoint as [longitude, latitude].
    if (!Array.isArray(point) || point.length !== 2 || !validPoint(point[1], point[0])) {
      return { error: 'location_unavailable', status: 422 };
    }
    return { center: [point[1], point[0]], label: home.address.address || 'Rental home', scope: 'listing' };
  }
  const city = cities[query.city];
  const isCity = query.city === 'columbus-ga';
  return {
    center: city.center,
    label: city.name + (isCity ? ' city center' : ' guide point'),
    scope: isCity ? 'city' : 'neighborhood'
  };
}

export function nearbyUrl(center) {
  const url = new URL(NEARBY_URL);
  url.search = new URLSearchParams({ lat: center[0], lon: center[1], distance: 5, limit: 50 }).toString();
  return url.href;
}

/** Best-effort per-isolate limiter, like server.py's: at most `max` calls in any `windowMs`. */
export function createRateLimiter(max = 5, windowMs = 1000, now = () => Date.now()) {
  const calls = [];
  return () => {
    const t = now();
    while (calls.length && t - calls[0] > windowMs) calls.shift();
    if (calls.length >= max) return false;
    calls.push(t);
    return true;
  };
}

export const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: RESPONSE_HEADERS });

/**
 * The whole GET handler with its dependencies injected, so tests can drive it without Cloudflare.
 * @param {{ request: Request, env: object, cities: object, allow: () => boolean, fetchImpl?: typeof fetch }} deps
 */
export async function handleSchoolsRequest({ request, env, cities, allow, fetchImpl = fetch }) {
  const query = parseSchoolsQuery(new URL(request.url).searchParams, cities);
  if (!query) return reply(400, { error: 'invalid_request' });

  const key = env && env.GREATSCHOOLS_API_KEY;
  if (!key) return reply(503, { error: 'schools_not_configured' });
  if (!allow()) return reply(429, { error: 'try_again_later' });

  const getJson = async (url, headers = {}) => {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error(`Upstream ${response.status}`);
    return response.json();
  };

  try {
    const feedRecords = query.listing ? (await getJson(FEED)).data : [];
    const target = resolveCenter(query, { feedRecords, cities });
    if (target.error) return reply(target.status, { error: target.error });

    const payload = await getJson(nearbyUrl(target.center), { 'X-API-Key': key });
    return reply(200, {
      schools: normalizeSchools(payload),
      center: target.center,
      label: target.label,
      scope: target.scope
    });
  } catch {
    // Never log request headers, API keys, or provider response bodies.
    return reply(502, { error: 'schools_unavailable' });
  }
}
