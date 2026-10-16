/**
 * Globlix lead receiver: Google Apps Script bound to your leads spreadsheet.
 *
 * Setup (once):
 * 1. Open the Globlix Leads Google Sheet (ID below).
 * 2. Extensions > Apps Script. Replace the code with this file. Save.
 * 3. Project Settings > Script properties > Add property:
 *      SHARED_SECRET = a long random string (same as SHEETS_SECRET in Cloudflare)
 * 4. Deploy > New deployment > type "Web app".
 *      Execute as: Me.   Who has access: Anyone.
 *    Copy the Web app URL into Cloudflare as SHEETS_WEBHOOK_URL.
 * 5. Run the "testAppend" function once from the editor to grant permission.
 *
 * Each form gets its own tab ("contact", "hsn-snapshot"). New fields add new
 * columns automatically. The "follow_up_status" column is for your team.
 *
 * Health check: open the Web app URL in a browser. It should say
 * "Globlix lead receiver is running".
 */

// The Globlix Leads spreadsheet (from its URL: /spreadsheets/d/<ID>/edit)
var SHEET_ID = '1jY9_49eY-Yfbntzdzbljfp1PRAeu1ZPRVV-Ois7_Lg4';

function getBook_() {
  try { return SpreadsheetApp.openById(SHEET_ID); } catch (e) { return SpreadsheetApp.getActiveSpreadsheet(); }
}

function doGet() {
  var ok = !!PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
  return ContentService.createTextOutput(ok
    ? 'Globlix lead receiver is running. Spreadsheet: ' + getBook_().getName()
    : 'Running, but SHARED_SECRET is not set in Project Settings > Script properties.');
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var secret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
    if (!secret || body.secret !== secret) return json_({ ok: false, error: 'unauthorised' });
    var tab = String(body.sheet || 'contact').replace(/[^\w-]/g, '').slice(0, 40) || 'contact';
    appendRow_(tab, body.row || {});
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function appendRow_(tab, row) {
  var ss = getBook_();
  var sheet = ss.getSheetByName(tab) || ss.insertSheet(tab);
  var keys = Object.keys(row);
  var lastCol = sheet.getLastColumn();
  var headers = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  if (!headers.length) {
    headers = keys;
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else {
    var missing = keys.filter(function (k) { return headers.indexOf(k) === -1; });
    if (missing.length) {
      sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
      headers = headers.concat(missing);
    }
  }
  var values = headers.map(function (h) {
    var v = row[h] === undefined ? '' : row[h];
    // stop spreadsheet formula injection from form input
    return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
  });
  sheet.appendRow(values);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function testAppend() {
  appendRow_('test', { submitted_ist: new Date().toISOString(), form: 'test', name: 'Test lead', email: 'test@example.com' });
}
