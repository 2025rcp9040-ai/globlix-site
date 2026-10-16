// Cloudflare Pages version (only used if you host on Pages; Workers use worker.js): receives every website form at POST /api/lead.
// Set these in Cloudflare (Workers & Pages > globlix-site > Settings >
// Variables and Secrets), as "Secret" type:
//   SHEETS_WEBHOOK_URL  Google Apps Script web app URL (see apps-script/Code.gs)
//   SHEETS_SECRET       shared secret, same value as SHARED_SECRET in the Apps Script
//   HUBSPOT_TOKEN       HubSpot private app access token
//   TURNSTILE_SECRET    optional: Cloudflare Turnstile secret key (spam check)
import { handleLead } from '../../lib/leads.mjs';

export const onRequestPost = ({ request, env }) => handleLead(request, env);

export const onRequestGet = () => new Response(null, { status: 302, headers: { Location: '/' } });
