import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import Papa from 'papaparse';
import {productFields,productMappingFields,suggestProductMapping,validateProductMapping,type ProductDataset} from './products.ts';
import {productRevenueVariance,productBudgetTotals,summarizeProductBudgets} from './product-budget.ts';
import {readSourceFile} from './import-financials.ts';
import {buildReport,exportProductCsv,exportProductBudgetCsv} from './reports.ts';
import {createPdfReport} from './pdf-report.ts';
import {demoPeriods} from './demo-data.ts';
const dataset:ProductDataset={filename:'products.csv',currencyCode:'PKR',rows:[
  {month:'2026-01',product:'A',unitsSold:1,revenue:100,productCost:40,revenueBudget:50},
  {month:'2026-02',product:'A',unitsSold:2,revenue:300,productCost:80,revenueBudget:600},
  {month:'2026-01',product:'B',unitsSold:1,revenue:80,productCost:40,revenueBudget:0},
  {month:'2026-02',product:'B',unitsSold:0,revenue:0,productCost:10,revenueBudget:0},
  {month:'2026-03',product:'C',unitsSold:1,revenue:50,productCost:30},
]};
const range={from:'2026-01',to:'2026-03'};
test('product variance uses Favorable, Adverse and On budget while zero/missing budgets have safe percentages',()=>{
  assert.equal(productRevenueVariance(100,50).outcome,'Favorable');
  assert.deepEqual(productRevenueVariance(300,600),{budget:600,amount:-300,percentage:-50,outcome:'Adverse'});
  assert.deepEqual(productRevenueVariance(80,0),{budget:0,amount:80,percentage:null,outcome:'Favorable'});
  assert.equal(productRevenueVariance(0,0).outcome,'On budget');
  assert.deepEqual(productRevenueVariance(50,undefined),{budget:null,amount:null,percentage:null,outcome:'Budget not provided'});
});
test('optional product budget mapping retains legacy inputs and rejects invalid or duplicate budget sources',()=>{
  const headers=productFields.slice(),rows=[['2026-01','A',1,100,40]];
  const legacy=validateProductMapping({name:'Legacy',headers,rows},suggestProductMapping(headers),true);
  assert.deepEqual(legacy.errors,[]);assert.equal(legacy.rows[0].revenueBudget,undefined);
  const budgetHeaders=[...headers,'Sales Budget'],mapping=suggestProductMapping(budgetHeaders);
  assert.equal(mapping['Revenue Budget'],5);
  const validate=(value:unknown)=>validateProductMapping({name:'Budget',headers:budgetHeaders,rows:[[...rows[0],value]]},mapping,true);
  assert.equal(validate('').rows[0].revenueBudget,undefined);assert.equal(validate(0).rows[0].revenueBudget,0);
  for(const bad of [-1,'Infinity','bad','$10',1000000000001])assert.match(validate(bad).errors.join(),/Revenue Budget/);
  assert.match(validateProductMapping({name:'Dup',headers:budgetHeaders,rows:[[...rows[0],50]]},{...mapping,'Revenue Budget':3},true).errors.join(),/Duplicate mapping/);
});
test('selected product and period totals are weighted from amounts; partial coverage never implies zero',()=>{
  const before=JSON.stringify(dataset);
  const all=summarizeProductBudgets(dataset,range);assert.equal(all.actual,530);assert.equal(all.budget,null);assert.equal(all.amount,null);assert.equal(all.provided,4);
  const a=summarizeProductBudgets(dataset,range,'A');assert.equal(a.actual,400);assert.equal(a.budget,650);assert.equal(a.amount,-250);assert.ok(Math.abs(a.percentage!-(-250/650*100))<1e-10);
  assert.equal(summarizeProductBudgets(dataset,{from:'2026-02',to:'2026-02'},'A').percentage,-50);
  assert.equal(summarizeProductBudgets(dataset,range,'C').status,'Product budgets not provided');
  assert.equal(summarizeProductBudgets(dataset,{from:'2028-01',to:'2028-02'}).rows.length,0);
  assert.equal(JSON.stringify(dataset),before);
  assert.equal(productBudgetTotals([]).budget,null);
});
test('product CSV includes aggregate budgets and monthly budget CSV preserves zero, missing and formula escaping',()=>{
  const aggregate=Papa.parse<Record<string,string>>(exportProductCsv(dataset,range,'A'),{header:true,skipEmptyLines:true}).data;
  assert.equal(aggregate.length,1);assert.equal(aggregate[0].RevenueBudget,'650');assert.equal(aggregate[0].RevenueVariance,'-250');assert.equal(aggregate[0].RevenueBudgetResult,'Adverse');
  const details=Papa.parse<Record<string,string>>(exportProductBudgetCsv(dataset,range),{header:true,skipEmptyLines:true}).data;
  assert.equal(details.length,5);assert.equal(details.find(row=>row.Product==='C')!.RevenueBudget,'');assert.equal(details.find(row=>row.Product==='C')!.Variance,'N/A');
  assert.ok(details.filter(row=>row.Product==='B').every(row=>row.RevenueBudget==='0'&&row.VariancePercent==='N/A'));
  const dangerous={...dataset,rows:[{...dataset.rows[0],product:'=formula'}]};
  assert.equal(Papa.parse<Record<string,string>>(exportProductBudgetCsv(dangerous,range),{header:true,skipEmptyLines:true}).data[0].Product,"'=formula");
  assert.throws(()=>exportProductBudgetCsv(dataset,range,'C'),/not provided/);
});
test('product selection and budgets never change overall monthly revenue budget or profitability',()=>{
  const input={periods:demoPeriods,currencyCode:'USD',filename:'',isDemo:true,productDataset:dataset,selectedRange:range,selectedProduct:'A'};
  const report=buildReport(input);
  assert.equal(report.totals.revenue,571000);assert.equal(report.products.rows.length,1);assert.equal(report.productBudgets.amount,-250);
  assert.equal(report.revenueBudget.budget,585000);assert.equal(report.revenueBudget.amount,-14000);const baseline=buildReport({...input,productDataset:null,selectedProduct:''});assert.deepEqual(report.revenueBudget,baseline.revenueBudget);
  assert.equal(report.products.currencyCode,'PKR');
});
test('both updated product templates import real optional budgets without changing product costs/profits',async()=>{
  for(const ext of ['csv','xlsx']){const bytes=await readFile(new URL(`../public/product-template.${ext}`,import.meta.url));const[sheet]=await readSourceFile(new File([bytes],`products.${ext}`));assert.deepEqual(sheet.headers,productMappingFields.slice());const parsed=validateProductMapping(sheet,suggestProductMapping(sheet.headers),true);assert.deepEqual(parsed.errors,[]);assert.deepEqual(parsed.rows.map(row=>row.revenueBudget),[160000,110000,170000,150000,12000,0]);const total=productBudgetTotals(parsed.rows);assert.equal(total.actual,595000);assert.equal(total.budget,602000);assert.equal(total.amount,-7000);}
});
test('PDF contains filtered product-budget detail, adverse labels and multi-page records with missing budgets',async()=>{
  const fonts={regular:(await readFile(new URL('../public/fonts/DejaVuSans.ttf',import.meta.url))).toString('base64'),bold:(await readFile(new URL('../public/fonts/DejaVuSans-Bold.ttf',import.meta.url))).toString('base64')};
  const input={periods:demoPeriods,currencyCode:'USD',filename:'',isDemo:true,productDataset:dataset,selectedRange:range,selectedProduct:'A'};
  const doc=createPdfReport(input,fonts);assert.equal(doc.getNumberOfPages(),5);await mkdir('/tmp/product-budget-reports',{recursive:true});await writeFile('/tmp/product-budget-reports/filtered.pdf',Buffer.from(doc.output('arraybuffer')));
  const rows=Array.from({length:120},(_,index)=>({...dataset.rows[index%5],product:`Fictional product ${index}`,month:`${2020+Math.floor(index/12)}-${String(index%12+1).padStart(2,'0')}`}));
  const multi=createPdfReport({...input,productDataset:{...dataset,rows},selectedProduct:'',selectedRange:{from:'2020-01',to:'2030-12'},periods:[{...demoPeriods[0],month:'2020-01'}]},fonts);assert.ok(multi.getNumberOfPages()>5);await writeFile('/tmp/product-budget-reports/multi.pdf',Buffer.from(multi.output('arraybuffer')));
});
