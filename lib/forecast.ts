import {calculateProfits,summarize,type FinancialPeriod} from './finance.ts';
import {summarizeBreakEven} from './break-even.ts';
import {selectPeriodRange,type MonthRange} from './date-range.ts';
export const scenarioNames=['Conservative','Base','Optimistic'] as const;
export type ScenarioName=typeof scenarioNames[number];
export const assumptionKeys=['revenueGrowth','cogsPercentage','operatingExpenseGrowth','otherExpenses','tax'] as const;
export type AssumptionKey=typeof assumptionKeys[number];
export type ForecastAssumptions=Record<AssumptionKey,number|null>;
export type ForecastSettings={horizon:3|6|12;scenarios:Record<ScenarioName,ForecastAssumptions>};
export type ForecastInput={periods:FinancialPeriod[];historyRange:MonthRange;latestActualMonth:string;settings:ForecastSettings;currencyCode:string;filename:string;isDemo:boolean};
export const forecastDisclaimer='FORECAST ESTIMATES — based on historical data and selected assumptions, not actual results or guarantees.';
const monthIndex=(month:string)=>/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month)?Number(month.slice(0,4))*12+Number(month.slice(5))-1:NaN;
const monthAt=(index:number)=>`${String(Math.floor(index/12)).padStart(4,'0')}-${String(index%12+1).padStart(2,'0')}`;
const validAmount=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER;
function growth(rows:FinancialPeriod[],key:'revenue'|'operatingExpenses'){
  if(rows.length<2||rows[0][key]<=0)return null;
  const elapsed=monthIndex(rows.at(-1)!.month)-monthIndex(rows[0].month);
  const value=(Math.pow(rows.at(-1)![key]/rows[0][key],1/elapsed)-1)*100;
  return Number.isFinite(value)?value:null;
}
export function forecastBasis(periods:FinancialPeriod[],latestActualMonth:string){
  const rows=[...periods].sort((a,b)=>a.month.localeCompare(b.month)),errors:string[]=[],warnings:string[]=[];
  if(!rows.length)errors.push('Select at least one historical month.');
  if(!Number.isFinite(monthIndex(latestActualMonth)))errors.push('A valid latest actual month is required.');
  const seen=new Set<string>();
  const required=['revenue','costOfRevenue','operatingExpenses','otherExpenses','taxes'] as const;
  for(const row of rows){
    if(!Number.isFinite(monthIndex(row.month))||seen.has(row.month))errors.push('Historical months must be valid and unique.');seen.add(row.month);
    for(const key of required)if(!validAmount(row[key]))errors.push(`${row.month}: valid non-negative ${key} is required; missing inputs are not zero.`);
  }
  const seed=rows.at(-1);
  if(seed&&seed.month>latestActualMonth)errors.push('Forecast start must follow every actual month.');
  const totals=errors.length?null:summarize(rows);
  const defaults:ForecastAssumptions={revenueGrowth:totals?growth(rows,'revenue'):null,cogsPercentage:totals&&totals.revenue>0?totals.costOfRevenue/totals.revenue*100:null,operatingExpenseGrowth:totals?growth(rows,'operatingExpenses'):null,otherExpenses:totals?totals.otherExpenses/rows.length:null,tax:totals?totals.taxes/rows.length:null};
  if(rows.length<2)warnings.push('Limited history: one month cannot establish growth. Enter revenue and operating expense growth assumptions.');
  if(defaults.revenueGrowth===null&&rows.length>1)warnings.push('Revenue growth cannot be derived from a zero starting revenue. Enter an explicit assumption.');
  if(defaults.operatingExpenseGrowth===null&&rows.length>1)warnings.push('Operating expense growth cannot be derived from a zero starting expense. Enter an explicit assumption.');
  if(defaults.cogsPercentage===null)warnings.push('COGS percentage needs positive historical revenue or an explicit user assumption.');
  if(seed?.revenue===0)warnings.push('The revenue seed is zero. Multiplicative growth keeps revenue at zero; choose another historical basis to model positive revenue.');
  if(seed?.operatingExpenses===0)warnings.push('The operating expense seed is zero. Percentage growth keeps it at zero.');
  if(seed&&rows.length&&monthIndex(seed.month)-monthIndex(rows[0].month)+1!==rows.length)warnings.push('History contains calendar gaps. Growth uses elapsed calendar months; other expense/tax averages use provided rows.');
  if(seed&&seed.month<latestActualMonth)warnings.push('Historical selection ends before the latest actual month. Growth compounds across the gap; no projections are written into actual months.');
  const breakEven=totals?summarizeBreakEven(rows):null;
  const comparison={monthlyFixedCosts:breakEven?.complete?breakEven.totals.fixedCosts!/rows.length:null,variableCostPercentage:breakEven?.complete&&totals&&totals.revenue>0?breakEven.totals.variableCosts!/totals.revenue*100:null,revenue:breakEven?.complete&&breakEven.totals.breakEvenRevenue!==null?breakEven.totals.breakEvenRevenue/rows.length:null,status:!breakEven||!breakEven.complete?'Break-even comparison unavailable: explicit Fixed Costs and Variable Costs are required for every selected month.':breakEven.totals.breakEvenRevenue===null?`Break-even comparison unavailable: ${breakEven.totals.status}`:'Historical cost-structure reference: average monthly fixed costs and period variable-cost/revenue ratio held constant across all scenarios.'};
  return{rows,seed,defaults,errors:[...new Set(errors)],warnings,comparison,historyFrom:rows[0]?.month??'',historyTo:seed?.month??'',latestActualMonth};
}
export type ForecastBasis=ReturnType<typeof forecastBasis>;
export function defaultForecastSettings(basis:ForecastBasis):ForecastSettings{
  return{horizon:3,scenarios:{Conservative:{...basis.defaults},Base:{...basis.defaults},Optimistic:{...basis.defaults}}};
}
function assumptionErrors(a:ForecastAssumptions){
  const errors:string[]=[];
  for(const key of assumptionKeys){const value=a[key];if(value===null||!Number.isFinite(value))errors.push(`${key}: enter a finite assumption.`);
    else if(key==='revenueGrowth'||key==='operatingExpenseGrowth'){if(value < -100||value>1000)errors.push(`${key}: use -100% to 1000%.`);}
    else if(key==='cogsPercentage'){if(value<0||value>1000)errors.push('cogsPercentage: use 0% to 1000%; values above 100% can model losses.');}
    else if(!validAmount(value))errors.push(`${key}: enter a non-negative monthly amount within the supported numeric range.`);
  }return errors;
}
function project(basis:ForecastBasis,settings:ForecastSettings,name:ScenarioName){
  const assumptions=settings.scenarios[name];const errors=assumptionErrors(assumptions);
  type Row=ReturnType<typeof calculateProfits>&{kind:'Forecast estimate';stepsFromSeed:number;breakEvenRevenue:number|null;revenueAboveBreakEven:number|null};
  const rows:Row[]=[];
  if(!basis.seed||basis.errors.length||errors.length)return{name,assumptions,rows,totals:null,errors};
  const seed=basis.seed;
  for(let step=1;step<=settings.horizon;step++){
    const index=monthIndex(basis.latestActualMonth)+step;
    if(index>=120000){errors.push('Forecast dates would exceed YYYY-MM year 9999.');break;}
    const stepsFromSeed=index-monthIndex(seed.month);
    const revenue=seed.revenue*Math.pow(1+assumptions.revenueGrowth!/100,stepsFromSeed);
    const operatingExpenses=seed.operatingExpenses*Math.pow(1+assumptions.operatingExpenseGrowth!/100,stepsFromSeed);
    const costOfRevenue=revenue*assumptions.cogsPercentage!/100;
    if(![revenue,operatingExpenses,costOfRevenue].every(validAmount)){errors.push('Projected amounts exceed the supported numeric range. Reduce growth or horizon.');break;}
    const period=calculateProfits({month:monthAt(index),revenue,costOfRevenue,operatingExpenses,otherExpenses:assumptions.otherExpenses!,taxes:assumptions.tax!});
    rows.push({...period,kind:'Forecast estimate',stepsFromSeed,breakEvenRevenue:basis.comparison.revenue,revenueAboveBreakEven:basis.comparison.revenue===null?null:revenue-basis.comparison.revenue});
  }
  const totals=rows.length===settings.horizon?summarize(rows):null;
  if(totals&&Object.values(totals).some(value=>typeof value==='number'&&(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)))errors.push('Forecast totals exceed the supported numeric range. Reduce growth or horizon.');
  return{name,assumptions,rows:errors.length?[]:rows,totals:errors.length?null:totals,errors};
}
export function buildForecast(input:ForecastInput){
  const selection=selectPeriodRange(input.periods,input.historyRange);
  const basis=forecastBasis(selection.periods,input.latestActualMonth);
  if(selection.error)basis.errors.push(selection.error);
  if(![3,6,12].includes(input.settings.horizon))basis.errors.push('Select a 3, 6 or 12-month forecast horizon.');
  const scenarios=scenarioNames.map(name=>project(basis,input.settings,name));
  const errors=[...basis.errors,...scenarios.flatMap(scenario=>scenario.errors.map(error=>`${scenario.name}: ${error}`))];
  return{basis,scenarios,errors,valid:errors.length===0,forecastFrom:scenarios.find(scenario=>scenario.rows.length)?.rows[0]?.month??'',forecastTo:scenarios.find(scenario=>scenario.rows.length)?.rows.at(-1)?.month??''};
}
