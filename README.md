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
npm test           # Financial calculation and demo reconciliation tests
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

Use **Download sample CSV** for a fictional template, then choose a `.csv` or `.xlsx` file. All parsing happens locally using Papa Parse and read-excel-file; no financial records are sent to a server or persisted. A refresh or **Reset to demo** returns to fictional defaults. Invalid uploads leave the current dataset intact.

Required column names (case-sensitive, order-independent):

```csv
Month,Revenue,COGS,OperatingExpenses,OtherExpenses,Tax
2026-01,182000,76000,54000,2000,10000
```

`Month` must be YYYY-MM (year 0001–9999). Store Excel months as text, not date cells. Each month must be unique. Amounts must be non-negative finite numbers with no currency symbols or thousands separators; blank amounts are invalid. **OtherExpenses excludes tax**. All amounts are interpreted as USD. For XLSX, only the first worksheet is used; additional worksheets are ignored. Maximum file size: 5 MB; maximum data rows: 1,000; maximum individual amount: $1 trillion. Blank rows are ignored. No budget or category detail is inferred.

The import updates all KPIs, both charts, the date range and the monthly table. Months are sorted chronologically. Net profit = revenue − COGS − operating expenses − other expenses − tax. Losses are supported and zero revenue yields a zero margin. Validation reports missing or duplicate headers, invalid values with row and column names, duplicate months, empty files and unreadable workbooks.

Parser tests include an actual generated XLSX workbook, CSV quoting and sorting, invalid input rejection and file limits. `write-excel-file` is a development-only fixture generator.

### Preparing a monthly summary

The expandable **How to prepare your data** guide beside the file chooser includes a sample table, definitions of all six columns and a checklist. Download either `/financial-template.csv` or `/financial-template.xlsx`; both contain the same three fictional months and are covered by a parser import test.

Prepare one row per month, not individual sales or invoices. Enter 0 for amounts that do not apply. Do not use merged cells or total/subtotal rows. Expense categories must not overlap: each cost is counted once, and OtherExpenses excludes Tax. Use one currency per file. The dashboard always displays USD ($) and performs no currency detection or conversion; convert your figures to USD yourself before importing. Product profitability requires product-level sales and costs, while budget variance requires a separate budget dataset; neither is provided by this monthly upload.
