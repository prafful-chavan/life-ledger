# Life Ledger

A private, mobile-friendly personal dashboard for family finance, salary growth, expenses, net worth, interview preparation, future goals, daily tasks, exercise, and local assistant-style analysis.

## Open it

Open `index.html` in any modern browser, or run a small static server from this folder:

```sh
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

## Import data

Use **Upload sheet** to import `.xlsx`, `.xls`, `.csv`, or backup `.json` files. The importer understands common headers:

- Income: `Date`, `Month`, `Person`, `Amount`, `Salary`, `Company`, `Source`, `Type`
- Salary slips: `Month`, `Gross Earnings`, `Total Earnings`, `Gross Salary`, `Net Salary`, `Income Tax/TDS`, `Tax`, `Basic Salary`, `HRA`, `LTA`, `PF`, `Professional Tax`, `Personal Allowance`, `Special Allowance`, `Performance Pay`, `Bonus`
- Expenses: `Date`, `Category`, `Amount`, `Paid By`, `Merchant`, `Note`, `Description`
- Net worth: `Name`, `Category`, `Owner`, `Value`, `Outstanding`, `Balance`
- Goals: `Goal`, `Target`, `Saved`, `Progress`, `Due Date`
- Interview prep: `Topic`, `Status`, `Confidence`, `Hours`, `Target Hours`
- Daily life: `Task`, `Area`, `Done`, `Workout`, `Minutes`, `Intensity`

The app stores data in browser `localStorage`. Use **Export backup** regularly to keep a copy.

Use **Reset data** to clear one area before reuploading, such as salary/income only, expenses only, all finance, interview prep, goals, tasks, workouts, chat, or everything. Use **Dark mode** to switch themes; the choice is remembered in this browser.

The salary importer can read workbook tabs named like `Blazeclan-Salary`, `Hashedin-Salary`, `Quantiphi-Salary`, `JLR-Salary`, `TCS-Salary`, and `Wife-Ascent-Salary`. It preserves salary components and uses net salary as the income number for dashboards.
