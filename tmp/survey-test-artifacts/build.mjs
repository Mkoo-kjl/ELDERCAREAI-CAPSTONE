import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';

const directory=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const input=JSON.parse(await fs.readFile(path.join(directory,'survey-input.json'),'utf8'));
const out=path.resolve(directory,'../../outputs/01a19aac-survey-testing');
await fs.mkdir(out,{recursive:true});
const rating=input.fields.filter(field=>field.sampled),blank=input.fields.filter(field=>!field.sampled);
const ordered=[...rating,...blank];
const headers=['record_type','synthetic_case_id',...ordered.map(field=>field.code)];

// A reproducible positive-response test fixture, not sampled human opinions.
let state=20261108;
function random(){state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;}
function shuffle(values){for(let i=values.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[values[i],values[j]]=[values[j],values[i]];}return values;}
const columns=rating.map((_,index)=>shuffle(Array.from({length:50},(_,row)=>row<(index%2===0?33:32)?'Strongly Agree':'Agree')));
const data=Array.from({length:50},(_,row)=>['SYNTHETIC TEST DATA',`TEST-${String(row+1).padStart(3,'0')}`,...columns.map(column=>column[row]),...blank.map(()=>null)]);
assert.equal(new Set(data.map(row=>row[1])).size,50);
assert.ok(data.every(row=>row[0]==='SYNTHETIC TEST DATA'&&row.length===headers.length));
assert.ok(data.every(row=>row.slice(2,15).every(value=>['Strongly Agree','Agree'].includes(value))&&row.slice(15).every(value=>value===null)));
const counts={stronglyAgree:data.flatMap(row=>row.slice(2,15)).filter(value=>value==='Strongly Agree').length,agree:data.flatMap(row=>row.slice(2,15)).filter(value=>value==='Agree').length};
assert.equal(counts.stronglyAgree+counts.agree,650);

const workbook=Workbook.create();
const sheet=workbook.worksheets.add('Synthetic responses');
sheet.showGridLines=false;sheet.tabColor='#274760';
sheet.getRange('A1:AD51').values=[headers,...data];
sheet.getRange('A1:AD51').format.font={name:'Arial',size:11,color:'#243746'};
sheet.getRange('A1:AD51').format.verticalAlignment='center';
sheet.getRange('A1:AD51').format.rowHeight=24;
sheet.getRange('A1:AD1').format={fill:'#274760',font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},rowHeight:38,wrapText:true,horizontalAlignment:'center'};
sheet.getRange('A1:A51').format.columnWidth=29;
sheet.getRange('B1:B51').format.columnWidth=22;
sheet.getRange('C1:AD51').format.columnWidth=19;
sheet.getRange('A2:A51').format.fill='#FFF1D6';
sheet.getRange('A2:A51').format.font={name:'Arial',size:11,bold:true,color:'#6E4C12'};
sheet.getRange('C2:O51').format.horizontalAlignment='center';
sheet.getRange('P2:AD51').format.fill='#F3F5F7';
sheet.getRange('C2:O51').dataValidation={rule:{type:'list',values:['Strongly Agree','Agree']}};
sheet.getRange('C2:O51').conditionalFormats.add('containsText',{text:'Strongly Agree',format:{fill:'#E4EFF7',font:{color:'#193F5A'}}});
sheet.freezePanes.freezeRows(1);sheet.freezePanes.freezeColumns(2);

const key=workbook.worksheets.add('Question key');key.showGridLines=false;
key.getRange('A1:E37').format.font={name:'Arial',size:11,color:'#243746'};
key.getRange('A1:E37').format.verticalAlignment='center';
key.getRange('A1:E37').format.rowHeight=26;
key.getRange('A1:A37').format.columnWidth=23;
key.getRange('B1:B37').format.columnWidth=25;
key.getRange('C1:C37').format.columnWidth=52;
key.getRange('D1:D37').format.columnWidth=24;
key.getRange('E1:E37').format.columnWidth=52;
key.getRange('A1').values=[['Synthetic survey test data']];
key.getRange('A1').format.font={name:'Arial',size:16,bold:true,color:'#243746'};
key.getRange('A2').values=[['50 artificial cases. Every record is test data. No form submissions or real participant responses.']];
key.getRange('A3').values=[[`Question source: ${input.source}`]];
key.getRange('A4').values=[['Method: seeded shuffle (20261108), 32–33 Strongly Agree answers per rating item; other answers Agree.']];
key.getRange('A5').values=[['Demographics, sincerity checks, recommendations and Other/free-text answers are intentionally blank.']];
key.getRange('A6').values=[['Use for testing only. Agreement on a negatively worded item indicates a concern, not a favorable evaluation.']];
key.getRange('A6').format.font={name:'Arial',size:11,bold:true,color:'#79500A'};
key.getRange('A8:E8').values=[['Data column','Form section','Item summary','File treatment','Interpretation note']];
key.getRange('A8:E8').format={fill:'#274760',font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},rowHeight:30,horizontalAlignment:'center',wrapText:true};
key.getRange('A9:E36').values=input.fields.map(field=>[field.code,field.section,field.summary,field.sampled?'Synthetic rating':'Left blank',field.note]);
key.getRange('A9:E36').format.wrapText=true;
key.getRange('A9:E36').format.rowHeight=40;
key.freezePanes.freezeRows(8);
workbook.recalculate();
const inspected=await workbook.inspect({kind:'table',range:"'Synthetic responses'!A1:G4",include:'values',tableMaxRows:4,tableMaxCols:7,maxChars:1200});
await fs.writeFile(path.join(directory,'inspection.ndjson'),inspected.ndjson);
const errors=await workbook.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#SPILL!',options:{useRegex:true,maxResults:20},summary:'final error scan',maxChars:1200});
await fs.writeFile(path.join(directory,'error-scan.ndjson'),errors.ndjson);
for(const [name,range,filename] of [['Synthetic responses','A1:F10','responses-preview.png'],['Question key','A1:E16','key-preview.png']]){
  const preview=await workbook.render({sheetName:name,range,scale:1.25,format:'png'});
  await fs.writeFile(path.join(directory,filename),new Uint8Array(await preview.arrayBuffer()));
}
const xlsx=await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(path.join(out,'eldercare_SYNTHETIC_TEST_50.xlsx'));
const escape=value=>`"${String(value??'').replaceAll('"','""')}"`;
await fs.writeFile(path.join(out,'eldercare_SYNTHETIC_TEST_50.csv'),'\ufeff'+[headers,...data].map(row=>row.map(escape).join(',')).join('\r\n')+'\r\n','utf8');
console.log(JSON.stringify({output:out,rows:50,mainRatingItems:13,blankSurveyFields:blank.length,...counts}));
