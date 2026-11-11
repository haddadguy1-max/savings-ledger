# Savings Ledger — Full upgrade TEST BUILD (v17)

**DO NOT deploy directly over your live app without a backup.** The existing legacy ledger login, data model and dashboard are preserved.

## What is actually implemented
- Expanded on-screen reports, charts, contributor bridge and PDF exports from previous build.
- Google Sheets sign-up adapter (requires a Google OAuth client ID; not live tested).
- Legacy Apps Script backend `Code.gs` upgraded to synchronize Settings and handle `testEmail`.
- Legacy Apps Script `installMonthlyEmailTrigger()` schedules monthly report-link emails. **Run it once in the Apps Script editor and authorize MailApp.** Emails include a report link, not a generated PDF attachment.
- Data → Reports & notifications: real legacy test-email request, setup check, preferences, local notification test, and notification click-to-report support.
- Push event listener in service worker, ready for a separately deployed push sender and device subscription backend. **There is no push subscription or server yet, so remote scheduled push is not operational.**
- Versioned service-worker cache.

## Owner setup (required)
1. Create a test repository and upload files from this directory to its root. Do not overwrite live files.
2. Google sign-up: create Google Cloud OAuth Web client; authorize `https://haddadguy1-max.github.io`; enable Google Drive and Sheets APIs; put the public client ID in `google-drive.js`. Add test users on consent screen. Do not upload a client secret.
3. Legacy email: back up the currently deployed Apps Script; replace its source with the provided `Code.gs`; **copy your existing TOKEN into the new Code.gs** (do not change it or you will lock out legacy users); deploy a NEW VERSION of the existing web-app deployment (keep the same URL); run `installMonthlyEmailTrigger()` once and authorize it. Verify your existing ledger first.
4. Save recipient email(s) in Data and press **Send test email now**. Check inbox and spam. The backend returns whether MailApp accepted the message; it does not prove final inbox delivery.
5. Install test PWA on iPhone Home Screen; open Data → Test notification on this device. This is a local notification only.
6. For true monthly push, deploy a separate authenticated push backend with VAPID keys, subscription registration, a scheduler, and secure per-user settings. Never embed VAPID private keys or mail provider secrets in GitHub Pages.
7. Test with throwaway ledger data on two devices before migrating real data.

## Known blockers / honest limitations
- Google sign-up cannot work until the OAuth client is configured; installed iOS PWA OAuth behavior must be tested.
- Google accounts do not yet have an email sender, scheduled job, or remote push sender.
- Google settings synchronization uses last-write-wins and Sheets updates are not transactionally safe under simultaneous edits.
- Gold historical prices can include estimates; never label interpolated prices as verified market data.
- Legacy email report links point to the existing production URL and require the recipient to have access; no PDF attachment.
- Email and notification preferences are included in the shared Settings synchronization, but remote scheduled push still needs a subscription server.
- No secure independent ledger password for Google accounts. Google sign-in is the authentication.
- No live OAuth, email or push end-to-end test was performed.

## Release gate
Confirm legacy login, CSV backup, original data, Google registration, cross-device data/settings, test email, report math, PWA offline and push permissions before promoting.

# Savings Ledger — additive Google sign-in test build

## Important: preserve your existing site
This package retains the existing Savings Ledger dashboard, tabs, and legacy Apps Script sign-in. **Do not delete your Google Sheet, Apps Script, or existing GitHub repository.** Make a backup of your repository and export your ledger CSV before testing. Ideally deploy to a branch or test URL first.

## Google setup (required; cannot be preconfigured by ChatGPT)
1. Open https://console.cloud.google.com/ and create/select a project.
2. Enable **Google Drive API** and **Google Sheets API**.
3. Configure the OAuth consent screen; for testing, add your Google account as a test user. Request Drive file access and Sheets scopes; Google may require verification before public release.
4. Create an **OAuth 2.0 Client ID**, application type **Web application**. Authorized JavaScript origins: `https://haddadguy1-max.github.io` (origin only, no path). Use the same origin for your GitHub Pages site.
5. Replace `REPLACE_WITH_YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com` in `google-drive.js` with your real client ID. Do not place a client secret in GitHub.
6. Upload the contents of this ZIP to the existing repository root. Keep the legacy Apps Script deployed. GitHub Pages can take a few minutes to refresh.
7. In the app's **Data → Sign in**, choose **Sign in with Google · My Drive**. On first use Google asks permission and creates a spreadsheet. Returning users connect to the same spreadsheet if Drive finds it.
8. On iPhone, test in Safari first. Installed home-screen PWA Google OAuth may fail depending on iOS browser behavior.

## Existing users and new users
- **Existing ledger login + password** is still present. This is a separate, legacy Apps Script ledger. Google sign-in **does not automatically migrate** it. Keep using the legacy login until you explicitly decide to migrate.
- **Google users** sign up and return through the same **Sign in with Google** button. Google manages their password; there is no new Savings Ledger password to save. They can save their email as their account reference.
- Google account ledgers use Sheets in that account's Drive. All shared settings already handled by the app are stored in its Settings tab.

## Limitations / not production ready
- Google OAuth has not been exercised against a live Google account here. The app cannot work until your OAuth client ID is configured.
- The Google mode does not provide the Apps Script weekly backups, automated monthly emails or server gold-price fallback. The legacy mode remains unchanged.
- Google access tokens expire, and the user must reconnect. There is no server-side session.
- Concurrent writes from two devices are **not transactional**; even with row-level writes, simultaneous creation may collide. Test with one device at a time.
- Settings are stored in the Google spreadsheet, but simultaneous conflicting settings edits are resolved by timestamps, not a full audit log.
- The Google mode is intended for **one Google account per ledger**, not shared editing across different Google accounts.
- Existing local data is snapshotted before Google connection; do not rely on this as your only backup. Always export CSV first.

## Test checklist
1. Export a CSV from your existing ledger and confirm legacy login still works.
2. Register with a separate Google test account and verify a new Google Sheet exists.
3. Set a ledger title, people, target, starting savings and gold settings in Data. Add a test transaction.
4. Tap Sync now and confirm `Settings` and `Raw data` tabs in Google Sheets contain the new values.
5. On a second browser/device, sign in with the same Google account, confirm the values return. Test a setting edit in both directions.
6. Sign out and confirm your original local ledger is still accessible. Check legacy sign-in again.
7. Check offline/reconnect behavior and test iPhone PWA separately.

Do not publish this to real users before completing these tests and an OAuth/security review.

## November report enhancement
- **Save 1-page PDF** now produces a compact A4 executive report with net worth, monthly and YTD contributions, a reconciled wealth bridge, an actual-vs-phased-plan line graph, gold cost/value/holdings and a short insight. The original detailed on-screen report and the detailed PDF generator are retained in code (`lgBuildDetailedPdf`).
- The bridge reconciles opening and closing net worth; gold price effect is estimated from the change in market value less changes in gold cost. The residual is explicitly shown as **Other / reconciliation**, not silently classified as savings. Market prices may be estimated, and no historical snapshot has been implemented yet.
- Email recipient wording now accurately states that an email service is required. **No working test-email, scheduled delivery, or push service is included in this build.** These require backend credentials, scheduling, opt-in permissions and end-to-end tests; do not promise them to users yet.
- Google OAuth still requires a real client ID configured by the repository owner. No password registration service has been added. Legacy ledger/password login is retained.


## Expanded monthly report (November 2026 update)
The on-screen Monthly Report now includes contributor reconciliation, a net-worth bridge, a historical gold market-price chart, a cumulative gold investment vs market-value chart, gold investment metrics, and a complete gold purchase ledger. **Export PDF** uses the same comprehensive report sections; the PDF is intentionally multi-page so details are legible rather than compressed into one page.

**Important:** Market history may be estimated where a verified monthly price is unavailable. The reconciliation row is explicit and must be reviewed if nonzero. Do not use this as audited financial reporting.

Email sending, scheduled delivery and push notifications are NOT implemented in this package; the OAuth Client ID must still be configured. Test on a separate repository and retain backups before deployment.

## Critical fixes in this package
- Service worker uses **network-first for HTML and JS** (cache fallback when offline) to reduce old report code persisting on iPhone; cache version bumped. Reload twice after deployment.
- Google button explicitly says **Sign up / Sign in**, with no misleading implication that a separate ledger password is created. The developer must configure OAuth once.
- Google Sheets `Deleted` boolean accepts both TRUE and true.
- Sync errors now display actual Google API error messages instead of calling every failure offline.
- The report explicitly flags differences between named contributions and net savings. Gold history is labeled recorded/estimated, not represented as independently verified market data.

### Not fixed or implemented
- No backend for email sending, scheduled email, Web Push or a test-send endpoint. **Do not claim these work.**
- No automatic Apps Script provisioning: Google Sheets API creates the ledger directly.
- No separate password for Google accounts. Legacy password remains unchanged.
- No audited price-history feed or cost-basis reconciliation for missing historical lots.
- Google OAuth and multi-device concurrency have not been live-tested.
- Existing ledger sync may expose tokens in shareable invitation URLs; treat invitations as sensitive.

### Quick diagnostic
After upload, open Safari (not home screen), refresh twice, and check the Google button says `Sign up / Sign in with Google`. If not, GitHub Pages has not deployed the new files or Safari is still using cached resources. Google sign-up requires an OAuth client ID; the app cannot create it for the owner.
