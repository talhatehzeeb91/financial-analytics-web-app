import test from 'node:test';
import assert from 'node:assert/strict';
import { mappingColumns, readSourceFile, suggestMapping, validateMapping, type Mapping, type SourceSheet } from './import-financials.ts';
import { currency, summarize } from './finance.ts';
import writeXlsxFile from 'write-excel-file/node';
const sheet: SourceSheet = { name: 'Summary', headers: ['Period','Sales','Cost of sales','Opex','Other costs','Taxes'], rows: [['2025-12',1000,100,200,30,70],['2025-01',2000,200,400,60,140]] };
const mapping = suggestMapping(sheet.headers);

test('common aliases suggest unique mappings; ambiguous and missing fields stay unassigned', () => {
  assert.deepEqual(mapping, { Month:0, Revenue:1, COGS:2, OperatingExpenses:3, OtherExpenses:4, Tax:5 });
  assert.equal(suggestMapping(['Month','Sales','Revenue']).Revenue, undefined);
  assert.equal(suggestMapping(['Month','Sales']).COGS, undefined);
  assert.equal(suggestMapping(['Reporting Month','Total Revenue'])?.Revenue, 1);
});
test('confirmation and currency are mandatory; missing expense columns never default to zero', () => {
  assert.match(validateMapping(sheet, mapping, 'USD', false, false).errors.join(), /Confirm/);
  assert.match(validateMapping(sheet, mapping, '', true, false).errors.join(), /currency/);
  assert.match(validateMapping(sheet, mapping, 'JPY', true, false).errors.join(), /currency/);
  const incomplete = { ...mapping, Tax: undefined };
  assert.match(validateMapping(sheet, incomplete, 'USD', true, true).errors.join(), /Map Tax/);
});
test('duplicate, out-of-range, fractional and invalid required mappings are rejected', () => {
  for (const bad of [{ ...mapping, COGS:1 }, { ...mapping, Revenue:20 }, { ...mapping, Month:'zero' }, { ...mapping, Month:0.5 }] as Mapping[]) {
    assert.ok(validateMapping(sheet, bad, 'USD', true, true).errors.length);
  }
  assert.match(validateMapping({ ...sheet, headers:['Period','Sales','Sales'] }, mapping, 'USD', true, true).errors.join(), /Duplicate column names/);
});
test('zero expenses require explicit mapping and separate confirmation; required fields cannot use zero', () => {
  const chosen: Mapping = { Month:0, Revenue:1, COGS:'zero', OperatingExpenses:'zero', OtherExpenses:'zero', Tax:'zero' };
  assert.match(validateMapping(sheet, chosen, 'PKR', true, false).errors.join(), /should use 0/);
  const result = validateMapping(sheet, chosen, 'PKR', true, true);
  assert.deepEqual(result.errors, []);
  assert.equal(summarize(result.periods).netProfit, 3000);
  assert.equal(result.periods[0].month, '2025-01');
});
test('mapped validation preserves month, duplicate and numeric constraints', () => {
  const result = validateMapping({ ...sheet, rows:[['2025-13',-1,0,0,0,0],['2025-13',1,0,0,0,0]] }, mapping, 'EUR', true, false);
  assert.match(result.errors.join(), /YYYY-MM/);
  assert.match(result.errors.join(), /duplicate month/);
  assert.match(result.errors.join(), /Revenue must be a non-negative/);
  assert.equal(result.periods.length, 0);
});
test('currency codes change formatting without changing calculated amounts', () => {
  for (const code of ['USD','PKR','AED','GBP','EUR']) {
    const result = validateMapping(sheet, mapping, code, true, false);
    assert.equal(summarize(result.periods).netProfit, 1800);
    assert.ok(currency(1800, code).includes(code));
    assert.ok(currency(1800, code).includes('1,800'));
  }
});
test('source reader preserves all worksheets and different headers for explicit selection', async () => {
  const buffer = await writeXlsxFile([
    { sheet:'Notes', data:[[{type:String,value:'Notes'}],[{type:String,value:'Not monthly data'}]] },
    { sheet:'Monthly', data:[sheet.headers.map(value=>({type:String,value})), ...sheet.rows.map(row=>row.map(value=>typeof value === 'string' ? {type:String,value} : {type:Number,value:value as number}))] },
  ]).toBuffer();
  const sources = await readSourceFile(new File([new Uint8Array(buffer)],'multi.xlsx'));
  assert.deepEqual(sources.map(source=>source.name), ['Notes','Monthly']);
  assert.ok(validateMapping(sources[0], suggestMapping(sources[0].headers), 'USD', true, false).errors.length);
  assert.deepEqual(validateMapping(sources[1], suggestMapping(sources[1].headers), 'AED', true, false).errors, []);
});
test('downloadable templates work through preview and mapping flow', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const extension of ['csv','xlsx']) {
    const bytes = await readFile(new URL(`../public/financial-template.${extension}`,import.meta.url));
    const [source] = await readSourceFile(new File([bytes],`template.${extension}`));
    assert.deepEqual(source.headers, mappingColumns.slice());
    const result = validateMapping(source,suggestMapping(source.headers),'USD',true,false);
    assert.equal(result.periods.length,3);
    assert.deepEqual(result.errors,[]);
  }
});
