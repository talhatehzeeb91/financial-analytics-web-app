import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import Papa from 'papaparse';
import writeXlsxFile from 'write-excel-file/node';
import { revenueVariance, summarizeRevenueBudget } from './budget.ts';
import { parseCsv, parseFinancialFile, readSourceFile, suggestMapping, validateMapping } from './import-financials.ts';
import { buildReport, exportReportCsv } from './reports.ts';
import { createPdfReport } from './pdf-report.ts';
import { demoPeriods } from './demo-data.ts';
const header='Month,Revenue,COGS,OperatingExpenses,OtherExpenses,Tax';
const csv=header+',RevenueBudget\n2026-01,1000,100,100,10,10,800\n2026-02,500,100,100,10,10,1000\n2026-03,200,100,50,0,0,0\n2026-04,300,100,100,0,0,';

test('positive, negative, equal, zero and missing budgets have distinct revenue variance semantics',()=>{
  assert.deepEqual(revenueVariance(1000,800),{budget:800,amount:200,percentage:25,outcome:'Favorable'});
  assert.deepEqual(revenueVariance(500,1000),{budget:1000,amount:-500,percentage:-50,outcome:'adverse'});
  assert.deepEqual(revenueVariance(200,0),{budget:0,amount:200,percentage:null,outcome:'Favorable'});
  assert.equal(revenueVariance(0,0).outcome,'On budget');
  assert.equal(revenueVariance(0,100).percentage,-100);
  assert.deepEqual(revenueVariance(300,undefined),{budget:null,amount:null,percentage:null,outcome:'Budget not provided'});
});
test('legacy files remain valid; blanks stay missing; malformed budgets are rejected',()=>{
  const old=parseCsv(header+'\n2026-01,100,40,20,5,5');
  assert.deepEqual(old.errors,[]);assert.equal(old.periods[0].revenueBudget,undefined);
  const parsed=parseCsv(csv);assert.deepEqual(parsed.errors,[]);
  assert.equal(parsed.periods[2].revenueBudget,0);assert.equal(parsed.periods[3].revenueBudget,undefined);
  for(const bad of ['-1','NaN','Infinity','$200','1000000000001']) assert.match(parseCsv(header+`,RevenueBudget\n2026-01,100,40,20,5,5,${bad}`).errors.join(),/RevenueBudget/);
});
test('optional mapping suggests common names, prevents duplicates and never defaults to zero',()=>{
  const sheet={name:'Monthly',headers:['Period','Sales','Cost of Sales','Opex','Other costs','Tax','Sales Budget'],rows:[['2026-01',100,40,20,5,5,200]]};
  const mapping=suggestMapping(sheet.headers);assert.equal(mapping.RevenueBudget,6);
  const result=validateMapping(sheet,mapping,'AED',true,false);assert.deepEqual(result.errors,[]);assert.equal(result.periods[0].revenueBudget,200);
  assert.equal(validateMapping(sheet,{...mapping,RevenueBudget:undefined},'AED',true,false).periods[0].revenueBudget,undefined);
  assert.match(validateMapping(sheet,{...mapping,RevenueBudget:1},'AED',true,false).errors.join(),/Duplicate mapping/);
  assert.ok(validateMapping(sheet,{...mapping,RevenueBudget:'zero'},'AED',true,true).errors.length);
});
test('partial and absent budget coverage never compare partial totals with full-period actuals',()=>{
  const periods=parseCsv(csv).periods;
  const partial=summarizeRevenueBudget(periods);
  assert.equal(partial.actual,2000);assert.equal(partial.provided,3);assert.equal(partial.budget,null);assert.equal(partial.amount,null);assert.equal(partial.percentage,null);
  const complete=summarizeRevenueBudget(periods.slice(0,3));assert.equal(complete.actual,1700);assert.equal(complete.budget,1800);assert.equal(complete.amount,-100);assert.ok(Math.abs(complete.percentage!+100/1800*100)<1e-10);
  const absent=summarizeRevenueBudget(periods.slice(3));assert.equal(absent.status,'Budget not provided');assert.equal(absent.budget,null);
});
test('demo budgets are realistic, complete and do not change existing actual profit calculations',()=>{
  const report=buildReport({periods:demoPeriods,currencyCode:'USD',filename:'',isDemo:true});
  assert.equal(report.totals.netProfit,336000);assert.equal(report.totals.revenue,1320000);
  assert.equal(report.revenueBudget.budget,1325000);assert.equal(report.revenueBudget.amount,-5000);
  assert.ok(report.revenueBudget.rows.some(row=>row.outcome==='Favorable'));
  assert.ok(report.revenueBudget.rows.some(row=>row.outcome==='adverse'));
});
test('filtered CSV and report models retain currency, missing budgets, zero budgets and period boundaries',()=>{
  const input={periods:parseCsv(csv).periods,currencyCode:'PKR',filename:'sample.csv',isDemo:false,selectedRange:{from:'2026-02',to:'2026-03'}};
  const report=buildReport(input);assert.equal(report.revenueBudget.actual,700);assert.equal(report.revenueBudget.budget,1000);assert.equal(report.revenueBudget.amount,-300);assert.equal(report.revenueBudget.percentage,-30);
  const rows=Papa.parse<Record<string,string>>(exportReportCsv(input),{header:true,skipEmptyLines:true}).data;
  assert.equal(rows.length,2);assert.equal(rows[0].RevenueBudget,'1000');assert.equal(rows[0].RevenueBudgetVariance,'-500');assert.equal(rows[0].RevenueBudgetVariancePercent,'-50');assert.equal(rows[1].RevenueBudget,'0');assert.equal(rows[1].RevenueBudgetVariancePercent,'N/A');
  assert.ok(rows.every(row=>row.Currency==='PKR'&&row.PeriodFrom==='2026-02'&&row.PeriodTo==='2026-03'));
  const missing=Papa.parse<Record<string,string>>(exportReportCsv({...input,selectedRange:{from:'2026-04',to:'2026-04'}}),{header:true,skipEmptyLines:true}).data[0];
  assert.equal(missing.RevenueBudget,'');assert.equal(missing.RevenueBudgetVariance,'N/A');
});
test('real Excel files and both downloadable templates import the optional budget',async()=>{
  const bytes=await writeXlsxFile([header.split(',').concat('RevenueBudget').map(value=>({type:String,value})),[{type:String,value:'2026-01'},...[100,40,20,5,5,0].map(value=>({type:Number,value}))]]).toBuffer();
  const parsed=await parseFinancialFile(new File([new Uint8Array(bytes)],'budget.xlsx'));assert.deepEqual(parsed.errors,[]);assert.equal(parsed.periods[0].revenueBudget,0);
  for(const ext of ['csv','xlsx']) {
    const buffer=await readFile(new URL(`../public/financial-template.${ext}`,import.meta.url));
    const [sheet]=await readSourceFile(new File([buffer],`template.${ext}`));
    const result=validateMapping(sheet,suggestMapping(sheet.headers),'USD',true,false);
    assert.deepEqual(result.errors,[]);assert.deepEqual(result.periods.map(row=>row.revenueBudget),[180000,205000,200000]);
  }
});
test('PDF exports paginated budget comparisons, partial coverage and missing monthly values',async()=>{
  const fonts={regular:(await readFile(new URL('../public/fonts/DejaVuSans.ttf',import.meta.url))).toString('base64'),bold:(await readFile(new URL('../public/fonts/DejaVuSans-Bold.ttf',import.meta.url))).toString('base64')};
  const periods=parseCsv(csv).periods;
  const doc=createPdfReport({periods,currencyCode:'PKR',filename:'budget.csv',isDemo:false},fonts);
  assert.equal(doc.getNumberOfPages(),3);
  await mkdir('/tmp/budget-reports',{recursive:true});await writeFile('/tmp/budget-reports/partial.pdf',Buffer.from(doc.output('arraybuffer')));
  const multi=Array.from({length:120},(_,index)=>({...periods[index%4],month:`${2020+Math.floor(index/12)}-${String(index%12+1).padStart(2,'0')}`}));
  const multiDoc=createPdfReport({periods:multi,currencyCode:'PKR',filename:'multi-budget.csv',isDemo:false},fonts);
  assert.ok(multiDoc.getNumberOfPages()>4);await writeFile('/tmp/budget-reports/multi.pdf',Buffer.from(multiDoc.output('arraybuffer')));
});
