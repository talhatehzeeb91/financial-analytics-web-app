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

Gross profit = revenue − cost of revenue. Operating profit = gross profit − operating expenses. Net profit = operating profit − other expenses − taxes. Margins divide the corresponding profit by revenue; zero revenue returns a zero margin. The expense donut shows **total expenses**, including COGS, operating expenses, other expenses, and tax. Categories reconcile to the total deductions from revenue. Zero expenses show an explicit empty state. The monthly table provides exact chart figures in an accessible format.

No environment variables, secrets, external fonts, database, or external data service are required.

## Restricted cloud environments

Keep the environment's configured HTTPS proxy and TLS verification enabled. If npm cannot reach the proxy or registry, source files remain usable, but lint, type checking, build, and application startup require a successful dependency installation. Do not treat missing-dependency errors as successful validation. The financial tests use Node's built-in runner and can execute without npm dependencies on Node.js 24.

## Local CSV and Excel import

Use the CSV or XLSX template, or choose your own monthly summary file. Parsing happens locally with Papa Parse and read-excel-file; financial records are never sent to a server or persisted. A refresh or **Reset to demo** restores the fictional USD dataset.

1. Select a `.csv` or `.xlsx` file. For Excel, explicitly select a worksheet; only that sheet is analyzed.
2. Preview the headers and first five non-empty data rows. The first non-empty row must contain unique column headers.
3. Map your columns to Month, Revenue, COGS, OperatingExpenses, OtherExpenses and Tax. Names do not need to match. Common aliases such as Period, Sales, Cost of Sales, Opex and Taxes are suggested; ambiguous matches remain unassigned. Confirm the mappings yourself. Each source column can be used once; extra unmapped columns are ignored.
4. Month and Revenue must map to real source columns. Every expense must map to a column or explicitly use **Not applicable — use 0**. This choice requires a separate confirmation; missing financial columns never silently become zero. Blank cells in mapped financial columns remain invalid.
5. Select the currency already used by the whole file: USD, PKR, AED, GBP or EUR. Every card, chart and table uses that currency code. Amounts are not converted or detected automatically. Templates contain fictional USD data.
6. Click **Validate and review**, then inspect the month count, range, currency, totals and zero-expense fields. The dashboard changes only after **Import and analyze**. Editing a mapping, worksheet, currency or confirmation invalidates the review; validate again before importing.

### Monthly-summary requirements

The expandable **How to prepare your data** guide includes a sample table and plain-English field definitions. Both downloadable templates contain the same three fictional months and are covered by parser/mapping tests.

```csv
Month,Revenue,COGS,OperatingExpenses,OtherExpenses,Tax
2026-01,182000,76000,54000,2000,10000
```

Prepare one row per month, not individual sales or invoices. Month must be YYYY-MM (year 0001–9999); store Excel months as text, not date cells. Months must be unique. Amounts must be finite non-negative numbers without currency symbols or thousands separators. Enter 0 when an amount does not apply, or explicitly confirm a zero mapping for the expense field. Do not use merged cells or total/subtotal rows. Expense categories must not overlap; each cost is counted once, and OtherExpenses excludes Tax.

Maximum file size: 5 MB; maximum data rows per selected sheet: 1,000; maximum individual amount: 1 trillion in the selected currency. Blank rows are ignored. Validation reports missing mappings, duplicate mappings/headers/months, invalid values with row and field names, empty files and unreadable workbooks. Reported validation row numbers count non-empty data rows, with the header counted as row 1.

Product profitability requires product-level sales and costs, while budget variance requires a separate budget dataset; neither is provided by this monthly upload. No currency conversion, transaction aggregation or budget/category inference is performed.

### Validation

`npm test` runs calculation, strict-template parser and flexible-mapping tests, including real XLSX workbooks, multiple worksheets, downloadable templates, alias ambiguity, required confirmations, duplicate mappings, missing fields, explicit zero choices and currency formatting without conversion. `write-excel-file` is a development-only fixture generator. The browser workflow is checked against the production build, including review invalidation, worksheet switching, import/reset and consistent currency labels.

To reproduce the browser check, run `npm run build`, install Chromium with `npx playwright install chromium`, then run `npm run test:e2e`. If Chromium is already installed by the environment, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable instead (verified here with `/usr/bin/chromium`). Playwright starts and stops its own production server on port 3010, creates a multi-worksheet XLSX fixture and writes a mapping screenshot under `test-results/`. Do not run another server on that port. These generated artifacts are ignored by Git.

The six-month regression fixture at `tests/fixtures/fictional-pkr-six-months.csv` intentionally has nonstandard headers and unsorted months. It includes a loss-making March and a zero-revenue April. Expected PKR totals are revenue 5,000,000, gross profit 2,170,000, operating profit 1,070,000 and net profit 760,000. Browser checks cover every monthly chart tooltip, sorted table values, aggregate margins, zero-revenue KPI margins, 390 px mapping controls, singular/plural messages and active-source identity. The dashboard retains the active filename until a new import is confirmed or Reset to demo is used; selecting or failing to read another file does not relabel active data.
