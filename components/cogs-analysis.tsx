'use client';
import { CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { analyzeCogs, cogsPercent } from '@/lib/cogs';
import type { FinancialPeriod } from '@/lib/finance';
import { reportMoney } from '@/lib/reports';

export function CogsAnalysis({ periods, currencyCode, periodLabel }: { periods: FinancialPeriod[]; currencyCode: string; periodLabel: string }) {
  const result = analyzeCogs(periods);
  const money = (value: number | null) => value === null ? 'N/A' : reportMoney(value, currencyCode);
  const cards = [ ['Total COGS', money(result.totals.cogs)], ['COGS / revenue', cogsPercent(result.totals.cogsPercentage)],
    ['Gross profit', money(result.totals.grossProfit)], ['Gross margin', cogsPercent(result.totals.grossMargin)] ];
  return <section id="cogs-analysis" className="panel min-w-0 p-5 sm:p-6" aria-labelledby="cogs-title">
    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-700">Cost of goods sold</p>
    <h2 id="cogs-title" className="text-lg font-semibold">COGS Analysis</h2>
    <p className="mt-1 text-xs text-slate-500">{periodLabel} · {currencyCode} · monthly financial dataset only</p>
    <p className="mt-3 text-xs leading-5 text-slate-500">Product costs are separate and never added to monthly COGS. Period percentages use totals, not an average of monthly percentages. Zero revenue gives N/A; missing COGS is never assumed to be zero.</p>
    {!result.complete && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{result.status}</p>}
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value]) => <article key={label} className="min-w-0 rounded-xl border border-slate-200 p-4"><h3 className="text-xs text-slate-500">{label}</h3><p className={`mt-3 break-words text-xl font-semibold ${label === 'Gross profit' || label === 'Gross margin' ? result.totals.grossProfit === null || result.totals.grossProfit === 0 ? 'text-slate-600' : result.totals.grossProfit < 0 ? 'text-red-700' : 'text-teal-700' : 'text-slate-800'}`}>{value}</p></article>)}</div>
    {!!result.rows.length && <>
      <div className="mt-6 h-80 w-full overflow-hidden" role="img" aria-label="Monthly COGS, revenue, gross profit and COGS percentage. Exact figures follow in the table.">
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={result.rows} margin={{ top:10, right:5, left:0, bottom:5 }}>
          <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e2e8f0"/><XAxis dataKey="month" tick={{ fontSize:11 }}/>
          <YAxis yAxisId="amount" width={85} tick={{ fontSize:10 }} tickFormatter={value => `${currencyCode} ${value / 1000}k`}/>
          <YAxis yAxisId="percent" orientation="right" width={48} tick={{ fontSize:10 }} tickFormatter={value => `${value}%`}/>
          <Tooltip formatter={(value,name) => name === 'COGS %' ? cogsPercent(Number(value)) : money(Number(value))}/><Legend wrapperStyle={{ fontSize:12 }}/>
          <Line yAxisId="amount" dataKey="revenue" name="Revenue" stroke="#0d9488" strokeWidth={2.5} connectNulls={false} isAnimationActive={false}/>
          <Line yAxisId="amount" dataKey="cogs" name="COGS" stroke="#818cf8" strokeWidth={2.5} connectNulls={false} isAnimationActive={false}/>
          <Line yAxisId="amount" dataKey="grossProfit" name="Gross profit" stroke="#475569" strokeWidth={2} connectNulls={false} isAnimationActive={false}/>
          <Line yAxisId="percent" dataKey="cogsPercentage" name="COGS %" stroke="#b45309" strokeDasharray="5 4" strokeWidth={2} connectNulls={false} isAnimationActive={false}/>
        </ComposedChart></ResponsiveContainer>
      </div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-right text-sm"><caption className="sr-only">Monthly COGS analysis in {currencyCode}</caption><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Month','COGS','Revenue','Gross profit','COGS %','Gross margin'].map(label => <th key={label} scope="col" className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{result.rows.map(row => <tr key={row.month} className="border-b border-slate-100"><th scope="row" className="px-3 py-3 font-medium">{row.month}</th><td className="px-3 py-3">{money(row.cogs)}</td><td className="px-3 py-3">{money(row.revenue)}</td><td className={`px-3 py-3 ${row.grossProfit === null || row.grossProfit === 0 ? 'text-slate-600' : row.grossProfit < 0 ? 'text-red-700' : 'text-teal-700'}`}>{money(row.grossProfit)}</td><td className="px-3 py-3">{cogsPercent(row.cogsPercentage)}</td><td className="px-3 py-3">{cogsPercent(row.grossMargin)}</td></tr>)}</tbody><tfoot className="bg-teal-50 font-semibold"><tr><th scope="row" className="px-3 py-3">Period totals</th><td className="px-3 py-3">{money(result.totals.cogs)}</td><td className="px-3 py-3">{money(result.totals.revenue)}</td><td className="px-3 py-3">{money(result.totals.grossProfit)}</td><td className="px-3 py-3">{cogsPercent(result.totals.cogsPercentage)}</td><td className="px-3 py-3">{cogsPercent(result.totals.grossMargin)}</td></tr></tfoot></table></div>
    </>}
  </section>;
}
