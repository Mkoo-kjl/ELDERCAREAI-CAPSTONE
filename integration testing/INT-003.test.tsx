import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const first=readFileSync(join(__dirname,'..','website/edcadmin/index.html'),'utf8');
const second=readFileSync(join(__dirname,'..','website/edcadmin/index.html'),'utf8');
test('visible integration controls',()=>{
expect(first).toContain('id="login-form"');
expect(second).toContain('id="recovery-form"');
});
