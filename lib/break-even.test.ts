import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import Papa from 'papaparse';
import {breakEvenMeasures,summarizeBreakEven} from './break-even.ts';
import {parseCsv,readSourceFile,suggestMapping,validateMapping} from './import-financials.ts';
import {buildReport,exportReportCsv} from './reports.ts';
import {createPdfReport} from './pdf-report.ts';
const header='Month,Revenue,COGS,OperatingExpenses,OtherExpenses,Tax,FixedCosts,VariableCosts';
const csv=header+'\n2026-02,500,200,50,0,0,200,400\n2026-01,1000,300,80,0,0,200,600\n2026-03,0,20,30,0,0,100,50\n2026-04,100,40,20,0,0,100,100\n2026-05,100,40,20,0,0,100,150\n2026-06,100,40,20,0,0,,40';
const periods=parseCsv(csv).periods;
const input={periods,currencyCode:'PKR',filename:'fictional-break-even.csv',isDemo:false};
test('contribution, break-even and safety use ratios and preserve positive/negative safety',()=>{
  const a=breakEvenMeasures({revenue:1000,fixedCosts:200,variableCosts:600});assert.equal(a.contribution,400);assert.equal(a.contributionMargin,40);assert.equal(a.breakEvenRevenue,500);assert.equal(a.marginOfSafety,500);assert.equal(a.marginOfSafetyPercentage,50);assert.equal(a.status,'Above break-even');
  const b=breakEvenMeasures({revenue:500,fixedCosts:200,variableCosts:400});assert.equal(b.breakEvenRevenue,1000);assert.equal(b.marginOfSafety,-500);assert.equal(b.marginOfSafetyPercentage,-100);assert.equal(b.status,'Below break-even');
  assert.equal(breakEvenMeasures({revenue:500,fixedCosts:100,variableCosts:400}).status,'At break-even');
  const zeroFixed=breakEvenMeasures({revenue:100,fixedCosts:0,variableCosts:0});assert.equal(zeroFixed.breakEvenRevenue,0);assert.equal(zeroFixed.marginOfSafetyPercentage,100);
});
test('zero revenue, non-positive contribution, missing inputs and numeric limits never give invalid break-even points',()=>{
  for(const row of [{revenue:0,fixedCosts:100,variableCosts:50},{revenue:100,fixedCosts:100,variableCosts:100},{revenue:100,fixedCosts:100,variableCosts:150}]){
    const result=breakEvenMeasures(row);assert.equal(result.breakEvenRevenue,null);assert.equal(result.marginOfSafety,null);assert.equal(result.marginOfSafetyPercentage,null);
  }
  assert.equal(breakEvenMeasures({revenue:0,fixedCosts:0,variableCosts:0}).contributionMargin,null);
  for(const value of [undefined,null,NaN,Infinity,-1]){
    const noFixed=breakEvenMeasures({revenue:100,fixedCosts:value,variableCosts:40});assert.equal(noFixed.breakEvenRevenue,null);assert.equal(noFixed.contribution,60);assert.match(noFixed.status,/both be provided/);
    const noVariable=breakEvenMeasures({revenue:100,fixedCosts:40,variableCosts:value});assert.equal(noVariable.contribution,null);assert.equal(noVariable.breakEvenRevenue,null);
  }
  assert.equal(breakEvenMeasures({revenue:NaN,fixedCosts:100,variableCosts:40}).breakEvenRevenue,null);
  const huge=breakEvenMeasures({revenue:Number.MIN_VALUE,fixedCosts:100,variableCosts:100});assert.equal(huge.contributionMargin,null);assert.equal(huge.breakEvenRevenue,null);
});
test('period analysis sums inputs, not break-even points or percentages; complete periods can include zero-revenue months',()=>{
  const total=summarizeBreakEven(periods.slice(0,2));assert.equal(total.totals.revenue,1500);assert.equal(total.totals.fixedCosts,400);assert.equal(total.totals.variableCosts,1000);assert.equal(total.totals.contribution,500);assert.equal(total.totals.contributionMargin,500/1500*100);assert.equal(total.totals.breakEvenRevenue,1200);assert.equal(total.totals.marginOfSafety,300);assert.equal(total.totals.marginOfSafetyPercentage,20);
  const zeroMonth=summarizeBreakEven(periods.slice(0,3));assert.ok(Math.abs(zeroMonth.totals.breakEvenRevenue!-500/.3)<1e-9);
  const partial=summarizeBreakEven(periods);assert.equal(partial.provided,5);assert.equal(partial.complete,false);assert.equal(partial.totals.fixedCosts,null);assert.equal(partial.totals.breakEvenRevenue,null);assert.equal(partial.totals.contribution,460);assert.equal(summarizeBreakEven([]).totals.breakEvenRevenue,null);
});
test('optional fixed/variable mapping validates explicit values and preserves all legacy fields',()=>{
  assert.deepEqual(parseCsv(csv).errors,[]);assert.equal(periods[5].fixedCosts,undefined);assert.equal(periods[0].fixedCosts,200);
  for(const column of ['FixedCosts','VariableCosts'])for(const value of ['-1','$10','NaN','Infinity','1000000000001']){const row=['2026-01',1000,300,80,0,0,200,600];row[column==='FixedCosts'?6:7]=value;assert.match(parseCsv(header+'\n'+row.join(',')).errors.join(),new RegExp(column));}
  const sheet={name:'Monthly',headers:['Period','Sales','Cost of Sales','Opex','Other Costs','Taxes','Total Fixed Costs','Total Variable Costs'],rows:[['2026-01',1000,300,80,0,0,200,600]]};const mapping=suggestMapping(sheet.headers);assert.equal(mapping.FixedCosts,6);assert.equal(mapping.VariableCosts,7);
  assert.equal(validateMapping(sheet,mapping,'PKR',true,false).periods[0].variableCosts,600);assert.match(validateMapping(sheet,mapping,'PKR',false,false).errors.join(),/Confirm/);
  assert.match(validateMapping(sheet,{...mapping,VariableCosts:6},'PKR',true,false).errors.join(),/Duplicate/);assert.match(validateMapping(sheet,{...mapping,FixedCosts:'zero'},'PKR',true,true).errors.join(),/Map FixedCosts/);
  const legacy=validateMapping(sheet,{...mapping,FixedCosts:undefined,VariableCosts:undefined},'PKR',true,false).periods[0];assert.equal(legacy.fixedCosts,undefined);assert.equal(legacy.variableCosts,undefined);assert.equal(buildReport({...input,periods:[legacy]}).totals.grossProfit,700);
  sheet.rows[0][6]=0;assert.equal(validateMapping(sheet,mapping,'PKR',true,false).periods[0].fixedCosts,0);
});
test('both real templates import identical cost classifications without changing expense amounts',async()=>{
  const results=[];
  for(const ext of ['csv','xlsx']){const bytes=await readFile(new URL(`../public/financial-template.${ext}`,import.meta.url));const[sheet]=await readSourceFile(new File([bytes],`financial-template.${ext}`));const result=validateMapping(sheet,suggestMapping(sheet.headers),'USD',true,false);assert.deepEqual(result.errors,[]);assert.deepEqual(result.periods.map(row=>row.fixedCosts),[64000,66000,65000]);assert.deepEqual(result.periods.map(row=>row.variableCosts),[78000,83000,81000]);assert.equal(result.periods[0].cogsBudget,80000);assert.equal(result.periods[0].costOfRevenue,76000);results.push(result.periods);}
  assert.deepEqual(results[0],results[1]);
});
test('selected-period CSV exports analysis, unavailable reasons and unchanged monthly/product measures independently',()=>{
  const selectedRange={from:'2026-01',to:'2026-02'};const report=buildReport({...input,selectedRange,productDataset:{filename:'products.csv',currencyCode:'USD',rows:[{month:'2026-01',product:'Separate',unitsSold:1,revenue:1000000,productCost:900000}]}});assert.equal(report.breakEven.totals.breakEvenRevenue,1200);assert.equal(report.totals.grossProfit,1000);assert.equal(report.products.rows[0].grossProfit,100000);
  const rows=Papa.parse<Record<string,string>>(exportReportCsv({...input,selectedRange}),{header:true,skipEmptyLines:true}).data;assert.deepEqual(rows.map(row=>[row.FixedCosts,row.VariableCosts,row.Contribution,row.BreakEvenRevenue,row.MarginOfSafety]),[['200','600','400','500','500'],['200','400','100','1000','-500']]);assert.ok(rows.every(row=>row.PeriodBreakEvenRevenue==='1200'&&row.PeriodMarginOfSafetyPercent==='20'&&row.Currency==='PKR'&&row.PeriodTo==='2026-02'));
  const all=Papa.parse<Record<string,string>>(exportReportCsv(input),{header:true,skipEmptyLines:true}).data;assert.equal(all[2].BreakEvenRevenue,'N/A');assert.equal(all[2].ContributionMarginPercent,'N/A');assert.equal(all[5].FixedCosts,'');assert.ok(all.every(row=>row.PeriodBreakEvenRevenue==='N/A'));
});
test('PDF paginates explicit break-even inputs and missing/zero/negative explanations',async()=>{
  const fonts={regular:(await readFile(new URL('../public/fonts/DejaVuSans.ttf',import.meta.url))).toString('base64'),bold:(await readFile(new URL('../public/fonts/DejaVuSans-Bold.ttf',import.meta.url))).toString('base64')};const doc=createPdfReport(input,fonts);assert.equal(doc.getNumberOfPages(),4);
  const rows=Array.from({length:120},(_,index)=>({...periods[index%6],month:`${2020+Math.floor(index/12)}-${String(index%12+1).padStart(2,'0')}`}));const multi=createPdfReport({...input,periods:rows},fonts);assert.ok(multi.getNumberOfPages()>8);
  await mkdir('/tmp/ledger-break-even',{recursive:true});await writeFile('/tmp/ledger-break-even/sample.pdf',Buffer.from(doc.output('arraybuffer')));await writeFile('/tmp/ledger-break-even/multi.pdf',Buffer.from(multi.output('arraybuffer')));
});
