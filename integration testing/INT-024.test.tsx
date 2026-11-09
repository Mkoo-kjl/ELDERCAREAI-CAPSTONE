import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const first=readFileSync(join(__dirname,'..','src/components/PrescriptionEntryCard.tsx'),'utf8');
const second=readFileSync(join(__dirname,'..','src/components/MedicationEditor.tsx'),'utf8');
test('visible integration controls',()=>{
expect(first).toContain('prescription');
expect(second).toContain('Review prescription draft');
});
