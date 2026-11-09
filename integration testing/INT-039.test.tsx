import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const one=readFileSync(join(__dirname,'..','website/edcadmin/index.html'),'utf8');
const two=readFileSync(join(__dirname,'..','website/edcadmin/index.html'),'utf8');
test('visible cross-screen contract',()=>{
expect(one).toContain('id="view-dashboard"');
expect(two).toContain('id="sync-rows"');
});
