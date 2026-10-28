import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateProfits, margin, summarize } from './finance.ts';
import { demoPeriods } from './demo-data.ts';

test('profit waterfall subtracts costs, operating expenses, otherExpenses and tax', () => {
  const result = calculateProfits({ month: 'Test', revenue: 100, costOfRevenue: 40, operatingExpenses: 25, otherExpenses: 5, taxes: 8 });
  assert.equal(result.grossProfit, 60);
  assert.equal(result.operatingProfit, 35);
  assert.equal(result.netProfit, 22);
});
test('demo totals reconcile', () => {
  const totals = summarize(demoPeriods);
  assert.equal(totals.revenue, 1320000);
  assert.equal(totals.netProfit, 336000);
  assert.equal(totals.operatingExpenses, 352000);
});
test('empty periods have zero profit and zero revenue has an unavailable margin', () => {
  assert.equal(summarize([]).netProfit, 0);
  assert.equal(margin(0, 0), null);
  assert.equal(margin(-10, 100), -10);
});

test('losses and other expenses excluding tax are deducted exactly once', () => {
  const result = calculateProfits({ month: '2026-01', revenue: 0, costOfRevenue: 10, operatingExpenses: 20, otherExpenses: 3, taxes: 2 });
  assert.equal(result.grossProfit, -10);
  assert.equal(result.operatingProfit, -30);
  assert.equal(result.netProfit, -35);
  assert.equal(margin(result.netProfit, result.revenue), null);
});
