import type { FinancialPeriod } from './finance.ts';

export function revenueVariance(actual: number, budget: number | undefined) {
  const amount = budget === undefined ? null : actual - budget;
  return {
    budget: budget ?? null, amount,
    percentage: budget === undefined || budget === 0 ? null : (actual-budget)/budget*100,
    outcome: amount === null ? 'Budget not provided' : amount > 0 ? 'Favorable' : amount < 0 ? 'adverse' : 'On budget',
  };
}
export function summarizeRevenueBudget(periods: FinancialPeriod[]) {
  const provided=periods.filter(period=>period.revenueBudget !== undefined);
  const complete=periods.length>0 && provided.length===periods.length;
  const actual=periods.reduce((sum,period)=>sum+period.revenue,0);
  const budget=complete ? provided.reduce((sum,period)=>sum+period.revenueBudget!,0) : undefined;
  return { actual, ...revenueVariance(actual,budget), provided:provided.length, count:periods.length, complete,
    status:provided.length===0 ? 'Budget not provided' : complete ? 'Complete budget coverage' : `Budget incomplete: ${provided.length} of ${periods.length} months provided`,
    rows:periods.map(period=>({...period,...revenueVariance(period.revenue,period.revenueBudget)})),
  };
}
export const variancePercent=(value: number|null)=>value===null?'N/A':`${value.toFixed(1)}%`;
