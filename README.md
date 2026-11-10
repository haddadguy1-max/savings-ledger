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
