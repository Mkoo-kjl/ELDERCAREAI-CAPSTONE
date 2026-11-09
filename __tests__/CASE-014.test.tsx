import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const ui=readFileSync(join(__dirname,'..','app/setup/location.tsx'),'utf8');
test('visible UI contract',()=>{
expect(ui).toContain('Watch location sharing');
expect(ui).toContain('Galaxy Watch');
});
