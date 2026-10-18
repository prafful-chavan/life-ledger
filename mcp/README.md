# Life Ledger MCP

A local, read-only MCP server that lets Claude read your live household data and analyse it. It runs only on your Mac.

## How it works
- Each tool call pulls the latest encrypted vault from your sync gateway, decrypts it **in memory** with your vault password and answers from it. Nothing is cached on disk.
- The vault password is kept only in the macOS Keychain (item `life-ledger-mcp`). Remove it any time with `node mcp/setup.js --remove`.
- Nominees, policy notes/numbers and dates of birth are never returned (ages only).
- There are no write tools. The server cannot change your vault.

## One-time setup (you run these in your own Terminal)
```bash
node mcp/setup.js
```
It asks for the Apps Script gateway URL (the one in Life Ledger → Settings → Stock Prices) and your vault password (hidden), checks that it can decrypt the vault, then stores the password in the Keychain.

Register the server with Claude Code (and Claude Desktop uses the same command in its MCP settings):
```bash
claude mcp add life-ledger -- node /Users/praffulchavan/Documents/Life-Ledger/mcp/server.js
```

## Tools
- `daily_pack` — everything for the morning email in one call (≈20s: it fetches public price history).
- `holdings_table` (funds | stocks | us) — per holding: value, return, XIRR, trend, RSI, 50/200-day averages, the app's verdict, review-below / target levels with the holding's value at each, tax if sold.
- `tax_report` — gains by lot (FIFO), this year's realised gains, the ₹1.25L exemption left per person, harvesting ideas, old-vs-new regime estimate, what a CA still needs from you.
- `fitness` — body, workouts, steps, streaks (no habit names), net-worth milestone pace, SIP progress.
- `calendar` — birthdays, renewals, tax dates, salary day.
- Overview tools: `household_brief`, `net_worth`, `mutual_funds`, `stocks`, `us_stocks`, `expenses`, `health_check`, `protection`, `goals`, `data_freshness`.

## Tax profile (optional, stays on your Mac)
`~/.life-ledger-mcp/tax-profile.json`, e.g. `{"Me": {"regime": "new", "rentPaidMonthly": 18000, "section80COther": 150000, "section80D": 25000}, "Wife": {}}`. The more of it is filled in, the sharper `tax_report` gets.

## Known data limits
- Indian stock rows carry the sheet's import date, not the real buy date, so their tax is shown as a range until real dates are supplied.
- Price levels come from price history only (no fundamentals or news).

## Daily brief
`briefing-prompt.md` is the instruction set for the morning analysis. It writes a Gmail **draft**; it does not send.

## Limits
- Prices are as fresh as the last time the app was open on any device (the vault carries the last fetched prices). `data_freshness` reports the age.
- Rules of thumb only; not licensed investment or tax advice.
