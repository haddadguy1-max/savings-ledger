# Savings Ledger v29 — Gold prices, reports and closed-app notifications

**Release:** 11 November 2026  
**Based on:** the supplied `SavingsLedger-v28.zip`  
**Scope of this update:** gold market-data sourcing, correctly dated monthly valuations, price-history synchronization, labels in the app/reports/PDF, and protection against false gold-movement alerts on migration. All other v28 application features and icons are retained.

## 1. Gold data: two independent APIs

| Purpose | Provider / URL | Method | Stored result |
| --- | --- | --- | --- |
| **Current market price (primary)** | [Gold-API.com](https://gold-api.com/) — `https://api.gold-api.com/price/XAU` | One indicative USD spot price per *troy ounce*, with `updatedAt` timestamp. Browser fetch when opening/returning to the app, every 15 minutes while it is visible, or by tapping Refresh. | Last accepted price, source, provider observation timestamp; per-gram normalized value. |
| **Current market price (fallback)** | [Standard Bullion](https://standardbullion.com/market-data) — `https://standardbullion.com/spot-prices.json` | Midpoint of indicative USD/oz bid and ask, only when Gold-API.com fails. **Not an executable trading price**. | Same fields, with the source marked as the Standard Bullion bid/ask midpoint. |
| **Historical gold price (monthly reports)** | Standard Bullion — `https://standardbullion.com/api/v1/market/history?metal=XAU&range=5y` | For each *completed* UTC month, choose the last valid dated observation returned for that month. This is the **last available close**, not a monthly average. | Price, UTC observation date/time, source, `month-end-close` method in the `Gold prices` Google Sheet and local/shared cache. |

Both providers publish USD per **troy ounce**. The app converts using **31.1034768 grams per troy ounce**. A 21k holding is valued at `24k spot USD/g × grams × (21/24)`, 18k at `18/24`, and so on; the gold purchase's original **paid price is not overwritten**.

**Price quality and fallback order:**

1. A manually entered price, when explicitly selected for that month (marked as user supplied).
2. A verified Standard Bullion month-end closing observation from either device or the Google Sheets backend.
3. Older recorded monthly data (kept for compatibility, clearly marked as legacy rather than a confirmed close).
4. A dated spot-price snapshot that was actually recorded during the month (labelled as a snapshot).
5. For a missing month *after* a recorded price, the most recent **earlier** market observation is carried forward, marked `*` / estimate.
6. For dates with **no earlier market observation**, gold remains at its known original cost. **No invented future prices or interpolated prices and no rebranding of purchase prices as market quotes.**

Live prices retain their **actual** `updatedAt` timestamp. If the API cannot be reached, the last successfully observed quote remains usable, but it is labelled **cached**, not live. A source quote more than 30 minutes old is considered cached; the app does not pretend that it refreshed during an outage. The server also retains older stored quotes when network calls fail.

The historical market series can be **incomplete if the API is unavailable**, especially for months outside its returned window. The app does not invent missing prices to make charts appear complete. Charts will normally fill when the 5-year historical request succeeds. You may use Gold → **Reload price history** to retry.

**Provider attribution:** Standard Bullion requires visible attribution. The Gold section and report identify `standardbullion.com` as the historical data source; source URLs are documented here.

## 2. What changes in the app and PDF

- The Gold section uses the live price provider for current valuation and its timestamp, and historical dated closes for month-by-month charts.
- `Gold prices` is the dedicated Google Sheets tab. The v29 backend adds **Observation UTC** and **Saved UTC** columns without deleting existing rows. Old 4-column historical rows are upgraded on the next successful fetch.
- Dated historical records from Standard Bullion replace older generic monthly averages; older history remains cached until a verified replacement is received. This applies across devices.
- The legacy `Settings → goldHistory` value now includes **source/observation metadata** as well as prices. A newer verified close is preferred over an older phone's unverified monthly average.
- In-app reports and PDF exports continue to use the **same reporting model** and the same monthly valuation series. The text describing historical prices has been corrected from “monthly average” to “last available dated close”.
- The update is labelled **v29** in `version.json`, HTML script query strings, app version display and service-worker cache. Existing offline application data is not cleared.

This update **does not** redesign the app's wider transaction accounting, historical loan handling, or transfers between cash and gold. Those require a separate accounting audit before claiming that *all* net-worth figures are mathematically verified.

## 3. Closed-app push notifications — exactly how v29 works

This is **real Web Push**, not a background JavaScript timer in the iPhone. The flow is:

1. The user installs Savings Ledger on the iPhone Home Screen (iOS **16.4+**), opens it from that icon and taps **Allow notifications**.
2. The service worker subscribes to the phone's push service using the public VAPID key from Google Apps Script. During ledger sync, the app registers that device's **push endpoint and preferences** in the Google Sheet's `Push` tab. Notification permission and device subscription are **per device**, not shared simply by signing in on another phone.
3. The Apps Script web app (deployed `Code.gs`) remembers each device. The one-time `setup()` function creates an **hourly scheduled trigger** named `pushTick_`.
4. For a scheduled event, Apps Script sends an **empty authenticated Web Push signal** to the Apple/Google push service. The signal contains **no balance, savings or transaction details**.
5. iOS wakes the service worker even if the Savings Ledger window is closed. The worker authenticates to Apps Script to fetch queued notification text, then displays a visible system notification. The user may tap it to open Savings Ledger.

**Rules in the currently supplied app:**

| Event | Trigger | Closed-app delivery | Frequency |
| --- | --- | --- | --- |
| Another person/device creates an entry | After the new entry successfully reaches the Apps Script backend | Yes, intended to send immediately, **if** the other device is registered for push | Each new entry or batch of up to 12 |
| Monthly report | First seven calendar days of the following month, after the selected hour | Yes, via the Apps Script **hourly** trigger | Once per previous month per device |
| Nothing saved yet | On/after `nudgeDay` (default 10), after the selected hour, when no positive savings entry exists in the current month | Yes, via hourly trigger | Up to once per current month per device |
| Gold price moves ≥3% | Backend observes a fresh gold quote ≥3% above/below the last alert baseline, and the ledger holds gold | Yes, via hourly trigger; only when the quote's observation time is within **90 minutes** | Re-baselines after qualifying move; checks hourly |
| Goal milestones (25%, 50%, 75%, 90%, 100%) | The app recalculates progress on opening / when data changes | **No**, this remains app-side only | On milestones |
| Test notification | User taps **Send a test** | Yes, if push subscription and backend both work | On demand |

**Key caveats:**

- The scheduling timezone is **the Google Apps Script project's timezone**, not necessarily the phone's. The default selected hour is **9:00**.
- An hourly trigger means delivery can be **later than the chosen hour**, and system push delivery is not guaranteed to be instantaneous.
- When upgrading to the new gold provider, v29 resets the backend gold-alert reference on the first valid quote to avoid a false 3% notification caused only by a change of data provider.
- Web Push needs a reachable, deployed Apps Script backend and internet access. GitHub Pages **alone** cannot send a notification while the app is closed.
- A plain iPhone Safari browser tab is not the same as the **Home Screen installed web app** for push permission. Open the Home Screen app.
- Google OAuth/Drive-only mode has no equivalent Apps Script push backend unless separately configured. The above closed-app flow applies to the **legacy Google Sheets + Apps Script ledger**.
- Permission can be revoked in iOS Settings; subscriptions can expire; and Apple may delay or suppress delivery according to its policies. If a push signal fails, check Apps Script **Project Settings → Script Properties → `pushLast`** for the last recorded push response.
- **No email notifications** are sent.

### How to test push while the app is closed

1. Verify **Data → Version 29 · 11 Nov 2026 · ledger script up to date** after deploying the new backend.
2. Open the **Home Screen** installation, sign into your existing ledger, and enable notifications in Data.
3. Confirm **Push is on**. Tap **Send a test**, close the app, and check for a system notification.
4. Add an entry from a second registered device to test an actual cross-device event. The sender should not receive their own partner alert.
5. If the test fails, inspect the `Push` Google Sheet tab and the `pushLast` Script Property. Do not conclude push works merely because the in-app notification card appears.

## 4. Safe deployment (both app and backend)

**Back up first.** Make a copy of the Google Sheet and export or preserve any locally stored entries before touching deployment. Do **not** delete the iPhone PWA or clear website data to force an update; unsynced data could be lost.

**A. GitHub Pages (frontend)**

Upload the contents of the ZIP into the repository root, replacing `index.html`, `app-extras.js`, `google-drive.js`, `sw.js`, `manifest.json`, `version.json`, and the three icon files. Confirm the GitHub Pages deployment succeeds. Open the app and follow its **Update now** prompt. The visible version should become **29**.

**B. Google Apps Script (backend)**

Open the spreadsheet → **Extensions → Apps Script**. Save your existing secret `TOKEN` line somewhere secure. Replace the old `Code.gs` with the new file, then restore **your existing** token. In **Deploy → Manage deployments**, edit your existing web app deployment, select **New version**, and deploy. **Do not create a different web app URL unless you intend to reconnect every device.** Run `setup()` once in the editor and authorize the requested services. This keeps the hourly push trigger configured and upgrades the `Gold prices` tab header without deleting records.

**C. Verify prices and settings across devices**

Open the Gold section, tap **Refresh price** and **Reload price history**. Confirm a dated current quote, the last observed month-end prices, and the source attribution. In the Sheet inspect `Gold prices`: each recorded month includes its source and (for new v29 observations) its UTC observation timestamp. Check a completed month in both the in-app report and its exported PDF. Then sign in from a second device and verify its gold history and settings match once both have synced.

**Security:** `Code.gs` in the ZIP deliberately contains a placeholder token. Never upload a real token or private VAPID key to public GitHub. Never send credentials to an AI assistant for debugging.

## 5. Validation performed and remaining limits

Verified in this workspace using Node.js tests: finance calculation cases, structural/version checks, Google Apps Script behavior with mock Sheets and mock push endpoints, VAPID signatures checked by Node crypto, and mocked Standard Bullion history parsing/cache migration. JavaScript syntax checks and ZIP integrity checks are included in the release steps.

**Not verified here:** actual requests from your iPhone to the two providers; Google Apps Script authorization/deployment; real Apple Push Notification service delivery; live cross-device persistence using your own Google Sheet; real PDF print rendering on your phone; or the correctness of your individual transaction balances. **This package is a tested code update, not a claim of production verification.**
