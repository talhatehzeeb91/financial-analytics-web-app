import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file/browser';
import type { FinancialPeriod } from './finance.ts';

export const columns = ['Month', 'Revenue', 'COGS', 'OperatingExpenses', 'OtherExpenses', 'Tax'] as const;
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
    periods.push({ month, revenue: values[0], costOfRevenue: values[1], operatingExpenses: values[2], otherExpenses: values[3], taxes: values[4] });
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
