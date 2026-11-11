# Savings Ledger v23 — daily gold price and calculation review

**TEST BUILD — DO NOT REPLACE LIVE FINANCIAL DATA WITHOUT BACKUP.**

## Implemented
- Live 24K gold USD/troy-ounce quote requested from `https://api.gold-api.com/price/XAU` and converted to USD/gram using 31.1034768 grams/troy ounce; each lot is scaled by its recorded karat/24.
- On opening the app, a live quote is requested if the last successful live quote is older than 24 hours; the app retries while open and on visibility changes. Refresh button forces a new request. This is **not** a background daily job while the app is closed.
- Rejects failed HTTP responses and implausible/non-numeric quote values. Concurrent refreshes are deduplicated. No stale fallback is labeled live. Cached prices are not used as *today's* market quote after 24 hours.
- Keeps gold acquisition cost separate from market price. Missing historical prices are not filled with purchase costs, interpolated, or carried forward on the price chart.
- When no current quote is available, gold holdings panel shows **Price unavailable**, and unrealized gain is hidden rather than invented. The ledger's older cost-basis balance calculation is still used as a fallback and must not be interpreted as verified market value.
- Service-worker cache bumped so browsers receive updated code.

## Tests completed
- `node --check app-extras.js` and `node --check google-drive.js` passed.
- `node test_calculations.js` passed (cost basis, spot valuation, mixed purity, missing prices, stale price, manual override, history).
- ZIP integrity verified.

## NOT verified / remaining accounting blockers
1. **Existing gold purchase entries do not specify their funding source.** Gold paid using existing recorded cash requires a matching cash reduction; gold bought using external funds does not. Historical funding cannot be guessed or safely backfilled. The current app does not implement atomic cash-to-gold transfers. Net worth and monthly contributions may be overstated without proper offsetting entries.
2. **Loans are not full double-entry transactions**. Principal disbursement/repayment needs paired cash and liability changes. Historical loans need reconciliation.
3. **Live market API and Google sign-in/sync have not been end-to-end tested against your private ledger or production iPhone.** The gold provider may be down, rate-limited, CORS-blocked, or provide an unexpected format; this is handled as unavailable rather than fabricated.
4. Gold price history from `freegoldapi.com` is monthly average, not necessarily a month-end closing quote; individual daily historical records are not persisted by this version. Monthly snapshots may be incomplete and manual overrides are not independent verification.
5. Google OAuth still requires the actual OAuth client ID. Concurrent Google Sheets edits and scheduled push notifications remain unresolved.
6. Historical gold entries with missing cost or karat need user correction. Legacy reports use mixed savings/net-worth semantics and need transaction-level validation before being treated as audit-grade.

## Recommended safe rollout
1. Export original ledger and back up GitHub and Google Sheet.
2. Deploy ZIP to **test repository**, not production.
3. Confirm live quote and timestamp in iPhone Safari and Home Screen PWA, test offline/expired quotes, and manually verify purchase lots and PDF report.
4. Reconcile every historical gold purchase's funding source and every loan principal movement before trusting net worth.
5. Test separate accounts and simultaneous devices before production release.

**No one can responsibly guarantee “no mistakes” without your real transaction history, a working authenticated backend, and end-to-end device tests.**
