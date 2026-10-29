import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import Papa from 'papaparse';
import {forecastBasis,defaultForecastSettings,buildForecast,scenarioNames,type ForecastInput} from './forecast.ts';
import {exportForecastCsv} from './forecast-reports.ts';
import {createForecastPdf} from './forecast-pdf.ts';
import {exportReportCsv} from './reports.ts';
import {calculateProfits,type FinancialPeriod} from './finance.ts';
const history:FinancialPeriod[]=[{month:'2026-02',revenue:1100,costOfRevenue:660,operatingExpenses:110,otherExpenses:30,taxes:15,fixedCosts:220,variableCosts:660},{month:'2026-01',revenue:1000,costOfRevenue:600,operatingExpenses:100,otherExpenses:10,taxes:5,fixedCosts:200,variableCosts:600}];
const basis=()=>forecastBasis(history,'2026-02');
const input=():ForecastInput=>({periods:history,historyRange:{from:'2026-01',to:'2026-02'},latestActualMonth:'2026-02',settings:defaultForecastSettings(basis()),currencyCode:'PKR',filename:'fictional-history.csv',isDemo:false});
const close=(a:number|null|undefined,b:number)=>assert.ok(a!==null&&a!==undefined&&Math.abs(a-b)<1e-7,`${a} vs ${b}`);
test('historical defaults use calendar growth, weighted COGS and explicit flat monthly other/tax averages',()=>{
  const source=basis();close(source.defaults.revenueGrowth,10);close(source.defaults.operatingExpenseGrowth,10);assert.equal(source.defaults.cogsPercentage,60);assert.equal(source.defaults.otherExpenses,20);assert.equal(source.defaults.tax,10);assert.equal(source.seed?.month,'2026-02');close(source.comparison.revenue,525);
  const settings=defaultForecastSettings(source);assert.deepEqual(settings.scenarios.Base,settings.scenarios.Conservative);settings.scenarios.Base.revenueGrowth=20;assert.notEqual(settings.scenarios.Base.revenueGrowth,settings.scenarios.Optimistic.revenueGrowth);
});
test('forecasts compound separately and reuse existing profit formulas without modifying actuals',()=>{
  const before=JSON.stringify(history),report=buildForecast(input());assert.deepEqual(report.errors,[]);assert.equal(report.forecastFrom,'2026-03');assert.equal(report.forecastTo,'2026-05');const row=report.scenarios[1].rows[0];
  close(row.revenue,1210);close(row.costOfRevenue,726);close(row.grossProfit,484);close(row.operatingExpenses,121);close(row.operatingProfit,363);close(row.otherExpenses,20);close(row.taxes,10);close(row.netProfit,333);close(row.breakEvenRevenue,525);close(row.revenueAboveBreakEven,685);
  const expected=calculateProfits(row);assert.equal(row.netProfit,expected.netProfit);assert.equal(row.kind,'Forecast estimate');close(report.scenarios[1].totals?.revenue,4005.1);assert.equal(JSON.stringify(history),before);
});
test('all horizons and user scenario edits are independent and bounded',()=>{
  for(const horizon of [3,6,12] as const){const value=input();value.settings.horizon=horizon;const result=buildForecast(value);assert.equal(result.valid,true);assert.ok(result.scenarios.every(s=>s.rows.length===horizon));}
  const value=input();Object.assign(value.settings.scenarios.Conservative,{revenueGrowth:0,cogsPercentage:70,operatingExpenseGrowth:5});Object.assign(value.settings.scenarios.Optimistic,{revenueGrowth:20,cogsPercentage:50,operatingExpenseGrowth:0,otherExpenses:0,tax:0});const result=buildForecast(value);assert.equal(result.valid,true);close(result.scenarios[0].rows[0].revenue,1100);close(result.scenarios[0].rows[0].netProfit,184.5);close(result.scenarios[2].rows[0].netProfit,550);assert.equal(result.scenarios[0].rows[0].breakEvenRevenue,result.scenarios[2].rows[0].breakEvenRevenue);
  value.settings.scenarios.Base.revenueGrowth=-101;assert.equal(buildForecast(value).valid,false);value.settings.scenarios.Base.revenueGrowth=null;assert.match(buildForecast(value).errors.join(),/finite assumption/);
  value.settings.scenarios.Base.revenueGrowth=1000;value.settings.horizon=12;value.periods=history.map(row=>({...row,revenue:row.revenue*1000000}));assert.match(buildForecast(value).errors.join(),/numeric range/);
});
test('selected basis cannot overlap any actuals; elapsed-month gaps compound transparently',()=>{
  const value=input();value.latestActualMonth='2026-06';const report=buildForecast(value);assert.equal(report.forecastFrom,'2026-07');assert.equal(report.scenarios[1].rows[0].stepsFromSeed,5);close(report.scenarios[1].rows[0].revenue,1100*1.1**5);assert.match(report.basis.warnings.join(),/across the gap/);
  const sparse=forecastBasis([{...history[1],month:'2025-12'},{...history[0],month:'2026-02'}],'2026-02');close(sparse.defaults.revenueGrowth,(Math.sqrt(1.1)-1)*100);assert.match(sparse.warnings.join(),/calendar gaps/);
  value.historyRange={from:'2026-02',to:'2026-01'};assert.equal(buildForecast(value).valid,false);
  const max=input();max.periods=history.map(row=>({...row,month:row.month==='2026-01'?'9999-11':'9999-12'}));max.historyRange={from:'9999-11',to:'9999-12'};max.latestActualMonth='9999-12';assert.match(buildForecast(max).errors.join(),/year 9999/);
});
test('limited history and zero denominators require explicit assumptions; valid zero inputs and losses remain visible',()=>{
  const value=input();value.periods=[history[0]];value.historyRange={from:'2026-02',to:'2026-02'};value.settings=defaultForecastSettings(forecastBasis(value.periods,value.latestActualMonth));assert.equal(value.settings.scenarios.Base.revenueGrowth,null);assert.equal(buildForecast(value).valid,false);
  for(const name of scenarioNames)Object.assign(value.settings.scenarios[name],{revenueGrowth:0,operatingExpenseGrowth:0});assert.equal(buildForecast(value).valid,true);
  value.periods=[{...history[0],revenue:0,operatingExpenses:0,costOfRevenue:0,otherExpenses:0,taxes:0,fixedCosts:0,variableCosts:0}];value.settings=defaultForecastSettings(forecastBasis(value.periods,value.latestActualMonth));for(const name of scenarioNames)Object.assign(value.settings.scenarios[name],{revenueGrowth:10,operatingExpenseGrowth:10,cogsPercentage:60});const zero=buildForecast(value);assert.equal(zero.valid,true);assert.equal(zero.scenarios[1].rows[0].revenue,0);assert.equal(zero.scenarios[1].rows[0].netProfit,0);assert.equal(zero.basis.comparison.revenue,null);assert.match(zero.basis.warnings.join(),/seed is zero/);
  const loss=input();for(const name of scenarioNames)Object.assign(loss.settings.scenarios[name],{cogsPercentage:150,revenueGrowth:-100});const decline=buildForecast(loss);assert.equal(decline.valid,true);assert.equal(decline.scenarios[1].rows[0].revenue,0);assert.ok(decline.scenarios[1].rows[0].netProfit<0);
});
test('missing financial inputs block projections, while missing cost classification only removes break-even reference',()=>{
  for(const key of ['revenue','costOfRevenue','operatingExpenses','otherExpenses','taxes'] as const){const value=input();value.periods=[{...history[0],[key]:undefined} as unknown as FinancialPeriod];assert.match(buildForecast(value).errors.join(),/missing inputs are not zero/);}
  const value=input();value.periods=history.map(row=>({...row,fixedCosts:undefined,variableCosts:undefined}));const report=buildForecast(value);assert.equal(report.valid,true);assert.equal(report.basis.comparison.revenue,null);assert.match(report.basis.comparison.status,/required for every/);
  value.periods=history.map(row=>({...row,variableCosts:row.revenue}));assert.equal(buildForecast(value).basis.comparison.revenue,null);
});
test('forecast CSV keeps scenarios and assumptions separate from actual exports, with safe text escaping',()=>{
  const value=input();value.filename='=untrusted, "source".csv';value.settings.scenarios.Base.revenueGrowth=0;
  const parsed=Papa.parse<Record<string,string>>(exportForecastCsv(value),{header:true,skipEmptyLines:true});assert.deepEqual(parsed.errors,[]);assert.equal(parsed.data.length,9);assert.ok(parsed.data.every(row=>row.RecordType==='FORECAST ESTIMATE'&&row.Currency==='PKR'&&row.HistoricalPeriodFrom==='2026-01'&&row.LatestActualMonth==='2026-02'&&row.SourceFile.startsWith("'=")));
  const row=parsed.data.find(row=>row.Scenario==='Base')!;assert.equal(row.RevenueGrowthPercent,'0');assert.match(row.AssumptionSources,/revenueGrowth: user assumption/);assert.equal(row.ForecastMonth,'2026-03');close(Number(row.HistoricalMonthlyBreakEvenRevenue),525);
  const actual=Papa.parse<Record<string,string>>(exportReportCsv({...value,selectedRange:value.historyRange}),{header:true,skipEmptyLines:true}).data;assert.equal(actual.length,2);assert.deepEqual(actual.map(row=>row.Month),['2026-01','2026-02']);assert.equal(actual[1].Revenue,'1100');
  value.isDemo=true;assert.match(exportForecastCsv(value),/FICTIONAL DEMO DATA/);value.settings.scenarios.Base.tax=null;assert.throws(()=>exportForecastCsv(value),/finite assumption/);
});
test('forecast PDF includes all scenario months, defaults and sources, supports long source names',async()=>{
  const fonts={regular:(await readFile(new URL('../public/fonts/DejaVuSans.ttf',import.meta.url))).toString('base64'),bold:(await readFile(new URL('../public/fonts/DejaVuSans-Bold.ttf',import.meta.url))).toString('base64')};const value=input();value.settings.horizon=12;const doc=createForecastPdf(value,fonts);assert.ok(doc.getNumberOfPages()>=5);await mkdir('/tmp/ledger-forecast',{recursive:true});await writeFile('/tmp/ledger-forecast/sample.pdf',Buffer.from(doc.output('arraybuffer')));
  const long=createForecastPdf({...value,filename:'Fictional '+ 'long source name '.repeat(1000)+'.csv'},fonts);assert.ok(long.getNumberOfPages()>doc.getNumberOfPages());await writeFile('/tmp/ledger-forecast/long.pdf',Buffer.from(long.output('arraybuffer')));
});
