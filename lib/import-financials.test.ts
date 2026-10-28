import test from 'node:test';
import assert from 'node:assert/strict';
import writeXlsxFile from 'write-excel-file/node';
import { columns, parseCsv, parseFinancialFile, validateRows, MAX_FILE_BYTES } from './import-financials.ts';
import { calculateProfits, summarize } from './finance.ts';
const header = columns.join(',');
const csv = `${header}\n2025-12,100,40,20,5,10\n2025-01,200,80,30,10,20`;

test('CSV parses, sorts months, and reconciles uploaded profit calculations', () => {
  const result = parseCsv('\uFEFF' + csv);
  assert.deepEqual(result.errors, []);
  assert.equal(result.periods[0].month, '2025-01');
  assert.equal(summarize(result.periods).netProfit, 85);
  assert.equal(calculateProfits(result.periods[1]).operatingProfit, 40);
});
test('missing headers, duplicate headers and empty files have useful errors', () => {
  assert.match(parseCsv('Month,Revenue\n2026-01,10').errors.join(), /Missing required columns: COGS/);
  assert.match(parseCsv(`${header},Revenue\n2026-01,1,0,0,0,0,1`).errors.join(), /Duplicate column/);
  for (const input of ['', '\n\n', header]) assert.match(parseCsv(input).errors.join(), /empty|no data rows/);
});
test('invalid months, duplicate months and invalid numeric values reject the whole import', () => {
  for (const month of ['2026-13', 'Jan', '2026-1', '0000-01']) assert.match(parseCsv(`${header}\n${month},1,0,0,0,0`).errors.join(), /YYYY-MM/);
  for (const value of ['-1', 'NaN', 'Infinity', '$100', '', '1e309', '1000000000001']) assert.match(parseCsv(`${header}\n2026-01,${value},0,0,0,0`).errors.join(), /Row 2: Revenue/);
  const result = parseCsv(`${header}\n2026-01,10,0,0,0,0\n2026-01,20,0,0,0,0`);
  assert.match(result.errors.join(), /Row 3: duplicate month/);
  assert.equal(result.periods.length, 0);
});
test('quoted CSV, reordered columns and zero values are supported', () => {
  const result = parseCsv('Revenue,Month,COGS,OperatingExpenses,OtherExpenses,Tax\r\n"0","2026-01",0,0,0,0');
  assert.deepEqual(result.errors, []);
  assert.equal(summarize(result.periods).netProfit, 0);
  assert.ok(parseCsv(`${header}\n"2026-01,1,0,0,0,0`).errors.length > 0);
});
test('real XLSX workbook parses locally and matches CSV output', async () => {
  const buffer = await writeXlsxFile([
    columns.map(value => ({ type: String, value })),
    [{ type: String, value: '2025-12' }, ...[100,40,20,5,10].map(value => ({ type: Number, value }))],
    [{ type: String, value: '2025-01' }, ...[200,80,30,10,20].map(value => ({ type: Number, value }))],
  ]).toBuffer();
  const result = await parseFinancialFile(new File([new Uint8Array(buffer)], 'financials.xlsx'));
  assert.deepEqual(result, parseCsv(csv));
});
test('file type, size, empty and corrupt workbook errors are actionable', async () => {
  for (const [file, message] of [
    [new File([], 'empty.csv'), /empty/],
    [new File(['abc'], 'data.pdf'), /Unsupported/],
    [new File(['not a workbook'], 'bad.xlsx'), /Could not read/],
    [new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'big.csv'), /too large/],
  ] as const) assert.match((await parseFinancialFile(file)).errors.join(), message);
  assert.match(validateRows([columns.slice(), ...Array.from({ length: 1001 }, () => ['2026-01',0,0,0,0,0])]).errors.join(), /at most 1000/);
});
