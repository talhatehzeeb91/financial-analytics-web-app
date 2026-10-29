const fields = [
  ['Month', 'The month these totals belong to, such as 2026-01 for January 2026.'],
  ['Revenue', 'Total income from sales or services for the month, before subtracting expenses.'],
  ['COGS', 'Cost of goods sold: direct costs of the products or services you sold.'],
  ['OperatingExpenses', 'Costs of running the business, such as rent, salaries and marketing. Exclude costs already in COGS.'],
  ['OtherExpenses', 'Other costs not included in COGS or OperatingExpenses, such as loan interest. Excludes Tax.'],
  ['Tax', 'The month’s income tax expense. Keep it separate from all other expense columns.'],
  ['RevenueBudget', 'Optional planned monthly revenue in the same currency. Leave unmapped or blank when unavailable. Enter 0 only for an explicit zero budget.'],
  ['COGSBudget', 'Optional planned monthly COGS in the same currency, separate from product cost budgets. Leave unmapped or blank when unavailable. Enter 0 only for an explicit zero budget.'],
];

export function DataPreparationGuide() {
  return <details className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 p-5">
    <summary className="cursor-pointer text-sm font-semibold text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600">How to prepare your data<span className="mt-2 block pl-4 text-xs font-normal leading-5 text-slate-500">Monthly summaries only. Expand for an example, column definitions and a preparation checklist.</span></summary>
    <div className="mt-5 space-y-5 text-sm leading-6 text-slate-600">
      <p><strong className="text-slate-800">Start with monthly summaries.</strong> Add up your records first: one row per month, not individual sales or invoice transactions. Each month must appear only once.</p>
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Fictional example · amounts in USD</p><div className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full text-left text-xs"><caption className="sr-only">Sample monthly financial summary with six required columns and optional RevenueBudget and COGSBudget columns</caption><thead><tr>{fields.map(([name]) => <th key={name} scope="col" className="whitespace-nowrap border-b border-slate-200 p-2 font-semibold">{name}</th>)}</tr></thead><tbody><tr>{['2026-01', '182000', '76000', '54000', '2000', '10000', '180000', '80000'].map((value, index) => <td key={index} className="p-2 tabular-nums">{value}</td>)}</tr></tbody></table></div><p className="mt-2 text-xs">Download either template above; both contain the same three fictional months.</p></div>
      <dl className="space-y-3">{fields.map(([name, explanation]) => <div key={name}><dt className="font-semibold text-slate-800">{name}</dt><dd>{explanation}</dd></div>)}</dl>
      <div><h3 className="font-semibold text-slate-800">Before you import</h3><ul className="mt-2 list-disc space-y-2 pl-5">
        <li>Keep a header as the first non-empty row. Your column names can differ: preview the file and map them to the six required fields, plus optional Revenue Budget and COGS Budget. Suggestions require confirmation. Month and Revenue must be mapped; for an expense that does not apply, explicitly select “Not applicable — use 0” and confirm it. A source column cannot be mapped twice.</li>
        <li>Format Month as <code>YYYY-MM</code>, for example <code>2026-01</code>. In Excel, set these cells to Text; do not use Excel date cells.</li>
        <li>Enter non-negative numbers such as <code>1250.50</code>, without currency symbols or thousands separators. Enter <code>0</code> when an amount does not apply, or confirm the expense’s “use 0” mapping. Mapped required amount cells cannot be blank; optional budget cells may be blank (not provided).</li>
        <li>Use one currency per file. Select USD, PKR, AED, GBP or EUR to match the currency already in your file. The selected code labels every card, chart and table. The dashboard does not detect or convert currencies. Demo data uses USD.</li>
        <li>Expense categories must not overlap. Count each cost once. <strong>OtherExpenses excludes Tax</strong>; do not repeat tax or any other cost across columns.</li>
        <li>Use plain cells: no merged cells, total rows or subtotal rows. The dashboard calculates totals for you.</li>
        <li>For XLSX, choose the worksheet you want to import. Only that worksheet is analyzed. Blank rows are ignored. Maximum 5 MB, 1,000 monthly rows and 1 trillion per amount. Validate and review the summary before clicking “Import and analyze”; choosing a file alone does not change the dashboard.</li>
      </ul></div>
      <p className="rounded-lg border border-teal-100 bg-teal-50 p-3 text-xs leading-5 text-teal-900"><strong>What this upload provides:</strong> monthly revenue, expenses and profit. Optional RevenueBudget enables monthly Revenue Budget vs Actual. Variance is actual minus budget; positive is favorable, negative adverse. A zero or missing budget gives N/A for variance percentage. Missing budgets are not zero; period-wide budget comparisons require all selected months to have budgets. Optional COGSBudget enables COGS budget variance: budget minus actual COGS, with positive savings favorable and negative variance adverse. Zero or missing budgets give N/A percentages. Selected-period comparisons require complete COGS budget coverage; missing budgets are never invented. Product Profitability uses its own optional product-month file below (Month, Product, Units Sold, Revenue, Product Cost, optional Revenue Budget). It is never derived from this monthly file. Use the separate fictional product template and guide; product costs and revenue must be provided explicitly.</p>
    </div>
  </details>;
}
