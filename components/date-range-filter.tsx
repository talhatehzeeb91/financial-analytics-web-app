'use client';
import type { MonthRange } from '@/lib/date-range';

export function DateRangeFilter({ range, onChange, onReset, count, total, error, valid }: {
  range: MonthRange; onChange: (range: MonthRange)=>void; onReset: ()=>void;
  count: number; total: number; error: string; valid: boolean;
}) {
  return <section className="panel p-5 sm:p-6" aria-labelledby="period-title">
    <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-700">Focus your analysis</p><h2 id="period-title" className="text-lg font-semibold">Reporting period</h2><p className="mt-2 text-sm text-slate-500">Inclusive months. KPIs, charts, monthly results and exports all follow this range.</p></div><button type="button" onClick={onReset} className="rounded-lg border border-teal-700 px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-50">All months</button></div>
    <div className="mt-4 grid max-w-xl gap-4 sm:grid-cols-2">{(['from','to'] as const).map(bound=><label key={bound} className="min-w-0 text-sm font-medium text-slate-700">{bound==='from'?'From month':'To month'}<input type="month" min="0001-01" max="9999-12" aria-label={bound==='from'?'From month':'To month'} aria-describedby="period-status" aria-invalid={!valid} value={range[bound]} onChange={event=>onChange({...range,[bound]:event.target.value})} className="mt-2 block w-full min-w-0 rounded-lg border border-slate-300 bg-white p-2.5 text-sm"/></label>)}</div>
    <p id="period-status" role={error&&!valid?'alert':'status'} aria-label="Date range status" className={`mt-4 text-sm ${error?'text-amber-800':'text-teal-800'}`}>{error || `Showing ${count} of ${total} monthly records. Profit margins use totals for this period, not averages of monthly percentages.`}</p>
    <p className="mt-2 text-xs text-slate-500">Your full dataset stays intact. All months resets only this filter. Confirming a new import or resetting to demo restores the new dataset’s full range.</p>
  </section>;
}
