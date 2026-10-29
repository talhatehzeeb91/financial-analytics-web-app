import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import Papa from 'papaparse';
import { analyzeCogs, cogsPercent } from './cogs.ts';
import { selectPeriodRange } from './date-range.ts';
import { buildReport, exportReportCsv } from './reports.ts';
import { validateMapping } from './import-financials.ts';
import { createPdfReport } from './pdf-report.ts';
const periods = [
  {month:'2026-03',revenue:0,costOfRevenue:50,operatingExpenses:0,otherExpenses:0,taxes:0},
  {month:'2026-01',revenue:1000,costOfRevenue:600,operatingExpenses:0,otherExpenses:0,taxes:0},
  {month:'2026-02',revenue:100,costOfRevenue:150,operatingExpenses:0,otherExpenses:0,taxes:0},
];
const input={periods,currencyCode:'PKR',filename:'fictional-cogs.csv',isDemo:false};
test('COGS uses period totals, sorts months, and preserves losses and zero-revenue costs',()=>{
  const result=analyzeCogs(periods);
  assert.deepEqual(result.rows.map(row=>row.month),['2026-01','2026-02','2026-03']);
  assert.equal(result.totals.cogs,800);assert.equal(result.totals.revenue,1100);assert.equal(result.totals.grossProfit,300);
  assert.equal(result.totals.cogsPercentage,800/1100*100);assert.equal(result.totals.grossMargin,300/1100*100);
  assert.equal(result.rows[1].grossProfit,-50);assert.equal(result.rows[1].cogsPercentage,150);
  assert.equal(result.rows[2].grossProfit,-50);assert.equal(result.rows[2].cogsPercentage,null);assert.equal(result.rows[2].grossMargin,null);
  assert.equal(cogsPercent(null),'N/A');assert.equal(cogsPercent(0),'0.0%');
});
test('missing or invalid COGS never becomes zero; actual zero and empty selections are distinct',()=>{
  for(const value of [undefined,null,NaN,Infinity,-1]){
    const result=analyzeCogs([{month:'2026-01',revenue:100,costOfRevenue:value}]);
    assert.equal(result.complete,false);assert.equal(result.rows[0].cogs,null);assert.equal(result.totals.cogs,null);assert.equal(result.totals.grossProfit,null);assert.equal(result.totals.cogsPercentage,null);
  }
  assert.equal(analyzeCogs([{month:'2026-01',costOfRevenue:100}]).totals.grossProfit,null);
  assert.equal(analyzeCogs([{month:'2026-01',revenue:0,costOfRevenue:0}]).complete,true);
  assert.equal(analyzeCogs([]).totals.cogs,null);
  assert.throws(()=>buildReport({...input,periods:[{...periods[0],costOfRevenue:undefined as unknown as number}]}),/Missing or invalid/);
});
test('monthly COGS blanks and unmapped columns remain validation errors; explicit zero requires confirmation',()=>{
  const sheet={name:'Monthly',headers:['Month','Revenue','COGS','OperatingExpenses','OtherExpenses','Tax'],rows:[['2026-01',100,'',0,0,0]]};
  const mapping={Month:0,Revenue:1,COGS:2,OperatingExpenses:3,OtherExpenses:4,Tax:5};
  assert.match(validateMapping(sheet,mapping,'PKR',true,false).errors.join(),/COGS must/);
  assert.match(validateMapping(sheet,{...mapping,COGS:undefined},'PKR',true,false).errors.join(),/Map COGS/);
  assert.match(validateMapping(sheet,{...mapping,COGS:'zero'},'PKR',true,false).errors.join(),/Confirm/);
  assert.equal(validateMapping(sheet,{...mapping,COGS:'zero'},'PKR',true,true).periods[0].costOfRevenue,0);
});
test('report range filters COGS; independent product costs never alter monthly totals or CSV',()=>{
  const selectedRange={from:'2026-02',to:'2026-03'};
  const report=buildReport({...input,selectedRange,productDataset:{filename:'separate.csv',currencyCode:'USD',rows:[{month:'2026-02',product:'A',unitsSold:10,revenue:1000000,productCost:900000}]}});
  assert.equal(report.cogs.totals.cogs,200);assert.equal(report.cogs.totals.grossProfit,-100);assert.equal(report.cogs.totals.cogsPercentage,200);
  assert.deepEqual(report.cogs,analyzeCogs(selectPeriodRange(periods,selectedRange).periods));
  const csv=Papa.parse<Record<string,string>>(exportReportCsv({...input,selectedRange}),{header:true,skipEmptyLines:true}).data;
  assert.deepEqual(csv.map(row=>row.COGSPercent),['150','N/A']);
  assert.ok(csv.every(row=>row.PeriodCOGS==='200'&&row.PeriodCOGSPercent==='200'&&row.PeriodGrossProfit==='-100'&&row.PeriodGrossMarginPercent==='-100'&&row.Currency==='PKR'&&row.PeriodFrom==='2026-02'));
});
test('PDF COGS summary and repeated monthly tables handle long datasets',async()=>{
  const fonts={regular:(await readFile(new URL('../public/fonts/DejaVuSans.ttf',import.meta.url))).toString('base64'),bold:(await readFile(new URL('../public/fonts/DejaVuSans-Bold.ttf',import.meta.url))).toString('base64')};
  const sample=createPdfReport(input,fonts);assert.equal(sample.getNumberOfPages(),3);
  const rows=Array.from({length:120},(_,index)=>({...periods[index%3],month:`${2020+Math.floor(index/12)}-${String(index%12+1).padStart(2,'0')}`}));
  const multi=createPdfReport({...input,periods:rows},fonts);assert.ok(multi.getNumberOfPages()>5);
  await mkdir('/tmp/ledger-cogs',{recursive:true});await writeFile('/tmp/ledger-cogs/sample.pdf',Buffer.from(sample.output('arraybuffer')));await writeFile('/tmp/ledger-cogs/multi.pdf',Buffer.from(multi.output('arraybuffer')));
});
