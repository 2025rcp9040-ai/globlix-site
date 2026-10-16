import test from 'node:test';
import assert from 'node:assert/strict';
import { normalise, processSubmission, splitName, sheetRow } from '../lib/leads.mjs';
import { handleLead } from '../lib/leads.mjs';

const payload = {
  id: 'abc123', form_name: 'hsn-snapshot', created_at: '2026-10-15T16:16:00.000Z',
  data: {
    'form-name': 'hsn-snapshot', 'bot-field': '', name: 'Asha Kumari Verma', email: 'Asha@Example.COM ', phone: '+91 98765 43210',
    company: 'Asha Crafts', location: 'Jaipur, Rajasthan', hsn_code: '57050039', product: 'Jute rugs', export_status: 'new',
    target_markets: 'USA, United Kingdom', consent: 'yes', lang: 'hi', page: '/hi/free-hsn-snapshot/', ip: '1.2.3.4', user_agent: 'x',
  },
};

function mockFetch(routes) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body), headers: opts.headers });
    const route = routes.find(([prefix]) => url.startsWith(prefix));
    const [status, body] = route ? route[1] : [404, {}];
    return { ok: status < 400, status, text: async () => JSON.stringify(body) };
  };
  fn.calls = calls;
  return fn;
}

test('normalise cleans fields and drops request metadata', () => {
  const lead = normalise(payload);
  assert.equal(lead.form, 'hsn-snapshot');
  assert.equal(lead.fields.email, 'asha@example.com');
  assert.equal(lead.validEmail, true);
  assert.equal(lead.submitted_ist, '2026-10-15 21:46 IST');
  assert.ok(!('ip' in lead.fields) && !('bot-field' in lead.fields));
  assert.equal(sheetRow(lead).follow_up_status, 'New');
});

test('honeypot submissions are dropped', () => {
  assert.equal(normalise({ data: { 'bot-field': 'spam' } }), null);
});

test('splitName', () => {
  assert.deepEqual(splitName('Asha Kumari Verma'), { firstname: 'Asha', lastname: 'Kumari Verma' });
  assert.deepEqual(splitName('Ravi'), { firstname: 'Ravi', lastname: '' });
});

test('sends one row to Sheets and a contact + note to HubSpot', async () => {
  const f = mockFetch([
    ['https://sheets.test', [200, { ok: true }]],
    ['https://hs.test/crm/v3/objects/contacts/batch/upsert', [200, { status: 'COMPLETE', results: [{ id: '901' }] }]],
    ['https://hs.test/crm/v3/objects/notes', [201, { id: '555' }]],
  ]);
  const env = { SHEETS_WEBHOOK_URL: 'https://sheets.test/exec', SHEETS_SECRET: 's3cret', HUBSPOT_TOKEN: 'tok', HUBSPOT_API_BASE: 'https://hs.test' };
  const quiet = { log() {}, warn() {}, error() {} };
  const res = await processSubmission(payload, env, f, quiet);
  assert.deepEqual([res.sheets, res.hubspot], ['ok', 'ok']);
  const sheet = f.calls.find((c) => c.url.startsWith('https://sheets.test'));
  assert.equal(sheet.body.secret, 's3cret');
  assert.equal(sheet.body.sheet, 'hsn-snapshot');
  assert.equal(sheet.body.row.hsn_code, '57050039');
  const up = f.calls.find((c) => c.url.endsWith('/batch/upsert'));
  assert.equal(up.headers.Authorization, 'Bearer tok');
  assert.deepEqual(up.body.inputs[0], { idProperty: 'email', id: 'asha@example.com', properties: { email: 'asha@example.com', firstname: 'Asha', lastname: 'Kumari Verma', phone: '+91 98765 43210', company: 'Asha Crafts' } });
  const note = f.calls.find((c) => c.url.endsWith('/objects/notes'));
  assert.equal(note.body.associations[0].to.id, '901');
  assert.equal(note.body.associations[0].types[0].associationTypeId, 202);
  assert.match(note.body.properties.hs_note_body, /Hsn code:<\/strong> 57050039/);
});

test('a HubSpot failure does not stop the Sheets row', async () => {
  const f = mockFetch([
    ['https://sheets.test', [200, { ok: true }]],
    ['https://hs.test', [401, { message: 'bad token' }]],
  ]);
  const env = { SHEETS_WEBHOOK_URL: 'https://sheets.test/exec', HUBSPOT_TOKEN: 'bad', HUBSPOT_API_BASE: 'https://hs.test' };
  const res = await processSubmission(payload, env, f, { log() {}, warn() {}, error() {} });
  assert.equal(res.sheets, 'ok');
  assert.match(res.hubspot, /^error: .*401/);
});

test('missing configuration is skipped, not an error', async () => {
  const res = await processSubmission(payload, {}, mockFetch([]), { log() {}, warn() {}, error() {} });
  assert.match(res.sheets, /^skipped/);
  assert.match(res.hubspot, /^skipped/);
});

// ---------- POST /api/lead handler ----------
const quiet = { log() {}, warn() {}, error() {} };
const post = (fields, accept = 'application/json', headers = {}) => {
  const fd = new URLSearchParams();
  for (const [k, v] of fields) fd.append(k, v);
  return new Request('https://globlix.in/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: accept, ...headers }, body: fd.toString() });
};
const quickFields = [['form-name', 'quick-enquiry'], ['bot-field', ''], ['name', 'Ravi'], ['email', 'ravi@example.com'], ['phone', '+91 99999 11111'], ['product', 'Jute rugs'], ['consent', 'yes'], ['lang', 'hi']];
const sheetsOk = () => mockFetch([['https://sheets.test', [200, { ok: true }]]]);

test('handler saves a valid lead and joins multi-select values', async () => {
  const f = sheetsOk();
  const res = await handleLead(post([...quickFields, ['target_markets', 'USA'], ['target_markets', 'Japan']]), { SHEETS_WEBHOOK_URL: 'https://sheets.test/exec' }, f, quiet);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  const row = f.calls[0].body.row;
  assert.equal(row.form, 'quick-enquiry');
  assert.equal(row.target_markets, 'USA, Japan');
  assert.match(row.lead_id, /^[0-9a-f-]{36}$/);
});

test('handler redirects to the right thank-you page without JavaScript', async () => {
  const res = await handleLead(post(quickFields, 'text/html'), { SHEETS_WEBHOOK_URL: 'https://sheets.test/exec' }, sheetsOk(), quiet);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/hi/thank-you/');
});

test('handler rejects missing fields, unknown forms and quietly drops bots', async () => {
  const env = { SHEETS_WEBHOOK_URL: 'https://sheets.test/exec' };
  const missing = await handleLead(post(quickFields.filter(([k]) => k !== 'product')), env, sheetsOk(), quiet);
  assert.equal(missing.status, 400);
  assert.equal((await handleLead(post([['form-name', 'other'], ...quickFields.slice(1)]), env, sheetsOk(), quiet)).status, 400);
  const f = sheetsOk();
  const bot = await handleLead(post([...quickFields.slice(0, 1), ['bot-field', 'spam'], ...quickFields.slice(2)]), env, f, quiet);
  assert.equal(bot.status, 200);
  assert.equal(f.calls.length, 0);
});

test('handler reports failure when no destination stored the lead', async () => {
  const res = await handleLead(post(quickFields), {}, mockFetch([]), quiet);
  assert.equal(res.status, 502);
});

test('handler checks Turnstile when a secret is set', async () => {
  const env = { SHEETS_WEBHOOK_URL: 'https://sheets.test/exec', TURNSTILE_SECRET: 'ts' };
  const fake = (success) => {
    const calls = [];
    const fn = async (url, opts) => {
      calls.push({ url, opts });
      const body = url.includes('turnstile') ? { success } : { ok: true };
      return { ok: true, status: 200, text: async () => JSON.stringify(body) };
    };
    fn.calls = calls;
    return fn;
  };
  const bad = await handleLead(post([...quickFields, ['cf-turnstile-response', 'tok']]), env, fake(false), quiet);
  assert.equal(bad.status, 403);
  const f = fake(true);
  const good = await handleLead(post([...quickFields, ['cf-turnstile-response', 'tok']], 'application/json', { 'CF-Connecting-IP': '1.2.3.4' }), env, f, quiet);
  assert.equal(good.status, 200);
  const sv = new URLSearchParams(f.calls[0].opts.body);
  assert.deepEqual([sv.get('secret'), sv.get('response'), sv.get('remoteip')], ['ts', 'tok', '1.2.3.4']);
  assert.ok(!('cf-turnstile-response' in JSON.parse(f.calls[1].opts.body).row));
});
