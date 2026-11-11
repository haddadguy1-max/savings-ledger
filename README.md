# Savings Ledger — Notifications + Complete Data Sync (test build)

## What changed
- Removed email recipients, email test, and email delivery controls. Bundled Apps Script no longer sends scheduled email. If an old Apps Script deployment already has an email trigger, **delete that trigger manually** in Apps Script → Triggers.
- Notification settings are visible in Data and **enabled by default as a preference**. Permission is requested only when the user tests notifications. **This does not mean scheduled remote push is active**: that requires a deployed push service, subscription endpoint and scheduled job.
- Settings synchronization now includes all properties in the Data configuration, plus gold preferences and notification preferences. Remote-first adoption is used when no local setting timestamps exist. **Unverified in live Google/Apps Script services.**
- Report opens in a PDF preview generated from the exact same bytes as the Export PDF button; the Detailed view toggle shows the responsive report. Some iOS PWA browsers cannot embed PDF; use Detailed view or Export PDF there.
- Legacy ledger ID/password login remains intact.

## Why Google sign-up still says not activated
`google-drive.js` still contains `REPLACE_WITH_YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com`. A static GitHub Pages app cannot provision its own OAuth client. In Google Cloud Console enable Drive and Sheets APIs, configure the OAuth consent screen, create a Web application OAuth client, authorize `https://haddadguy1-max.github.io`, and replace the placeholder in `google-drive.js` with your public **Client ID**, not a client secret. Google may require test users and additional verification for broad deployment.

## Protect your existing data
1. Back up your existing repository and spreadsheet.
2. Upload the extracted files to a **test** GitHub Pages repository, not production.
3. Test existing ledger sign-in, changing goal/name/gold/notification settings on device A, sync, then open device B and verify each value. Repeat in reverse.
4. Test the report PDF preview and exported PDF for the same month.
5. If you use a previous deployed Apps Script with monthly email triggers, remove them manually; uploading a new `Code.gs` to GitHub does not update the deployed Apps Script.

## Not yet operational
Scheduled push when the PWA is closed, Google OAuth without owner configuration, and fully conflict-safe simultaneous multi-device edits. Notification permission must be granted on each device, and iOS requires Home Screen installation. Do not use this as your only copy of financial data.
