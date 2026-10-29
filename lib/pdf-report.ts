import { variancePercent } from './budget.ts';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { buildReport, reportMargin, reportMoney, type ReportInput } from './reports.ts';

export type PdfFonts = { regular: string; bold: string };
const teal: [number,number,number] = [15,118,110];
const ink: [number,number,number] = [23,43,58];
const muted: [number,number,number] = [85,105,125];

export function createPdfReport(input: ReportInput, fonts: PdfFonts) {
  const report = buildReport(input);
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4', putOnlyUsedFonts:true });
  doc.addFileToVFS('ReportSans.ttf', fonts.regular);
  doc.addFont('ReportSans.ttf', 'ReportSans', 'normal');
  doc.addFileToVFS('ReportSans-Bold.ttf', fonts.bold);
  doc.addFont('ReportSans-Bold.ttf', 'ReportSans', 'bold');
  doc.setFont('ReportSans','normal');
  doc.setProperties({ title:'Ledger financial summary', subject:report.label, creator:'Ledger — local browser export' });
  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight(), margin = 14;
  const usable = width - 2*margin;
  function heading(title: string, code=report.currencyCode) {
    doc.setFillColor(...teal); doc.rect(0,0,width,28,'F');
    doc.setTextColor(255,255,255);doc.setFont('ReportSans','bold');doc.setFontSize(18);doc.text(title,margin,13);
    doc.setFont('ReportSans','normal');doc.setFontSize(9);doc.text(`${code} | Selected period: ${report.dateRange} | No currency conversion`,margin,22);
  }
  heading('ledger.  Financial summary');
  doc.setFontSize(9);doc.setFont('ReportSans','bold');doc.setTextColor(...teal);doc.text(report.label,margin,37);
  doc.setTextColor(...ink);doc.setFont('ReportSans','normal');
  const filenameLines: string[] = doc.splitTextToSize(`Active source: ${report.source}`,usable);
  // A valid local filename is at most a few lines, but paginate arbitrary input
  // instead of clipping a long source name or letting it overlap the summary.
  let cursor = 44;
  for (const line of filenameLines) {
    if (cursor > height-22) { doc.addPage(); heading('ledger.  Source details'); cursor=39; }
    doc.text(line,margin,cursor);cursor+=4.5;
  }
  cursor+=5;
  if (cursor+115>height-20) {doc.addPage();heading('ledger.  Financial summary');cursor=39;}
  const cardWidth=(usable-9)/4;
  const metrics = [
    ['Revenue',report.totals.revenue,`${report.rows.length} ${report.rows.length===1?'month':'months'}`],
    ['Gross profit',report.totals.grossProfit,`${reportMargin(report.totals.grossProfit,report.totals.revenue)} margin`],
    ['Operating profit',report.totals.operatingProfit,`${reportMargin(report.totals.operatingProfit,report.totals.revenue)} margin`],
    ['Net profit',report.totals.netProfit,`${reportMargin(report.totals.netProfit,report.totals.revenue)} margin`],
  ] as const;
  metrics.forEach(([label,value,detail],index)=>{
    const x=margin+index*(cardWidth+3);
    doc.setFillColor(242,248,248);doc.roundedRect(x,cursor,cardWidth,29,2,2,'F');
    doc.setFont('ReportSans','normal');doc.setFontSize(8);doc.setTextColor(...muted);doc.text(label,x+4,cursor+7);
    doc.setFont('ReportSans','bold');doc.setFontSize(13);
    const text=reportMoney(value,report.currencyCode);
    while(doc.getTextWidth(text)>cardWidth-8 && doc.getFontSize()>7) doc.setFontSize(doc.getFontSize()-0.5);
    doc.setTextColor(...(value<0 ? [185,28,28] as [number,number,number] : ink));doc.text(text,x+4,cursor+17);
    doc.setFont('ReportSans','normal');doc.setFontSize(8);doc.setTextColor(...muted);doc.text(detail,x+4,cursor+25);
  });
  cursor+=40;
  doc.setFont('ReportSans','bold');doc.setFontSize(11);doc.setTextColor(...ink);doc.text('Expense breakdown',margin,cursor);
  const numeric = new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  autoTable(doc,{
    startY:cursor+4, margin:{left:margin,right:width/2+3,bottom:18},
    head:[['Category',`Amount (${report.currencyCode})`,'Share']],
    body:[...report.expenses.map(expense=>[expense.name,numeric.format(expense.value),report.expenseTotal===0?'N/A':`${(expense.value/report.expenseTotal*100).toFixed(1)}%`]), ['Total expenses',numeric.format(report.expenseTotal),'']],
    theme:'grid',styles:{font:'ReportSans',fontSize:8,cellPadding:2.6,lineColor:[226,232,240]},
    headStyles:{fillColor:teal,fontStyle:'bold'},columnStyles:{1:{halign:'right'},2:{halign:'right'}},
  });
  const notes = [
    'Reading this report',
    `All figures use ${report.currencyCode}. No exchange-rate conversion is performed.`,
    'Gross profit = Revenue - COGS.',
    'Operating profit = Gross profit - Operating expenses.',
    'Net profit = Operating profit - Other expenses - Tax.',
    'Other expenses exclude tax. Each cost is counted once.',
    'Margins are profit / revenue. Zero revenue is shown as N/A, including in the monthly table.',
    'Negative profit is a loss. PDF amounts are rounded to two decimal places; CSV retains numeric precision.',
    'Monthly financial totals exclude product results. Expense budget variance is not included.',
    `Products: ${report.products.status}.`,
    `Revenue budget: ${report.revenueBudget.status}.`,
  ];
  const notesX=width/2+5;let notesY=cursor;
  notes.forEach((text,index)=>{
    doc.setFont('ReportSans',index===0?'bold':'normal');doc.setFontSize(index===0?11:8);doc.setTextColor(...(index===0?ink:muted));
    const lines=doc.splitTextToSize(text,width-margin-notesX);
    doc.text(lines,notesX,notesY);notesY+=lines.length*3.8+3;
  });

  doc.addPage();heading('ledger.  Monthly results');
  doc.setFont('ReportSans','normal');doc.setTextColor(...muted);doc.setFontSize(8);
  doc.text(`All amounts in ${report.currencyCode}. Losses are negative; zero-revenue margins are N/A.`,margin,37);
  const moneyKeys = ['revenue','costOfRevenue','operatingExpenses','otherExpenses','taxes','grossProfit','operatingProfit','netProfit'] as const;
  const body = report.rows.map(row=>[row.month,...moneyKeys.map(key=>numeric.format(row[key])),reportMargin(row.netProfit,row.revenue)]);
  const totalRow=['TOTAL',...moneyKeys.map(key=>numeric.format(report.totals[key])),reportMargin(report.totals.netProfit,report.totals.revenue)];
  autoTable(doc,{
    startY:43, margin:{top:38,left:margin,right:margin,bottom:19},
    head:[['Month','Revenue','COGS','Operating expenses','Other expenses (excl. tax)','Tax','Gross profit','Operating profit','Net profit','Net margin']],
    body:[...body,totalRow],showHead:'everyPage',rowPageBreak:'avoid',theme:'striped',
    styles:{font:'ReportSans',fontSize:7.2,cellPadding:2.4,halign:'right',overflow:'linebreak',lineColor:[226,232,240]},
    headStyles:{fillColor:teal,fontStyle:'bold',fontSize:7.2},
    columnStyles:{0:{halign:'left',cellWidth:22},9:{cellWidth:18}},
    didParseCell(data) {
      if (data.section==='body') {
        if (String(data.cell.raw).startsWith('-')) data.cell.styles.textColor=[185,28,28];
        if (data.row.index===body.length) {data.cell.styles.fontStyle='bold';data.cell.styles.fillColor=[224,242,241];}
      }
    },
    didDrawPage() {if(doc.getCurrentPageInfo().pageNumber>2) heading('ledger.  Monthly results — continued');},
  });
  if(report.revenueBudget.provided>0) {
    const budget=report.revenueBudget;
    doc.addPage();heading('ledger.  Revenue Budget vs Actual');
    doc.setFont('ReportSans','normal');doc.setFontSize(9);doc.setTextColor(...ink);
    doc.text(budget.status,margin,37);
    doc.text(`Actual revenue: ${reportMoney(budget.actual,report.currencyCode)} | Total budget: ${budget.budget===null?'N/A':reportMoney(budget.budget,report.currencyCode)}`,margin,45);
    doc.text(`Variance: ${budget.amount===null?'N/A':reportMoney(budget.amount,report.currencyCode)} | Variance %: ${variancePercent(budget.percentage)} | ${budget.complete?budget.outcome:'Incomplete coverage'}`,margin,53);
    doc.setFontSize(8);doc.setTextColor(...muted);
    doc.text('Higher revenue is favorable. Zero-budget percentages are N/A. Missing budgets are never zero; total comparisons require complete coverage.',margin,61);
    autoTable(doc,{
      startY:67,margin:{top:38,left:margin,right:margin,bottom:19},
      head:[['Month',`Actual (${report.currencyCode})`,`Budget (${report.currencyCode})`,'Variance','Variance %','Result']],
      body:budget.rows.map(row=>[row.month,numeric.format(row.revenue),row.budget===null?'Not provided':numeric.format(row.budget),row.amount===null?'N/A':numeric.format(row.amount),variancePercent(row.percentage),row.outcome]),
      showHead:'everyPage',rowPageBreak:'avoid',theme:'striped',styles:{font:'ReportSans',fontSize:8,cellPadding:2.6,halign:'right'},
      columnStyles:{0:{halign:'left'},5:{halign:'left'}},headStyles:{fillColor:teal,fontStyle:'bold'},
      didParseCell(data){if(data.section==='body' && [3,4].includes(data.column.index)) {const row=budget.rows[data.row.index];if(row.amount!==null && row.amount!==0)data.cell.styles.textColor=row.amount>0?teal:[185,28,28];}},
      didDrawPage(data){if(data.pageNumber>1)heading('ledger.  Revenue budget — continued');},
    });
  }
  let productStart=Infinity;
  if(report.products.rows.length>0) {
    const product=report.products;doc.addPage();productStart=doc.getNumberOfPages();heading('ledger.  Product Profitability',product.currencyCode);
    doc.setFont('ReportSans','normal');doc.setFontSize(8);doc.setTextColor(...ink);
    const lines:string[]=doc.splitTextToSize(`Product source: ${product.filename}\nSelected product: ${input.selectedProduct||'All products'}`,usable);
    let y=37;
    for(const line of lines){if(y>height-35){doc.addPage();heading('ledger.  Product source',product.currencyCode);y=38;}doc.text(line,margin,y);y+=4;}
    if(y+33>height-35){doc.addPage();heading('ledger.  Product Profitability',product.currencyCode);y=38;}
    doc.text(`Product currency: ${product.currencyCode}. Separate from monthly ${report.currencyCode} totals. No conversion or reconciliation.`,margin,y+4);
    doc.text('Grouped by product for the selected period; sorted by gross profit. Product cost is the monthly total, excluding operating expenses and taxes.',margin,y+10);
    doc.text('Gross margin = (revenue - product cost) / revenue. Zero revenue is N/A.',margin,y+16);
    doc.text(report.productBudgets.status,margin,y+22);
    autoTable(doc,{
      startY:y+28,margin:{top:38,left:margin,right:margin,bottom:19},
      head:[['Product','Units sold',`Revenue (${product.currencyCode})`,'Product cost','Gross profit','Gross margin']],
      body:product.rows.map(row=>[row.product,new Intl.NumberFormat('en-US',{maximumFractionDigits:20}).format(row.unitsSold),numeric.format(row.revenue),numeric.format(row.productCost),numeric.format(row.grossProfit),row.grossMargin===null?'N/A':`${row.grossMargin.toFixed(1)}%`]),
      showHead:'everyPage',rowPageBreak:'avoid',theme:'striped',styles:{font:'ReportSans',fontSize:8,cellPadding:2.6,halign:'right',overflow:'linebreak'},
      columnStyles:{0:{halign:'left',cellWidth:70}},headStyles:{fillColor:teal,fontStyle:'bold'},
      didParseCell(data){if(data.section==='body' && [4,5].includes(data.column.index)){const row=product.rows[data.row.index];const value=row.grossProfit;if(data.column.index===5&&row.grossMargin===null)return;if(value!==0)data.cell.styles.textColor=value>0?teal:[185,28,28];}},
      didDrawPage(data){if(data.pageNumber>1)heading('ledger.  Products — continued',product.currencyCode);},
    });
  }
  if(report.productBudgets.provided>0){
    const budget=report.productBudgets;
    doc.addPage();heading('ledger.  Product revenue budget',report.products.currencyCode);
    doc.setFont('ReportSans','normal');doc.setFontSize(8);doc.setTextColor(...ink);
    const labels:string[]=doc.splitTextToSize(`Selected product: ${input.selectedProduct||'All products'} | ${budget.status}`,usable);
    let y=37;for(const line of labels){doc.text(line,margin,y);y+=4;}
    doc.text(`Actual product revenue: ${reportMoney(budget.actual,report.products.currencyCode)} | Budget: ${budget.budget===null?'N/A':reportMoney(budget.budget,report.products.currencyCode)}`,margin,y+4);
    doc.text(`Variance: ${budget.amount===null?'N/A':reportMoney(budget.amount,report.products.currencyCode)} | Variance %: ${variancePercent(budget.percentage)} | ${budget.complete?budget.outcome:'Incomplete coverage'}`,margin,y+11);
    doc.text('Actual minus budget. Positive is Favorable; negative is Adverse. Zero-budget percentages are N/A. Missing budgets are never zero.',margin,y+18);
    autoTable(doc,{
      startY:y+24,margin:{top:38,left:margin,right:margin,bottom:19},
      head:[['Month','Product',`Actual (${report.products.currencyCode})`,'Revenue budget','Variance','Variance %','Result']],
      body:budget.rows.map(row=>[row.month,row.product,numeric.format(row.revenue),row.budget===null?'Not provided':numeric.format(row.budget),row.amount===null?'N/A':numeric.format(row.amount),variancePercent(row.percentage),row.outcome]),
      showHead:'everyPage',rowPageBreak:'avoid',theme:'striped',styles:{font:'ReportSans',fontSize:8,cellPadding:2.6,halign:'right',overflow:'linebreak'},columnStyles:{0:{halign:'left'},1:{halign:'left',cellWidth:62}},headStyles:{fillColor:teal,fontStyle:'bold'},
      didParseCell(data){if(data.section==='body'&&[4,5].includes(data.column.index)){const row=budget.rows[data.row.index];if(row.amount===null||row.amount===0||(data.column.index===5&&row.percentage===null))return;data.cell.styles.textColor=row.amount>0?teal:[185,28,28];}},
      didDrawPage(data){if(data.pageNumber>1)heading('ledger.  Product budgets — continued',report.products.currencyCode);},
    });
  }
  if(report.salesCost.provided>0){
    const values=report.salesCost;
    const price=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:6});
    const amount=(value:number|null|undefined)=>value==null?'N/A':numeric.format(value);
    doc.addPage();heading('ledger.  Sales plan reconciliation',report.products.currencyCode);
    doc.setFont('ReportSans','normal');doc.setFontSize(8);doc.setTextColor(...ink);
    const labels:string[]=doc.splitTextToSize(`Selected product: ${input.selectedProduct||'All products'} | Sales breakdown coverage: ${values.salesProvided}/${values.count}; cost budgets: ${values.costsProvided}/${values.count}`,usable);
    doc.text(labels,margin,37);const y=37+labels.length*4;
    doc.text('Explicit revenue budget must match budgeted units x budgeted selling price (0.01 currency tolerance plus floating-point precision).',margin,y+4);
    doc.text('Mismatch or missing plan: price/volume unavailable. Zero units + zero revenue: price N/A, price variance 0. Positive revenue + zero units: unavailable.',margin,y+10);
    autoTable(doc,{
      startY:y+16,margin:{top:38,left:margin,right:margin,bottom:19},
      head:[['Month','Product','Actual units','Budget units','Actual price','Budget price','Revenue budget','Units x price','Plan difference','Status']],
      body:values.rows.map(row=>[row.month,row.product,String(row.unitsSold),row.budgetedUnits===undefined?'Not provided':String(row.budgetedUnits),row.actualSellingPrice===null?'N/A':price.format(row.actualSellingPrice),row.budgetedSellingPrice===undefined?'Not provided':price.format(row.budgetedSellingPrice),amount(row.revenueBudget),amount(row.expectedRevenueBudget),row.reconciliationDifference===null?'N/A':price.format(row.reconciliationDifference),row.reconciliation]),
      showHead:'everyPage',rowPageBreak:'avoid',theme:'striped',styles:{font:'ReportSans',fontSize:7,cellPadding:2,halign:'right',overflow:'linebreak'},columnStyles:{0:{halign:'left'},1:{halign:'left',cellWidth:42},9:{cellWidth:30}},headStyles:{fillColor:teal,fontStyle:'bold'},
      didDrawPage(data){if(data.pageNumber>1)heading('ledger.  Sales plans — continued',report.products.currencyCode);},
    });
    doc.addPage();heading('ledger.  Sales & cost variances',report.products.currencyCode);
    doc.setFont('ReportSans','normal');doc.setFontSize(8);doc.setTextColor(...ink);
    doc.text(`Volume: ${amount(values.volumeVariance)} | Price: ${amount(values.priceVariance)} | Total revenue variance: ${amount(values.revenueVariance)} (${report.products.currencyCode})`,margin,37);
    doc.text(`Cost budget: ${amount(values.costBudget)} | Actual cost: ${amount(values.actualCost)} | Cost variance: ${amount(values.costVariance)}`,margin,44);
    doc.text('Positive sales variances and cost savings are Favorable; negative is Adverse. Totals are sums of row variances only with complete coverage.',margin,51);
    doc.text('Volume = (actual units - budget units) x budget price; price = (actual price - budget price) x actual units; cost = cost budget - actual cost.',margin,58);
    const label=(value:number|null)=>`${amount(value)}\n${value===null?'Not available':value>0?'Favorable':value<0?'Adverse':'On budget'}`;
    autoTable(doc,{
      startY:64,margin:{top:38,left:margin,right:margin,bottom:19},head:[['Month','Product','Volume variance','Price variance','Revenue variance','Cost budget','Actual cost','Cost variance']],
      body:values.rows.map(row=>[row.month,row.product,label(row.volumeVariance),label(row.priceVariance),amount(row.revenueVariance),amount(row.costBudget),amount(row.productCost),label(row.costVariance)]),
      showHead:'everyPage',rowPageBreak:'avoid',theme:'striped',styles:{font:'ReportSans',fontSize:8,cellPadding:2.5,halign:'right',overflow:'linebreak'},columnStyles:{0:{halign:'left'},1:{halign:'left',cellWidth:55}},headStyles:{fillColor:teal,fontStyle:'bold'},
      didParseCell(data){if(data.section==='body'&&[2,3,4,7].includes(data.column.index)){const row=values.rows[data.row.index];const value=data.column.index===2?row.volumeVariance:data.column.index===3?row.priceVariance:data.column.index===4?row.revenueVariance:row.costVariance;if(value!==null&&value!==0)data.cell.styles.textColor=value>0?teal:[185,28,28];}},
      didDrawPage(data){if(data.pageNumber>1)heading('ledger.  Variances — continued',report.products.currencyCode);},
    });
  }
  const count=doc.getNumberOfPages();
  for(let page=1;page<=count;page++) {
    doc.setPage(page);doc.setFont('ReportSans','normal');doc.setFontSize(7);doc.setTextColor(...muted);
    doc.setDrawColor(226,232,240);doc.line(margin,height-13,width-margin,height-13);
    doc.text(page>=productStart?`Uploaded product summary | ${report.products.currencyCode} | Independent of monthly financial totals`:`${report.isDemo?'Fictional demo data — illustrative only':'Uploaded monthly summary'} | ${report.currencyCode} | Local browser export`,margin,height-8);
    doc.text(`Page ${page} of ${count}`,width-margin,height-8,{align:'right'});
  }
  return doc;
}
