const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const root = 'C:/ELDERCAREAI-CAPSTONE';
const unit = path.join(root, '__tests__');
const integration = path.join(root, 'integration testing');
const specs = [
  ['CASE-074','care-usability.test.ts',['live BPM display bands']],
  ['CASE-075','care-usability.test.ts',['oxygen, sleep, steps and experimental stress']],
  ['CASE-076','care-usability.test.ts',['database clock %s','invalid wall clock %s']],
  ['CASE-077','care-usability.test.ts',['Manila wall clocks']],
  ['CASE-078','care-usability.test.ts',['schedule respects start/end dates','appointment lifecycle uses actual']],
  ['CASE-079','monitoring-chart.test.tsx',['chart downsampling retains']],
  ['CASE-080','monitoring-chart.test.tsx',['analytics toggles line/thin bars']],
  ['CASE-081','monitoring-chart.test.tsx',['daily steps retain one maximum']],
  ['CASE-082','monitoring-chart.test.tsx',['repeating local reminders']],
  ['CASE-083','care-usability.test.ts',['two simultaneous notices']],
  ['CASE-084','care-usability.test.ts',['prescription normalization']],
  ['CASE-085','emergency-contacts.test.tsx',['contact roles have a fixed']],
  ['CASE-086','care-ui-updates.test.tsx',['automatic vital details start collapsed']],
  ['CASE-087','care-ui-updates.test.tsx',['prescription entry includes Elle']],
  ['INT-026','watch-sos-observer.test.tsx',['simultaneous local medication and appointment']],
  ['INT-027','watch-sos-observer.test.tsx',['local reminder scope rejects']],
  ['INT-028','care-images-analytics.test.tsx',['analytics uses queried records']],
  ['INT-029','care-images-analytics.test.tsx',['step analytics uses daily history']],
  ['INT-030','care-images-analytics.test.tsx',['medication images upload bytes']],
  ['INT-031','medication-editor.test.tsx',['OCR cannot create medication']],
  ['INT-032','emergency-contacts.test.tsx',['emergency action displays contact details']],
  ['INT-033','care-timeline.test.tsx',['schedule orders appointments']],
];
const bySource = new Map();
for (const [id,file,phrases] of specs) {
  if (!bySource.has(file)) bySource.set(file,[]);
  bySource.get(file).push({id,phrases,selected:[]});
}
for (const [file,targets] of bySource) {
  const source = path.join(unit,file);
  const text = fs.readFileSync(source,'utf8');
  const syntax = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const ast = ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,syntax);
  const prep=[],remaining=[];
  for (const statement of ast.statements) {
    const part=text.slice(statement.getFullStart(),statement.getEnd()).trim();
    const isTest=/^(test|it)(\.|\()/.test(part);
    if (!isTest) { prep.push(part); continue; }
    const matches=targets.filter(target=>target.phrases.some(phrase=>part.includes(phrase)));
    if (matches.length>1) throw Error(`Ambiguous test in ${file}: ${part.slice(0,80)}`);
    if (matches.length===1) matches[0].selected.push(part);
    else remaining.push(part);
  }
  for (const target of targets) {
    if (target.selected.length!==target.phrases.length) throw Error(`Expected ${target.phrases.length} tests for ${target.id}; found ${target.selected.length}`);
    const dest=path.join(target.id.startsWith('INT')?integration:unit,`${target.id}.test.tsx`);
    if (fs.existsSync(dest)) throw Error(`Already exists: ${dest}`);
    fs.writeFileSync(dest,[...prep,...target.selected].join('\n\n')+'\n');
    process.stdout.write(`${file} -> ${path.relative(root,dest)} (${target.selected.length} tests)\n`);
  }
  if (remaining.length) fs.writeFileSync(source,[...prep,...remaining].join('\n\n')+'\n');
  else fs.unlinkSync(source);
}
let next=88;
for (const file of fs.readdirSync(unit).filter(file=>/\.test\.(tsx?|js)$/.test(file)&&!/^CASE-\d+\.test\.tsx$/.test(file)).sort()) {
  const source=path.join(unit,file);
  const dest=path.join(unit,`CASE-${String(next++).padStart(3,'0')}.test.tsx`);
  const content=fs.readFileSync(source,'utf8');
  fs.writeFileSync(dest,(file.endsWith('.js')?'// @ts-nocheck\n':'')+content);
  fs.unlinkSync(source);
  process.stdout.write(`${file} -> ${path.basename(dest)}\n`);
}
console.log(`Numbered unit regression files end at CASE-${String(next-1).padStart(3,'0')}`);
