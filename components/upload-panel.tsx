'use client';
import { useRef, useState } from 'react';
import { DataPreparationGuide } from './data-preparation-guide';
import { currency, summarize, type FinancialPeriod } from '@/lib/finance';
import { columns, currencies, readSourceFile, suggestMapping, validateMapping, type CurrencyCode, type ImportResult, type Mapping, type SourceSheet } from '@/lib/import-financials';

const control = 'mt-2 block w-full min-w-0 rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-800';
export function UploadPanel({ onImport, onReset }: { onImport: (periods: FinancialPeriod[], currency: CurrencyCode, filename: string) => void; onReset: () => void }) {
  const [filename, setFilename] = useState('');
  const [sheets, setSheets] = useState<SourceSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState('');
  const [mapping, setMapping] = useState<Mapping>({});
  const [currencyCode, setCurrencyCode] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [zeroConfirmed, setZeroConfirmed] = useState(false);
  const [review, setReview] = useState<ImportResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const sheet = sheetIndex === '' ? undefined : sheets[Number(sheetIndex)];
  const zeroFields = columns.filter(field => mapping[field] === 'zero');
  function invalidate() { setReview(null); setErrors([]); setConfirmed(false); setZeroConfirmed(false); }
  function selectSheet(index: string, source = sheets) {
    setSheetIndex(index); setMapping(index === '' ? {} : suggestMapping(source[Number(index)].headers)); invalidate();
  }
  async function handleFile(file?: File) {
    if (!file) return;
    setBusy(true); setFilename(''); setSheets([]); setSheetIndex(''); setMapping({}); setCurrencyCode(''); invalidate(); setStatus('Reading file locally…');
    try {
      const source = await readSourceFile(file);
      setSheets(source); setFilename(file.name);
      if (/\.csv$/i.test(file.name)) selectSheet('0', source);
      setStatus(`File ready: ${file.name}. Preview, map and validate before importing. Your dashboard has not changed.`);
    } catch (error) { setErrors([error instanceof Error ? error.message : 'Could not read this file.']); setStatus('Your current dashboard data has been kept.'); }
    setBusy(false); if (input.current) input.current.value = '';
  }
  function reset() {
    onReset(); setFilename(''); setSheets([]); setSheetIndex(''); setMapping({}); setCurrencyCode(''); invalidate(); setStatus('Reset to fictional demo data (USD).');
    if (input.current) input.current.value = '';
  }
  const summary = review && !review.errors.length ? summarize(review.periods) : null;
  return <section className="panel min-w-0 p-5 sm:p-6" aria-labelledby="import-title">
    <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-700">Your data, your browser</p><h2 id="import-title" className="text-lg font-semibold">Bring your finances into focus</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Monthly summaries only. Preview and map your CSV or Excel columns without renaming them. Files stay in this browser tab.</p></div><div className="flex flex-wrap gap-2">{['xlsx', 'csv'].map(extension => <a key={extension} href={`/financial-template.${extension}`} download className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50">↓ {extension.toUpperCase()} template</a>)}</div></div>
    <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_1.2fr]"><div className="min-w-0">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-teal-300 bg-teal-50/40 p-5"><label className="min-w-0 flex-1 text-sm font-medium text-slate-700">1. Choose a financial data file<input ref={input} type="file" accept=".csv,.xlsx" disabled={busy} aria-describedby="import-help" onChange={event => void handleFile(event.target.files?.[0])} className="mt-3 block w-full text-xs text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-700 file:px-4 file:py-2.5 file:font-semibold file:text-white disabled:opacity-50"/></label><button type="button" disabled={busy} onClick={reset} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50">Reset to demo</button></div>
      <p id="import-help" className="mt-3 text-xs leading-6 text-slate-500">One row per month, not sales or invoice transactions. Month and Revenue are required. OtherExpenses excludes Tax. No currency conversion or server upload.</p>
    </div><DataPreparationGuide/></div>
    {sheets.length > 0 && <div className="mt-5 min-w-0 space-y-5 border-t border-slate-200 pt-5">
      <p className="break-all text-sm text-slate-600"><strong>Selected file (not yet imported):</strong> {filename}</p>
      <label className="block max-w-sm text-sm font-semibold">Worksheet<select aria-label="Worksheet" className={control} value={sheetIndex} onChange={event => selectSheet(event.target.value)}><option value="">Select a worksheet</option>{sheets.map((item, index) => <option key={index} value={index}>{item.name}</option>)}</select></label>
      {sheet && <>
        <div><h3 className="text-sm font-semibold">2. Preview source data</h3><p className="mt-1 text-xs text-slate-500">First five data rows. Blank rows are ignored. Preview does not change the dashboard.</p><div className="mt-3 max-h-64 overflow-auto rounded-lg border border-slate-200"><table className="w-full text-left text-xs"><thead className="bg-slate-50"><tr>{sheet.headers.map((header, index) => <th scope="col" key={index} className="whitespace-nowrap p-3">{header || '(blank header)'} <span className="font-normal text-slate-400">#{index + 1}</span></th>)}</tr></thead><tbody>{sheet.rows.filter(row => row.some(value => value != null && String(value).trim() !== '')).slice(0, 5).map((row, index) => <tr key={index} className="border-t border-slate-100">{sheet.headers.map((_, column) => <td key={column} className="max-w-60 truncate p-3">{row[column] instanceof Date ? (row[column] as Date).toISOString() : String(row[column] ?? '')}</td>)}</tr>)}</tbody></table></div></div>
        <div><h3 className="text-sm font-semibold">3. Map columns & choose currency</h3><p className="mt-1 text-xs text-slate-500">Suggested matches need your confirmation. Each source column can be used once. Missing expenses are never assumed to be zero.</p><div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{columns.map(field => <label key={field} className="min-w-0 text-xs font-semibold text-slate-600">{field}{field === 'Month' || field === 'Revenue' ? ' (required)' : ''}<select aria-label={`${field}${field === 'Month' || field === 'Revenue' ? ' (required)' : ''}`} className={control} value={mapping[field] ?? ''} onChange={event => { const value = event.target.value; setMapping(previous => ({ ...previous, [field]: value === '' ? undefined : value === 'zero' ? 'zero' : Number(value) })); invalidate(); }}><option value="">Choose source column</option>{sheet.headers.map((header, index) => <option key={index} value={index} disabled={!header || columns.some(other => other !== field && mapping[other] === index)}>{header || '(blank header)'} (column {index + 1})</option>)}{field !== 'Month' && field !== 'Revenue' && <option value="zero">Not applicable — use 0</option>}</select></label>)}</div>
        <label className="mt-4 block max-w-sm text-xs font-semibold text-slate-600">File currency<select aria-label="File currency" className={control} value={currencyCode} onChange={event => { setCurrencyCode(event.target.value); invalidate(); }}><option value="">Select file currency</option>{currencies.map(code => <option key={code}>{code}</option>)}</select></label><p className="mt-2 text-xs text-slate-500">Choose the currency already used by every amount in this file. Only labels change; amounts are not converted.</p></div>
        <div className="space-y-3 text-sm"><label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={event => { setConfirmed(event.target.checked); setReview(null); }} className="mt-1"/>I confirm these column mappings describe monthly summaries.</label>{zeroFields.length > 0 && <label className="flex items-start gap-2"><input type="checkbox" checked={zeroConfirmed} onChange={event => { setZeroConfirmed(event.target.checked); setReview(null); }} className="mt-1"/>I confirm these fields do not apply and should use 0 for every month: {zeroFields.join(', ')}.</label>}</div>
        <button type="button" onClick={() => { const result = validateMapping(sheet, mapping, currencyCode, confirmed, zeroConfirmed); setErrors(result.errors); setReview(result.errors.length ? null : result); }} className="rounded-lg border border-teal-700 px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-50">Validate and review</button>
        {summary && review && <div className="rounded-xl border border-teal-200 bg-teal-50 p-5" aria-label="Import summary"><h3 className="font-semibold text-teal-900">4. Ready to analyze</h3><p className="mt-2 text-sm text-teal-900">{review.periods.length} {review.periods.length === 1 ? 'month' : 'months'} · {review.periods[0].month} to {review.periods.at(-1)?.month} · {currencyCode} · no conversion</p><p className="mt-2 text-sm">Revenue: {currency(summary.revenue, currencyCode)} · Net profit: {currency(summary.netProfit, currencyCode)}</p><p className="mt-2 text-xs">Zero for every month: {zeroFields.length ? zeroFields.join(', ') : 'none'}. All monthly values passed validation. Your dashboard changes only when you import.</p><button type="button" onClick={() => { onImport(review.periods, currencyCode as CurrencyCode, filename); setStatus(`Imported ${review.periods.length} month${review.periods.length === 1 ? '' : 's'} in ${currencyCode}. Data stays in this browser tab.`); setSheets([]); setReview(null); }} className="mt-4 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">Import and analyze</button></div>}
      </>}
    </div>}
    <p role="status" aria-label="Import status" className="mt-3 text-sm text-teal-800">{status}</p>
    {errors.length > 0 && <div role="alert" className="mt-3 max-h-60 overflow-auto rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Please review your import:</p><ul className="mt-2 list-inside list-disc space-y-1">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
  </section>;
}
