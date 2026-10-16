// Lead pipeline shared by the Cloudflare Pages Function (functions/api/lead.js),
// the local preview server and the tests. A form entry is checked and
// normalised once, then sent to Google Sheets and HubSpot in parallel. Either
// destination can fail without blocking the other.

const MAX = 2000;
const FIELD_ORDER = [
  'name', 'email', 'phone', 'company', 'location', 'hsn_code', 'product',
  'export_status', 'target_markets', 'monthly_capacity', 'message', 'consent',
  'lang', 'page', 'utm_source', 'utm_medium', 'utm_campaign',
];
const DROP = new Set(['bot-field', 'form-name', 'ip', 'user_agent', 'referrer']);

const clean = (v) => {
  if (Array.isArray(v)) v = v.join(', ');
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u0000/g, '').trim().slice(0, MAX);
};

export function istTimestamp(date) {
  // e.g. 2026-10-15 21:46 IST, readable in the sheet
  const d = new Date(new Date(date).getTime() + 5.5 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} IST`;
}

export function normalise(payload) {
  const data = payload?.data || {};
  if (clean(data['bot-field'])) return null; // honeypot filled: a bot
  const form = clean(payload.form_name || data['form-name'] || 'contact');
  const created = payload.created_at ? new Date(payload.created_at) : new Date();
  const fields = {};
  for (const k of FIELD_ORDER) fields[k] = clean(data[k]);
  for (const [k, v] of Object.entries(data)) if (!(k in fields) && !DROP.has(k)) fields[k] = clean(v);
  fields.email = fields.email.toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email);
  return {
    form,
    id: clean(payload.id),
    submitted_at: created.toISOString(),
    submitted_ist: istTimestamp(created),
    validEmail,
    fields,
  };
}

export function sheetRow(lead) {
  return {
    submitted_ist: lead.submitted_ist,
    form: lead.form,
    ...lead.fields,
    follow_up_status: 'New',
    lead_id: lead.id,
  };
}

async function postJson(fetchImpl, url, body, headers = {}, timeoutMs = 8000) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) throw new Error(`${url.split('?')[0]} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  return json ?? text;
}

export async function sendToSheets(lead, env, fetchImpl = fetch) {
  if (!env.SHEETS_WEBHOOK_URL) return { skipped: 'SHEETS_WEBHOOK_URL not set' };
  const res = await postJson(fetchImpl, env.SHEETS_WEBHOOK_URL, {
    secret: env.SHEETS_SECRET || '',
    sheet: lead.form,
    row: sheetRow(lead),
  });
  if (res && typeof res === 'object' && res.ok === false) throw new Error(`Sheets script refused: ${res.error}`);
  return res;
}

export function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstname: '', lastname: '' };
  return { firstname: parts[0], lastname: parts.slice(1).join(' ') };
}

export function noteHtml(lead) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const label = (k) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const rows = Object.entries(lead.fields)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `<strong>${esc(label(k))}:</strong> ${esc(v)}`);
  return `<p><strong>Website form: ${esc(lead.form)}</strong> (${esc(lead.submitted_ist)})</p><p>${rows.join('<br>')}</p>`;
}

export async function sendToHubSpot(lead, env, fetchImpl = fetch) {
  if (!env.HUBSPOT_TOKEN) return { skipped: 'HUBSPOT_TOKEN not set' };
  if (!lead.validEmail) return { skipped: 'no valid email' };
  const base = env.HUBSPOT_API_BASE || 'https://api.hubapi.com';
  const auth = { Authorization: `Bearer ${env.HUBSPOT_TOKEN}` };
  const { firstname, lastname } = splitName(lead.fields.name);
  const props = { email: lead.fields.email, firstname, lastname, phone: lead.fields.phone, company: lead.fields.company };
  for (const k of Object.keys(props)) if (!props[k]) delete props[k];

  const up = await postJson(fetchImpl, `${base}/crm/v3/objects/contacts/batch/upsert`, {
    inputs: [{ idProperty: 'email', id: lead.fields.email, properties: props }],
  }, auth);
  const contactId = up?.results?.[0]?.id;
  if (!contactId) throw new Error('HubSpot upsert returned no contact id');

  // The full form details go in a note on the contact's timeline, so no
  // custom HubSpot properties have to be created first.
  const note = await postJson(fetchImpl, `${base}/crm/v3/objects/notes`, {
    properties: { hs_timestamp: lead.submitted_at, hs_note_body: noteHtml(lead) },
    associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }],
  }, auth);
  return { contactId, noteId: note?.id };
}

export async function processSubmission(payload, env, fetchImpl = fetch, log = console) {
  const lead = normalise(payload);
  if (!lead) { log.warn('Lead dropped: honeypot field was filled'); return { dropped: true }; }
  const [sheets, hubspot] = await Promise.allSettled([
    sendToSheets(lead, env, fetchImpl),
    sendToHubSpot(lead, env, fetchImpl),
  ]);
  const summary = {
    form: lead.form,
    email: lead.fields.email,
    sheets: sheets.status === 'fulfilled' ? 'ok' : `error: ${sheets.reason?.message}`,
    hubspot: hubspot.status === 'fulfilled' ? (hubspot.value?.skipped ? `skipped: ${hubspot.value.skipped}` : 'ok') : `error: ${hubspot.reason?.message}`,
  };
  if (sheets.status === 'fulfilled' && sheets.value?.skipped) summary.sheets = `skipped: ${sheets.value.skipped}`;
  (summary.sheets.startsWith('error') || summary.hubspot.startsWith('error') ? log.error : log.log)('Lead processed', JSON.stringify(summary));
  return summary;
}

// ---------- HTTP handler (POST /api/lead) ----------
export const FORMS = {
  'quick-enquiry': ['name', 'email', 'phone', 'product', 'consent'],
  'hsn-snapshot': ['name', 'email', 'phone', 'product', 'export_status', 'consent'],
  contact: ['name', 'email', 'phone', 'message', 'consent'],
};

const thanksPath = (lang) => (lang === 'hi' ? '/hi/thank-you/' : '/thank-you/');

export async function verifyTurnstile(token, secret, ip, fetchImpl = fetch) {
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body, signal: AbortSignal.timeout(8000),
    });
    const json = JSON.parse(await res.text());
    return json.success === true;
  } catch {
    return false;
  }
}

// Reads a browser form post, rejects spam and incomplete entries, and sends
// the lead on. Answers JSON to the site's script, or redirects to the
// thank-you page when the visitor has JavaScript turned off.
export async function handleLead(request, env = {}, fetchImpl = fetch, log = console) {
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');
  const reply = (status, body, lang) => {
    if (wantsJson) return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    if (status < 400) return new Response(null, { status: 303, headers: { Location: thanksPath(lang) } });
    const back = lang === 'hi' ? 'वापस जाएँ' : 'Go back';
    return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Globlix</title><p>${body.error}</p><p><a href="javascript:history.back()">${back}</a></p>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  };

  let form;
  try { form = await request.formData(); } catch { return reply(400, { ok: false, error: 'Unreadable form' }); }
  const data = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== 'string') continue; // no file uploads
    data[k] = data[k] ? `${data[k]}, ${v}` : v; // multi-select checkboxes
  }
  const lang = data.lang === 'hi' ? 'hi' : 'en';
  if (clean(data['bot-field'])) return reply(200, { ok: true }, lang); // bots get a quiet "thanks"

  const formName = clean(data['form-name']);
  const required = FORMS[formName];
  if (!required) return reply(400, { ok: false, error: 'Unknown form' }, lang);

  if (env.TURNSTILE_SECRET) {
    const ip = request.headers.get('cf-connecting-ip') || '';
    const human = await verifyTurnstile(data['cf-turnstile-response'], env.TURNSTILE_SECRET, ip, fetchImpl);
    if (!human) return reply(403, { ok: false, error: 'Spam check failed. Please try again.' }, lang);
  }
  delete data['cf-turnstile-response'];

  const missing = required.filter((k) => !clean(data[k]));
  if (missing.length || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean(data.email))) {
    return reply(400, { ok: false, error: 'Please fill in all required fields.', missing }, lang);
  }

  const summary = await processSubmission({
    form_name: formName, data, created_at: new Date().toISOString(), id: crypto.randomUUID(),
  }, env, fetchImpl, log);
  // The lead is safe if at least one destination stored it. Otherwise the
  // visitor sees the error with the WhatsApp button, so nothing is lost.
  const saved = summary.sheets === 'ok' || summary.hubspot === 'ok';
  return saved ? reply(200, { ok: true }, lang) : reply(502, { ok: false, error: 'Could not save the form' }, lang);
}
