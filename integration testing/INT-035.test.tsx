import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const one=readFileSync(join(__dirname,'..','app/setup/fitness.tsx'),'utf8');
const two=readFileSync(join(__dirname,'..','wearos/app/src/main/java/com/eldercareai/watch/MainActivity.kt'),'utf8');
test('visible cross-screen contract',()=>{
expect(one).toContain('watch');
expect(two).toContain('Pair watch');
});
