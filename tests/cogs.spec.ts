import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import Papa from 'papaparse';
async function analyze(page:Page) {
  for(const [index,field] of ['Month (required)','Revenue (required)','COGS','OperatingExpenses','OtherExpenses','Tax'].entries()) await page.getByLabel(field,{exact:true}).selectOption(String(index));
  await page.getByLabel('File currency',{exact:true}).selectOption('PKR');
  await page.getByLabel('I confirm these column mappings describe monthly summaries.').check();
  await page.getByRole('button',{name:'Validate and review'}).click();await page.getByRole('button',{name:'Import and analyze'}).click();
}
test('monthly COGS follows reporting period and currency, excludes product costs and exports weighted totals',async({page},testInfo)=>{
  const errors:string[]=[],posts:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.method()==='POST')posts.push(request.url());});
  await page.goto('/',{waitUntil:'networkidle'});
  const section=page.locator('#cogs-analysis');
  await expect(section).toContainText('monthly financial dataset only');await expect(section).toContainText('USD');
  const upload=page.getByLabel('1. Choose a financial data file');
  await upload.setInputFiles(`${process.cwd()}/tests/fixtures/fictional-pkr-six-months.csv`);await analyze(page);
  const card=(label:string)=>section.locator('article').filter({has:page.getByRole('heading',{name:label,exact:true})});
  await expect(card('Total COGS')).toContainText(/PKR\s+2,830,000\.00/);
  await expect(card('COGS / revenue')).toContainText('56.6%');await expect(card('Gross profit')).toContainText(/PKR\s+2,170,000\.00/);await expect(card('Gross margin')).toContainText('43.4%');
  await expect(section.getByRole('table',{name:/^Monthly COGS analysis in /}).locator('tbody tr th')).toHaveText(['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06']);
  await expect(section.getByRole('table',{name:/^Monthly COGS analysis in /}).locator('tbody tr').nth(3)).toContainText('N/A');
  // A different-currency product upload must not alter monthly COGS.
  const before=await section.innerText();await page.getByLabel('Choose a product data file').setInputFiles({name:'separate-products.csv',mimeType:'text/csv',buffer:Buffer.from('Month,Product,Units Sold,Revenue,Product Cost\n2026-02,Separate,1,999999,900000')});
  await page.getByLabel('Product file currency',{exact:true}).selectOption('USD');await page.getByLabel('I confirm these mappings describe product-month summaries and the selected product currency.').check();await page.getByRole('button',{name:'Validate product data'}).click();await page.getByRole('button',{name:'Import product data'}).click();expect(await section.innerText()).toBe(before);
  await page.getByLabel('From month',{exact:true}).fill('2026-02');await page.getByLabel('To month',{exact:true}).fill('2026-04');
  await expect(card('Total COGS')).toContainText(/PKR\s+950,000\.00/);await expect(card('COGS / revenue')).toContainText('59.4%');await expect(card('Gross margin')).toContainText('40.6%');await expect(section.getByRole('table',{name:/^Monthly COGS analysis in /}).locator('tbody tr')).toHaveCount(3);
  const chart=section.locator('.recharts-wrapper').first();await chart.scrollIntoViewIfNeeded();
  const ticks=chart.locator('text.recharts-cartesian-axis-tick-value').filter({hasText:/^2026-0[1-6]$/});await expect(ticks).toHaveText(['2026-02','2026-03','2026-04']);
  const tick=await ticks.nth(1).boundingBox(),bounds=await chart.boundingBox();await page.mouse.move(tick!.x+tick!.width/2,bounds!.y+bounds!.height*.4);
  const tip=chart.locator('.recharts-tooltip-wrapper');await expect(tip).toBeVisible();await expect(tip).toContainText(/PKR\s+300,000\.00/);await expect(tip).toContainText('75.0%');
  const csvEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download CSV',exact:true}).click();const csvPath=testInfo.outputPath('cogs.csv');await(await csvEvent).saveAs(csvPath);
  const rows=Papa.parse<Record<string,string>>((await readFile(csvPath)).toString(),{header:true,skipEmptyLines:true}).data;
  expect(rows).toHaveLength(3);expect(rows.every(row=>row.PeriodCOGS==='950000'&&row.PeriodCOGSPercent==='59.375'&&row.PeriodGrossProfit==='650000'&&row.Currency==='PKR')).toBe(true);expect(rows[2].COGSPercent).toBe('N/A');
  const pdfEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF',exact:true}).click();await(await pdfEvent).saveAs(testInfo.outputPath('cogs.pdf'));
  await page.mouse.move(0,0);await section.screenshot({path:testInfo.outputPath('cogs-desktop.png')});
  await page.setViewportSize({width:390,height:844});await section.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);await section.screenshot({path:testInfo.outputPath('cogs-mobile.png')});
  await page.getByLabel('From month',{exact:true}).fill('2026-04');await expect(card('COGS / revenue')).toContainText('N/A');await expect(card('Gross margin')).toContainText('N/A');
  await page.getByLabel('From month',{exact:true}).fill('2027-01');await page.getByLabel('To month',{exact:true}).fill('2027-02');await expect(section).toHaveCount(0);
  await page.getByRole('button',{name:'All months',exact:true}).click();await expect(section.getByRole('table',{name:/^Monthly COGS analysis in /}).locator('tbody tr')).toHaveCount(6);
  await upload.setInputFiles({name:'loss-and-zero.csv',mimeType:'text/csv',buffer:Buffer.from('Month,Revenue,COGS,OperatingExpenses,OtherExpenses,Tax\n2026-01,100,150,0,0,0\n2026-02,0,50,0,0,0')});await analyze(page);
  await expect(section.getByRole('table',{name:/^Monthly COGS analysis in /}).locator('tbody tr').first()).toContainText(/-PKR\s+50\.00/);await expect(section.getByRole('table',{name:/^Monthly COGS analysis in /}).locator('tbody tr').last()).toContainText(/-PKR\s+50\.00/);await expect(card('COGS / revenue')).toContainText('200.0%');await expect(section).not.toContainText(/NaN|Infinity/);
  await page.getByRole('button',{name:'Reset to demo',exact:true}).click();await expect(section).toContainText('USD');await expect(section.getByRole('table',{name:/^Monthly COGS analysis in /}).locator('tbody tr')).toHaveCount(6);
  expect(errors).toEqual([]);expect(posts).toEqual([]);
});
