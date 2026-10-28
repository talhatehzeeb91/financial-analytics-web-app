'use client';

import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { currency } from '@/lib/finance';

type Trend = { month: string; revenue: number; netProfit: number };
type Expense = { name: string; value: number; color: string };

export function RevenueChart({ data, currencyCode }: { data: Trend[]; currencyCode: string }) {
  return <div className="h-72 w-full" role="img" aria-label="Monthly revenue and net profit for the selected dataset. Exact figures follow in a table.">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0d9488" stopOpacity={0.18}/><stop offset="100%" stopColor="#0d9488" stopOpacity={0}/></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10}/>
        <YAxis tickFormatter={value => `${currencyCode} ${value / 1000}k`} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={85}/>
        <Tooltip formatter={value => currency(Number(value), currencyCode)} contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}/>
        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#0d9488" strokeWidth={3} fill="url(#revenueFill)" isAnimationActive={false}/>
        <Area type="monotone" dataKey="netProfit" name="Net profit" stroke="#818cf8" strokeWidth={2.5} fill="transparent" isAnimationActive={false}/>
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}

export function ExpenseChart({ data, total, currencyCode }: { data: Expense[]; total: string; currencyCode: string }) {
  return <div className="relative h-60" role="img" aria-label={`Total expenses ${total}. Category figures are listed below.`}>
    <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={72} outerRadius={96} paddingAngle={4} stroke="none" isAnimationActive={false}>{data.map(item => <Cell key={item.name} fill={item.color}/>)}</Pie><Tooltip formatter={value => currency(Number(value), currencyCode)}/></PieChart></ResponsiveContainer>
    {data.every(item => item.value === 0) && <p className="absolute bottom-0 w-full text-center text-xs text-slate-500">No expenses in this dataset</p>}
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-xs text-slate-500">Total expenses</span><strong className="mt-1 text-2xl tracking-tight">{total}</strong></div>
  </div>;
}
