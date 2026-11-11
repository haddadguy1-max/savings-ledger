# Savings Ledger — account isolation test (v20)

This is a **test build**, not a production security audit. It retains the original dashboard, legacy ledger login, Google OAuth prototype, reports and notification settings.

## What changed
- Ledger-specific local snapshots now include transactions, tombstones, all main Data configuration, gold preferences/history, contributor data, report settings, and notification preferences.
- Switching Google accounts or legacy ledgers swaps the local cache instead of carrying another account's values across.
- Legacy credentials are checked before switching accounts.
- Sign out clears the active ledger view while retaining a separate recoverable local cache.
- Google spreadsheet ID is the Google account ledger key.
- A fresh account does not push default settings to an existing remote ledger during first sync.
- Notification permission remains per-device; the monthly preference is ledger-specific.

## Important limitations
- **Do not deploy over your live website until tested.** Export your data and back up your repo.
- Google OAuth still requires replacing the placeholder CLIENT_ID in google-drive.js and enabling Google APIs.
- The browser's localStorage is **not encrypted**. A shared unlocked device can still expose locally cached financial information; account isolation prevents accidental cross-ledger mixing, not physical-device attacks.
- Google tokens are held in memory and require reauthentication after reload.
- Legacy login uses an existing script URL as ledger identifier. A separate legacy account migration mechanism is not included.
- True scheduled push still requires a backend.
- Google Sheets concurrent writes remain subject to races; do not edit on two devices simultaneously until hardened.
- Test on two devices: account A target/name/gold/notifications, switch to B (all independent), switch back to A (all restored), then repeat on second device after sync.
- This patch was syntax-checked, but **not live-tested against Google or Apps Script**.
