import { ExpenseChart, RevenueChart } from '@/components/financial-charts';
import { demoOperatingExpenses, demoPeriods } from '@/lib/demo-data';
import { calculateProfits, currency, margin, summarize } from '@/lib/finance';

export default function Dashboard() {
  const totals = summarize(demoPeriods);
  const monthly = demoPeriods.map(calculateProfits);
  const metrics = [
    { name: 'Revenue', value: totals.revenue, detail: 'Total business income', icon: '↗' },
    { name: 'Gross Profit', value: totals.grossProfit, detail: `${margin(totals.grossProfit, totals.revenue).toFixed(1)}% gross margin`, icon: '◈' },
    { name: 'Operating Profit', value: totals.operatingProfit, detail: `${margin(totals.operatingProfit, totals.revenue).toFixed(1)}% operating margin`, icon: '▥' },
    { name: 'Net Profit', value: totals.netProfit, detail: `${margin(totals.netProfit, totals.revenue).toFixed(1)}% net margin`, icon: '◎' },
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
      <div className="mt-10 hidden rounded-xl border border-teal-100 bg-teal-50/60 p-4 lg:block"><span className="text-lg" aria-hidden="true">✧</span><p className="mt-2 text-sm font-semibold text-teal-900">A clearer financial picture</p><p className="mt-2 text-xs leading-5 text-teal-800">Explore your business performance with this fictional sample workspace.</p></div>
      <div className="bottom-7 mt-8 hidden items-center gap-3 lg:absolute lg:flex"><span className="grid size-9 place-items-center rounded-full bg-slate-100 text-xs font-bold">AC</span><div><p className="text-sm font-semibold">Acme Studio</p><p className="text-xs text-slate-500">Demo workspace</p></div></div>
    </aside>
    <main id="overview" className="min-w-0 flex-1 lg:ml-60">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-5 lg:px-10"><p className="text-sm text-slate-500">Workspace <span className="mx-2 text-slate-300">/</span><span className="font-medium text-slate-800">Financial overview</span></p><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">Demo data</span></header>
      <div className="mx-auto max-w-[1600px] space-y-7 p-6 lg:p-10">
        <section className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-teal-700">Your business at a glance</p><h1 className="text-3xl font-bold tracking-tight text-slate-900">Financial overview</h1><p className="mt-2 text-sm text-slate-500">A little clarity. A better next decision.</p></div><div className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600">Jan – Jun 2026 <span className="ml-3 text-slate-400">· USD</span></div></section>
        <div className="flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-teal-900"><span aria-hidden="true">ⓘ</span><p><strong>Sample workspace.</strong> All figures are fictional demo data for illustration and do not represent actual financial performance.</p></div>
        <section aria-label="Key financial indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(metric => <article key={metric.name} className="panel p-5"><div className="flex items-center justify-between"><h2 className="text-sm font-medium text-slate-500">{metric.name}</h2><span className="grid size-8 place-items-center rounded-lg bg-slate-50 text-teal-700" aria-hidden="true">{metric.icon}</span></div><p className="mt-4 text-3xl font-semibold tracking-tight">{currency(metric.value)}</p><p className="mt-3 text-xs text-slate-500">{metric.detail}</p></article>)}</section>
        <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
          <section id="performance" className="panel scroll-mt-6 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">Revenue & profitability</h2><p className="mt-1 text-xs text-slate-500">Monthly performance · fictional demo data</p></div><div className="flex gap-4 text-xs text-slate-500"><span><i className="mr-2 inline-block size-2 rounded-full bg-teal-600"/>Revenue</span><span><i className="mr-2 inline-block size-2 rounded-full bg-indigo-400"/>Net profit</span></div></div><div className="mt-8"><RevenueChart data={monthly}/></div></section>
          <section id="expenses" className="panel scroll-mt-6 p-5 sm:p-6"><h2 className="font-semibold">Expense breakdown</h2><p className="mt-1 text-xs text-slate-500">Operating expenses · Jan – Jun 2026</p><ExpenseChart data={demoOperatingExpenses} total={currency(totals.operatingExpenses)}/><ul className="space-y-3">{demoOperatingExpenses.map(expense => <li key={expense.name} className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 text-slate-500"><i className="size-2 rounded-full" style={{ background: expense.color }}/>{expense.name}</span><span className="font-medium">{currency(expense.value)} <span className="ml-2 text-slate-400">{Math.round(expense.value / totals.operatingExpenses * 100)}%</span></span></li>)}</ul></section>
        </div>
        <section id="monthly-detail" className="panel scroll-mt-6 overflow-hidden"><div className="p-6"><h2 className="font-semibold">The numbers, month by month</h2><p className="mt-1 text-xs text-slate-500">Fictional demo data · all amounts in USD</p></div><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-right text-sm"><caption className="sr-only">Monthly revenue, gross profit, operating profit and net profit for the first half of 2026</caption><thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500"><tr><th scope="col" className="px-6 py-3 text-left">Month</th>{['Revenue', 'Gross profit', 'Operating profit', 'Net profit'].map(label => <th key={label} scope="col" className="px-6 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{monthly.map(period => <tr key={period.month} className="border-b border-slate-100 last:border-0"><th scope="row" className="px-6 py-4 text-left font-medium">{period.month} 2026</th>{[period.revenue, period.grossProfit, period.operatingProfit, period.netProfit].map((value, index) => <td key={index} className={`px-6 py-4 tabular-nums ${index === 3 ? 'font-medium text-teal-700' : 'text-slate-600'}`}>{currency(value)}</td>)}</tr>)}</tbody></table></div></section>
        <footer className="flex flex-wrap justify-between gap-2 text-xs text-slate-400"><p>Ledger · Financial clarity, thoughtfully presented.</p><p>Demo data only · No connected accounts</p></footer>
      </div>
    </main>
  </div>;
}
