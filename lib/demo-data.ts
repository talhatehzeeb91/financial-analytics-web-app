import type { FinancialPeriod } from './finance';

// Fictional USD figures for a demonstration business; not actual financial records.
export const demoPeriods: FinancialPeriod[] = [
  { month: 'Jan', revenue: 182000, costOfRevenue: 76000, operatingExpenses: 54000, interest: 2000, taxes: 10000 },
  { month: 'Feb', revenue: 198000, costOfRevenue: 81000, operatingExpenses: 56000, interest: 2000, taxes: 12000 },
  { month: 'Mar', revenue: 191000, costOfRevenue: 79000, operatingExpenses: 55000, interest: 2000, taxes: 11000 },
  { month: 'Apr', revenue: 224000, costOfRevenue: 91000, operatingExpenses: 59000, interest: 2000, taxes: 15000 },
  { month: 'May', revenue: 246000, costOfRevenue: 98000, operatingExpenses: 62000, interest: 2000, taxes: 17000 },
  { month: 'Jun', revenue: 279000, costOfRevenue: 109000, operatingExpenses: 66000, interest: 2000, taxes: 21000 },
];

// Operating expense categories reconcile to the six-month operating expense total.
export const demoOperatingExpenses = [
  { name: 'People & payroll', value: 193600, color: '#0d9488' },
  { name: 'Sales & marketing', value: 70400, color: '#2dd4bf' },
  { name: 'Software & tools', value: 52800, color: '#99f6e4' },
  { name: 'Office & other', value: 35200, color: '#cbd5e1' },
];
