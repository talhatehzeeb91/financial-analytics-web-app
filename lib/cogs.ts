// Monthly financial measures only. Product datasets are deliberately not accepted.
export type CogsPeriod = { month: string; revenue?: number | null; costOfRevenue?: number | null };
const amount = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
export const cogsPercent = (value: number | null) => value === null ? 'N/A' : `${value.toFixed(1)}%`;
function measures(revenue: number | null, cogs: number | null) {
  const grossProfit = revenue === null || cogs === null ? null : revenue - cogs;
  return { revenue, cogs, grossProfit,
    cogsPercentage: revenue === null || revenue === 0 || cogs === null ? null : cogs / revenue * 100,
    grossMargin: revenue === null || revenue === 0 || grossProfit === null ? null : grossProfit / revenue * 100 };
}
export function analyzeCogs(periods: CogsPeriod[]) {
  const rows = [...periods].sort((a,b) => a.month.localeCompare(b.month))
    .map(row => ({ month: row.month, ...measures(amount(row.revenue), amount(row.costOfRevenue)) }));
  const complete = rows.length > 0 && rows.every(row => row.revenue !== null && row.cogs !== null);
  const sum = (key: 'revenue' | 'cogs') => rows.length && rows.every(row => row[key] !== null)
    ? rows.reduce((total,row) => total + row[key]!, 0) : null;
  return { rows, complete, totals: measures(sum('revenue'), sum('cogs')),
    status: !rows.length ? 'No monthly data in this period.' : complete ? 'Monthly COGS analysis' : 'Missing or invalid monthly revenue or COGS. Incomplete totals and percentages are unavailable; missing values are never zero.' };
}
