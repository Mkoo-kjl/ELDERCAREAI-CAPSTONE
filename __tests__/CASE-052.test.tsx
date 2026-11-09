import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const ui=readFileSync(join(__dirname,'..','src/components/PrescriptionEntryCard.tsx'),'utf8');
test('visible UI contract',()=>{
expect(ui).toContain('prescription');
expect(ui).toContain('Pressable');
});
