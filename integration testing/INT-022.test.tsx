import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const one=readFileSync(join(__dirname,'..','src/components/MedicationEditor.tsx'),'utf8');
const two=readFileSync(join(__dirname,'..','app/(tabs)/care.tsx'),'utf8');
test('visible cross-screen contract',()=>{
expect(one).toContain('Prescribed reminder times');
expect(two).toContain('Medications');
});
