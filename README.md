# Ledger — Financial analytics dashboard

A responsive Next.js application using TypeScript, Tailwind CSS v4, the App Router, and Recharts. The default dataset is **fictional demo data**, labeled throughout the interface. Uploaded datasets are labeled separately. There are no connected accounts, authentication, Supabase, or deployment integrations.

## Requirements

- Node.js 20.9 or later (Node.js 24 recommended)
- npm 11 recommended
- HTTPS access to registry.npmjs.org for dependency installation

## Local development

From the repository root:

```sh
npm ci
npm run dev
```

Open http://localhost:3000 in your local browser. The development server binds to all interfaces for container development. The committed `package-lock.json` pins dependencies; use `npm ci` for repeatable installs and `npm install` when intentionally updating dependencies.

## Commands

```sh
npm run dev        # Development server
npm run build      # Production build
npm start          # Serve the production build (run build first)
npm run lint       # ESLint with Next.js and TypeScript rules
npm run typecheck  # TypeScript validation
npm test           # Financial calculation, parser and mapping tests
npm run test:e2e   # Browser workflow against a production build
```

## Structure and financial definitions

- `app/`: App Router layout, dashboard page, and Tailwind styles.
- `components/financial-charts.tsx`: Client-side Recharts visualizations.
- `lib/demo-data.ts`: Fictional monthly records, in USD, for January–June 2026.
- `lib/finance.ts`: Pure calculations and currency formatting, separate from UI components.
- `lib/finance.test.ts`: Profit waterfall, aggregation, reconciliation, and zero-revenue checks.

Gross profit = revenue − cost of revenue. Operating profit = gross profit − operating expenses. Net profit = operating profit − other expenses − taxes. Margins divide the corresponding profit by revenue; zero revenue returns an unavailable margin, displayed as N/A. The expense donut shows **total expenses**, including COGS, operating expenses, other expenses, and tax. Categories reconcile to the total deductions from revenue. Zero expenses show an explicit empty state. The monthly table provides exact chart figures in an accessible format.

No environment variables, secrets, external fonts, database, or external data service are required.

## Restricted cloud environments

Keep the environment's configured HTTPS proxy and TLS verification enabled. If npm cannot reach the proxy or registry, source files remain usable, but lint, type checking, build, and application startup require a successful dependency installation. Do not treat missing-dependency errors as successful validation. The financial tests use Node's built-in runner and can execute without npm dependencies on Node.js 24.

## Local CSV and Excel import

Use the CSV or XLSX template, or choose your own monthly summary file. Parsing happens locally with Papa Parse and read-excel-file; financial records are never sent to a server or persisted. A refresh or **Reset to demo** restores the fictional USD dataset.

1. Select a `.csv` or `.xlsx` file. For Excel, explicitly select a worksheet; only that sheet is analyzed.
2. Preview the headers and first five non-empty data rows. The first non-empty row must contain unique column headers.
3. Map your columns to Month, Revenue, COGS, OperatingExpenses, OtherExpenses and Tax, plus optional Revenue Budget. Names do not need to match. Common aliases such as Period, Sales, Cost of Sales, Opex and Taxes are suggested; ambiguous matches remain unassigned. Confirm the mappings yourself. Each source column can be used once; extra unmapped columns are ignored.
4. Month and Revenue must map to real source columns. Every expense must map to a column or explicitly use **Not applicable — use 0**. This choice requires a separate confirmation; missing financial columns never silently become zero. Blank cells in mapped financial columns remain invalid.
5. Select the currency already used by the whole file: USD, PKR, AED, GBP or EUR. Every card, chart and table uses that currency code. Amounts are not converted or detected automatically. Templates contain fictional USD data.
6. Click **Validate and review**, then inspect the month count, range, currency, totals and zero-expense fields. The dashboard changes only after **Import and analyze**. Editing a mapping, worksheet, currency or confirmation invalidates the review; validate again before importing.

### Monthly-summary requirements

The expandable **How to prepare your data** guide includes a sample table and plain-English field definitions. Both downloadable templates contain the same three fictional months and are covered by parser/mapping tests.

```csv
Month,Revenue,COGS,OperatingExpenses,OtherExpenses,Tax,RevenueBudget
2026-01,182000,76000,54000,2000,10000,180000
```

Prepare one row per month, not individual sales or invoices. Month must be YYYY-MM (year 0001–9999); store Excel months as text, not date cells. Months must be unique. Amounts must be finite non-negative numbers without currency symbols or thousands separators. Enter 0 when an amount does not apply, or explicitly confirm a zero mapping for the expense field. Do not use merged cells or total/subtotal rows. Expense categories must not overlap; each cost is counted once, and OtherExpenses excludes Tax.

Maximum file size: 5 MB; maximum data rows per selected sheet: 1,000; maximum individual amount: 1 trillion in the selected currency. Blank rows are ignored. Validation reports missing mappings, duplicate mappings/headers/months, invalid values with row and field names, empty files and unreadable workbooks. Reported validation row numbers count non-empty data rows, with the header counted as row 1.

Product Profitability is available through a separate optional product-month import, never from this monthly summary file. Monthly revenue budget variance is available through the optional RevenueBudget column; expense budget comparisons are not included. No currency conversion, transaction aggregation or budget/category inference is performed.

### Validation

`npm test` runs calculation, strict-template parser and flexible-mapping tests, including real XLSX workbooks, multiple worksheets, downloadable templates, alias ambiguity, required confirmations, duplicate mappings, missing fields, explicit zero choices and currency formatting without conversion. `write-excel-file` is a development-only fixture generator. The browser workflow is checked against the production build, including review invalidation, worksheet switching, import/reset and consistent currency labels.

To reproduce the browser check, run `npm run build`, install Chromium with `npx playwright install chromium`, then run `npm run test:e2e`. If Chromium is already installed by the environment, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable instead (verified here with `/usr/bin/chromium`). Playwright starts and stops its own production server on port 3010, creates a multi-worksheet XLSX fixture and writes a mapping screenshot under `test-results/`. Do not run another server on that port. These generated artifacts are ignored by Git.

The six-month regression fixture at `tests/fixtures/fictional-pkr-six-months.csv` intentionally has nonstandard headers and unsorted months. It includes a loss-making March and a zero-revenue April. Expected PKR totals are revenue 5,000,000, gross profit 2,170,000, operating profit 1,070,000 and net profit 760,000. Browser checks cover every monthly chart tooltip, sorted table values, aggregate margins, zero-revenue KPI margins, 390 px mapping controls, singular/plural messages and active-source identity. The dashboard retains the active filename until a new import is confirmed or Reset to demo is used; selecting or failing to read another file does not relabel active data.

## Downloadable reports

**Export report** downloads the currently active dataset and selected currency locally in the browser, without exchange-rate conversion or uploading financial data. Choosing a replacement file does not change the export until **Import and analyze** is confirmed. Reset to demo restores clearly labeled fictional USD exports.

- **CSV:** one row per month, sorted chronologically. Includes dataset/source filename/currency, all six source columns, calculated gross/operating/net profits, and corresponding margin percentages. Amounts retain numeric precision; negative profits remain numeric negative values. Zero-revenue margins are `N/A`. CSV uses UTF-8 with BOM and CRLF, quotes text and doubles embedded quotes. Potential spreadsheet formulas in text (including filenames with leading whitespace/control characters and `=`, `+`, `-` or `@`) are prefixed with an apostrophe. This protective prefix is intentionally retained when reading such a CSV back as text.
- **PDF:** A4 landscape summary with the full active filename, date range, currency, four KPI totals, profit margins, expense breakdown, definitions and a separate monthly results table. Losses are negative/red; zero-revenue margins are `N/A`. Amounts are displayed to two decimal places. Monthly tables repeat headers on additional pages and include page numbers and a totals row. Long filenames wrap and the embedded DejaVu Sans font supports Unicode source names. The PDF is generated using jsPDF and jsPDF-AutoTable, loaded only when requested; font files are fetched from this app, without transmitting financial records.

The report calculation/CSV model lives in `lib/reports.ts`; PDF layout lives in `lib/pdf-report.ts`. DejaVu font licenses are bundled in `public/fonts/DEJAVU-LICENSE.txt`. Unit tests cover CSV values/escaping, demo labeling, losses, zero margins, long filenames and multi-page generation. The browser suite downloads actual files and verifies active-dataset CSV values. PDF text extraction and rasterized pages were inspected for correct figures, readable layout, and all 120 rows of an eight-page stress report.

## Reporting-period filter

Use **From month** and **To month** to select inclusive months; changes apply immediately. **All months** restores the active dataset’s full date range without resetting its data or currency. One filtered slice drives KPI totals, both charts, the monthly table and report downloads. Aggregate margins use total profit divided by total revenue for the selected period, rather than an average of monthly percentages. Zero-revenue margins remain N/A.

The complete imported dataset remains in memory unchanged. Missing, invalid or reversed dates show a validation message. A valid range with no records shows a separate no-data message. Analysis and downloads are unavailable in either case, so empty selections do not produce misleading zero-value KPIs or empty reports. Calendar gaps are not filled with synthetic rows.

A confirmed new import or **Reset to demo** restores the new dataset’s full range. Merely previewing another file leaves both the active data and its filter unchanged. CSV includes `PeriodFrom` and `PeriodTo` on every exported row; PDF headings and download filenames explicitly identify the selected boundaries, including when an endpoint has no recorded month. The currency is retained with no conversion.

The date-range regression checks February–April of the fictional six-month PKR fixture: revenue 1,600,000, gross profit 650,000, operating profit 200,000, net profit 95,000 and a 5.9% weighted net margin. Unit tests cover inclusive selection, original-data preservation, invalid/no-data ranges and report boundaries. Browser tests cover filtered chart tooltips, CSV values, PDF download, 390 px controls, reset behavior and N/A for April alone. The actual downloaded PDF was text-extracted and visually inspected for the selected period and correct figures.

## Monthly Revenue Budget vs Actual

`RevenueBudget` is an **optional** non-negative monthly planned revenue amount in the same currency as actual revenue. The six original monthly columns remain required and existing CSV/XLSX files remain compatible. Common headers such as Sales Budget and Budgeted Revenue are suggested in mapping; confirm them before import. Leave the budget field unmapped or leave individual budget cells blank when unavailable. Missing budgets are never zero. An explicit `0` is a real zero budget; the mapping does not offer an automatic-zero choice for budgets. The same finite-number and 1 trillion per-amount limit applies.

The dashboard compares actual revenue and budget for the selected reporting period, with a monthly chart and table. Variance amount = actual revenue − revenue budget; percentage = variance ÷ budget × 100. Higher revenue is **Favorable**, lower is **adverse**, and equal is **On budget**. Zero or missing budgets produce N/A percentages. A missing monthly budget also produces N/A variance amount. Missing budgets form gaps in the chart, not zero points.

Period totals are compared only when **every selected month** has a budget. For partial coverage, actual revenue still includes all selected months, but aggregate budget/variance/percentage are unavailable and a coverage message explains why. Available monthly comparisons remain visible. With no budgets, the section clearly says **Budget not provided** and does not draw a misleading comparison chart. The date filter never discards source data.

Both fictional CSV/XLSX templates now include the optional budget column. Demo actuals and profit formulas are unchanged; fictional demo budgets total USD 1,325,000 against USD 1,320,000 actual revenue, yielding an adverse USD 5,000 variance (−0.4%).

CSV adds RevenueBudget, RevenueBudgetVariance, RevenueBudgetVariancePercent and RevenueBudgetResult. Missing budgets are blank, and missing variances/percentages are N/A. PDF retains existing financial pages and adds a paginated revenue-budget summary/table when budgets exist; otherwise it explicitly says Budget not provided. Selected boundaries and currency apply to every report section with no conversion. All budget parsing/calculation/export processing stays in the browser.

`lib/budget.ts` contains the independent variance and coverage logic. Budget tests cover positive/negative/equal variances, zero and missing budgets, partial coverage, legacy inputs, mapping validation, both templates, filtered CSV/PDF output and paginated budget tables. Browser checks cover optional mapping, no-budget and partial-budget states, favorable/adverse rows, zero budgets, chart gaps/tooltips, reporting-period changes, PKR exports, template downloads/imports, reset and mobile layout.

## Product Profitability (separate optional dataset)

Use **Choose a product data file** in Product Profitability, not the monthly uploader. Download the fictional USD CSV or XLSX product template. Required fields are Month, Product, Units Sold, Revenue and Product Cost; arbitrary source names can be mapped, and XLSX worksheets are selected explicitly. Preview the first five non-empty rows, confirm mappings and the product file currency, validate, then click **Import product data**. Failed reads or validation leave the active product dataset unchanged.

Use one summary row per product per month. Month must be YYYY-MM text; Product is a non-empty, case-sensitive name/SKU of at most 200 characters. Use consistent names to aggregate the same product across months. Units Sold, Revenue and Product Cost are required non-negative finite numbers (maximum 1 trillion); fractional units are allowed. Blank revenue/cost/units are errors, never zero. Enter 0 explicitly when correct. No currency symbols, thousands separators, total rows or merged cells. Duplicate product-month rows are rejected to prevent double counting. Limits are 5 MB and 1,000 product-month rows. **Product Cost is the total cost for that product-month, not a unit cost**; quantity does not multiply it.

Product gross profit = revenue − product cost. Gross margin = gross profit ÷ revenue × 100; zero revenue is N/A, including when there is a loss. The reporting-period filter selects product-month rows inclusively; the table aggregates by product and sorts by gross profit descending, with an alphabetical tie break. Aggregated margins use summed profit/revenue, not an average of monthly percentages. The chart compares the top ten products; the table includes all products and full names. Losses are red; positive gross profit is teal. No rows for a selected period produces a clear no-data state, not fabricated zero results.

Product records remain separate from monthly actuals, expenses and budgets. They never change monthly KPIs, even when currencies match. The product file has its own required currency selection. Different-currency results may be viewed side by side but are explicitly labeled and never converted, reconciled or combined. A new monthly import keeps the product dataset and changes the shared period filter; **Remove product data** affects only products. **Reset to demo** clears active and pending product data too. Browser refresh clears both local datasets.

**Export product CSV** in the product section and **Download product CSV** in Export report provide a separate, formula-safe product-results file with source filename, product currency, selected range, units, revenue, product cost, gross profit and gross margin. It contains aggregated results, not the original product-month import format. The monthly CSV retains monthly rows and its own currency, adding ProductDataStatus metadata; it does not interleave product monetary rows. This separation prevents accidental cross-currency sums. The PDF adds a separately labeled, paginated product section in the product currency, with its own source name and footer. Products are not labeled fictional just because the monthly dataset is demo data. When no product data is loaded, the dashboard, export area, monthly CSV metadata and PDF say **Product data not provided**. If the monthly period has no data, combined reports stay unavailable, but product-only CSV remains available for valid product results.

All parsing, aggregation and downloads remain local in the browser. Product CSV/XLSX files are never sent to a server. Tests cover calculations, weighted aggregation, loss/zero-revenue cases, required/invalid data, mapping, duplicate rows, real Excel worksheets and both templates, filtering, currency separation, formula injection, PDF pagination, failed-import preservation, reset and 390 px layout.
