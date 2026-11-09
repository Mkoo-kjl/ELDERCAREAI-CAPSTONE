import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const first=readFileSync(join(__dirname,'..','wearos/app/src/main/java/com/eldercareai/watch/OxygenActivity.kt'),'utf8');
const second=readFileSync(join(__dirname,'..','app/(tabs)/health.tsx'),'utf8');
test('visible integration controls',()=>{
expect(first).toContain('Measure blood oxygen');
expect(second).toContain('Blood Oxygen');
});
