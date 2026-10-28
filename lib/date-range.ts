import type { FinancialPeriod } from './finance.ts';

export type MonthRange = { from: string; to: string };
const validMonth = (value: string) => /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value);

export function datasetRange(periods: FinancialPeriod[]): MonthRange {
  const months = periods.map(period=>period.month).sort();
  return { from:months[0] ?? '', to:months.at(-1) ?? '' };
}
export function selectPeriodRange(periods: FinancialPeriod[], range: MonthRange) {
  if (!validMonth(range.from) || !validMonth(range.to)) return { periods:[] as FinancialPeriod[], error:'Choose both From month and To month using valid months (YYYY-MM).', valid:false };
  if (range.from > range.to) return { periods:[] as FinancialPeriod[], error:'From month must be on or before To month.', valid:false };
  const selected = periods.filter(period=>period.month>=range.from && period.month<=range.to).sort((a,b)=>a.month.localeCompare(b.month));
  return { periods:selected, error:selected.length ? '' : 'No data in this period. Choose another range or use All months. Your full dataset is unchanged.', valid:true };
}
