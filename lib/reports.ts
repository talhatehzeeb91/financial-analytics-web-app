import { summarizeProducts, type ProductDataset } from './products.ts';
import { revenueVariance, summarizeRevenueBudget } from './budget.ts';
import { datasetRange, selectPeriodRange, type MonthRange } from './date-range.ts';
import { calculateProfits, margin, summarize, type FinancialPeriod } from './finance.ts';

export type ReportInput = { periods: FinancialPeriod[]; currencyCode: string; filename: string; isDemo: boolean; selectedRange?: MonthRange; productDataset?: ProductDataset|null };
export function buildReport(input: ReportInput) {
  if (!input.periods.length) throw new Error('There is no dataset to export.');
  const selectedRange = input.selectedRange ?? datasetRange(input.periods);
  const selection = selectPeriodRange(input.periods, selectedRange);
  if (selection.error) throw new Error(selection.error);
  const rows = selection.periods.map(calculateProfits);
  const totals = summarize(rows);
  return {
    ...input, rows, totals, selectedRange, products:summarizeProducts(input.productDataset,selectedRange), revenueBudget:summarizeRevenueBudget(rows),
    source: input.isDemo ? 'Fictional demo data' : input.filename,
    label: input.isDemo ? 'FICTIONAL DEMO DATA — illustrative only' : 'Uploaded monthly summary',
    dateRange: `${selectedRange.from} to ${selectedRange.to}`,
    expenses: [
      { name:'COGS', value:totals.costOfRevenue },
      { name:'Operating expenses', value:totals.operatingExpenses },
      { name:'Other expenses (excludes tax)', value:totals.otherExpenses },
      { name:'Tax', value:totals.taxes },
    ],
    expenseTotal: totals.costOfRevenue + totals.operatingExpenses + totals.otherExpenses + totals.taxes,
  };
}
export type FinancialReport = ReturnType<typeof buildReport>;
export const reportMoney = (value: number, code: string) => new Intl.NumberFormat('en-US', { style:'currency', currency:code, currencyDisplay:'code', minimumFractionDigits:2, maximumFractionDigits:2 }).format(value);
export const reportMargin = (profit: number, revenue: number) => {
  const result = margin(profit, revenue);
  return result === null ? 'N/A' : `${result.toFixed(1)}%`;
};

// Numeric cells are trusted calculated/source numbers. Untrusted text is quoted,
// and dangerous spreadsheet prefixes are neutralized without altering numbers.
export function escapeCsvCell(value: string | number | null): string {
  if (value === null) return 'N/A';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Cannot export a non-finite amount.');
    return String(value);
  }
  const safe = /^[=+\-@]/.test(value.trimStart()) || /^[\x00-\x1f]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function exportReportCsv(input: ReportInput): string {
  const report = buildReport(input);
  const header = ['Dataset','SourceFile','Currency','Month','Revenue','COGS','OperatingExpenses','OtherExpenses','Tax','GrossProfit','OperatingProfit','NetProfit','GrossMarginPercent','OperatingMarginPercent','NetMarginPercent','PeriodFrom','PeriodTo','RevenueBudget','RevenueBudgetVariance','RevenueBudgetVariancePercent','RevenueBudgetResult','ProductDataStatus'];
  const rows = report.rows.map(row => [
    report.label, report.source, report.currencyCode, row.month,
    row.revenue,row.costOfRevenue,row.operatingExpenses,row.otherExpenses,row.taxes,
    row.grossProfit,row.operatingProfit,row.netProfit,
    margin(row.grossProfit,row.revenue),margin(row.operatingProfit,row.revenue),margin(row.netProfit,row.revenue),
    report.selectedRange.from, report.selectedRange.to,
    row.revenueBudget ?? '', revenueVariance(row.revenue,row.revenueBudget).amount, revenueVariance(row.revenue,row.revenueBudget).percentage, revenueVariance(row.revenue,row.revenueBudget).outcome, report.products.status,
  ]);
  return '\uFEFF' + [header, ...rows].map(row => row.map(escapeCsvCell).join(',')).join('\r\n') + '\r\n';
}

// Product results use their own CSV, so monthly financial values and currencies
// can never be accidentally summed with product-level measures.
export function exportProductCsv(dataset: ProductDataset, range: MonthRange): string {
  const result=summarizeProducts(dataset,range);
  if(!result.rows.length)throw new Error(result.status);
  const head=['ProductSourceFile','Currency','PeriodFrom','PeriodTo','Product','UnitsSold','Revenue','ProductCost','GrossProfit','GrossMarginPercent'];
  const rows=result.rows.map(row=>[dataset.filename,dataset.currencyCode,range.from,range.to,row.product,row.unitsSold,row.revenue,row.productCost,row.grossProfit,row.grossMargin]);
  return '\uFEFF'+[head,...rows].map(row=>row.map(escapeCsvCell).join(',')).join('\r\n')+'\r\n';
}
