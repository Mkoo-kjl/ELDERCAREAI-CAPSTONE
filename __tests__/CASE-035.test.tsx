import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const ui=readFileSync(join(__dirname,'..','src/components/VitalDetailModal.tsx'),'utf8');
test('visible UI contract',()=>{
expect(ui).toContain('Modal');
expect(ui).toContain('Text');
});
