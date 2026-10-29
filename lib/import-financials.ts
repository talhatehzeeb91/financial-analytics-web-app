import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file/browser';
import type { FinancialPeriod } from './finance.ts';

export const columns = ['Month', 'Revenue', 'COGS', 'OperatingExpenses', 'OtherExpenses', 'Tax'] as const;
export const optionalBudgetColumns = ['RevenueBudget', 'COGSBudget'] as const;
export const mappingColumns = [...columns, ...optionalBudgetColumns] as const;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 1000;
export const MAX_AMOUNT = 1_000_000_000_000;
export type ImportResult = { periods: FinancialPeriod[]; errors: string[] };

export function validateRows(rows: unknown[][]): ImportResult {
  const errors: string[] = [];
  const nonempty = rows.map((cells, index) => ({ cells, row: index + 1 })).filter(({ cells }) => cells.some(value => value !== null && value !== undefined && String(value).trim() !== ''));
  if (nonempty.length < 2) return { periods: [], errors: ['The file is empty or contains no data rows. Include a header and at least one month.'] };
  const headers = nonempty[0].cells.map(value => String(value ?? '').replace(/^\uFEFF/, '').trim());
  const missing = columns.filter(column => !headers.includes(column));
  if (missing.length) errors.push(`Missing required columns: ${missing.join(', ')}.`);
  const repeated = headers.filter((header, index) => header && headers.indexOf(header) !== index);
  if (repeated.length) errors.push(`Duplicate column names: ${[...new Set(repeated)].join(', ')}.`);
  if (nonempty.length - 1 > MAX_ROWS) errors.push(`Use at most ${MAX_ROWS} monthly rows.`);
  if (errors.length) return { periods: [], errors };
  const seen = new Set<string>();
  const periods: FinancialPeriod[] = [];
  for (const { cells, row } of nonempty.slice(1)) {
    const month = String(cells[headers.indexOf('Month')] ?? '').trim();
    if (!/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month)) errors.push(`Row ${row}: Month must use YYYY-MM (for example 2026-01).`);
    if (seen.has(month)) errors.push(`Row ${row}: duplicate month ${month}. Include each month once.`);
    seen.add(month);
    const values = columns.slice(1).map(column => {
      const raw = cells[headers.indexOf(column)];
      const text = typeof raw === 'string' ? raw.trim() : '';
      const value = typeof raw === 'number' ? raw : /^\d+(\.\d+)?$/.test(text) ? Number(text) : NaN;
      if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) errors.push(`Row ${row}: ${column} must be a non-negative number no greater than ${MAX_AMOUNT} (no currency symbols or separators).`);
      return value;
    });
    const budgets: Pick<FinancialPeriod, 'revenueBudget' | 'cogsBudget'> = {};
    for (const [column,key] of [['RevenueBudget','revenueBudget'],['COGSBudget','cogsBudget']] as const) {
      const index = headers.indexOf(column);
      const raw = index < 0 ? undefined : cells[index];
      if (raw === undefined || raw === null || String(raw).trim() === '') continue;
      const text = typeof raw === 'string' ? raw.trim() : '';
      const value = typeof raw === 'number' ? raw : /^\d+(\.\d+)?$/.test(text) ? Number(text) : NaN;
      if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) errors.push(`Row ${row}: ${column} must be a non-negative number no greater than ${MAX_AMOUNT}, or blank when not provided.`);
      budgets[key] = value;
    }
    periods.push({ ...budgets, month, revenue: values[0], costOfRevenue: values[1], operatingExpenses: values[2], otherExpenses: values[3], taxes: values[4] });
  }
  return errors.length ? { periods: [], errors } : { periods: periods.sort((a, b) => a.month.localeCompare(b.month)), errors: [] };
}

export function parseCsv(text: string): ImportResult {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy', delimiter: ',' });
  if (result.errors.length) return { periods: [], errors: result.errors.map(error => `CSV formatting error${error.row === undefined ? '' : ` near row ${error.row + 1}`}: ${error.message}`) };
  return validateRows(result.data);
}

export async function parseFinancialFile(file: File): Promise<ImportResult> {
  if (file.size === 0) return { periods: [], errors: ['The file is empty. Choose a file containing financial data.'] };
  if (file.size > MAX_FILE_BYTES) return { periods: [], errors: ['The file is too large. Maximum size is 5 MB.'] };
  try {
    if (/\.csv$/i.test(file.name)) return parseCsv(await file.text());
    if (/\.xlsx$/i.test(file.name)) {
      const sheets = await readXlsxFile(await file.arrayBuffer());
      return validateRows(sheets[0]?.data ?? []);
    }
    return { periods: [], errors: ['Unsupported file type. Choose a .csv or .xlsx file.'] };
  } catch {
    return { periods: [], errors: ['Could not read this file. Check that it is a valid, unencrypted CSV or XLSX workbook. For Excel, put the template columns on the first worksheet and store Month as text.'] };
  }
}

export type SourceSheet = { name: string; headers: string[]; rows: unknown[][] };
export type Field = typeof mappingColumns[number];
export type Mapping = Partial<Record<Field, number | 'zero'>>;
export const currencies = ['USD', 'PKR', 'AED', 'GBP', 'EUR'] as const;
export type CurrencyCode = typeof currencies[number];

export async function readSourceFile(file: File): Promise<SourceSheet[]> {
  if (!file.size) throw new Error('The file is empty.');
  if (file.size > MAX_FILE_BYTES) throw new Error('Maximum file size is 5 MB.');
  let sheets: { sheet: string; data: unknown[][] }[];
  if (/\.csv$/i.test(file.name)) {
    const parsed = Papa.parse<string[]>(await file.text(), { delimiter: ',', skipEmptyLines: 'greedy' });
    if (parsed.errors.length) throw new Error(`CSV formatting error: ${parsed.errors.map(error => error.message).join('; ')}`);
    sheets = [{ sheet: 'CSV data', data: parsed.data }];
  } else if (/\.xlsx$/i.test(file.name)) {
    try { sheets = await readXlsxFile(await file.arrayBuffer()); }
    catch { throw new Error('Could not read this XLSX workbook. Use a valid, unencrypted file.'); }
  } else throw new Error('Choose a .csv or .xlsx file.');
  return sheets.map(sheet => {
    const first = sheet.data.findIndex(row => row.some(value => value != null && String(value).trim() !== ''));
    return { name: sheet.sheet, headers: first < 0 ? [] : sheet.data[first].map(value => String(value ?? '').replace(/^\uFEFF/, '').trim()), rows: first < 0 ? [] : sheet.data.slice(first + 1) };
  });
}

const aliases: Record<Field, string[]> = {
  Month: ['month', 'period', 'reportingmonth'],
  Revenue: ['revenue', 'sales', 'totalsales', 'income', 'totalrevenue'],
  COGS: ['cogs', 'costofgoodssold', 'costofsales', 'costofrevenue'],
  OperatingExpenses: ['operatingexpenses', 'opex', 'operatingcosts'],
  OtherExpenses: ['otherexpenses', 'othercosts', 'interest'],
  Tax: ['tax', 'taxes', 'incometax'],
  COGSBudget: ['cogsbudget','budgetcogs','budgetedcogs','costofsalesbudget','budgetedcostofsales','costofgoodssoldbudget'],
  RevenueBudget: ['revenuebudget','budgetrevenue','salesbudget','budgetedsales','budgetedrevenue','budget'],
};
export function suggestMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  for (const field of mappingColumns) {
    const matches = headers.map((header, index) => aliases[field].includes(header.toLowerCase().replace(/[^a-z0-9]/g, '')) ? index : -1).filter(index => index >= 0);
    if (matches.length === 1 && !Object.values(mapping).includes(matches[0])) mapping[field] = matches[0];
  }
  return mapping;
}

export function validateMapping(sheet: SourceSheet, mapping: Mapping, currencyCode: string, confirmed: boolean, zeroConfirmed: boolean): ImportResult {
  const errors: string[] = [];
  if (!currencies.includes(currencyCode as CurrencyCode)) errors.push('Select the file currency. Amounts will not be converted.');
  if (!confirmed) errors.push('Confirm the column mappings before validating.');
  if (Object.values(mapping).includes('zero') && !zeroConfirmed) errors.push('Confirm that the selected expense fields do not apply and should use 0.');
  const used = new Set<number>();
  for (const field of mappingColumns) {
    const source = mapping[field];
    if (optionalBudgetColumns.some(column => column === field) && source === undefined) continue;
    if (source === 'zero' && field !== 'Month' && field !== 'Revenue' && !optionalBudgetColumns.some(column => column === field)) continue;
    if (typeof source !== 'number' || !Number.isInteger(source) || source < 0 || source >= sheet.headers.length || !sheet.headers[source]) errors.push(`Map ${field} to a source column${optionalBudgetColumns.some(column => column === field) ? ' or leave it unmapped (budget not provided)' : field === 'Month' || field === 'Revenue' ? ' (required)' : ' or explicitly choose Not applicable — use 0'}.`);
    else if (used.has(source)) errors.push(`Duplicate mapping: ${sheet.headers[source]} is used more than once.`);
    else used.add(source);
  }
  const duplicates = sheet.headers.filter((header, index) => header && sheet.headers.indexOf(header) !== index);
  if (duplicates.length) errors.push(`Duplicate column names: ${[...new Set(duplicates)].join(', ')}. Use unique headers.`);
  if (errors.length) return { periods: [], errors };
  const rows = sheet.rows.filter(row => row.some(value => value != null && String(value).trim() !== ''));
  const mapped = [...columns, ...optionalBudgetColumns.filter(field => typeof mapping[field] === 'number')];
  return validateRows([mapped.slice(), ...rows.map(row => mapped.map(field => mapping[field] === 'zero' ? 0 : row[mapping[field] as number]))]);
}
