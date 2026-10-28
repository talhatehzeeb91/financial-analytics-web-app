import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readSourceFile, validateMapping, type Mapping } from './import-financials.ts';
import { calculateProfits, margin, summarize } from './finance.ts';

test('fictional six-month PKR fixture sorts, reconciles totals, losses and zero-revenue margins', async () => {
  const bytes = await readFile(new URL('../tests/fixtures/fictional-pkr-six-months.csv', import.meta.url));
  const [source] = await readSourceFile(new File([bytes], 'fictional-pkr-six-months.csv'));
  const mapping: Mapping = { Month:0, Revenue:1, COGS:2, OperatingExpenses:3, OtherExpenses:4, Tax:5 };
  const result = validateMapping(source, mapping, 'PKR', true, false);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.periods.map(period => period.month), ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06']);
  const monthly = result.periods.map(calculateProfits);
  assert.deepEqual(monthly.map(period => [period.grossProfit, period.operatingProfit, period.netProfit]), [
    [400000,200000,150000], [550000,330000,260000], [100000,-80000,-110000],
    [0,-50000,-55000], [420000,220000,175000], [700000,450000,340000],
  ]);
  const totals = summarize(result.periods);
  assert.deepEqual([totals.revenue,totals.grossProfit,totals.operatingProfit,totals.netProfit], [5000000,2170000,1070000,760000]);
  assert.deepEqual([totals.costOfRevenue,totals.operatingExpenses,totals.otherExpenses,totals.taxes], [2830000,1100000,175000,135000]);
  assert.equal(margin(totals.netProfit,totals.revenue),15.2);
  for (const profit of [monthly[3].grossProfit,monthly[3].operatingProfit,monthly[3].netProfit]) assert.equal(margin(profit,0),null);
});
