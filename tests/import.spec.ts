import { test } from '@playwright/test';
import assert from 'node:assert/strict';
import writeXlsxFile from 'write-excel-file/node';
import { mkdir } from 'node:fs/promises';

test('monthly mapping, worksheet selection, confirmations and currency labels', async ({ page }, testInfo) => {
 const errors: string[] = [], posts: string[] = [];
 await mkdir(testInfo.outputDir, { recursive: true });
 const fixture = testInfo.outputPath('multi.xlsx');
 await writeXlsxFile([
   { sheet:'Notes', data:[[{ type:String,value:'Notes' }],[{ type:String,value:'Choose Monthly instead' }]] },
   { sheet:'Monthly', data:[['Period','Sales','Cost of Sales','Opex','Other costs','Taxes'].map(value=>({ type:String,value })), [{ type:String,value:'2024-07' }, ...[1000,100,200,30,70].map(value=>({ type:Number,value }))]] },
 ]).toFile(fixture);
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url())});
 await page.goto('/',{waitUntil:'networkidle'});
 const upload=page.getByLabel('1. Choose a financial data file');
 const kpis=page.locator('section[aria-label="Key financial indicators"]');
 const alias='Period,Sales,Cost of Sales,Opex,Other costs\n'+Array.from({length:6},(_,i)=>`2025-0${i+1},1000,100,200,30`).join('\n');
 await upload.setInputFiles({name:'my-monthly.csv',mimeType:'text/csv',buffer:Buffer.from(alias)});
 await page.getByRole('heading',{name:'3. Map columns & choose currency'}).waitFor();
 assert.equal(await page.locator('table').nth(1).locator('tbody tr').count(),5);
 assert.equal(await page.getByLabel('Revenue (required)',{exact:true}).inputValue(),'1');
 assert.equal(await page.getByLabel('COGS',{exact:true}).locator('option[value="1"]').evaluate(option => (option as HTMLOptionElement).disabled),true);
 await page.getByLabel('Revenue (required)',{exact:true}).selectOption('');
 assert.equal(await page.getByLabel('COGS',{exact:true}).locator('option[value="1"]').evaluate(option => (option as HTMLOptionElement).disabled),false);
 await page.getByLabel('Revenue (required)',{exact:true}).selectOption('1');
 assert.equal(await page.getByRole('button',{name:'Import and analyze'}).count(),0);
 await page.getByRole('button',{name:'Validate and review'}).click();
 assert.ok((await page.getByRole('alert').filter({hasText:'Please review'}).innerText()).includes('Map Tax'));
 await page.getByLabel('Tax',{exact:true}).selectOption('zero');
 await page.getByLabel('File currency',{exact:true}).selectOption('PKR');
 await page.getByLabel('I confirm these column mappings describe monthly summaries.').check();
 await page.getByRole('button',{name:'Validate and review'}).click();
 assert.ok((await page.getByRole('alert').filter({hasText:'Please review'}).innerText()).includes('should use 0'));
 await page.getByLabel('I confirm these fields do not apply and should use 0 for every month: Tax.').check();
 await page.getByRole('button',{name:'Validate and review'}).click();
 await page.getByRole('heading',{name:'4. Ready to analyze'}).waitFor();
 assert.ok((await kpis.innerText()).includes('USD'));
 await page.locator('section[aria-labelledby="import-title"]').screenshot({path:testInfo.outputPath('financial-column-mapping.png')});
 await page.getByLabel('COGS',{exact:true}).selectOption('zero');
 assert.equal(await page.getByRole('button',{name:'Import and analyze'}).count(),0);
 assert.equal(await page.getByLabel('I confirm these column mappings describe monthly summaries.').isChecked(),false);
 await page.getByLabel('COGS',{exact:true}).selectOption('2');
 await page.getByLabel('File currency',{exact:true}).selectOption('AED');
 assert.equal(await page.getByRole('button',{name:'Import and analyze'}).count(),0);
 assert.equal(await page.getByLabel('I confirm these column mappings describe monthly summaries.').isChecked(),false);
 await page.getByLabel('I confirm these column mappings describe monthly summaries.').check();
 await page.getByLabel('I confirm these fields do not apply and should use 0 for every month: Tax.').check();
 await page.getByRole('button',{name:'Validate and review'}).click();
 await page.getByRole('button',{name:'Import and analyze'}).click();
 assert.ok((await kpis.innerText()).includes('AED'));
 assert.ok((await kpis.innerText()).includes('6,000'));
 assert.ok((await page.locator('#monthly-detail').innerText()).includes('AED'));
 assert.ok((await page.locator('#expenses').innerText()).includes('AED'));
 assert.ok((await page.locator('#performance').innerText()).includes('AED'));
 await upload.setInputFiles(fixture);
 assert.equal(await page.getByLabel('Worksheet',{exact:true}).inputValue(),'');
 await page.getByLabel('Worksheet',{exact:true}).selectOption('1');
 assert.equal(await page.getByLabel('Revenue (required)',{exact:true}).inputValue(),'1');
 await page.getByLabel('File currency',{exact:true}).selectOption('EUR');
 await page.getByLabel('I confirm these column mappings describe monthly summaries.').check();
 await page.getByRole('button',{name:'Validate and review'}).click();
 await page.getByRole('heading',{name:'4. Ready to analyze'}).waitFor();
 await page.getByLabel('Worksheet',{exact:true}).selectOption('0');
 assert.equal(await page.getByRole('button',{name:'Import and analyze'}).count(),0);
 await page.getByLabel('Worksheet',{exact:true}).selectOption('1');
 await page.getByLabel('I confirm these column mappings describe monthly summaries.').check();
 await page.getByRole('button',{name:'Validate and review'}).click();
 await page.getByRole('button',{name:'Import and analyze'}).click();
 assert.ok((await kpis.innerText()).includes('EUR'));
 assert.ok((await kpis.innerText()).includes('1,000'));
 // Each currency goes through the same explicit template workflow.
 for(const code of ['USD','PKR','AED','GBP','EUR']){
   await upload.setInputFiles(`${process.cwd()}/public/financial-template.csv`);
   await page.getByLabel('File currency',{exact:true}).selectOption(code);
   await page.getByLabel('I confirm these column mappings describe monthly summaries.').check();
   await page.getByRole('button',{name:'Validate and review'}).click();
   await page.getByRole('button',{name:'Import and analyze'}).click();
   assert.ok((await kpis.innerText()).includes(code));
   assert.ok((await kpis.innerText()).includes('571,000'));
 }
 await upload.setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('Month,Revenue,COGS,OperatingExpenses,OtherExpenses,Tax\n2025-01,-1,0,0,0,0')});
 await page.getByLabel('File currency',{exact:true}).selectOption('USD');
 await page.getByLabel('I confirm these column mappings describe monthly summaries.').check();
 await page.getByRole('button',{name:'Validate and review'}).click();
 assert.ok((await page.getByRole('alert').filter({hasText:'Please review'}).innerText()).includes('non-negative'));
 assert.equal(await page.getByRole('button',{name:'Import and analyze'}).count(),0);
 assert.ok((await kpis.innerText()).includes('EUR'));
 await page.getByRole('button',{name:'Reset to demo'}).click();
 assert.ok((await kpis.innerText()).includes('USD'));
 assert.ok((await kpis.innerText()).includes('1,320,000'));
 await upload.setInputFiles(`${process.cwd()}/public/financial-template.xlsx`);
 await page.getByLabel('Worksheet',{exact:true}).selectOption('0');
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>document.documentElement.scrollWidth <= innerWidth);
 assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);
 console.log('PASS: five-row preview; aliases and duplicate prevention; required/zero confirmations; review invalidation; worksheet selection; import totals; all currencies without conversion; invalid upload recovery; reset; XLSX template mapping; mobile; no browser errors or POSTs.');

});
