import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import Papa from 'papaparse';
import writeXlsxFile from 'write-excel-file/node';
import {productFields,productProfit,suggestProductMapping,summarizeProducts,validateProductMapping,type ProductDataset} from './products.ts';
import {readSourceFile} from './import-financials.ts';
import {buildReport,exportProductCsv,exportReportCsv} from './reports.ts';
import {createPdfReport} from './pdf-report.ts';
import {demoPeriods} from './demo-data.ts';
const range={from:'2026-01',to:'2026-06'};
async function fixture():Promise<ProductDataset>{const bytes=await readFile(new URL('../public/product-template.csv',import.meta.url));const[sheet]=await readSourceFile(new File([bytes],'products.csv'));const result=validateProductMapping(sheet,suggestProductMapping(sheet.headers),true);assert.deepEqual(result.errors,[]);return{rows:result.rows,currencyCode:'AED',filename:'fictional-products.csv'};}

test('product profit and weighted margins preserve losses and zero revenue',()=>{
  assert.deepEqual(productProfit({revenue:100,productCost:40}),{grossProfit:60,grossMargin:60});
  assert.deepEqual(productProfit({revenue:100,productCost:150}),{grossProfit:-50,grossMargin:-50});
  assert.deepEqual(productProfit({revenue:0,productCost:20}),{grossProfit:-20,grossMargin:null});
});
test('required mappings, confirmation, ambiguous aliases and duplicate source columns are validated',()=>{
  const sheet={name:'Products',headers:['Period','Item','Qty','Sales','COGS'],rows:[['2026-01','A',1,100,40]]};
  const map=suggestProductMapping(sheet.headers);assert.deepEqual(map,{Month:0,Product:1,'Units Sold':2,Revenue:3,'Product Cost':4});
  assert.equal(suggestProductMapping(['Month','Product','Units','Revenue','Sales','Cost']).Revenue,undefined);
  assert.deepEqual(validateProductMapping(sheet,map,true).errors,[]);
  assert.match(validateProductMapping(sheet,map,false).errors.join(),/Confirm/);
  assert.match(validateProductMapping(sheet,{...map,'Product Cost':undefined},true).errors.join(),/Map Product Cost/);
  assert.match(validateProductMapping(sheet,{...map,'Product Cost':3},true).errors.join(),/Duplicate mapping/);
});
test('blank product/month, invalid amounts, duplicate product-months and empty sheets reject the import',()=>{
  const headers=productFields.slice(),map=suggestProductMapping(headers);
  for(const row of [['','A',1,100,40],['2026-13','A',1,100,40],['2026-01','',1,100,40],['2026-01','A',1,'',40],['2026-01','A',1,100,''],['2026-01','A',-1,100,40],['2026-01','A',1,Infinity,40],['2026-01','A',1,100,'$40']]) assert.ok(validateProductMapping({name:'Bad',headers,rows:[row]},map,true).errors.length);
  assert.match(validateProductMapping({name:'Dup',headers,rows:[['2026-01','A',1,100,40],['2026-01','A',2,200,80]]},map,true).errors.join(),/duplicate Month and Product/);
  assert.match(validateProductMapping({name:'Empty',headers,rows:[]},map,true).errors.join(),/empty/);
  assert.match(validateProductMapping({name:'Too many',headers,rows:Array.from({length:1001},()=>['2026-01','A',1,1,1])},map,true).errors.join(),/at most/);
  assert.deepEqual(validateProductMapping({name:'Zero',headers,rows:[['2026-01','A',0,0,0]]},map,true).errors,[]);
});
test('grouped products sort by gross profit, filter inclusively, and keep source data intact',async()=>{
  const dataset=await fixture(),before=JSON.stringify(dataset);
  const result=summarizeProducts(dataset,range);
  assert.deepEqual(result.rows.map(row=>[row.product,row.grossProfit]),[['Analytics Pro',162500],['Analytics Starter',104000],['Sample Kit',-2500],['Legacy Adapter',-5000]]);
  assert.equal(result.rows[0].grossMargin,50);assert.equal(result.rows[2].grossMargin,null);
  const filtered=summarizeProducts(dataset,{from:'2026-02',to:'2026-04'});assert.equal(filtered.rows[0].grossProfit,87500);assert.equal(filtered.rows[1].grossProfit,56000);
  assert.equal(JSON.stringify(dataset),before);
  const weighted=summarizeProducts({...dataset,rows:[{month:'2026-01',product:'Weighted',unitsSold:1,revenue:100,productCost:10},{month:'2026-02',product:'Weighted',unitsSold:1,revenue:300,productCost:270}]},range);
  assert.equal(weighted.rows[0].grossMargin,30);
  assert.equal(summarizeProducts(null,range).status,'Product data not provided');
  assert.match(summarizeProducts(dataset,{from:'2028-01',to:'2028-02'}).status,/No product data/);
  assert.ok(summarizeProducts(dataset,{from:'2026-05',to:'2026-01'}).error);
});
test('product CSV is formula-safe, period-filtered and uses only the product currency; monthly totals stay unchanged',async()=>{
  const dataset=await fixture();dataset.rows[0].product='=SUM(A1:A2)';
  const filteredRange={from:'2026-01',to:'2026-04'};
  const parsed=Papa.parse<Record<string,string>>(exportProductCsv(dataset,filteredRange),{header:true,skipEmptyLines:true});
  assert.deepEqual(parsed.errors,[]);assert.ok(parsed.data.every(row=>row.Currency==='AED'&&row.PeriodTo==='2026-04'));
  assert.ok(parsed.data.some(row=>row.Product==="'=SUM(A1:A2)"));assert.ok(parsed.data.some(row=>row.GrossMarginPercent==='N/A'));
  const input={periods:demoPeriods,currencyCode:'USD',filename:'',isDemo:true,productDataset:dataset,selectedRange:range};
  const report=buildReport(input);assert.equal(report.totals.revenue,1320000);assert.equal(report.totals.netProfit,336000);assert.equal(report.products.currencyCode,'AED');
  const monthly=Papa.parse<Record<string,string>>(exportReportCsv(input),{header:true,skipEmptyLines:true}).data;assert.equal(monthly.length,6);assert.ok(monthly.every(row=>row.Currency==='USD'));assert.equal(monthly.reduce((sum,row)=>sum+Number(row.Revenue),0),1320000);
  assert.throws(()=>exportProductCsv(dataset,{from:'2028-01',to:'2028-02'}),/No product data/);
});
test('CSV/XLSX product templates and a real multi-worksheet workbook parse correctly',async()=>{
  const results=[];
  for(const ext of ['csv','xlsx']){const bytes=await readFile(new URL(`../public/product-template.${ext}`,import.meta.url));const[sheet]=await readSourceFile(new File([bytes],`template.${ext}`));const result=validateProductMapping(sheet,suggestProductMapping(sheet.headers),true);assert.deepEqual(result.errors,[]);results.push(result.rows);}
  assert.deepEqual(results[0],results[1]);
  const bytes=await writeXlsxFile([{sheet:'Notes',data:[[{type:String,value:'Not products'}]]},{sheet:'Products',data:[productFields.map(value=>({type:String,value})),[{type:String,value:'2026-01'},{type:String,value:'A'},...[1,100,40].map(value=>({type:Number,value}))]]}]).toBuffer();
  const sheets=await readSourceFile(new File([new Uint8Array(bytes)],'multi.xlsx'));assert.equal(sheets.length,2);assert.equal(validateProductMapping(sheets[1],suggestProductMapping(sheets[1].headers),true).rows[0].productCost,40);
});
test('PDF appends separate product-currency pages with long names, losses, zero margins and pagination',async()=>{
  const dataset=await fixture();const fonts={regular:(await readFile(new URL('../public/fonts/DejaVuSans.ttf',import.meta.url))).toString('base64'),bold:(await readFile(new URL('../public/fonts/DejaVuSans-Bold.ttf',import.meta.url))).toString('base64')};
  const input={periods:demoPeriods,currencyCode:'USD',filename:'',isDemo:true,productDataset:dataset,selectedRange:range};
  const doc=createPdfReport(input,fonts);assert.equal(doc.getNumberOfPages(),8);
  await mkdir('/tmp/product-reports',{recursive:true});await writeFile('/tmp/product-reports/sample.pdf',Buffer.from(doc.output('arraybuffer')));
  const rows=Array.from({length:120},(_,index)=>({...dataset.rows[index%6],product:`Fictional long product — ${index} ${'sample '.repeat(15)}`}));
  const multi=createPdfReport({...input,productDataset:{...dataset,rows}},fonts);assert.ok(multi.getNumberOfPages()>5);await writeFile('/tmp/product-reports/multi.pdf',Buffer.from(multi.output('arraybuffer')));
});
