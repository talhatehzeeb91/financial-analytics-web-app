import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import Papa from 'papaparse';

async function download(page: Page, button: string, path: string) {
  const event=page.waitForEvent('download');
  await page.getByRole('button',{name:button,exact:true}).click();
  const file=await event;await file.saveAs(path);return readFile(path);
}

test('local CSV and PDF downloads reflect the active dataset, currency and demo labeling', async ({page},testInfo)=>{
  const posts: string[]=[], errors: string[]=[];
  page.on('request',request=>{if(request.method()==='POST')posts.push(request.url());});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/',{waitUntil:'networkidle'});
  const demoCsv=await download(page,'Download CSV',testInfo.outputPath('demo.csv'));
  const demo=Papa.parse<Record<string,string>>(demoCsv.toString(),{header:true,skipEmptyLines:true});
  expect(demo.errors).toEqual([]);expect(demo.data).toHaveLength(6);
  expect(demo.data[0].Dataset).toContain('FICTIONAL DEMO DATA');
  expect(demo.data[0].SourceFile).toBe('Fictional demo data');
  expect(demo.data.every(row=>row.Currency==='USD')).toBe(true);
  const demoPdf=await download(page,'Download PDF',testInfo.outputPath('demo.pdf'));
  expect(demoPdf.subarray(0,5).toString()).toBe('%PDF-');

  const bytes=await readFile(`${process.cwd()}/tests/fixtures/fictional-pkr-six-months.csv`);
  const filename='=Fictional PKR — monthly summary, '+ 'long-source-name-'.repeat(9)+'.csv';
  await page.getByLabel('1. Choose a financial data file').setInputFiles({name:filename,mimeType:'text/csv',buffer:bytes});
  for(const [index,field] of ['Month (required)','Revenue (required)','COGS','OperatingExpenses','OtherExpenses','Tax'].entries()) await page.getByLabel(field,{exact:true}).selectOption(String(index));
  await page.getByLabel('File currency',{exact:true}).selectOption('PKR');
  await page.getByLabel('I confirm these column mappings describe monthly summaries.').check();
  await page.getByRole('button',{name:'Validate and review'}).click();
  await page.getByRole('button',{name:'Import and analyze'}).click();
  const section=page.locator('section[aria-labelledby="export-title"]');
  await expect(section).toContainText(filename);
  await expect(section).toContainText('PKR');
  await section.screenshot({path:testInfo.outputPath('export-interface.png')});
  const csv=await download(page,'Download CSV',testInfo.outputPath('pkr-report.csv'));
  const result=Papa.parse<Record<string,string>>(csv.toString(),{header:true,skipEmptyLines:true});
  expect(result.errors).toEqual([]);expect(result.data).toHaveLength(6);
  expect(result.data.map(row=>row.Month)).toEqual(['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06']);
  expect(result.data.every(row=>row.Currency==='PKR'&&row.SourceFile===`'${filename}`)).toBe(true);
  expect(result.data.reduce((sum,row)=>sum+Number(row.Revenue),0)).toBe(5000000);
  expect(result.data.reduce((sum,row)=>sum+Number(row.GrossProfit),0)).toBe(2170000);
  expect(result.data.reduce((sum,row)=>sum+Number(row.OperatingProfit),0)).toBe(1070000);
  expect(result.data.reduce((sum,row)=>sum+Number(row.NetProfit),0)).toBe(760000);
  expect(result.data[2].NetProfit).toBe('-110000');
  expect(result.data[3].NetMarginPercent).toBe('N/A');
  const pdf=await download(page,'Download PDF',testInfo.outputPath('pkr-report.pdf'));
  expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(10000);
  await expect(page.getByRole('status',{name:'Export status'})).toContainText('PDF downloaded');
  // Merely selecting another file cannot change what is exported.
  await page.getByLabel('1. Choose a financial data file').setInputFiles({name:'replacement.csv',mimeType:'text/csv',buffer:bytes});
  const pending=await download(page,'Download CSV',testInfo.outputPath('while-previewing.csv'));
  expect(pending.toString()).toBe(csv.toString());
  await page.getByRole('button',{name:'Reset to demo'}).click();
  const reset=await download(page,'Download CSV',testInfo.outputPath('reset.csv'));
  expect(reset.toString()).toBe(demoCsv.toString());
  await page.setViewportSize({width:390,height:844});
  await section.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
  expect(errors).toEqual([]);expect(posts).toEqual([]);
});
