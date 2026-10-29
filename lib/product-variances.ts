import {summarizeProducts,type ProductDataset,type ProductRecord} from './products.ts';
import type {MonthRange} from './date-range.ts';
export const varianceOutcome=(value:number|null)=>value===null?'Not available':value>0?'Favorable':value<0?'Adverse':'On budget';
export function salesCostVariance(row:ProductRecord){
  const actualSellingPrice=row.unitsSold>0?row.revenue/row.unitsSold:null;
  const finitePrice=actualSellingPrice!==null&&Number.isFinite(actualSellingPrice)?actualSellingPrice:null;
  const expectedRevenueBudget=row.budgetedUnits===undefined||row.budgetedSellingPrice===undefined?null:row.budgetedUnits*row.budgetedSellingPrice;
  const tolerance=expectedRevenueBudget===null?0:Math.max(0.01,Number.EPSILON*Math.max(Math.abs(expectedRevenueBudget),Math.abs(row.revenueBudget??0))*8);
  const reconciled=expectedRevenueBudget!==null&&row.revenueBudget!==undefined&&Math.abs(expectedRevenueBudget-row.revenueBudget)<=tolerance;
  let reconciliation='Reconciled';
  if(expectedRevenueBudget===null||row.revenueBudget===undefined)reconciliation='Missing sales plan';
  else if(!reconciled)reconciliation='Revenue budget mismatch';
  else if(row.unitsSold===0&&row.revenue!==0)reconciliation='Zero units with revenue';
  else if(row.unitsSold>0&&finitePrice===null)reconciliation='Selling price unavailable';
  const available=reconciliation==='Reconciled';
  const volumeVariance=available?(row.unitsSold-row.budgetedUnits!)*row.budgetedSellingPrice!:null;
  const priceVariance=available?(row.unitsSold===0?0:(finitePrice!-row.budgetedSellingPrice!)*row.unitsSold):null;
  const revenueVariance=row.revenueBudget===undefined?null:row.revenue-row.revenueBudget;
  const costVariance=row.costBudget===undefined?null:row.costBudget-row.productCost;
  return{...row,actualSellingPrice:finitePrice,expectedRevenueBudget,reconciliation,reconciliationDifference:expectedRevenueBudget===null||row.revenueBudget===undefined?null:expectedRevenueBudget-row.revenueBudget,volumeVariance,priceVariance,revenueVariance,costVariance,
    volumeOutcome:varianceOutcome(volumeVariance),priceOutcome:varianceOutcome(priceVariance),costOutcome:varianceOutcome(costVariance)};
}
export function salesCostTotals(records:ProductRecord[]){
  const rows=records.map(salesCostVariance);
  const salesProvided=rows.filter(row=>row.reconciliation==='Reconciled').length;
  const costsProvided=rows.filter(row=>row.costBudget!==undefined).length;
  const salesComplete=rows.length>0&&salesProvided===rows.length,costsComplete=rows.length>0&&costsProvided===rows.length;
  return{rows,salesProvided,costsProvided,count:rows.length,
    volumeVariance:salesComplete?rows.reduce((sum,row)=>sum+row.volumeVariance!,0):null,
    priceVariance:salesComplete?rows.reduce((sum,row)=>sum+row.priceVariance!,0):null,
    revenueVariance:rows.length>0&&rows.every(row=>row.revenueBudget!==undefined)?rows.reduce((sum,row)=>sum+row.revenueVariance!,0):null,
    actualCost:rows.reduce((sum,row)=>sum+row.productCost,0),
    costBudget:costsComplete?rows.reduce((sum,row)=>sum+row.costBudget!,0):null,
    costVariance:costsComplete?rows.reduce((sum,row)=>sum+row.costVariance!,0):null,
    mismatches:rows.filter(row=>row.reconciliation==='Revenue budget mismatch').length,
    provided:rows.filter(row=>row.budgetedUnits!==undefined||row.budgetedSellingPrice!==undefined||row.costBudget!==undefined).length};
}
export function summarizeSalesCost(dataset:ProductDataset|null|undefined,range:MonthRange,selectedProduct=''){
  return salesCostTotals(summarizeProducts(dataset,range,selectedProduct).sourceRows);
}
