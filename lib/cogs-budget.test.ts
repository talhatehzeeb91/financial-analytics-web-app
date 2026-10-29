import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import Papa from 'papaparse';
import { cogsBudgetVariance, summarizeCogsBudget } from './cogs-budget.ts';
import { parseCsv, readSourceFile, suggestMapping, validateMapping } from './import-financials.ts';
import { buildReport, exportReportCsv } from './reports.ts';
import { createPdfReport } from './pdf-report.ts';
const header='Month,Revenue,COGS,OperatingExpenses,OtherExpenses,Tax,COGSBudget';
const csv=header+'\n2026-01,1000,80,0,0,0,100\n2026-02,1000,200,0,0,0,100\n2026-03,0,20,0,0,0,0\n2026-04,1000,50,0,0,0,';
const periods=parseCsv(csv).periods;
const input={periods,currencyCode:'PKR',filename:'fictional-cogs-budgets.csv',isDemo:false};
test('monthly cost signs, zero budget and absent budget are distinct',()=>{
  assert.deepEqual(cogsBudgetVariance(80,100),{budget:100,amount:20,percentage:20,outcome:'Favorable'});
  assert.equal(cogsBudgetVariance(200,100).outcome,'Adverse');assert.equal(cogsBudgetVariance(100,100).outcome,'On budget');
  assert.deepEqual(cogsBudgetVariance(20,0),{budget:0,amount:-20,percentage:null,outcome:'Adverse'});
  assert.equal(cogsBudgetVariance(0,0).percentage,null);assert.equal(cogsBudgetVariance(0,0).outcome,'On budget');
  assert.equal(cogsBudgetVariance(50,undefined).amount,null);
  for(const value of [NaN,Infinity,-1])assert.equal(cogsBudgetVariance(50,value).budget,null);
  assert.equal(cogsBudgetVariance(undefined,100).amount,null);
});
test('legacy and blank budgets stay absent; optional mapping supports aliases, confirmation and duplicate prevention',()=>{
  assert.deepEqual(parseCsv(csv).errors,[]);assert.equal(periods[3].cogsBudget,undefined);assert.equal(periods[2].cogsBudget,0);
  assert.equal(parseCsv('Month,Revenue,COGS,OperatingExpenses,OtherExpenses,Tax\n2026-01,100,40,0,0,0').periods[0].cogsBudget,undefined);
  for(const invalid of ['-1','$10','NaN','Infinity','1000000000001'])assert.match(parseCsv(header+`\n2026-01,100,50,0,0,0,${invalid}`).errors.join(),/COGSBudget/);
  const sheet={name:'Monthly',headers:['Period','Sales','Cost of Sales','Opex','Other Costs','Taxes','Budgeted COGS'],rows:[['2026-01',1000,80,0,0,0,100]]};
  const mapping=suggestMapping(sheet.headers);assert.equal(mapping.COGSBudget,6);
  assert.equal(validateMapping(sheet,mapping,'PKR',true,false).periods[0].cogsBudget,100);
  assert.match(validateMapping(sheet,mapping,'PKR',false,false).errors.join(),/Confirm/);
  assert.match(validateMapping(sheet,{...mapping,COGSBudget:2},'PKR',true,false).errors.join(),/Duplicate/);
  assert.match(validateMapping(sheet,{...mapping,COGSBudget:'zero'},'PKR',true,true).errors.join(),/Map COGSBudget/);
  assert.equal(validateMapping(sheet,{...mapping,COGSBudget:undefined},'PKR',true,false).periods[0].cogsBudget,undefined);
});
test('period comparisons use sums and complete coverage, preserve existing profit and product separation',()=>{
  const partial=summarizeCogsBudget(periods);assert.equal(partial.actual,350);assert.equal(partial.provided,3);assert.equal(partial.budget,null);assert.equal(partial.amount,null);assert.equal(partial.percentage,null);
  const total=summarizeCogsBudget(periods.slice(0,3));assert.equal(total.actual,300);assert.equal(total.budget,200);assert.equal(total.amount,-100);assert.equal(total.percentage,-50);
  assert.equal(summarizeCogsBudget([]).actual,null);assert.equal(summarizeCogsBudget(periods.slice(3)).status,'COGS budget not provided');
  const report=buildReport({...input,selectedRange:{from:'2026-01',to:'2026-02'},productDataset:{filename:'products.csv',currencyCode:'USD',rows:[{month:'2026-01',product:'Independent',unitsSold:1,revenue:1000000,productCost:900000,costBudget:800000}]}});
  assert.equal(report.cogsBudget.actual,280);assert.equal(report.cogsBudget.budget,200);assert.equal(report.cogsBudget.percentage,-40);assert.equal(report.totals.grossProfit,1720);assert.equal(report.salesCost.costVariance,-100000);
});
test('both downloadable templates preserve identical optional budgets and imported actuals',async()=>{
  const results=[];
  for(const ext of ['csv','xlsx']){
    const bytes=await readFile(new URL(`../public/financial-template.${ext}`,import.meta.url));const[sheet]=await readSourceFile(new File([bytes],`financial-template.${ext}`));
    const parsed=validateMapping(sheet,suggestMapping(sheet.headers),'USD',true,false);assert.deepEqual(parsed.errors,[]);assert.deepEqual(parsed.periods.map(row=>row.cogsBudget),[80000,79000,79000]);results.push(parsed.periods);
  }
  assert.deepEqual(results[0],results[1]);
});
test('filtered CSV retains monthly budget variance, zero N/A and period coverage',()=>{
  const rows=Papa.parse<Record<string,string>>(exportReportCsv({...input,selectedRange:{from:'2026-02',to:'2026-04'}}),{header:true,skipEmptyLines:true}).data;
  assert.deepEqual(rows.map(row=>[row.Month,row.COGSBudget,row.COGSBudgetVariance,row.COGSBudgetVariancePercent,row.COGSBudgetResult]),[['2026-02','100','-100','-100','Adverse'],['2026-03','0','-20','N/A','Adverse'],['2026-04','','N/A','N/A','Budget not provided']]);
  assert.ok(rows.every(row=>row.PeriodCOGSBudget===''&&row.PeriodCOGSBudgetVariance==='N/A'&&row.COGSBudgetCoverage.includes('incomplete')&&row.Currency==='PKR'));
  const complete=Papa.parse<Record<string,string>>(exportReportCsv({...input,selectedRange:{from:'2026-01',to:'2026-02'}}),{header:true,skipEmptyLines:true}).data;
  assert.ok(complete.every(row=>row.PeriodCOGSBudget==='200'&&row.PeriodCOGSBudgetVariance==='-80'&&row.PeriodCOGSBudgetVariancePercent==='-40'));
});
test('PDF contains additional paginated monthly COGS budget section when budgets exist',async()=>{
  const fonts={regular:(await readFile(new URL('../public/fonts/DejaVuSans.ttf',import.meta.url))).toString('base64'),bold:(await readFile(new URL('../public/fonts/DejaVuSans-Bold.ttf',import.meta.url))).toString('base64')};
  const doc=createPdfReport(input,fonts);assert.equal(doc.getNumberOfPages(),4);
  const rows=Array.from({length:120},(_,index)=>({...periods[index%4],month:`${2020+Math.floor(index/12)}-${String(index%12+1).padStart(2,'0')}`}));
  const multi=createPdfReport({...input,periods:rows},fonts);assert.ok(multi.getNumberOfPages()>6);
  await mkdir('/tmp/ledger-cogs-budgets',{recursive:true});await writeFile('/tmp/ledger-cogs-budgets/sample.pdf',Buffer.from(doc.output('arraybuffer')));await writeFile('/tmp/ledger-cogs-budgets/multi.pdf',Buffer.from(multi.output('arraybuffer')));
});
