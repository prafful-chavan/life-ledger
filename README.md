# Life Ledger

A private, mobile-friendly personal dashboard for family finance, salary growth, expenses, net worth, interview preparation, future goals, daily tasks, exercise, and local assistant-style analysis.

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
