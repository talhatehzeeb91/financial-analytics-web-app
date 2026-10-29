export type FinancialPeriod = {
  month: string;
  revenue: number;
  costOfRevenue: number;
  operatingExpenses: number;
  otherExpenses: number;
  taxes: number;
  revenueBudget?: number;
};

export function calculateProfits(period: FinancialPeriod) {
  const grossProfit = period.revenue - period.costOfRevenue;
  const operatingProfit = grossProfit - period.operatingExpenses;
  const netProfit = operatingProfit - period.otherExpenses - period.taxes;
  return { ...period, grossProfit, operatingProfit, netProfit };
}

export function summarize(periods: FinancialPeriod[]) {
  const totals = periods.reduce((sum, period) => ({
    month: 'Total',
    revenue: sum.revenue + period.revenue,
    costOfRevenue: sum.costOfRevenue + period.costOfRevenue,
    operatingExpenses: sum.operatingExpenses + period.operatingExpenses,
    otherExpenses: sum.otherExpenses + period.otherExpenses,
    taxes: sum.taxes + period.taxes,
  }), { month: 'Total', revenue: 0, costOfRevenue: 0, operatingExpenses: 0, otherExpenses: 0, taxes: 0 });
  return calculateProfits(totals);
}

export function margin(profit: number, revenue: number) {
  return revenue === 0 ? null : profit / revenue * 100;
}

export const currency = (value: number, currencyCode = 'USD') => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: currencyCode, currencyDisplay: 'code', maximumFractionDigits: 0,
}).format(value);
