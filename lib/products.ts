import { margin } from './finance.ts';
import { selectPeriodRange, type MonthRange } from './date-range.ts';
import { MAX_AMOUNT, MAX_ROWS, type CurrencyCode, type SourceSheet } from './import-financials.ts';

export const productFields=['Month','Product','Units Sold','Revenue','Product Cost'] as const;
export type ProductField=typeof productFields[number];
export type ProductMapping=Partial<Record<ProductField,number>>;
export type ProductRecord={month:string;product:string;unitsSold:number;revenue:number;productCost:number};
export type ProductDataset={rows:ProductRecord[];currencyCode:CurrencyCode;filename:string};
const aliases:Record<ProductField,string[]>={Month:['month','period','reportingmonth','accountingperiod'],Product:['product','productname','item','sku'], 'Units Sold':['unitssold','units','quantity','qty'],Revenue:['revenue','sales','turnover'],'Product Cost':['productcost','cost','cogs','costofgoods','productcosts']};
export function suggestProductMapping(headers:string[]):ProductMapping {
  const result:ProductMapping={};
  for(const field of productFields){const matches=headers.map((header,index)=>aliases[field].includes(header.toLowerCase().replace(/[^a-z0-9]/g,''))?index:-1).filter(index=>index>=0);if(matches.length===1&&!Object.values(result).includes(matches[0]))result[field]=matches[0];}
  return result;
}
export function validateProductMapping(sheet:SourceSheet,mapping:ProductMapping,confirmed:boolean):{rows:ProductRecord[];errors:string[]} {
  const errors:string[]=[],used=new Set<number>();
  if(!confirmed)errors.push('Confirm your product column mappings before validating.');
  if(sheet.headers.some((header,index)=>header&&sheet.headers.indexOf(header)!==index))errors.push('Duplicate source headers. Use unique column names.');
  for(const field of productFields){const index=mapping[field];if(index===undefined||!Number.isInteger(index)||index<0||index>=sheet.headers.length||!sheet.headers[index])errors.push(`Map ${field} to a source column. Missing values are never assumed to be zero.`);else if(used.has(index))errors.push(`Duplicate mapping for ${field}. Each source column can be used once.`);else used.add(index);}
  const data=sheet.rows.map((cells,index)=>({cells,row:index+2})).filter(({cells})=>cells.some(value=>value!=null&&String(value).trim()!==''));
  if(!data.length)errors.push('The selected worksheet/file is empty or has no product data rows.');
  if(data.length>MAX_ROWS)errors.push(`Use at most ${MAX_ROWS} product-month rows.`);
  if(errors.length)return{rows:[],errors};
  const seen=new Set<string>(),rows:ProductRecord[]=[];
  for(const{cells,row}of data){
    const month=String(cells[mapping.Month!]??'').trim(),product=String(cells[mapping.Product!]??'').trim();
    if(!/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month))errors.push(`Row ${row}: Month must use YYYY-MM (Excel text cells).`);
    if(!product||product.length>200)errors.push(`Row ${row}: Product is required and must be no longer than 200 characters.`);
    const key=JSON.stringify([month,product]);if(seen.has(key))errors.push(`Row ${row}: duplicate Month and Product. Use one summary row per product per month.`);seen.add(key);
    const values=(['Units Sold','Revenue','Product Cost']as const).map(field=>{const raw=cells[mapping[field]!],text=typeof raw==='string'?raw.trim():'';const value=typeof raw==='number'?raw:/^\d+(\.\d+)?$/.test(text)?Number(text):NaN;if(!Number.isFinite(value)||value<0||value>MAX_AMOUNT)errors.push(`Row ${row}: ${field} must be a non-negative number no greater than ${MAX_AMOUNT}. Blank values, currency symbols and separators are not allowed.`);return value;});
    rows.push({month,product,unitsSold:values[0],revenue:values[1],productCost:values[2]});
  }
  return errors.length?{rows:[],errors}:{rows:rows.sort((a,b)=>a.month.localeCompare(b.month)||a.product.localeCompare(b.product)),errors:[]};
}
export function productProfit(row:{revenue:number;productCost:number}) {
  const grossProfit=row.revenue-row.productCost;
  return{grossProfit,grossMargin:margin(grossProfit,row.revenue)};
}
export function summarizeProducts(dataset:ProductDataset|null|undefined,range:MonthRange) {
  if(!dataset)return{status:'Product data not provided',rows:[],sourceRows:[],currencyCode:'',filename:'',error:''};
  const selection=selectPeriodRange(dataset.rows,range);
  if(!selection.valid)return{status:selection.error,rows:[],sourceRows:[],currencyCode:dataset.currencyCode,filename:dataset.filename,error:selection.error};
  const grouped=new Map<string,{product:string;unitsSold:number;revenue:number;productCost:number}>();
  for(const row of selection.periods){const total=grouped.get(row.product)??{product:row.product,unitsSold:0,revenue:0,productCost:0};total.unitsSold+=row.unitsSold;total.revenue+=row.revenue;total.productCost+=row.productCost;grouped.set(row.product,total);}
  const rows=[...grouped.values()].map(row=>({...row,...productProfit(row)})).sort((a,b)=>b.grossProfit-a.grossProfit||a.product.localeCompare(b.product));
  return{status:rows.length?'Product results available':'No product data in the selected period',rows,sourceRows:selection.periods,currencyCode:dataset.currencyCode,filename:dataset.filename,error:''};
}
