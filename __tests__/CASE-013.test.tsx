import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const ui=readFileSync(join(__dirname,'..','app/setup/intro.tsx'),'utf8');
test('visible UI contract',()=>{
expect(ui).toContain('Heart rate');
expect(ui).toContain('Sleep');
});
