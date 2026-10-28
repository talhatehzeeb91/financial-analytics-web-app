import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Papa from 'papaparse';
import { datasetRange, selectPeriodRange } from './date-range.ts';
import { readSourceFile, validateMapping } from './import-financials.ts';
import { summarize } from './finance.ts';
import { buildReport, exportReportCsv, reportMargin } from './reports.ts';

async function fixture() {
  const bytes=await readFile(new URL('../tests/fixtures/fictional-pkr-six-months.csv',import.meta.url));
  const [source]=await readSourceFile(new File([bytes],'six-months.csv'));
  return validateMapping(source,{Month:0,Revenue:1,COGS:2,OperatingExpenses:3,OtherExpenses:4,Tax:5},'PKR',true,false).periods;
}

test('inclusive filtering sorts selected records without discarding or mutating the full dataset',async()=>{
  const full=(await fixture()).reverse(), before=JSON.stringify(full);
  assert.deepEqual(datasetRange(full),{from:'2026-01',to:'2026-06'});
  const selected=selectPeriodRange(full,{from:'2026-02',to:'2026-04'});
  assert.equal(selected.error,'');
  assert.deepEqual(selected.periods.map(row=>row.month),['2026-02','2026-03','2026-04']);
  assert.equal(JSON.stringify(full),before);
  assert.equal(selectPeriodRange(full,datasetRange(full)).periods.length,6);
});
test('weighted margins come from selected totals, including losses and a zero-revenue month',async()=>{
  const full=await fixture();
  const selected=selectPeriodRange(full,{from:'2026-02',to:'2026-04'});
  const total=summarize(selected.periods);
  assert.deepEqual([total.revenue,total.grossProfit,total.operatingProfit,total.netProfit],[1600000,650000,200000,95000]);
  assert.equal(reportMargin(total.grossProfit,total.revenue),'40.6%');
  assert.equal(reportMargin(total.operatingProfit,total.revenue),'12.5%');
  assert.equal(reportMargin(total.netProfit,total.revenue),'5.9%');
  const zero=summarize(selectPeriodRange(full,{from:'2026-04',to:'2026-04'}).periods);
  assert.equal(zero.netProfit,-55000);
  assert.equal(reportMargin(zero.netProfit,zero.revenue),'N/A');
});
test('invalid, missing and empty ranges are distinguishable and cannot generate empty exports',async()=>{
  const full=await fixture();
  for(const range of [{from:'2026-05',to:'2026-04'},{from:'',to:'2026-04'},{from:'2026-13',to:'2027-01'}]) {
    const selected=selectPeriodRange(full,range);
    assert.equal(selected.valid,false);assert.ok(selected.error);assert.equal(selected.periods.length,0);
    assert.throws(()=>exportReportCsv({periods:full,selectedRange:range,currencyCode:'PKR',filename:'six.csv',isDemo:false}));
  }
  const range={from:'2027-01',to:'2027-03'};
  const selected=selectPeriodRange(full,range);
  assert.equal(selected.valid,true);assert.match(selected.error,/No data/);
  assert.throws(()=>buildReport({periods:full,selectedRange:range,currencyCode:'PKR',filename:'six.csv',isDemo:false}),/No data/);
});
test('reports and CSV use only selected values and label requested boundaries, even beyond recorded months',async()=>{
  const full=await fixture();
  const input={periods:full,selectedRange:{from:'2026-02',to:'2026-04'},currencyCode:'PKR',filename:'six.csv',isDemo:false};
  const report=buildReport(input);
  assert.equal(report.dateRange,'2026-02 to 2026-04');
  assert.equal(report.totals.netProfit,95000);
  const parsed=Papa.parse<Record<string,string>>(exportReportCsv(input),{header:true,skipEmptyLines:true});
  assert.deepEqual(parsed.errors,[]);assert.equal(parsed.data.length,3);
  assert.deepEqual(parsed.data.map(row=>row.Month),['2026-02','2026-03','2026-04']);
  assert.equal(parsed.data.reduce((sum,row)=>sum+Number(row.NetProfit),0),95000);
  assert.ok(parsed.data.every(row=>row.PeriodFrom==='2026-02'&&row.PeriodTo==='2026-04'&&row.Currency==='PKR'));
  assert.equal(parsed.data[2].NetMarginPercent,'N/A');
  assert.equal(buildReport({...input,selectedRange:{from:'2025-12',to:'2026-02'}}).dateRange,'2025-12 to 2026-02');
});
