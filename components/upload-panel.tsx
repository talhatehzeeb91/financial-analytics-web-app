'use client';
import { useRef, useState } from 'react';
import type { FinancialPeriod } from '@/lib/finance';
import { parseFinancialFile } from '@/lib/import-financials';

export function UploadPanel({ onImport, onReset }: { onImport: (periods: FinancialPeriod[]) => void; onReset: () => void }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function handleFile(file?: File) {
    if (!file) return;
    setBusy(true); setErrors([]); setStatus('Reading file locally…');
    const result = await parseFinancialFile(file);
    if (result.errors.length) { setErrors(result.errors); setStatus('Import failed. Your current dashboard data has been kept.'); }
    else { onImport(result.periods); setStatus(`Loaded ${result.periods.length} month${result.periods.length === 1 ? '' : 's'} from ${file.name}. Data stays in this browser tab.`); }
    setBusy(false);
    if (input.current) input.current.value = '';
  }
  return <section className="panel p-5 sm:p-6" aria-labelledby="import-title">
    <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-700">Your data, your browser</p><h2 id="import-title" className="text-lg font-semibold">Bring your finances into focus</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Import a CSV or Excel workbook. Files are parsed locally and never uploaded to a server. Refreshing the page returns to demo data.</p></div><a href="/financial-template.csv" download className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50">↓ Download sample CSV</a></div>
    <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-teal-300 bg-teal-50/40 p-5"><label className="min-w-0 flex-1 text-sm font-medium text-slate-700">Choose a financial data file<input ref={input} type="file" accept=".csv,.xlsx" disabled={busy} aria-describedby="import-help" onChange={event => void handleFile(event.target.files?.[0])} className="mt-3 block w-full text-xs text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-700 file:px-4 file:py-2.5 file:font-semibold file:text-white disabled:opacity-50"/></label><button type="button" disabled={busy} onClick={() => { onReset(); setErrors([]); setStatus('Reset to fictional demo data.'); if (input.current) input.current.value = ''; }} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Reset to demo</button></div>
    <p id="import-help" className="mt-4 text-xs leading-6 text-slate-500">Required columns: <code>Month, Revenue, COGS, OperatingExpenses, OtherExpenses, Tax</code>. Month: YYYY-MM (Excel text cells). Amounts: non-negative numbers in USD, without currency symbols or separators. <strong>OtherExpenses excludes tax.</strong> XLSX: first worksheet only. Maximum 5 MB, 1,000 months, and $1 trillion per amount. The sample is fictional.</p>
    <p role="status" className="mt-2 text-sm text-teal-800">{busy ? 'Reading file locally…' : status}</p>
    {errors.length > 0 && <div role="alert" className="mt-3 max-h-60 overflow-auto rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Please fix the file and try again:</p><ul className="mt-2 list-inside list-disc space-y-1">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
  </section>;
}
