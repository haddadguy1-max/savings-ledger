# Savings Ledger, version 27 (11 Nov 2026)

## Install

**1. GitHub (the app).** Upload every file in this folder to the repository, replacing the old ones:
`index.html`, `app-extras.js`, `google-drive.js`, `sw.js`, `manifest.json`, `version.json`, the three icons.
`Code.gs`, `README.md` and the two `test_*.js` files are not needed on GitHub (they do no harm there, as long as
`Code.gs` still has the placeholder password).

**2. Google Sheet (the ledger script).** Open the Sheet, then Extensions, Apps Script.
Copy your current `const TOKEN = '...'` line somewhere safe. Paste the whole of `Code.gs` over the old code.
Put your own TOKEN line back. Then Deploy, Manage deployments, the pencil, Version: **New version**, Deploy.
Saving the file is not enough: without a new version the app keeps talking to the old script.
Google asks you to authorize once more, because the script now also fetches gold prices.

**3. On each phone.** Open the app. A bar says "A new version is ready": tap Update now.
Data, at the bottom, must show **Version 27 · 11 Nov 2026 · ledger script up to date**.
Do not delete the app or clear Safari data.

## What changed from version 26

- Entries and settings can no longer be lost on reopening. Version 26 restored a copy saved every 12 seconds over
  the live data each time the app started.
- Signing in no longer hides what was on the phone or discards it. Signing out tucks the ledger away on the phone;
  signing in again brings entries and settings straight back.
- Settings sync is one key per setting, newest wins. The duplicate "fullDataConfig" key, which could bring an old
  target back, is gone. A phone meeting a ledger for the first time takes the ledger's settings.
- Gold: every month has a price. Market average when known (this phone, another phone, or the ledger script),
  latest price for the current month, and otherwise an estimate between the nearest known prices, always marked.
  Nothing shows "Unavailable" and no chart stops halfway.
- Report: one set of figures for the screen and the PDF. The net worth bridge adds up to the dollar.
  PDF charts are drawn as lines and bars, not as pictures of a hidden canvas.
- Notifications: five alerts worked out on the phone, plus calendar reminders for when the app is closed.
- Updates: pages and scripts are always asked from the site first; a version check shows the update bar.
- Ledger script 3: settings, weekly backup tabs, gold prices tab. No email.

## Settings tab of the Sheet (one row each: Setting, Value, Updated)

`people`, `title`, `goal`, `startSaving`, `goldKarat`, `goldMode`, `goldManual` (today's typed price),
`goldMan` (prices typed for a month), `goldHistory` (market monthly averages shared between phones).
Values are JSON. Rows left by earlier versions (`fullDataConfig`, `delivery`, `reportEmails`, `appUrl`) are ignored.

## Tested here

`node test_calculations.js`, `node test_regressions.js`, and a browser run at iPhone size against a stand-in for the
ledger script: 52 checks over three phones and two ledgers (reload, sign in, second phone, settings both ways,
offline and back, bad reply, wrong password, sign out and in, two ledgers kept apart, invite link, leftovers of
versions 24 to 26, report against PDF for four months).

## Not tested here

- The real Google Apps Script, a real iPhone, and GitHub Pages. This workspace has no access to them.
- The live price services (gold-api.com, freegoldapi.com, Yahoo). They were stood in for.
- Charts on screen were run with a stand-in for Chart.js. PDF charts were rendered and looked at.
- "Sign up with Google" stays hidden until a Google OAuth client ID is put in `google-drive.js`.
