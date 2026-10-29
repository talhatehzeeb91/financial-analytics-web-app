import type { FinancialPeriod } from './finance.ts';
const valid = (value: number | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function cogsBudgetVariance(actual: number | undefined, budget: number | undefined) {
  const safeBudget = valid(budget) ? budget : null;
  const amount = !valid(actual) || safeBudget === null ? null : safeBudget - actual;
  return { budget: safeBudget, amount, percentage: amount === null || safeBudget === 0 ? null : amount / safeBudget! * 100,
    outcome: safeBudget === null ? 'Budget not provided' : amount === null ? 'Actual COGS unavailable' : amount > 0 ? 'Favorable' : amount < 0 ? 'Adverse' : 'On budget' };
}
export function summarizeCogsBudget(periods: FinancialPeriod[]) {
  const rows = [...periods].sort((a,b)=>a.month.localeCompare(b.month)).map(row=>({...row,...cogsBudgetVariance(row.costOfRevenue,row.cogsBudget)}));
  const provided = rows.filter(row=>row.budget !== null).length;
  const complete = rows.length > 0 && provided === rows.length;
  const actual = rows.length > 0 && rows.every(row=>valid(row.costOfRevenue)) ? rows.reduce((sum,row)=>sum+row.costOfRevenue,0) : undefined;
  const budget = complete ? rows.reduce((sum,row)=>sum+row.budget!,0) : undefined;
  return { rows, provided, count:rows.length, complete, actual: actual ?? null, ...cogsBudgetVariance(actual,budget),
    status: !provided ? 'COGS budget not provided' : complete ? 'Complete COGS budget coverage' : `COGS budget incomplete: ${provided} of ${rows.length} months provided` };
}
