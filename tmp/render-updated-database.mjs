import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve('.');
const {default:puppeteer}=await import(pathToFileURL(join(root,'tmp/diagram-renderer/node_modules/puppeteer/lib/puppeteer/puppeteer.js')).href);
const out=join(root,'output/diagrams/database_2026-11-07');
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu'],userDataDir:join(root,'tmp/database-diagram-chrome')});
const checks=[];
try{
  for(const name of ['ElderCareAI_Database_Design_UPDATED','ElderCareAI_Chen_ERD_UPDATED']){
    const svg=readFileSync(join(out,name+'.svg'),'utf8');const width=Number(svg.match(/width="([\d.]+)"/)[1]),height=Number(svg.match(/height="([\d.]+)"/)[1]);
    const page=await browser.newPage();await page.setViewport({width:Math.ceil(width),height:Math.ceil(height),deviceScaleFactor:1.5});
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"/><style>html,body{margin:0;background:white}svg{display:block}</style></head><body>'+svg+'</body></html>',{waitUntil:'load'});
    const textCheck=await page.evaluate(()=>{const svg=document.querySelector('svg'),w=svg.viewBox.baseVal.width,h=svg.viewBox.baseVal.height;const labels=[...svg.querySelectorAll('text')];return{labels:labels.length,outside:labels.map(n=>{const b=n.getBBox();return{text:n.textContent,x:b.x,y:b.y,width:b.width,height:b.height};}).filter(b=>b.x<0||b.y<0||b.x+b.width>w+.5||b.y+b.height>h+.5)};});
    if(textCheck.outside.length)throw Error('Clipped diagram text: '+JSON.stringify(textCheck.outside));
    checks.push({name,...textCheck});
    await page.screenshot({path:join(out,name+'.png'),fullPage:true});
    console.log(JSON.stringify({name,width:Math.round(width*1.5),height:Math.round(height*1.5)}));await page.close();
  }
  writeFileSync(join(out,'render-validation.json'),JSON.stringify(checks,null,2));
}finally{await browser.close();}
