// Cloudflare Pages Function: GET /api/schools?listing=<id> | ?city=<slug>
// Same contract as the local server.py adapter that schools.js was built against, so the
// browser code needs no changes. Set GREATSCHOOLS_API_KEY as a Pages environment variable
// (Website Manager > Environment Variables). Without it this returns 503 and the page falls back
// to the city GIS data in /data. The key is never sent to the browser or logged.
// All logic lives in ../_lib/schools-api.js, which is unit-tested (tests/schools-api.test.mjs).
import guides from '../../neighborhoods.json';
import { buildCities, createRateLimiter, handleSchoolsRequest } from '../_lib/schools-api.js';

const CITIES = buildCities(guides);
const allow = createRateLimiter(5, 1000);

export const onRequestGet = ({ request, env }) => handleSchoolsRequest({ request, env, cities: CITIES, allow });

// Anything but GET gets a clean 405 rather than falling through to a static 404.
export const onRequest = () => new Response(null, { status: 405, headers: { Allow: 'GET' } });
