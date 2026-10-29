import type { FinancialPeriod } from './finance';

// Fictional USD figures for a demonstration business; not actual financial records.
export const demoPeriods: FinancialPeriod[] = [
  { month: '2026-01', revenueBudget: 180000, revenue: 182000, costOfRevenue: 76000, operatingExpenses: 54000, otherExpenses: 2000, taxes: 10000 },
  { month: '2026-02', revenueBudget: 205000, revenue: 198000, costOfRevenue: 81000, operatingExpenses: 56000, otherExpenses: 2000, taxes: 12000 },
  { month: '2026-03', revenueBudget: 200000, revenue: 191000, costOfRevenue: 79000, operatingExpenses: 55000, otherExpenses: 2000, taxes: 11000 },
  { month: '2026-04', revenueBudget: 220000, revenue: 224000, costOfRevenue: 91000, operatingExpenses: 59000, otherExpenses: 2000, taxes: 15000 },
  { month: '2026-05', revenueBudget: 250000, revenue: 246000, costOfRevenue: 98000, operatingExpenses: 62000, otherExpenses: 2000, taxes: 17000 },
  { month: '2026-06', revenueBudget: 270000, revenue: 279000, costOfRevenue: 109000, operatingExpenses: 66000, otherExpenses: 2000, taxes: 21000 },
];
