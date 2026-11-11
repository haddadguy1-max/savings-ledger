# Savings Ledger v24 — Settings sync and report data integrity

## Changes
- Shared settings include all `CFG` Data tab values, target, starting balance, contributors, gold valuation settings, and observed gold price history.
- Gold setting edits now request a sync, rather than remaining device-local.
- On a new ledger with no remote settings, local values are seeded. On an existing ledger, remote timestamps are respected.
- Report and detailed PDF use the same reportData model; missing monthly market quotes are explicitly shown as gaps, not replaced by purchase prices or a later month.
- One-page PDF no longer substitutes cost basis for missing market valuation; missing net worth is labeled unavailable.
- Data quality notes explain historical monthly averages versus month-end closes.
- New Home Screen icons included.

## Deployment warning
**This is a test build.** Back up the Google Sheet and the previous app before uploading. Google sign-in still requires your OAuth Client ID. The historical gold provider may not supply all requested months, and this build does not invent missing quotes. True multi-device simultaneous-edit atomicity is not guaranteed by Google Sheets API; do not edit the same setting simultaneously. The existing cash/gold transfer accounting and loan accounting require transaction migration and remain unresolved.

## Manual cross-device test
1. Back up the spreadsheet. Open the same ledger on iPhone and laptop.
2. Change Data → Target to a unique number; wait for Synced; inspect `Settings` tab (`fullDataConfig` and `goal` rows).
3. Refresh the other device, confirm target and starting savings match. Repeat with contributors and gold purity/mode.
4. Edit an existing gold purchase cost and verify the `Raw data` row and report on both devices.
5. Open October report and export PDF. Both should display the same monthly gold observations and missing-price warnings.
6. Test switching between two accounts: no shared financial settings should leak.
7. Test offline edit and re-connection. Do not delete the app until all pending edits have synced.
