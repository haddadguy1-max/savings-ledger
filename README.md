# Savings Ledger, version 30 (11 Nov 2026)

Built on the version 29 package. App version 30, ledger script version 6.

## Install, in this order

**1. Google Sheet (the ledger script).** Open the Sheet, Extensions, Apps Script.
Copy your `const TOKEN = '...'` line somewhere safe, paste the whole of `Code.gs` over the old code, put your TOKEN
line back, save.

**2. Run `setup` once.** In the editor's toolbar pick the function **setup** and press **Run**. Google asks you to
authorize: accept everything it lists. This creates the hourly timer. Skipping this step is the usual reason
scheduled notifications never arrive.

**3. Deploy a new version.** Deploy, Manage deployments, the pencil, Version: **New version**, Deploy.
Keep the same deployment so the ledger login does not change.

**4. GitHub.** Upload `index.html`, `app-extras.js`, `google-drive.js`, `sw.js`, `manifest.json`, `version.json`
and the three icons, replacing the old ones. Never upload a `Code.gs` that contains your real TOKEN.

**5. Each phone.** Open the app from the Home Screen and tap **Update now**. Data must show
**Version 30 · 11 Nov 2026 · ledger script up to date**.

## Turning push on, and proving it works

On each phone, in Data, Notifications on this phone:

1. Tap **Allow notifications** (or **Turn on push**). The first line becomes "Push is on".
2. Read **Push status**. Every line should have a tick. A line with a "!" says what to fix.
3. Tap **Test in 1 minute** and close the app completely. About a minute later the ledger's own timer sends
   "Delayed test arrived". This is the same path the scheduled alerts use.
4. **Send a test** sends one immediately.

If a test does not arrive, the last line of Push status holds the push service's answer. Send that line.

Nothing scheduled fires on an ordinary day by design: the report comes on the 1st, the weekly summary on Monday,
the reminder on your chosen day only when nothing was saved, gold only on a 3% move. The delayed test exists so
the timer can be checked any day.

## What changed from version 29

Push
- The phone now subscribes straight from the tap. iPhone refuses a subscription that starts later, which could
  leave "Push is on" never appearing.
- The script keeps one signed permission slip per push service for six hours instead of signing a new one for every
  message. Apple asks for at most one new slip an hour.
- Messages are sent with high urgency, so iPhone does not hold them back to save power.
- The hourly timer now calls a public function, `pushTick`. The old private name `pushTick_` is replaced on setup.
- Push status in the app, the delayed test, a weekly summary every Monday, and a count on the app icon.

Gold
- Version 29 rejected every quote from gold-api.com unless it carried a `currency` field, which that service does
  not appear to send. Quotes are accepted again.
- History now has two sources on the phone (standardbullion.com, freegoldapi.com) and three on the ledger script
  (those two and Yahoo). A later source only fills months the earlier ones lack.
- Version 29 removed estimates, so months before the first market price fell back to what was paid and the report
  showed a false jump in "gold price change" in the first priced month. Marked estimates are back: every month has
  a price, and an estimated one carries a `*`.
- A price you typed, and a price seen live during the month, count as real prices, not estimates.
- A chart in the report raised an error when a point was touched. Fixed.

New
- **Share your progress**, at the end of the monthly report: a picture of the month for a message or a story.
  Amounts are left out unless you tick "Show amounts".

## Tested here

`node test_calculations.js`, `node test_gold_sources.js`, `node test_script.js`, `node test_regressions.js`,
and a browser run at iPhone size against a stand-in for the ledger script (56 checks, several phones, two ledgers).
`test_script.js` runs `Code.gs` against a stand-in Sheet and verifies every push signature with Node's own crypto.

## Not tested here

- The real Google Apps Script, a real iPhone, GitHub Pages, and Apple's or Google's push services.
- The gold price services. This workspace cannot reach them, so their exact reply formats are taken from version 29's
  notes and from earlier versions; the code accepts a quote when the optional fields are missing.
- On-screen charts ran with a stand-in for Chart.js. PDF charts and the share card were rendered and looked at.
- "Sign up with Google" stays hidden until a Google OAuth client ID is put in `google-drive.js`.
