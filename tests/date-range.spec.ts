import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import Papa from 'papaparse';

async function analyze(page: Page) {
  for(const [index,field] of ['Month (required)','Revenue (required)','COGS','OperatingExpenses','OtherExpenses','Tax'].entries()) await page.getByLabel(field,{exact:true}).selectOption(String(index));
  await page.getByLabel('File currency',{exact:true}).selectOption('PKR');
  await page.getByLabel('I confirm these column mappings describe monthly summaries.').check();
  await page.getByRole('button',{name:'Validate and review'}).click();
  await page.getByRole('button',{name:'Import and analyze'}).click();
}
async function setRange(page: Page, from: string, to: string) {
  await page.getByLabel('From month',{exact:true}).fill(from);
  await page.getByLabel('To month',{exact:true}).fill(to);
}

test('one period drives dashboard and exports, empty/invalid ranges hide analysis, and dataset changes reset the filter',async({page},testInfo)=>{
  const errors: string[]=[],posts: string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.method()==='POST')posts.push(request.url());});
  await page.goto('/',{waitUntil:'networkidle'});
  const upload=page.getByLabel('1. Choose a financial data file');
  const cards=page.locator('section[aria-label="Key financial indicators"]');
  const rows=page.locator('#monthly-detail tbody tr');
  await upload.setInputFiles(`${process.cwd()}/tests/fixtures/fictional-pkr-six-months.csv`);
  await analyze(page);
  await expect(page.getByLabel('From month',{exact:true})).toHaveValue('2026-01');
  await expect(page.getByLabel('To month',{exact:true})).toHaveValue('2026-06');
  await setRange(page,'2026-02','2026-04');
  const expected=[['Revenue','1,600,000'],['Gross Profit','650,000'],['Operating Profit','200,000'],['Net Profit','95,000']];
  for(const [name,amount] of expected) await expect(cards.locator('article').filter({has:page.getByRole('heading',{name,exact:true})})).toContainText(new RegExp(`PKR\\s+${amount}`));
  await expect(cards).toContainText('40.6% gross margin');
  await expect(cards).toContainText('12.5% operating margin');
  await expect(cards).toContainText('5.9% net margin');
  await expect(rows).toHaveCount(3);
  await expect(rows.locator('th')).toHaveText(['Feb 2026','Mar 2026','Apr 2026']);
  await expect(page.getByRole('status',{name:'Date range status'})).toContainText('Showing 3 of 6');
  await expect(page.locator('#expenses')).toContainText(/PKR\s+1,505,000/);
  const chart=page.locator('#performance .recharts-wrapper');await chart.scrollIntoViewIfNeeded();
  const ticks=page.locator('#performance text.recharts-cartesian-axis-tick-value').filter({hasText:/^2026-0[1-6]$/});
  await expect(ticks).toHaveText(['2026-02','2026-03','2026-04']);
  const tick=await ticks.nth(1).boundingBox(),bounds=await chart.boundingBox();
  await page.mouse.move(tick!.x+tick!.width/2,bounds!.y+bounds!.height*.4);
  const tip=page.locator('#performance .recharts-tooltip-wrapper');
  await expect(tip).toBeVisible();await expect(tip).toContainText('2026-03');await expect(tip).toContainText(/-PKR\s+110,000/);
  const csvEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download CSV',exact:true}).click();
  const csv=await csvEvent;expect(csv.suggestedFilename()).toContain('2026-02-2026-04');
  const csvPath=testInfo.outputPath('filtered.csv');await csv.saveAs(csvPath);
  const data=Papa.parse<Record<string,string>>((await readFile(csvPath)).toString(),{header:true,skipEmptyLines:true});
  expect(data.errors).toEqual([]);expect(data.data).toHaveLength(3);
  expect(data.data.map(row=>row.Month)).toEqual(['2026-02','2026-03','2026-04']);
  expect(data.data.every(row=>row.PeriodFrom==='2026-02'&&row.PeriodTo==='2026-04'&&row.Currency==='PKR')).toBe(true);
  for(const [key,total] of [['Revenue',1600000],['GrossProfit',650000],['OperatingProfit',200000],['NetProfit',95000]] as const) expect(data.data.reduce((sum,row)=>sum+Number(row[key]),0)).toBe(total);
  expect(data.data[2].NetMarginPercent).toBe('N/A');
  const pdfEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF',exact:true}).click();
  const pdf=await pdfEvent;expect(pdf.suggestedFilename()).toContain('2026-02-2026-04');await pdf.saveAs(testInfo.outputPath('filtered.pdf'));
  await expect(page.locator('section[aria-labelledby="export-title"]')).toContainText('Selected period: 2026-02 to 2026-04');
  await page.mouse.move(1550,10);await page.evaluate(()=>window.scrollTo(0,0));await page.waitForFunction(()=>window.scrollY===0);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:testInfo.outputPath('filtered-dashboard.png'),fullPage:true});

  await setRange(page,'2026-05','2026-04');
  await expect(page.getByRole('alert',{name:'Date range status'})).toContainText('From month must be on or before');
  await expect(cards).toHaveCount(0);await expect(page.locator('#performance')).toHaveCount(0);await expect(rows).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Download CSV',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Download PDF',exact:true})).toHaveCount(0);
  await setRange(page,'2027-01','2027-03');
  await expect(page.getByRole('status',{name:'Date range status'})).toContainText('No data in this period');
  await expect(cards).toHaveCount(0);await expect(page.getByRole('button',{name:'Download CSV',exact:true})).toHaveCount(0);
  await page.getByLabel('From month',{exact:true}).fill('');
  await expect(page.getByRole('alert',{name:'Date range status'})).toContainText('Choose both');
  await page.getByRole('button',{name:'All months',exact:true}).click();
  await expect(rows).toHaveCount(6);await expect(cards).toContainText(/PKR\s+5,000,000/);
  await setRange(page,'2026-04','2026-04');
  await expect(rows).toHaveCount(1);await expect(cards).toContainText('N/A net margin');
  await expect(cards).toContainText(/-PKR\s+55,000/);
  await page.setViewportSize({width:390,height:844});
  await setRange(page,'2026-02','2026-04');
  for(const name of ['From month','To month']) {
    const input=page.getByLabel(name,{exact:true});await input.scrollIntoViewIfNeeded();
    const box=await input.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(390);
  }
  await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
  await page.locator('section[aria-labelledby="period-title"]').screenshot({path:testInfo.outputPath('mobile-filter.png')});
  await page.getByRole('button',{name:'All months',exact:true}).click();await expect(rows).toHaveCount(6);
  await setRange(page,'2026-03','2026-04');
  await upload.setInputFiles({name:'different-months.csv',mimeType:'text/csv',buffer:Buffer.from('Period,Sales,Cost of Sales,Opex,Other costs,Taxes\n2030-10,100,40,20,5,5\n2030-11,200,80,40,10,10')});
  await expect(page.getByLabel('From month',{exact:true})).toHaveValue('2026-03');
  await analyze(page);
  await expect(page.getByLabel('From month',{exact:true})).toHaveValue('2030-10');
  await expect(page.getByLabel('To month',{exact:true})).toHaveValue('2030-11');await expect(rows).toHaveCount(2);
  await page.getByRole('button',{name:'Reset to demo',exact:true}).click();
  await expect(page.getByLabel('From month',{exact:true})).toHaveValue('2026-01');
  await expect(page.getByLabel('To month',{exact:true})).toHaveValue('2026-06');
  await expect(rows).toHaveCount(6);await expect(cards).toContainText(/USD\s+1,320,000/);
  expect(errors).toEqual([]);expect(posts).toEqual([]);
});
