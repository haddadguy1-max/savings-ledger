# Savings Ledger v26 — targeted reliability repairs (TEST BUILD)

## Confirmed defects repaired
1. **Critical:** `shMerge` referenced `R` before its `const` declaration, throwing a ReferenceError and preventing successful settings sync. Corrected order and initial sync logic.
2. **Critical:** the packaged legacy `Code.gs` had no `doGet`, so the legacy backend could not return rows/settings. Restored authenticated `doGet` returning both. **Redeploy Apps Script as a new version**; uploading the GitHub files alone does not update Apps Script.
3. **Critical:** account isolation listed `lg-gold-history-v1` while the app actually uses `lg-goldhist-v1`. Corrected account-specific storage so gold history does not leak between ledgers on the same device.
4. Historical API requests now check HTTP status and merge valid monthly observations into existing history rather than discarding previously saved months.
5. Report month-end balance headline now uses the same market-valued figure as net worth, rather than a different cost-based balance with a misleading market label.
6. Gold monthly calculations stop at the current month instead of displaying future-dated holdings.

## What this build does NOT claim
- No historical API can guarantee every daily/monthly observation; older months can remain carried-forward estimates. Monthly averages are not month-end closes.
- The Google OAuth client ID is still a placeholder and **Google sign-in is not enabled** until configured.
- Live two-device synchronization, Google Sheets permissions, and real-money reconciliation have not been tested.
- Gold purchase transfers and loan accounting still need a redesigned transaction model; do not trust net-worth reconciliation until those are addressed.
- Google Sheets write operations are not atomic under simultaneous edits.

## Safe installation and tests
1. Back up the spreadsheet and current GitHub files. Do not delete the PWA or clear Safari data.
2. Upload extracted ZIP contents to a **test** GitHub Pages repository.
3. For legacy ledger users, replace Apps Script Code.gs, set the original TOKEN, and **Deploy > Manage deployments > Edit > New version**.
4. Open test app, sign in, change savings goal, then inspect the Google Sheet `Settings` tab for `goal` and `fullDataConfig`.
5. Repeat on a second device. Test logout/login, gold prices, and same-month report versus PDF.
6. Check the developer console and network responses if a value fails to synchronize.

Run `node test_calculations.js` and `node test_regressions.js` to repeat the static and calculation checks.
