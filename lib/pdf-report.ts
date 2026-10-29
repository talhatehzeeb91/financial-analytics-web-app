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
  function heading(title: string) {
    doc.setFillColor(...teal); doc.rect(0,0,width,28,'F');
    doc.setTextColor(255,255,255);doc.setFont('ReportSans','bold');doc.setFontSize(18);doc.text(title,margin,13);
    doc.setFont('ReportSans','normal');doc.setFontSize(9);doc.text(`${report.currencyCode} | Selected period: ${report.dateRange} | No currency conversion`,margin,22);
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
    'Monthly summaries only. Product profitability and expense budget variance are not included.',
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
  const count=doc.getNumberOfPages();
  for(let page=1;page<=count;page++) {
    doc.setPage(page);doc.setFont('ReportSans','normal');doc.setFontSize(7);doc.setTextColor(...muted);
    doc.setDrawColor(226,232,240);doc.line(margin,height-13,width-margin,height-13);
    doc.text(`${report.isDemo?'Fictional demo data — illustrative only':'Uploaded monthly summary'} | ${report.currencyCode} | Local browser export`,margin,height-8);
    doc.text(`Page ${page} of ${count}`,width-margin,height-8,{align:'right'});
  }
  return doc;
}
