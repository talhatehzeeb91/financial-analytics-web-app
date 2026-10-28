import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import Papa from 'papaparse';
import { buildReport, escapeCsvCell, exportReportCsv, reportMargin, type ReportInput } from './reports.ts';
import { readSourceFile, validateMapping } from './import-financials.ts';
import { createPdfReport } from './pdf-report.ts';

async function fixture(): Promise<ReportInput> {
  const bytes = await readFile(new URL('../tests/fixtures/fictional-pkr-six-months.csv',import.meta.url));
  const [sheet] = await readSourceFile(new File([bytes],'fictional-pkr-six-months.csv'));
  const result = validateMapping(sheet,{Month:0,Revenue:1,COGS:2,OperatingExpenses:3,OtherExpenses:4,Tax:5},'PKR',true,false);
  assert.deepEqual(result.errors,[]);
  return { periods:result.periods, currencyCode:'PKR', filename:'fictional-pkr-six-months.csv', isDemo:false };
}

test('CSV exports every source amount, calculated profit, selected currency and active filename', async () => {
  const input = await fixture();
  const parsed = Papa.parse<Record<string,string>>(exportReportCsv(input),{header:true,skipEmptyLines:true});
  assert.deepEqual(parsed.errors,[]);assert.equal(parsed.data.length,6);
  assert.deepEqual(parsed.data[0],{
    Dataset:'Uploaded monthly summary',SourceFile:input.filename,Currency:'PKR',Month:'2026-01',Revenue:'1000000',COGS:'600000',OperatingExpenses:'200000',OtherExpenses:'30000',Tax:'20000',GrossProfit:'400000',OperatingProfit:'200000',NetProfit:'150000',GrossMarginPercent:'40',OperatingMarginPercent:'20',NetMarginPercent:'15',
  });
  assert.equal(parsed.data[2].NetProfit,'-110000');
  assert.equal(parsed.data[3].Revenue,'0');
  for(const column of ['GrossMarginPercent','OperatingMarginPercent','NetMarginPercent']) assert.equal(parsed.data[3][column],'N/A');
  assert.equal(parsed.data.reduce((sum,row)=>sum+Number(row.Revenue),0),5000000);
  assert.equal(parsed.data.reduce((sum,row)=>sum+Number(row.NetProfit),0),760000);
});
test('CSV quoting round-trips quotes, commas and newlines; text formulas are neutralized', () => {
  for(const value of ['=SUM(A1:A2)','+cmd','-cmd','@cmd','  =cmd','\t=cmd','\r=cmd','\n=cmd','\uFEFF=cmd']) {
    const parsed = Papa.parse<string[]>(escapeCsvCell(value)).data[0][0];
    assert.equal(parsed,`'${value}`);
  }
  for(const value of ['summary, Q1.csv','report "final".xlsx','report\n2026.csv']) assert.equal(Papa.parse<string[]>(escapeCsvCell(value)).data[0][0],value);
  assert.equal(escapeCsvCell(-110000),'-110000');
  assert.throws(()=>escapeCsvCell(Infinity),/non-finite/);
});
test('demo exports are explicitly labeled; zero revenue margins are N/A', async () => {
  const input = await fixture();
  const demo = {...input,isDemo:true,currencyCode:'USD'};
  const report=buildReport(demo);
  assert.match(report.label,/FICTIONAL DEMO DATA/);
  assert.equal(report.source,'Fictional demo data');
  assert.match(exportReportCsv(demo),/FICTIONAL DEMO DATA/);
  assert.equal(reportMargin(-55000,0),'N/A');
  assert.equal(reportMargin(-110000,400000),'-27.5%');
  assert.throws(()=>buildReport({...input,periods:[]}),/no dataset/);
});
test('PDF supports Unicode long filenames, losses, and multi-page tables with all rows retained', async () => {
  const input = await fixture();
  const fonts={
    regular:(await readFile(new URL('../public/fonts/DejaVuSans.ttf',import.meta.url))).toString('base64'),
    bold:(await readFile(new URL('../public/fonts/DejaVuSans-Bold.ttf',import.meta.url))).toString('base64'),
  };
  const report=createPdfReport({...input,filename:'Fictional — '+ 'long monthly summary '.repeat(10)+'.csv'},fonts);
  assert.equal(report.getNumberOfPages(),2);
  const periods = Array.from({length:120},(_,index)=>({...input.periods[index%6],month:`${2020+Math.floor(index/12)}-${String(index%12+1).padStart(2,'0')}`}));
  const multi=createPdfReport({...input,periods},fonts);
  assert.ok(multi.getNumberOfPages()>3);
  const output='/tmp/ledger-report-tests';await mkdir(output,{recursive:true});
  await writeFile(`${output}/six-months.pdf`,Buffer.from(report.output('arraybuffer')));
  await writeFile(`${output}/multi-page.pdf`,Buffer.from(multi.output('arraybuffer')));
});
