'use client';

import { useState } from 'react';
import { ExportReport } from '@/components/export-report';
import { reportMargin } from '@/lib/reports';
import { UploadPanel } from '@/components/upload-panel';
import type { CurrencyCode } from '@/lib/import-financials';
import type { FinancialPeriod } from '@/lib/finance';
import { ExpenseChart, RevenueChart } from '@/components/financial-charts';
import { demoPeriods } from '@/lib/demo-data';
import { calculateProfits, currency, summarize } from '@/lib/finance';

export default function Dashboard() {
  const [periods, setPeriods] = useState<FinancialPeriod[]>(demoPeriods);
  const [activeFilename, setActiveFilename] = useState('');
  const [isDemo, setIsDemo] = useState(true);
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>('USD');
  const money = (value: number) => currency(value, currencyCode);
  const totals = summarize(periods);
  const monthly = periods.map(calculateProfits);
  const formatMonth = (month: string) => new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
  const dateRange = `${formatMonth(periods[0].month)} – ${formatMonth(periods[periods.length - 1].month)}`;
  const sourceLabel = isDemo ? 'Fictional demo data' : 'Uploaded data';
  const expenses = [
    { name: 'COGS', value: totals.costOfRevenue, color: '#0d9488' },
    { name: 'Operating expenses', value: totals.operatingExpenses, color: '#2dd4bf' },
    { name: 'Other expenses (excl. tax)', value: totals.otherExpenses, color: '#99f6e4' },
    { name: 'Tax', value: totals.taxes, color: '#cbd5e1' },
  ];
  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.value, 0);
  const metrics = [
    { name: 'Revenue', value: totals.revenue, detail: 'Total business income', icon: '↗' },
    { name: 'Gross Profit', value: totals.grossProfit, detail: `${reportMargin(totals.grossProfit, totals.revenue)} gross margin`, icon: '◈' },
    { name: 'Operating Profit', value: totals.operatingProfit, detail: `${reportMargin(totals.operatingProfit, totals.revenue)} operating margin`, icon: '▥' },
    { name: 'Net Profit', value: totals.netProfit, detail: `${reportMargin(totals.netProfit, totals.revenue)} net margin`, icon: '◎' },
  ];
  return <div className="min-h-screen lg:flex">
    <aside className="border-b border-slate-200 bg-white p-5 lg:fixed lg:inset-y-0 lg:w-60 lg:border-r lg:p-7">
      <a href="#overview" className="flex items-center gap-3 text-2xl font-bold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-teal-700 text-xl text-white">▥</span>ledger<span className="text-teal-600">.</span></a>
      <p className="mt-8 hidden text-[10px] font-bold tracking-[0.18em] text-slate-400 lg:block">WORKSPACE</p>
      <nav aria-label="Dashboard navigation" className="mt-5 flex gap-2 overflow-x-auto lg:flex-col">
        <a href="#overview" aria-current="page" className="nav-item bg-teal-50 font-semibold text-teal-800"><span aria-hidden="true">▦</span> Overview</a>
        <a href="#performance" className="nav-item text-slate-500"><span aria-hidden="true">↗</span> Performance</a>
        <a href="#expenses" className="nav-item text-slate-500"><span aria-hidden="true">◉</span> Expenses</a>
        <a href="#monthly-detail" className="nav-item text-slate-500"><span aria-hidden="true">▤</span> Monthly report</a>
      </nav>
      <div className="mt-10 hidden rounded-xl border border-teal-100 bg-teal-50/60 p-4 lg:block"><span className="text-lg" aria-hidden="true">✧</span><p className="mt-2 text-sm font-semibold text-teal-900">A clearer financial picture</p><p className="mt-2 text-xs leading-5 text-teal-800">Explore your business performance. Import your data privately in this browser.</p></div>
      <div className="bottom-7 mt-8 hidden items-center gap-3 lg:absolute lg:flex"><span className="grid size-9 place-items-center rounded-full bg-slate-100 text-xs font-bold">AC</span><div><p className="text-sm font-semibold">Acme Studio</p><p className="text-xs text-slate-500">{isDemo ? 'Demo workspace' : 'Local data workspace'}</p></div></div>
    </aside>
    <main id="overview" className="min-w-0 flex-1 lg:ml-60">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-5 lg:px-10"><p className="text-sm text-slate-500">Workspace <span className="mx-2 text-slate-300">/</span><span className="font-medium text-slate-800">Financial overview</span></p><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{isDemo ? 'Demo data' : 'Uploaded data'}</span></header>
      <div className="mx-auto max-w-[1600px] space-y-7 p-6 lg:p-10">
        <section className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-teal-700">Your business at a glance</p><h1 className="text-3xl font-bold tracking-tight text-slate-900">Financial overview</h1><p className="mt-2 text-sm text-slate-500">A little clarity. A better next decision.</p></div><div className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600">{dateRange} <span className="ml-3 text-slate-400">· {currencyCode}</span></div></section>
        <div className="flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-teal-900"><span aria-hidden="true">ⓘ</span><p>{isDemo ? <><strong>Sample workspace.</strong> All figures are fictional demo data for illustration and do not represent actual financial performance.</> : <><strong>Your uploaded data.</strong> Calculations use the file you selected. Financial data stays in this browser tab.<span className="mt-1 block break-all" aria-label="Active dataset"><strong>Active dataset:</strong> {activeFilename}</span></>}</p></div>
        <UploadPanel onImport={(data, code, filename) => { setActiveFilename(filename); setPeriods(data); setCurrencyCode(code); setIsDemo(false); }} onReset={() => { setActiveFilename(''); setPeriods(demoPeriods); setCurrencyCode('USD'); setIsDemo(true); }}/>
        <section aria-label="Key financial indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(metric => <article key={metric.name} className="panel p-5"><div className="flex items-center justify-between"><h2 className="text-sm font-medium text-slate-500">{metric.name}</h2><span className="grid size-8 place-items-center rounded-lg bg-slate-50 text-teal-700" aria-hidden="true">{metric.icon}</span></div><p className="mt-4 text-3xl font-semibold tracking-tight">{money(metric.value)}</p><p className="mt-3 text-xs text-slate-500">{metric.detail}</p></article>)}</section>
        <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
          <section id="performance" className="panel scroll-mt-6 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">Revenue & profitability</h2><p className="mt-1 text-xs text-slate-500">Monthly performance · {sourceLabel}</p></div><div className="flex gap-4 text-xs text-slate-500"><span><i className="mr-2 inline-block size-2 rounded-full bg-teal-600"/>Revenue</span><span><i className="mr-2 inline-block size-2 rounded-full bg-indigo-400"/>Net profit</span></div></div><div className="mt-8"><RevenueChart data={monthly} currencyCode={currencyCode}/></div></section>
          <section id="expenses" className="panel scroll-mt-6 p-5 sm:p-6"><h2 className="font-semibold">Total expense breakdown</h2><p className="mt-1 text-xs text-slate-500">COGS, operating expenses, other expenses & tax · {dateRange}</p><ExpenseChart currencyCode={currencyCode} data={expenses} total={money(expenseTotal)}/><ul className="space-y-3">{expenses.map(expense => <li key={expense.name} className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 text-slate-500"><i className="size-2 rounded-full" style={{ background: expense.color }}/>{expense.name}</span><span className="font-medium">{money(expense.value)} <span className="ml-2 text-slate-400">{expenseTotal === 0 ? 0 : Math.round(expense.value / expenseTotal * 100)}%</span></span></li>)}</ul></section>
        </div>
        <section id="monthly-detail" className="panel scroll-mt-6 overflow-hidden"><div className="p-6"><h2 className="font-semibold">The numbers, month by month</h2><p className="mt-1 text-xs text-slate-500">{sourceLabel} · all amounts in {currencyCode}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-right text-sm"><caption className="sr-only">Monthly revenue, gross profit, operating profit and net profit for {dateRange}</caption><thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500"><tr><th scope="col" className="px-6 py-3 text-left">Month</th>{['Revenue', 'Gross profit', 'Operating profit', 'Net profit'].map(label => <th key={label} scope="col" className="px-6 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{monthly.map(period => <tr key={period.month} className="border-b border-slate-100 last:border-0"><th scope="row" className="px-6 py-4 text-left font-medium">{formatMonth(period.month)}</th>{[period.revenue, period.grossProfit, period.operatingProfit, period.netProfit].map((value, index) => <td key={index} className={`px-6 py-4 tabular-nums ${index === 3 ? 'font-medium text-teal-700' : 'text-slate-600'}`}>{money(value)}</td>)}</tr>)}</tbody></table></div></section>
        <ExportReport periods={periods} currencyCode={currencyCode} filename={activeFilename} isDemo={isDemo}/>
        <footer className="flex flex-wrap justify-between gap-2 text-xs text-slate-400"><p>Ledger · Financial clarity, thoughtfully presented.</p><p>{sourceLabel} · No connected accounts</p></footer>
      </div>
    </main>
  </div>;
}
