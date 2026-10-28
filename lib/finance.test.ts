import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateProfits, margin, summarize } from './finance.ts';
import { demoPeriods, demoOperatingExpenses } from './demo-data.ts';

test('profit waterfall subtracts costs, operating expenses, interest and tax', () => {
  const result = calculateProfits({ month: 'Test', revenue: 100, costOfRevenue: 40, operatingExpenses: 25, interest: 5, taxes: 8 });
  assert.equal(result.grossProfit, 60);
  assert.equal(result.operatingProfit, 35);
  assert.equal(result.netProfit, 22);
});
test('demo totals and expense breakdown reconcile', () => {
  const totals = summarize(demoPeriods);
  assert.equal(totals.revenue, 1320000);
  assert.equal(totals.netProfit, 336000);
  assert.equal(demoOperatingExpenses.reduce((sum, expense) => sum + expense.value, 0), totals.operatingExpenses);
});
test('empty periods and zero revenue produce finite zero values', () => {
  assert.equal(summarize([]).netProfit, 0);
  assert.equal(margin(0, 0), 0);
  assert.equal(margin(-10, 100), -10);
});
