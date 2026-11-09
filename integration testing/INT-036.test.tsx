import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const one=readFileSync(join(__dirname,'..','wearos/app/src/main/java/com/eldercareai/watch/MainActivity.kt'),'utf8');
const two=readFileSync(join(__dirname,'..','app/(tabs)/health.tsx'),'utf8');
test('visible cross-screen contract',()=>{
expect(one).toContain('Start monitoring');
expect(two).toContain('heart');
expect(two).toContain('spo2');
});
