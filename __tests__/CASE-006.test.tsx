import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const ui=readFileSync(join(__dirname,'..','website/edcadmin/index.html'),'utf8');
test('visible UI contract',()=>{
expect(ui).toContain('id="invite-form"');
expect(ui).toContain('id="invite-confirm"');
});
