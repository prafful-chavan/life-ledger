# Life Ledger

A private, mobile-friendly personal dashboard for family finance, salary growth, expenses, net worth, interview preparation, future goals, daily tasks, exercise, and local assistant-style analysis.

## Making a change safely

1. Edit the code. If you changed a script or stylesheet that `index.html` loads as `file?v=X.Y.Z`, **bump that `?v=`** — devices cache by that URL and would never receive the change otherwise.
2. `node tools/update-version-lock.js` records the new version (it refuses until every changed file has been bumped).
3. `npm test` runs every unit test; `npm run test:e2e` drives the real app in headless Chrome with a made-up household.
4. `git push` first runs a hook (version check + unit tests; enabled by `git config core.hooksPath .githooks`). On GitHub, every push to `main` is tested again and **the site is deployed only if all tests pass**.

## Live app

**https://prafful-chavan.github.io/life-ledger/**

Pushes to `main` redeploy automatically via GitHub Pages.

## Security (password + encrypted sync)

The public URL does **not** expose your numbers. Protection works like this:

1. **Password** — unlocks an AES-256-GCM encrypted vault (PBKDF2, 250k iterations).
2. **Google Drive** — only the **encrypted** vault file is stored (`life-ledger-vault.enc.json`). Google cannot read your salary or expenses without your password.

2FA (Authy / Authenticator) can be added later. On a new browser or phone: use **Restore vault from Google Drive**, then sign in with your password.

Use **Export backup** inside the app for an extra offline copy.

## Google Drive setup (one-time)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → create or pick a project.
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **APIs & Services → Credentials** → **Create credentials → OAuth client ID** → type **Web application**.
4. **Authorized JavaScript origins** (add both):
   - `https://prafful-chavan.github.io`
   - `http://localhost:4173`
5. Copy the **Client ID** into `config.js`:

```js
window.LIFE_LEDGER_CONFIG = {
  GOOGLE_CLIENT_ID: "123456789-xxxx.apps.googleusercontent.com",
};
```

6. **OAuth consent screen** → add your Google account as a test user (while app is in "Testing").
7. Push `config.js` or edit it on GitHub, then in the app click **Link Google Drive**.

## Open locally

```sh
python3 -m http.server 4173
```

Visit `http://localhost:4173`.

## Import your salary & expenses workbook

Your file `Salary and expensese sheet details (1).xlsx` includes:

| Sheets | What imports |
|--------|----------------|
| TCS-Salary, JLR-Salary, Quantiphi-Salary, Hashedin-Salary, Blazeclan-Salary, Wife-Ascent-Salary | Monthly salary with gross, net, tax, basic, HRA, PF, etc. |
| Expenses-till-march-2026 | Expenses (Date, Category, Amount, Note) |

**Local / with file in project:**

1. Copy the workbook to `data/salary-and-expenses.xlsx` (already set up if you pasted it in the project folder).
2. Run the app → **Upload sheet** → **Import master salary sheet**.

**Live site (GitHub Pages):** use **Upload sheet** → choose the `.xlsx` from your Mac (the master file is not pushed to GitHub for privacy).

## Import other data

Use **Upload sheet** to import `.xlsx`, `.xls`, `.csv`, or backup `.json` files. The importer understands common headers:

- Income: `Date`, `Month`, `Person`, `Amount`, `Salary`, `Company`, `Source`, `Type`
- Salary slips: `Month`, `Gross Earnings`, `Total Earnings`, `Gross Salary`, `Net Salary`, `Income Tax/TDS`, `Tax`, `Basic Salary`, `HRA`, `LTA`, `PF`, `Professional Tax`, `Personal Allowance`, `Special Allowance`, `Performance Pay`, `Bonus`
- Expenses: `Date`, `Category`, `Amount`, `Paid By`, `Merchant`, `Note`, `Description`
- Net worth: `Name`, `Category`, `Owner`, `Value`, `Outstanding`, `Balance`
- Goals: `Goal`, `Target`, `Saved`, `Progress`, `Due Date`
- Interview prep: `Topic`, `Status`, `Confidence`, `Hours`, `Target Hours`
- Daily life: `Task`, `Area`, `Done`, `Workout`, `Minutes`, `Intensity`

Use **Reset data** to clear one area before reuploading. Use **Dark mode** to switch themes.

The salary importer can read workbook tabs named like `Blazeclan-Salary`, `Hashedin-Salary`, `Quantiphi-Salary`, `JLR-Salary`, `TCS-Salary`, and `Wife-Ascent-Salary`. It preserves salary components and uses net salary as the income number for dashboards.


## Multi-device sync (v2)

Changes merge **record by record** (`sync-engine.js`) through an Apps Script gateway
(`sync-gateway.gs`), so a Mac and an iPhone edited at the same time converge instead of
overwriting each other. The old Google Drive vault is still written as a mirror/fallback.

**One-time setup (needs you, in the Apps Script editor):**
1. Open the same Apps Script project as the stock price proxy.
2. Replace `stock-price-proxy.gs` with the repo version and add `sync-gateway.gs` as a new file.
3. Run any function once (e.g. `syncMeta_`) and approve the Drive permission.
4. Deploy → Manage deployments → Edit → **New version** (keep the same URL).
5. In the app: Settings → "Multi-device sync" → **Sync now**. Status should show "Up to date".

Install on iPhone/iPad: Safari → Share → Add to Home Screen (manifest + service worker included).
Snapshots live in the Drive folder "Life Ledger Sync" (last 40); restore from Settings → Version history.

## Spending app sync (Dropbox → Life Ledger)

The Spending Tracker app writes a daily SQLite backup to Dropbox (`Apps/SpendingTracker`).
`spending-sync.gs` (Apps Script, read-only Dropbox access) fetches the newest backup through the
authenticated sync gateway; `spending-import.js` reads it in the browser with sql.js and merges
new expenses (ids derived from row content; deleted rows are not re-imported).

Setup: add `spending-sync.gs` to the Apps Script project, set script properties
`DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET`, run `dropboxAuthUrl`, approve, set `DROPBOX_AUTH_CODE`,
run `dropboxExchangeCode`, then `dropboxTest`. Redeploy a new version.

Wife's backup (separate Dropbox account): in the Dropbox app console enable additional users, have her
open the link from `dropboxAuthUrl` and Allow, save the code as `DROPBOX_AUTH_CODE_WIFE`, run
`dropboxExchangeCodeWife`, then `dropboxTestWife`. Her rows import as paid by "Wife" (ids `spw-…`).

## Wealth Advisor (dashboard)

Live portfolio analysis on the dashboard. `advisor-engine.js` computes returns, XIRR, drawdown, trend vs
Nifty/S&P/gold, concentration, allocation drift, emergency-fund months, debt cost, savings rate and goal gaps
and turns them into graded signals with evidence. An AI model (Gemini free by default, or OpenRouter) writes the
prioritised review from those numbers only; every action must cite a real signal id (`advisor-ai.js` validates it).

Setup: add `advisor-history.gs` to the Apps Script project, replace `stock-price-proxy.gs` (adds `?history=`),
Deploy → New version. Set your goals under Dashboard → Wealth Advisor → Profile. Educational analytics, not
SEBI-registered investment advice.

## Hey Prafful — knowing everything, now and in future

The chat agent does not rely on a fixed prompt. It has tools (`knowledge.js`) that read the app's data directly:
`list_sources`, `query_data` (filter / group by field or year-quarter-month-week-day / sum-avg-count-min-max over the
FULL history), `get_module`, `get_object` and `calculate` (exact maths). Every list stored in the app state is
discovered automatically — a new section that keeps an array of records in `state` is queryable with no extra code.

To give a new feature a hand-written briefing, register a module (see `knowledge-modules.js`):
`LifeLedgerKnowledge.registerModule({ id, title, description, build: (state, args) => "text" })`.
Add a line to `DESCRIPTIONS` in `knowledge.js` if you want the new list to carry a friendly explanation.


## Tax page

The **Tax** page (sidebar → Money → Tax) is a personal Indian income-tax planner for the two of you. Everything is computed in the browser by `tax-core.js` (the same file the tests and the MCP server use); `tax.js` only draws it.

- **Today**: tax this year per person, ranked actions, and the dates that matter.
- **Plan**: new vs old regime on your real salary records, ways to pay less (employer NPS, tax-free long-term gains and exactly which units to sell and buy back), advance tax, and a move-abroad residency view.
- **Returns**: each filed (or unfiled) year checked against its documents, what correcting it costs (revised return, updated return), and the July filing checklist.
- **Family money**: gifts, loans and deposits between family members, using the marriage date.
- **Rules**: every rule the page relies on, its source and how sure we are. A monthly scheduled check looks for changes.
- **Data**: import/export. Your profile, returns and transfers live in the encrypted vault (`taxProfile`, `taxReturns`, `taxFamily`); nothing personal is in the code or the repository.

Planning aid only: a CA confirms before anything is filed or paid. Tests: `tests/tax-system.test.js`, `tests/tax-household.test.js`, `tests/tax-sync.test.js`, `tests/mcp-taxplan.test.js`, and the Tax checks in `tests/e2e/run.js`.
