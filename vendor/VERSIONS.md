# Third-party code served from this site

These files run inside the page next to your unlocked data, so they are served from here (not from a CDN) and pinned by SHA-384.
A test (tests/security-guards.test.js) fails if a file differs from the hash below. To update one: download it from the source,
read what changed, put the new hash here and in the test, and bump the version in the file name.

| File | What | Source | SHA-384 (base64) |
|---|---|---|---|
| xlsx-0.20.3.full.min.js | SheetJS 0.20.3 (spreadsheet reader), Apache-2.0 | https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js | EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT |
| sqljs-1.8.0/sql-wasm.js | sql.js 1.8.0 (SQLite reader), MIT | https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js | KsfptB549CXfbfsdxZmPo2PlmgCyJ+RNqHTQE1Gj45t3p4DaA1QbZYVyqlni4pOO |
| sqljs-1.8.0/sql-wasm.wasm | sql.js 1.8.0 engine | https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.wasm | AS2JK6pQgcjrHesLM8C6EQ0u87+/VcHqKXIPDFVCgQgO2A258+LHg7ID8d66NgPW |
