// Cloudflare Worker entry for globlix.in (Workers static-assets deployment).
// Static pages are served from dist/ by Cloudflare. Only /api/* runs this code.
//   POST /api/lead    receives every website form
//   GET  /api/health  shows which settings are present (never shows values)
// Secrets (Worker > Settings > Variables and Secrets):
//   SHEETS_WEBHOOK_URL, SHEETS_SECRET, HUBSPOT_TOKEN, TURNSTILE_SECRET (optional)
import { handleLead } from './lib/leads.mjs';

async function health(env) {
  const out = {
    SHEETS_WEBHOOK_URL: Boolean(env.SHEETS_WEBHOOK_URL),
    SHEETS_SECRET: Boolean(env.SHEETS_SECRET),
    HUBSPOT_TOKEN: Boolean(env.HUBSPOT_TOKEN),
    TURNSTILE_SECRET: Boolean(env.TURNSTILE_SECRET),
  };
  if (env.SHEETS_WEBHOOK_URL) {
    try {
      const r = await fetch(env.SHEETS_WEBHOOK_URL, { redirect: 'follow', signal: AbortSignal.timeout(8000) });
      const text = (await r.text()).slice(0, 200);
      out.sheets_script = r.ok ? text : `HTTP ${r.status}`;
    } catch (e) {
      out.sheets_script = `unreachable: ${e.message}`;
    }
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/lead' && request.method === 'POST') return handleLead(request, env);
    if (pathname === '/api/health') return health(env);
    if (pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
