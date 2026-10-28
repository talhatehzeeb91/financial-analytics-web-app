# Ledger — Financial analytics dashboard

A responsive Next.js application using TypeScript, Tailwind CSS v4, the App Router, and Recharts. All figures are **fictional demo data**, labeled throughout the interface. There are no connected accounts, authentication, Supabase, or deployment integrations.

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
- `components/financial-charts.tsx`: Client-side Recharts visualizations; the dashboard page is a Server Component.
- `lib/demo-data.ts`: Fictional monthly records and operating expense categories, in USD, for January–June 2026.
- `lib/finance.ts`: Pure calculations and currency formatting, separate from UI components.
- `lib/finance.test.ts`: Profit waterfall, aggregation, reconciliation, and zero-revenue checks.

Gross profit = revenue − cost of revenue. Operating profit = gross profit − operating expenses. Net profit = operating profit − interest − taxes. Margins divide the corresponding profit by revenue; zero revenue returns a zero margin. The expense donut shows **operating expenses only**, excluding cost of revenue, interest, and taxes. The category totals reconcile to the period's operating expenses. The monthly table provides exact chart figures in an accessible format.

No environment variables, secrets, external fonts, database, or external data service are required.

## Restricted cloud environments

Keep the environment's configured HTTPS proxy and TLS verification enabled. If npm cannot reach the proxy or registry, source files remain usable, but lint, type checking, build, and application startup require a successful dependency installation. Do not treat missing-dependency errors as successful validation. The financial tests use Node's built-in runner and can execute without npm dependencies on Node.js 24.
