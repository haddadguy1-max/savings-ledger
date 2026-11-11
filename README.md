# Savings Ledger v29 — Gold data and notifications

Built from the user's uploaded `SavingsLedger-v28.zip` (11 November 2026). This release keeps the existing app, Google Apps Script push system, PDF generator, data, settings and icons, while improving gold price sourcing, dated history, cached-quote behavior and historical valuation labels.

**Read [`GOLD_NOTIFICATION_LOGIC_v29.md`](GOLD_NOTIFICATION_LOGIC_v29.md)** for the exact data-provider architecture, historical/cached valuation logic, notification triggers, limitations and safe deployment instructions.

## Deployment checklist

1. **Back up the Google Sheet and any unsynced phone data.** Do not delete the installed PWA or clear Safari data.
2. **GitHub Pages:** upload the app files (`index.html`, `app-extras.js`, `google-drive.js`, `sw.js`, `manifest.json`, `version.json`, `icon-180.png`, `icon-192.png`, `icon-512.png`). Verify GitHub Pages deployment, then accept **Update now**. The displayed app version should be **29**.
3. **Apps Script:** In the original spreadsheet's Apps Script editor, preserve the existing `TOKEN` secret, replace `Code.gs`, restore the secret, choose **Deploy → Manage deployments → edit → New version → Deploy**. Run the function `setup()` once to authorize/configure the hourly push trigger. Do not publish the secret to GitHub.
4. On the installed app, verify **Data → Version 29 · 11 Nov 2026 · ledger script up to date**. Check the Gold area, refresh the live price and history, inspect `Gold prices` in the Sheet, and compare the in-app monthly report against the PDF.
5. For closed-app notifications, open the Home Screen app on each iPhone, select **Allow notifications**, confirm **Push is on**, and use **Send a test**. Real delivery is not guaranteed until the backend and iPhone have both been tested.

## Sources

- Current spot: https://api.gold-api.com/price/XAU (Gold-API.com)
- Live fallback: https://standardbullion.com/spot-prices.json (bid/ask midpoint)
- Historical daily closes: https://standardbullion.com/api/v1/market/history?metal=XAU&range=5y
- Provider documentation and data attribution: https://standardbullion.com/market-data

All prices USD per troy ounce before conversion to USD per gram and karat-specific valuations. The last available dated closing observation per completed UTC month is used for historical reports, not a monthly average. Fallbacks and saved manual prices are labelled as such.

## Tests

With Node.js installed, from the app folder:

```bash
node --check app-extras.js
node --check google-drive.js
node --check sw.js
node test_calculations.js
node test_gold_sources.js
node test_regressions.js
node test_script.js
```

These tests use mock providers and a mock Apps Script runtime. They do not constitute a production or live device test.
