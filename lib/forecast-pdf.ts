import {jsPDF} from 'jspdf';
import {autoTable} from 'jspdf-autotable';
import {buildForecast,scenarioNames,assumptionKeys,forecastDisclaimer,type ForecastInput} from './forecast.ts';
import type {PdfFonts} from './pdf-report.ts';
import {reportMoney} from './reports.ts';
export function createForecastPdf(input:ForecastInput,fonts:PdfFonts){
  const report=buildForecast(input);if(!report.valid)throw new Error(report.errors.join(' '));
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',putOnlyUsedFonts:true});
  doc.addFileToVFS('ReportSans.ttf',fonts.regular);doc.addFont('ReportSans.ttf','ReportSans','normal');doc.addFileToVFS('ReportSans-Bold.ttf',fonts.bold);doc.addFont('ReportSans-Bold.ttf','ReportSans','bold');doc.setFont('ReportSans','normal');
  doc.setProperties({title:'Ledger forecast estimates',subject:forecastDisclaimer,creator:'Ledger local browser export'});
  const teal:[number,number,number]=[15,118,110],margin=14,width=297,height=210,usable=269;
  const number=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const money=(value:number|null)=>value===null?'N/A':number.format(value);
  const pct=(value:number|null)=>value===null?'Not derivable':`${number.format(value)}%`;
  function heading(title:string){doc.setFillColor(...teal);doc.rect(0,0,width,28,'F');doc.setFont('ReportSans','bold');doc.setFontSize(17);doc.setTextColor(255,255,255);doc.text(title,margin,13);doc.setFont('ReportSans','normal');doc.setFontSize(8);doc.text(`FORECAST ESTIMATES | ${input.currencyCode} | ${report.forecastFrom} to ${report.forecastTo} | No currency conversion`,margin,22);}
  heading('ledger. Forecast assumptions');
  let cursor=36;
  function text(value:string){doc.setFont('ReportSans','normal');doc.setFontSize(8);doc.setTextColor(45,65,80);const lines:string[]=doc.splitTextToSize(value,usable);for(const line of lines){if(cursor>height-23){doc.addPage();heading('ledger. Forecast assumptions — continued');cursor=38;doc.setFont('ReportSans','normal');doc.setFontSize(8);doc.setTextColor(45,65,80);}doc.text(line,margin,cursor);cursor+=4;}cursor+=3;}
  text(forecastDisclaimer);text(input.isDemo?'FICTIONAL DEMO DATA — illustrative only':`Source file: ${input.filename}`);
  text(`Historical basis: ${input.historyRange.from} to ${input.historyRange.to} (${report.basis.rows.length} records). Seed: ${report.basis.seed!.month}. Latest actual in full dataset: ${input.latestActualMonth}.`);
  text('Revenue and operating expenses compound from the last selected month across calendar gaps. COGS = forecast revenue x assumed COGS ratio. Other expenses and tax stay at the scenario monthly amounts; tax is not a calculated tax rate. Existing Ledger gross, operating and net profit formulas apply.');
  text('Historical growth defaults are first-to-last compound monthly rates using elapsed months; COGS default is total COGS / total revenue. Other expenses and tax default to arithmetic monthly averages. All scenarios start with identical defaults; differences require explicit user edits. Inputs are assumptions, not predictions.');
  text(`Seed revenue: ${reportMoney(report.basis.seed!.revenue,input.currencyCode)} | Seed operating expenses: ${reportMoney(report.basis.seed!.operatingExpenses,input.currencyCode)}.`);
  for(const warning of report.basis.warnings)text(warning);
  text(`${report.basis.comparison.status} Monthly fixed costs: ${money(report.basis.comparison.monthlyFixedCosts)}; variable-cost ratio: ${pct(report.basis.comparison.variableCostPercentage)}; monthly historical break-even: ${money(report.basis.comparison.revenue)} (${input.currencyCode}). This reference is not inferred from forecast COGS and does not change with scenario assumptions.`);
  if(cursor>130){doc.addPage();heading('ledger. Scenario assumptions');cursor=38;}
  const defaults=report.basis.defaults;
  autoTable(doc,{startY:cursor,margin:{top:38,left:margin,right:margin,bottom:20},head:[['Scenario','Revenue growth / month','COGS / revenue','Opex growth / month',`Other expenses / month (${input.currencyCode})`,`Tax / month (${input.currencyCode})`]],body:[['Historical default',pct(defaults.revenueGrowth),pct(defaults.cogsPercentage),pct(defaults.operatingExpenseGrowth),money(defaults.otherExpenses),money(defaults.tax)],...report.scenarios.map(s=>[s.name,pct(s.assumptions.revenueGrowth),pct(s.assumptions.cogsPercentage),pct(s.assumptions.operatingExpenseGrowth),money(s.assumptions.otherExpenses),money(s.assumptions.tax)])],styles:{font:'ReportSans',fontSize:8,cellPadding:2.5,overflow:'linebreak'},headStyles:{fillColor:teal},showHead:'everyPage',didDrawPage(data){if(data.pageNumber>1)heading('ledger. Scenario assumptions — continued');}});
  doc.addPage();heading('ledger. Assumption sources & scenario totals');cursor=37;
  text('Each assumption is classified by whether its current value matches the historical default. Missing defaults require explicit user assumptions. Amounts below are forecast horizon totals, separate from actual financial totals.');
  const labels=['Revenue growth','COGS percentage','Opex growth','Monthly other expenses','Monthly tax'];
  autoTable(doc,{startY:cursor,margin:{top:38,left:margin,right:margin,bottom:20},head:[['Scenario',...labels]],body:report.scenarios.map(s=>[s.name,...assumptionKeys.map(key=>s.assumptions[key]===defaults[key]?'Matches historical default':'User assumption')]),styles:{font:'ReportSans',fontSize:8,cellPadding:2.5},headStyles:{fillColor:teal}});
  autoTable(doc,{startY:90,margin:{top:38,left:margin,right:margin,bottom:20},head:[['Scenario','Revenue','COGS','Gross profit','Opex','Operating profit','Other expenses','Tax','Net profit']],body:report.scenarios.map(s=>[s.name,...(['revenue','costOfRevenue','grossProfit','operatingExpenses','operatingProfit','otherExpenses','taxes','netProfit'] as const).map(key=>money(s.totals![key]))]),styles:{font:'ReportSans',fontSize:8,cellPadding:2.5,halign:'right'},columnStyles:{0:{halign:'left'}},headStyles:{fillColor:teal}});
  for(const name of scenarioNames){const scenario=report.scenarios.find(s=>s.name===name)!;doc.addPage();heading(`ledger. ${name} forecast estimates`);doc.setFontSize(8);doc.setTextColor(45,65,80);doc.text('All amounts in '+input.currencyCode+'. Historical break-even is a constant cost-structure reference. Missing comparisons are N/A.',margin,37);
    const cells=(row:typeof scenario.rows[number])=>[row.month,...(['revenue','costOfRevenue','grossProfit','operatingExpenses','operatingProfit','otherExpenses','taxes','netProfit'] as const).map(key=>money(row[key])),money(row.breakEvenRevenue),money(row.revenueAboveBreakEven)];
    autoTable(doc,{startY:44,margin:{top:38,left:margin,right:margin,bottom:20},head:[['Forecast month','Revenue','COGS','Gross profit','Opex','Operating profit','Other expenses','Tax','Net profit','Historical break-even','Revenue above break-even']],body:scenario.rows.map(cells),styles:{font:'ReportSans',fontSize:7.2,cellPadding:2.5,halign:'right',overflow:'linebreak'},columnStyles:{0:{halign:'left'}},headStyles:{fillColor:teal},showHead:'everyPage',rowPageBreak:'avoid',didParseCell(data){if(data.section==='body'&&String(data.cell.raw).startsWith('-'))data.cell.styles.textColor=[185,28,28];},didDrawPage(data){if(data.pageNumber>1)heading(`ledger. ${name} forecast — continued`);}});
  }
  const count=doc.getNumberOfPages();for(let page=1;page<=count;page++){doc.setPage(page);doc.setFont('ReportSans','normal');doc.setFontSize(7);doc.setTextColor(85,105,125);doc.text(`${input.isDemo?'FICTIONAL DEMO DATA | ':''}FORECAST ESTIMATES | ${input.currencyCode} | Historical basis ${input.historyRange.from} to ${input.historyRange.to} | Local browser export`,margin,202);doc.text(`Page ${page} of ${count}`,283,202,{align:'right'});}
  return doc;
}
