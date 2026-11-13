// Recreate the three affected use-case diagrams as native SVG at their original
// canvas sizes and coordinates. Word drawing extents and relationships stay intact.
const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1105-1297-0_26.1105.1297.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright');
const out=path.resolve('tmp/use-case-review/diagrams');fs.mkdirSync(out,{recursive:true});
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function create(w,h,font){let bits=[`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><marker id="arrow" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto"><path d="M1,1 L11,6 L1,11" fill="none" stroke="black" stroke-width="1"/></marker></defs><rect width="100%" height="100%" fill="white"/>`];
 const text=(x,y,s,size=font)=>bits.push(`<text x="${x}" y="${y}" dominant-baseline="middle" text-anchor="middle" font-family="Times New Roman" font-size="${size}" fill="black">${esc(s)}</text>`);
 const line=(x1,y1,x2,y2,dash=false,arrow=false)=>bits.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="black" stroke-width="1.4" ${dash?'stroke-dasharray="6 6"':''} ${arrow?'marker-end="url(#arrow)"':''}/>`);
 const box=(x,y,bw,bh)=>bits.push(`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="none" stroke="black" stroke-width="1.4"/>`);
 const oval=(x,y,rx,ry,s)=>{bits.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="white" stroke="black" stroke-width="1.4"/>`);text(x,y,s);};
 const actor=(x,y,labels)=>{const scale=font/18;bits.push(`<circle cx="${x}" cy="${y}" r="${11*scale}" fill="white" stroke="black" stroke-width="1.4"/>`);line(x,y+11*scale,x,y+50*scale);line(x-22*scale,y+25*scale,x+22*scale,y+25*scale);line(x,y+50*scale,x-22*scale,y+80*scale);line(x,y+50*scale,x+22*scale,y+80*scale);labels.forEach((s,i)=>text(x,y+(103+i*21)*scale,s));};
 return {text,line,box,oval,actor,svg:()=>bits.join('')+'</svg>'};}
const diagrams=[];
{
 const g=create(1043,298,18);g.box(85,17,862,275);g.text(515,38,'ElderCareAI');g.actor(44,98,['Caregiver']);g.actor(1003,98,['Elder']);
 g.line(68,132,123,132);g.line(904,132,982,132);
 g.line(276,132,331,132,true,true);g.line(484,132,541,132,true,true);g.line(694,132,751,132,true,true);g.line(253,211,201,161,true,true);
 g.oval(200,132,77,30,'Connect Watch');g.oval(408,132,77,30,'Enter Code');g.oval(618,132,77,30,'Pair Watch');g.oval(828,132,77,30,'Wear Watch');g.oval(307,235,77,30,'Disconnect');
 [[302,113],[511,113],[719,113]].forEach(([x,y])=>g.text(x,y,'<<Include>>',12));g.text(262,186,'<<Extend>>',12);
 diagrams.push({name:'image23',w:1043,h:298,svg:g.svg()});
}
{
 const g=create(915,313,18);g.box(85,7,730,300);g.text(450,28,'ElderCareAI');g.actor(44,88,['Caregiver']);g.actor(868,88,['Galaxy','Watch6']);
 g.line(68,122,123,122);g.line(637,122,845,122);g.line(276,122,484,122,true,true);g.line(515,150,449,208,true,true);g.line(485,238,637,238,true,true);g.line(200,210,200,152,true,true);
 g.oval(200,122,77,30,'Start Monitoring');g.oval(561,122,77,30,'Upload Data');g.oval(200,240,77,30,'Stop Monitoring');g.oval(408,240,77,30,'Save Readings');g.oval(713,235,77,30,'Update Realtime');
 [[376,104],[455,164],[551,218]].forEach(([x,y])=>g.text(x,y,'<<Include>>',12));g.text(230,188,'<<Extend>>',12);
 diagrams.push({name:'image25',w:915,h:313,svg:g.svg()});
}
{
 const g=create(1147,421,26);g.box(116,12,1024,401);g.text(627,46,'ElderCareAI');g.actor(57,116,['Caregiver']);g.line(90,166,171,166);
 g.line(392,166,547,166,true,true);g.line(886,166,768,166,true,true);g.line(568,193,470,279,true,true);g.line(515,310,694,310,true,true);
 g.oval(282,166,111,44,'Allow Location');g.oval(657,166,110,44,'Receive Watch Fix');g.oval(997,166,110,44,'View Source');g.oval(404,310,111,44,'Open Live Map');g.oval(804,310,111,44,'Load Latest Fix');
 [[468,140],[480,213],[594,286]].forEach(([x,y])=>g.text(x,y,'<<Include>>',18));g.text(828,140,'<<Extend>>',18);
 diagrams.push({name:'image26',w:1147,h:421,svg:g.svg()});
}
{
 const g=create(962,351,22);g.box(104,6,854,334);g.text(531,32,'ElderCareAI');g.actor(55,93,['Caregiver']);g.line(83,134,150,134);
 g.line(335,134,463,134,true,true);g.line(500,168,471,220,true,true);g.line(548,254,629,254,true,true);g.line(758,216,802,171,true,true);g.line(242,218,242,171,true,true);
 g.oval(242,134,92,37,'Press SOS');g.oval(556,134,92,37,'Confirm Activation');g.oval(838,134,92,37,'Choose Contact');g.oval(242,254,92,37,'');g.text(242,243,'Resolve',22);g.text(242,267,'Emergency',22);g.oval(455,254,92,37,'Logs');g.oval(721,254,92,37,'Create Alert');
 [[397,114],[444,179],[582,232],[739,193]].forEach(([x,y])=>g.text(x,y,'<<Include>>',14));g.text(196,199,'<<Extend>>',14);
 diagrams.push({name:'image7',w:962,h:351,svg:g.svg()});
}
{
 const g=create(942,342,18);g.box(74,8,862,330);g.text(505,29,'ElderCareAI');g.actor(34,110,['Admin']);g.line(57,144,112,144);
 g.line(265,144,321,144,true,true);g.line(474,144,541,144,true,true);g.line(694,144,750,144,true,true);g.line(189,226,189,174,true,true);
 g.oval(189,144,77,30,'View Monitor');g.oval(398,144,77,30,'Check Devices');g.oval(618,144,77,30,'View Syncs');g.oval(826,144,77,30,'');g.text(826,133,'Compare');g.text(826,155,'Timestamps');g.oval(189,257,77,30,'Refresh View');
 [[293,122],[503,122],[719,122]].forEach(([x,y])=>g.text(x,y,'<<Include>>',12));g.text(221,203,'<<Extend>>',12);
 diagrams.push({name:'image19',w:942,h:342,svg:g.svg()});
}
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{for(const d of diagrams){fs.writeFileSync(path.join(out,d.name+'.svg'),d.svg);const page=await browser.newPage({viewport:{width:d.w,height:d.h},deviceScaleFactor:1});await page.setContent('<html><body style="margin:0">'+d.svg+'</body></html>');await page.screenshot({path:path.join(out,d.name+'.png')});await page.close();console.log('Rendered '+d.name+' at '+d.w+'x'+d.h);}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
