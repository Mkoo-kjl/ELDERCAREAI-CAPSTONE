const fs=require('fs');
const ts=require('typescript');
const path='C:/ELDERCAREAI-CAPSTONE/__tests__';
const file=path+'/CASE-089.test.tsx';
const source=fs.readFileSync(file,'utf8');
const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const importText=ast.statements.filter(s=>ts.isImportDeclaration(s)).map(s=>source.slice(s.getStart(ast),s.getEnd())).join('\n');
const describe=ast.statements.find(s=>ts.isExpressionStatement(s)&&s.getText(ast).startsWith('describe('));
if(!describe)throw Error('Expected admin describe block');
const callback=describe.expression.arguments[1];
const tests=callback.body.statements.filter(s=>ts.isExpressionStatement(s)&&s.getText(ast).startsWith('it('));
if(tests.length!==6)throw Error(`Expected 6 admin tests, found ${tests.length}`);
const ids=[89,101,102,103,104,105];
tests.forEach((test,index)=>{
  const text=importText+'\n\ndescribe(\'admin request validation\', () => {\n'+test.getText(ast)+'\n});\n';
  fs.writeFileSync(path+`/CASE-${String(ids[index]).padStart(3,'0')}.test.tsx`,text);
});
console.log('Created six distinct admin unit case files');
