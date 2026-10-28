import { test, expect, type Page } from '@playwright/test';

const fields = ['Month (required)','Revenue (required)','COGS','OperatingExpenses','OtherExpenses','Tax'];
const fixture = `${process.cwd()}/tests/fixtures/fictional-pkr-six-months.csv`;
const filename = 'fictional-pkr-six-months.csv';
const normalized = (text: string) => text.replace(/\s+/g, ' ');

async function mapAndReview(page: Page) {
  for (const [index, field] of fields.entries()) await page.getByLabel(field, { exact:true }).selectOption(String(index));
  await page.getByLabel('File currency', { exact:true }).selectOption('PKR');
  await page.getByLabel('I confirm these column mappings describe monthly summaries.').check();
  await page.getByRole('button',{ name:'Validate and review' }).click();
  await expect(page.getByRole('button',{ name:'Import and analyze' })).toBeVisible();
}

test('six-month PKR mapping on mobile, sorted monthly profits, losses, zero revenue and tooltips', async ({ page }, testInfo) => {
  const errors: string[] = [], posts: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
  await page.goto('/', { waitUntil:'networkidle' });
  const upload = page.getByLabel('1. Choose a financial data file');
  const cards = page.locator('section[aria-label="Key financial indicators"]');
  const active = page.locator('[aria-label="Active dataset"]');

  // The zero-revenue month alone checks the actual KPI margin presentation.
  await upload.setInputFiles({ name:'fictional-zero-revenue.csv', mimeType:'text/csv', buffer:Buffer.from('Accounting Period,Turnover,Direct Production Cost,Running Costs,Finance Charges,Income Tax Due\n2026-04,0,0,50000,5000,0') });
  await mapAndReview(page);
  await expect(page.locator('[aria-label="Import summary"]')).toContainText('1 month ·');
  await expect(page.locator('[aria-label="Import summary"]')).not.toContainText('1 months');
  await page.getByRole('button',{ name:'Import and analyze' }).click();
  await expect(page.getByRole('status', { name:'Import status' })).toContainText('Imported 1 month in PKR');
  await expect(cards).not.toContainText(/NaN|Infinity/);
  await expect(cards.locator('article').nth(1)).toContainText('N/A gross margin');
  await expect(cards.locator('article').nth(2)).toContainText('N/A operating margin');
  await expect(cards.locator('article').nth(3)).toContainText('N/A net margin');
  await expect(cards).toContainText(/-PKR\s+55,000/);
  await expect(active).toContainText('fictional-zero-revenue.csv');

  await page.setViewportSize({ width:390, height:844 });
  await upload.setInputFiles(fixture);
  // Selecting a different file must not relabel the still-active dataset.
  await expect(active).toContainText('fictional-zero-revenue.csv');
  await expect(page.locator('p').filter({ hasText:'Selected file (not yet imported):' })).toContainText(filename);
  for (const field of [...fields, 'File currency']) {
    const control = page.getByLabel(field, { exact:true });
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeVisible();
    const bounds = await control.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  }
  await mapAndReview(page);
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
  await expect(page.locator('[aria-label="Import summary"]')).toContainText('6 months · 2026-01 to 2026-06');
  await page.locator('section[aria-labelledby="import-title"]').screenshot({ path:testInfo.outputPath('mobile-mapping.png') });
  await page.setViewportSize({ width:1600, height:1100 });
  await page.getByRole('button',{ name:'Import and analyze' }).click();
  await expect(active).toContainText(filename);
  await expect(page.getByRole('status', { name:'Import status' })).toContainText('Imported 6 months in PKR');

  const kpis = [['Revenue','5,000,000'],['Gross Profit','2,170,000'],['Operating Profit','1,070,000'],['Net Profit','760,000']];
  for (const [name, amount] of kpis) {
    const card = cards.locator('article').filter({ has:page.getByRole('heading',{ name, exact:true }) });
    expect(normalized(await card.innerText())).toContain(`PKR ${amount}`);
  }
  await expect(cards).toContainText('43.4% gross margin');
  await expect(cards).toContainText('21.4% operating margin');
  await expect(cards).toContainText('15.2% net margin');
  const expected = [
    ['Jan 2026','1,000,000','400,000','200,000','150,000'],
    ['Feb 2026','1,200,000','550,000','330,000','260,000'],
    ['Mar 2026','400,000','100,000','-80,000','-110,000'],
    ['Apr 2026','0','0','-50,000','-55,000'],
    ['May 2026','900,000','420,000','220,000','175,000'],
    ['Jun 2026','1,500,000','700,000','450,000','340,000'],
  ];
  const rows = page.locator('#monthly-detail tbody tr');
  await expect(rows).toHaveCount(6);
  for (const [index, values] of expected.entries()) {
    await expect(rows.nth(index).locator('th')).toHaveText(values[0]);
    const amounts = await rows.nth(index).locator('td').allTextContents();
    expect(amounts.map(value=>normalized(value))).toEqual(values.slice(1).map(value=>value.startsWith('-') ? `-PKR ${value.slice(1)}` : `PKR ${value}`));
  }
  await expect(page.locator('#expenses')).toContainText(/PKR\s+4,240,000/);
  for (const amount of ['2,830,000','1,100,000','175,000','135,000']) expect(normalized(await page.locator('#expenses').innerText())).toContain(`PKR ${amount}`);
  await expect(page.locator('#monthly-detail')).toContainText('all amounts in PKR');

  const chart = page.locator('#performance .recharts-wrapper');
  await chart.scrollIntoViewIfNeeded();
  const ticks = page.locator('#performance text.recharts-cartesian-axis-tick-value').filter({ hasText:/^2026-0[1-6]$/ });
  await expect(ticks).toHaveCount(6);
  const tooltip = page.locator('#performance .recharts-tooltip-wrapper');
  for (const index of [0,1,2,3,4,5]) {
    const tick = await ticks.nth(index).boundingBox();
    const bounds = await chart.boundingBox();
    await page.mouse.move(tick!.x + tick!.width/2, bounds!.y + bounds!.height*0.4);
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(`2026-0${index + 1}`);
    for (const value of [expected[index][1],expected[index][4]]) expect(normalized(await tooltip.innerText())).toContain(value.startsWith('-') ? `-PKR ${value.slice(1)}` : `PKR ${value}`);
  }
  const pie = page.locator('#expenses [role="img"]');
  await pie.scrollIntoViewIfNeeded();
  const bounds = await pie.boundingBox();
  await page.mouse.move(bounds!.x+bounds!.width/2,bounds!.y+bounds!.height/2-84);
  const expenseTooltip = page.locator('#expenses .recharts-tooltip-wrapper');
  await expect(expenseTooltip).toBeVisible();
  await expect(expenseTooltip).toContainText(/COGS.*PKR\s+2,830,000/);
  await page.mouse.move(1550,10);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForFunction(()=>window.scrollY===0);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({ path:testInfo.outputPath('six-month-pkr-dashboard.png'), fullPage:true });

  // Failed/replacement uploads cannot erase the active source identity.
  await upload.setInputFiles({ name:'invalid.csv', mimeType:'text/csv', buffer:Buffer.from('"unterminated') });
  await expect(page.getByRole('alert').filter({ hasText:'Please review' })).toBeVisible();
  await expect(active).toContainText(filename);
  await expect(cards).toContainText(/PKR\s+5,000,000/);
  await page.getByRole('button',{ name:'Reset to demo' }).click();
  await expect(active).toHaveCount(0);
  await expect(cards).toContainText(/USD\s+1,320,000/);
  expect(errors).toEqual([]);
  expect(posts).toEqual([]);
});
