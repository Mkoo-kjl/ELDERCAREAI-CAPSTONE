import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const one=readFileSync(join(__dirname,'..','wearos/app/src/main/java/com/eldercareai/watch/CareActivity.kt'),'utf8');
const two=readFileSync(join(__dirname,'..','app/(tabs)/care.tsx'),'utf8');
test('visible cross-screen contract',()=>{
expect(one).toContain('Taken');
expect(two).toContain('Taken');
});
