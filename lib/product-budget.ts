import {revenueVariance} from './budget.ts';
import {summarizeProducts,type ProductDataset,type ProductRecord} from './products.ts';
import type {MonthRange} from './date-range.ts';

export function productRevenueVariance(actual:number,budget:number|undefined){
  const result=revenueVariance(actual,budget);
  return{...result,outcome:result.outcome==='Unfavorable'?'Adverse':result.outcome};
}
export function productBudgetTotals(rows:ProductRecord[]){
  const provided=rows.filter(row=>row.revenueBudget!==undefined).length;
  const complete=rows.length>0&&provided===rows.length;
  const actual=rows.reduce((sum,row)=>sum+row.revenue,0);
  const budget=complete?rows.reduce((sum,row)=>sum+row.revenueBudget!,0):undefined;
  return{actual,...productRevenueVariance(actual,budget),provided,count:rows.length,complete,
    status:!provided?'Product budgets not provided':complete?'Complete product budget coverage':`Product budget incomplete: ${provided} of ${rows.length} product-month budgets provided`,
  };
}
export function summarizeProductBudgets(dataset:ProductDataset|null|undefined,range:MonthRange,selectedProduct=''){
  const products=summarizeProducts(dataset,range,selectedProduct);
  const rows=products.sourceRows.map(row=>({...row,...productRevenueVariance(row.revenue,row.revenueBudget)}));
  const grouped=new Map<string,ProductRecord[]>();
  for(const row of products.sourceRows){const group=grouped.get(row.month)??[];group.push(row);grouped.set(row.month,group);}
  return{...productBudgetTotals(products.sourceRows),rows,
    months:[...grouped.entries()].map(([month,records])=>({month,...productBudgetTotals(records)})),
  };
}
