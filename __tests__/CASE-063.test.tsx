import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const ui=readFileSync(join(__dirname,'..','src/components/MedicationEditor.tsx'),'utf8');
test('visible UI contract',()=>{
expect(ui).toContain('Review prescription draft');
expect(ui).toContain('Open original prescription');
});
