# globlix.in

Website for Globlix: English and Hindi pages, a browser editor, a blog, a WhatsApp button, and lead forms that save to Google Sheets and HubSpot. Hosted on Cloudflare Pages. See `ARCHITECTURE.md` for the design.

## What's in the folder

```
content/            everything you edit in the CMS (pages, services, blog, home, settings)
src/i18n/           menu, button and form labels in English and Hindi
src/styles, src/js  site design and the small browser script
static/             logo, favicon, images, and the CMS at /admin
scripts/build.mjs   builds the site into dist/ (no installs needed)
functions/api/      Cloudflare Pages Function: receives every form at /api/lead
lib/leads.mjs       checks each lead and sends it to Google Sheets and HubSpot
apps-script/Code.gs paste into your Google Sheet's Apps Script
tests/              automated checks (npm test)
```

## Launch checklist on Cloudflare (about 1 to 2 hours)

Everything below runs on Cloudflare's free plan.

### 1. Put the code on GitHub
1. Create a free GitHub account and a **private** repository called `globlix-site`.
2. Upload this folder's contents (GitHub > Add file > Upload files), or push with git.

### 2. Create the site on Cloudflare Pages
1. Sign up at dash.cloudflare.com. Go to **Workers & Pages > Create > Pages > Connect to Git**, allow GitHub access and pick `globlix-site`.
2. Build settings:
   - Framework preset: **None**
   - Build command: `node scripts/build.mjs`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION` = `22`
3. Click **Save and Deploy**. The site appears at `globlix-site.pages.dev`. The `functions/` folder is picked up automatically, so the forms post to `/api/lead`.

### 3. Connect globlix.in
1. Easiest: Cloudflare > **Add a domain** > `globlix.in` (free plan), then change the nameservers at your domain registrar to the two Cloudflare shows. Wait until Cloudflare says the domain is active.
2. Pages project > **Custom domains > Set up a custom domain**: add `globlix.in`, then again for `www.globlix.in`. DNS records and HTTPS are created automatically.
3. Send www to the main address: your domain > **Rules > Redirect Rules > Create from template > "Redirect from WWW to root"** > Deploy.

### 4. Connect Google Sheets
The script is already set to your sheet (ID `1jY9_49eY-Yfbntzdzbljfp1PRAeu1ZPRVV-Ois7_Lg4`). If you already deployed it, skip to step 5 below: the web app URL and secret stay the same.
1. Open that Google Sheet.
2. Extensions > Apps Script. Delete the sample code, paste all of `apps-script/Code.gs`, save.
3. Project Settings > Script properties > add `SHARED_SECRET` = a long random string.
4. Run `testAppend` once and approve the permission prompt. A "test" tab appears; you can delete it.
5. Deploy > New deployment > Web app; Execute as **Me**, Who has access **Anyone**. Copy the web app URL (ends in `/exec`). Opening it in a browser should say "Globlix lead receiver is running".
6. Cloudflare > Pages project > **Settings > Variables and Secrets > Add** (type **Secret**, environment **Production**):
   - `SHEETS_WEBHOOK_URL` = the web app URL
   - `SHEETS_SECRET` = the same secret as step 3
7. Variables apply from the next deployment: **Deployments > latest > ⋯ > Retry deployment**.
8. Email alert for every new lead: in the Google Sheet, **Tools > Notification settings > Edit notifications** > "Any changes are made" > "Email - right away".

### 5. Connect HubSpot (free CRM)
1. In HubSpot: Settings > Integrations > Private apps (in newer accounts: Development > Legacy apps > Create private app).
2. Name it "Globlix website". Scopes: `crm.objects.contacts.read` and `crm.objects.contacts.write`. Create and copy the access token.
3. In Cloudflare add secret `HUBSPOT_TOKEN` = the token, then retry the deployment.

### 6. Turn on the content editor (/admin)
The editor signs you in with GitHub, through a small free login helper on Cloudflare Workers.
1. Deploy the helper: open `https://deploy.workers.cloudflare.com/?url=https://github.com/sveltia/sveltia-cms-auth` and follow the prompts. Note its address, e.g. `https://sveltia-cms-auth.<your-name>.workers.dev`.
2. GitHub > Settings > Developer settings > **OAuth Apps > New OAuth App** (github.com/settings/applications/new):
   - Application name: `Globlix editor`
   - Homepage URL: `https://globlix.in`
   - Authorization callback URL: `<helper address>/callback`
   Register, then **Generate a new client secret**. Copy the Client ID and Client Secret.
3. Cloudflare > Workers & Pages > `sveltia-cms-auth` > **Settings > Variables and Secrets**: add `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (type Secret) and `ALLOWED_DOMAINS` = `globlix.in`. Deploy.
4. In GitHub, edit `static/admin/config.yml` and replace the two **CHANGE-ME** values: `repo:` your `username/globlix-site`, `base_url:` the helper address. Commit; Cloudflare rebuilds.
5. Open `https://globlix.in/admin/` > **Login with GitHub**. To add another editor, invite their GitHub account as a collaborator on the repository.

### 7. Optional: stop spam bots (Cloudflare Turnstile)
1. Cloudflare > **Turnstile > Add widget**: name `globlix forms`, hostname `globlix.in`, mode **Managed**.
2. Copy the **secret key** into the Pages project as secret `TURNSTILE_SECRET`.
3. Copy the **site key** into `/admin` > Site settings > Turnstile site key, and publish. The check appears above each form's button.
Set both keys together: with only the secret set, every form would be refused.

### 8. Fill in your details
In `/admin` > Site settings: real **email** and **address** (phone and WhatsApp are already set). Then publish.

### 9. Test end to end
Submit the quick form, the HSN snapshot and the contact form on the live site (English and Hindi). Check that the Google Sheet has a new row, HubSpot has the contact with a note, and the email alert arrived. If a lead is missing: Pages project > Deployments > latest > **Functions > Real-time logs**, submit again, and read the "Lead processed" line.

If neither Sheets nor HubSpot can store a lead, the visitor sees the error message with a **Send these details on WhatsApp** button, so the enquiry still reaches you.

## Adding charts and infographics in the editor
In any article or page, switch the editor to Markdown mode and type one of these blocks:

````
```chart
title: Carpet imports, 2023
unit: USD bn
highlight: India
USA | 3.42
India | 1.17
```

```stats
38% | of world hand-knotted rug exports (2023)
```

```steps
Ship the goods | Shipping bill filed
Get paid | Bank receives payment
```
````
Charts become bar charts (the `highlight` row is orange), stats become big-number tiles, steps become a numbered flow. The market-access board and timeline are edited under **Market access board**.

## Editing content
- `/admin` > Insights > New article. Write in English, switch to the Hindi tab for the Hindi version. Save, then **Publish** when ready.
- Each draft gets a free preview link; only **Publish** changes the live site. The free plan allows 500 builds a month, far more than you need.

## For developers
```
npm run dev    # build and preview at http://localhost:8080; forms use the real handler
               # (set SHEETS_WEBHOOK_URL etc. in your shell to send test leads)
npm test       # parser, lead handler and pipeline (mocked Sheets/HubSpot/Turnstile), build checks
```
Requires Node 20 or newer. There are no npm dependencies.

## Before launch, replace placeholders
- `content/settings.json`: phone, WhatsApp number, email, address.
- `content/pages/*/privacy.md` and `terms.md`: legal entity name, address, grievance contact; have a lawyer review.
- Hindi copy: have a native speaker review the wording.
