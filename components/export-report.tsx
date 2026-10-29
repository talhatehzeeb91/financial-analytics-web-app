'use client';
import { useState } from 'react';
import {summarizeSalesCost} from '@/lib/product-variances';
import {summarizeProductBudgets} from '@/lib/product-budget';
import { summarizeProducts } from '@/lib/products';
import { exportProductBudgetCsv, exportProductCsv, exportReportCsv, type ReportInput } from '@/lib/reports';

function download(blob: Blob, name: string) {
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function base64(buffer: ArrayBuffer) {
  let text='';const bytes=new Uint8Array(buffer);
  for(let start=0;start<bytes.length;start+=8192) text+=String.fromCharCode(...bytes.subarray(start,start+8192));
  return btoa(text);
}
export function ExportReport(input: ReportInput) {
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const from=input.selectedRange?.from ?? input.periods[0].month;
  const to=input.selectedRange?.to ?? input.periods.at(-1)!.month;
  const name=`ledger-${input.isDemo?'demo':'report'}-${from}-${to}`;
  const productResults=summarizeProducts(input.productDataset,{from,to},input.selectedProduct);
  function productCsv(){if(!input.productDataset)return;download(new Blob([exportProductCsv(input.productDataset,{from,to},input.selectedProduct)],{type:'text/csv;charset=utf-8'}),`ledger-products-${from}-${to}.csv`);setStatus('Separate product CSV downloaded in its own currency.');}
  const salesCost=summarizeSalesCost(input.productDataset,{from,to},input.selectedProduct);
  const productBudgets=summarizeProductBudgets(input.productDataset,{from,to},input.selectedProduct);
  function productBudgetCsv(){if(!input.productDataset)return;download(new Blob([exportProductBudgetCsv(input.productDataset,{from,to},input.selectedProduct)],{type:'text/csv;charset=utf-8'}),`ledger-product-budgets-${from}-${to}.csv`);setStatus('Product-month budget CSV downloaded in its own currency.');}
  async function pdf() {
    // Capture this render's dataset; subsequent UI changes cannot mix currencies.
    const snapshot={...input,periods:input.periods.map(period=>({...period}))};
    setBusy(true);setStatus('Preparing your PDF locally…');
    try {
      const [{createPdfReport},regular,bold]=await Promise.all([
        import('@/lib/pdf-report'),
        fetch('/fonts/DejaVuSans.ttf').then(response=>{if(!response.ok)throw new Error('Font unavailable');return response.arrayBuffer();}),
        fetch('/fonts/DejaVuSans-Bold.ttf').then(response=>{if(!response.ok)throw new Error('Font unavailable');return response.arrayBuffer();}),
      ]);
      const doc=createPdfReport(snapshot,{regular:base64(regular),bold:base64(bold)});
      download(doc.output('blob'),`${name}.pdf`);setStatus('PDF downloaded. No financial data was uploaded.');
    } catch {setStatus('Could not create the PDF. Your dataset is unchanged; please retry.');}
    finally {setBusy(false);}
  }
  function csv() {
    try {download(new Blob([exportReportCsv(input)],{type:'text/csv;charset=utf-8'}),`${name}.csv`);setStatus('CSV downloaded. No financial data was uploaded.');}
    catch {setStatus('Could not create the CSV. Your dataset is unchanged; please retry.');}
  }
  return <section className="panel p-5 sm:p-6" aria-labelledby="export-title">
    <div className="flex flex-wrap items-start justify-between gap-5"><div className="min-w-0"><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-700">Take your insights with you</p><h2 id="export-title" className="text-lg font-semibold">Export report</h2><p className="mt-2 max-w-2xl break-all text-sm text-slate-500">{input.isDemo?'Fictional demo data — illustrative only':`Active dataset: ${input.filename}`}</p><p className="mt-2 text-xs text-slate-500">Selected period: {from} to {to} · {input.currencyCode} · {input.periods.length} monthly records · no conversion · generated locally in your browser</p></div><div className="flex flex-wrap gap-3"><button type="button" onClick={csv} disabled={busy} className="rounded-lg border border-teal-700 px-4 py-2.5 text-sm font-semibold text-teal-800 disabled:opacity-50">Download CSV</button>{productResults.rows.length>0&&<button type="button" onClick={productCsv} disabled={busy} className="rounded-lg border border-teal-700 px-4 py-2.5 text-sm font-semibold text-teal-800">Download product CSV</button>}{(productBudgets.provided>0||salesCost.provided>0)&&<button type="button" onClick={productBudgetCsv} disabled={busy} className="rounded-lg border border-teal-700 px-4 py-2.5 text-sm font-semibold text-teal-800">Download product budget CSV</button>}<button type="button" onClick={()=>void pdf()} disabled={busy} className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy?'Preparing PDF…':'Download PDF'}</button></div></div>
    <p className="mt-4 text-xs leading-5 text-slate-500">CSV includes monthly source amounts, calculated profits, margins, COGS percentages and selected-period COGS totals, and optional revenue and COGS budget variances. PDF includes a financial summary, expense breakdown and paginated monthly results and COGS analysis, including revenue and COGS budgets when provided. Zero-revenue margins show N/A. PDF amounts use two decimals; CSV retains numeric precision.</p>
    <p className="mt-3 break-words text-xs text-slate-500">{productResults.status}{productResults.currencyCode?` · Product currency: ${productResults.currencyCode}`:''}. Monthly CSV and product CSV stay separate. Product selection: {input.selectedProduct||'All products'}. Product CSV includes aggregate budgets; product budget CSV has monthly sales price/volume, cost-budget and reconciliation detail. PDF includes separate product sections when available; product amounts never alter monthly totals.</p>
    <p role="status" aria-label="Export status" className="mt-2 text-sm text-teal-800">{status}</p>
  </section>;
}
