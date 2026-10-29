// Explicit monthly cost classification only; never infer from financial or product expenses.
export type BreakEvenPeriod = {month:string;revenue?:number|null;fixedCosts?:number|null;variableCosts?:number|null};
const valid=(value:number|null|undefined):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const finite=(value:number)=>Number.isFinite(value)?value:null;
export function breakEvenMeasures(input:Omit<BreakEvenPeriod,'month'>){
  const revenue=valid(input.revenue)?input.revenue:null;
  const fixedCosts=valid(input.fixedCosts)?input.fixedCosts:null;
  const variableCosts=valid(input.variableCosts)?input.variableCosts:null;
  const contribution=revenue===null||variableCosts===null?null:revenue-variableCosts;
  const ratio=revenue===null||revenue===0||contribution===null?null:finite(contribution/revenue);
  const contributionMargin=ratio===null?null:finite(ratio*100);
  let breakEvenRevenue:number|null=null;
  let reason='';
  if(fixedCosts===null||variableCosts===null)reason='Fixed Costs and Variable Costs must both be provided. Break-even cannot be calculated yet.';
  else if(revenue===null)reason='Valid revenue is required.';
  else if(revenue===0)reason='Zero revenue: contribution margin and break-even are unavailable.';
  else if(ratio===null)reason='Contribution margin exceeds the supported numeric range.';
  else if(ratio<=0)reason='Contribution margin must be positive; no valid break-even point.';
  else {breakEvenRevenue=finite(fixedCosts/ratio);if(breakEvenRevenue===null)reason='Break-even revenue exceeds the supported numeric range.';}
  const marginOfSafety=breakEvenRevenue===null||revenue===null?null:finite(revenue-breakEvenRevenue);
  const marginOfSafetyPercentage=marginOfSafety===null||!revenue?null:finite(marginOfSafety/revenue*100);
  return{revenue,fixedCosts,variableCosts,contribution,contributionMargin,breakEvenRevenue,marginOfSafety,marginOfSafetyPercentage,
    status:reason||(marginOfSafety!>0?'Above break-even':marginOfSafety!<0?'Below break-even':'At break-even')};
}
export function summarizeBreakEven(periods:BreakEvenPeriod[]){
  const rows=[...periods].sort((a,b)=>a.month.localeCompare(b.month)).map(row=>({month:row.month,...breakEvenMeasures(row)}));
  const sum=(key:'revenue'|'fixedCosts'|'variableCosts')=>rows.length>0&&rows.every(row=>row[key]!==null)?rows.reduce((total,row)=>total+row[key]!,0):undefined;
  const provided=rows.filter(row=>row.fixedCosts!==null&&row.variableCosts!==null).length;
  return{rows,count:rows.length,provided,complete:rows.length>0&&provided===rows.length,
    totals:breakEvenMeasures({revenue:sum('revenue'),fixedCosts:sum('fixedCosts'),variableCosts:sum('variableCosts')}),
    coverage:!rows.length?'No monthly data in this period.':provided===rows.length?'Complete fixed/variable cost coverage':`Cost inputs incomplete: ${provided} of ${rows.length} months have both Fixed Costs and Variable Costs. Missing inputs are not zero.`};
}
