export type FinancialPeriod = {
  month: string;
  revenue: number;
  costOfRevenue: number;
  operatingExpenses: number;
  interest: number;
  taxes: number;
};

export function calculateProfits(period: FinancialPeriod) {
  const grossProfit = period.revenue - period.costOfRevenue;
  const operatingProfit = grossProfit - period.operatingExpenses;
  const netProfit = operatingProfit - period.interest - period.taxes;
  return { ...period, grossProfit, operatingProfit, netProfit };
}

export function summarize(periods: FinancialPeriod[]) {
  const totals = periods.reduce((sum, period) => ({
    month: 'Total',
    revenue: sum.revenue + period.revenue,
    costOfRevenue: sum.costOfRevenue + period.costOfRevenue,
    operatingExpenses: sum.operatingExpenses + period.operatingExpenses,
    interest: sum.interest + period.interest,
    taxes: sum.taxes + period.taxes,
  }), { month: 'Total', revenue: 0, costOfRevenue: 0, operatingExpenses: 0, interest: 0, taxes: 0 });
  return calculateProfits(totals);
}

export function margin(profit: number, revenue: number) {
  return revenue === 0 ? 0 : profit / revenue * 100;
}

export const currency = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(value);
