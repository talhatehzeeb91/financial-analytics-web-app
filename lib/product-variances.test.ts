import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import Papa from 'papaparse';
import {salesCostVariance,salesCostTotals,summarizeSalesCost} from './product-variances.ts';
import {suggestProductMapping,validateProductMapping,type ProductDataset,type ProductRecord} from './products.ts';
import {readSourceFile} from './import-financials.ts';
import {buildReport,exportProductCsv,exportProductBudgetCsv} from './reports.ts';
import {createPdfReport} from './pdf-report.ts';
import {demoPeriods} from './demo-data.ts';
const a:ProductRecord={month:'2026-01',product:'A',unitsSold:120,revenue:1440,productCost:700,revenueBudget:1000,budgetedUnits:100,budgetedSellingPrice:10,costBudget:800};
const b:ProductRecord={...a,month:'2026-02',unitsSold:80,revenue:720,costBudget:600};
const dataset:ProductDataset={filename:'sales-cost.csv',currencyCode:'PKR',rows:[a,b]};const range={from:'2026-01',to:'2026-02'};
test('price, volume and cost follow specified signs and reconcile to total sales variance',()=>{
  const x=salesCostVariance(a);assert.equal(x.actualSellingPrice,12);assert.equal(x.volumeVariance,200);assert.equal(x.priceVariance,240);assert.equal(x.revenueVariance,440);assert.equal(x.costVariance,100);assert.equal(x.priceOutcome,'Favorable');
  const y=salesCostVariance(b);assert.equal(y.volumeVariance,-200);assert.equal(y.priceVariance,-80);assert.equal(y.costVariance,-100);assert.equal(y.volumeOutcome,'Adverse');assert.equal(y.priceVariance!+y.volumeVariance!,y.revenueVariance);
});
test('mismatches are explicit and suppress decomposition without changing original revenue budget or cost variance',()=>{
  const mismatch=salesCostVariance({...a,revenueBudget:1100});assert.equal(mismatch.reconciliation,'Revenue budget mismatch');assert.equal(mismatch.expectedRevenueBudget,1000);assert.equal(mismatch.reconciliationDifference,-100);assert.equal(mismatch.priceVariance,null);assert.equal(mismatch.volumeVariance,null);assert.equal(mismatch.revenueVariance,340);assert.equal(mismatch.costVariance,100);
  const rounded=salesCostVariance({...a,revenueBudget:1000.005});assert.equal(rounded.reconciliation,'Reconciled');assert.equal(rounded.revenueBudget,1000.005);assert.ok(Math.abs(rounded.reconciliationDifference!)>0);
});
test('zero units, zero prices, missing sales plans and cost-only budgets never create invalid values',()=>{
  const zero=salesCostVariance({...a,unitsSold:0,revenue:0});assert.equal(zero.actualSellingPrice,null);assert.equal(zero.priceVariance,0);assert.equal(zero.volumeVariance,-1000);assert.equal(zero.revenueVariance,-1000);
  const invalid=salesCostVariance({...a,unitsSold:0});assert.equal(invalid.reconciliation,'Zero units with revenue');assert.equal(invalid.priceVariance,null);assert.equal(invalid.volumeVariance,null);
  const zeroBudget=salesCostVariance({...a,revenueBudget:0,budgetedUnits:0,budgetedSellingPrice:0});assert.equal(zeroBudget.priceVariance,1440);assert.equal(zeroBudget.volumeVariance,0);
  const missing=salesCostVariance({...a,revenueBudget:undefined});assert.equal(missing.reconciliation,'Missing sales plan');assert.equal(missing.priceVariance,null);assert.equal(missing.revenueVariance,null);
  const costOnly=salesCostVariance({month:'2026-01',product:'Cost only',unitsSold:1,revenue:100,productCost:50,costBudget:0});assert.equal(costOnly.costVariance,-50);assert.equal(costOnly.priceVariance,null);
});
test('optional aliases and invalid plan values preserve old files and never infer a revenue budget',()=>{
  const headers=['Period','Item','Actual Units','Sales','Cost','Revenue Budget','Planned Units','Planned Price','Budget Cost'];const map=suggestProductMapping(headers);assert.equal(map['Units Sold'],2);assert.equal(map['Budgeted Units'],6);assert.equal(map['Cost Budget'],8);
  const parse=(value:unknown)=>validateProductMapping({name:'Plans',headers,rows:[['2026-01','A',120,1440,700,'',value,10,800]]},map,true);
  assert.equal(parse(100).rows[0].revenueBudget,undefined);assert.equal(parse('').rows[0].budgetedUnits,undefined);assert.equal(parse(0).rows[0].budgetedUnits,0);
  for(const invalid of [-1,'bad','Infinity','$10',1000000000001])assert.match(parse(invalid).errors.join(),/Budgeted Units/);
  assert.match(validateProductMapping({name:'Dup',headers,rows:[['2026-01','A',120,1440,700,1000,100,10,800]]},{...map,'Budgeted Units':2},true).errors.join(),/Duplicate mapping/);
});
test('filtered totals sum row variances, with independent complete coverage for costs and sales',()=>{
  const total=salesCostTotals([a,b]);assert.equal(total.volumeVariance,0);assert.equal(total.priceVariance,160);assert.equal(total.revenueVariance,160);assert.equal(total.costVariance,0);
  const partial=salesCostTotals([a,{...b,budgetedUnits:undefined}]);assert.equal(partial.priceVariance,null);assert.equal(partial.volumeVariance,null);assert.equal(partial.revenueVariance,160);assert.equal(partial.costVariance,0);
  assert.equal(summarizeSalesCost(dataset,{from:'2026-01',to:'2026-01'},'A').priceVariance,240);assert.equal(summarizeSalesCost(dataset,range,'Missing').provided,0);
  const report=buildReport({periods:demoPeriods,currencyCode:'USD',filename:'',isDemo:true,productDataset:dataset,selectedRange:range});assert.equal(report.totals.revenue,380000);assert.equal(report.revenueBudget.budget,385000);assert.equal(report.products.rows[0].grossProfit,760);
});
test('CSV and both real templates include plan inputs, variances and reconciliation details',async()=>{
  const rows=Papa.parse<Record<string,string>>(exportProductBudgetCsv(dataset,range),{header:true,skipEmptyLines:true}).data;assert.equal(rows[0].ActualSellingPrice,'12');assert.equal(rows[0].SalesVolumeVariance,'200');assert.equal(rows[0].SalesPriceVariance,'240');assert.equal(rows[0].CostVariance,'100');assert.equal(rows[0].Reconciliation,'Reconciled');
  const grouped=Papa.parse<Record<string,string>>(exportProductCsv(dataset,range),{header:true,skipEmptyLines:true}).data[0];assert.equal(grouped.SalesVolumeVariance,'0');assert.equal(grouped.SalesPriceVariance,'160');assert.equal(grouped.CostVariance,'0');
  for(const ext of ['csv','xlsx']){const bytes=await readFile(new URL(`../public/product-template.${ext}`,import.meta.url));const[sheet]=await readSourceFile(new File([bytes],`template.${ext}`));const parsed=validateProductMapping(sheet,suggestProductMapping(sheet.headers),true);assert.deepEqual(parsed.errors,[]);const summary=salesCostTotals(parsed.rows);assert.equal(summary.salesProvided,6);assert.equal(summary.volumeVariance,-25000);assert.equal(summary.priceVariance,18000);assert.equal(summary.revenueVariance,-7000);assert.equal(summary.costVariance,10000);}
  const costOnly={...dataset,rows:[{month:'2026-01',product:'Cost only',unitsSold:1,revenue:100,productCost:50,costBudget:60}]};assert.match(exportProductBudgetCsv(costOnly,range),/Missing sales plan/);
});
test('PDF retains mismatch warnings, cost-only values and all paginated plan rows',async()=>{
  const fonts={regular:(await readFile(new URL('../public/fonts/DejaVuSans.ttf',import.meta.url))).toString('base64'),bold:(await readFile(new URL('../public/fonts/DejaVuSans-Bold.ttf',import.meta.url))).toString('base64')};
  const rows=[a,b,{...a,month:'2026-03',revenueBudget:900,product:'Mismatch'},{month:'2026-04',product:'Cost only',unitsSold:1,revenue:100,productCost:50,costBudget:60}];
  const input={periods:demoPeriods,currencyCode:'USD',filename:'',isDemo:true,productDataset:{...dataset,rows}};const doc=createPdfReport(input,fonts);assert.equal(doc.getNumberOfPages(),7);await mkdir('/tmp/ledger-variance-reports',{recursive:true});await writeFile('/tmp/ledger-variance-reports/sample.pdf',Buffer.from(doc.output('arraybuffer')));
  const multi=Array.from({length:120},(_,index)=>({...a,product:`Fictional Product ${index}`,month:`${2020+Math.floor(index/12)}-${String(index%12+1).padStart(2,'0')}`}));const long=createPdfReport({...input,periods:[{...demoPeriods[0],month:'2020-01'}],selectedRange:{from:'2020-01',to:'2030-12'},productDataset:{...dataset,rows:multi}},fonts);assert.ok(long.getNumberOfPages()>8);await writeFile('/tmp/ledger-variance-reports/multi.pdf',Buffer.from(long.output('arraybuffer')));
});
