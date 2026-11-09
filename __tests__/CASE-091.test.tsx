import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const ui=readFileSync(join(__dirname,'..','wearos/app/src/main/java/com/eldercareai/watch/MainActivity.kt'),'utf8');
test('visible UI contract',()=>{
expect(ui).toContain('Connect your watch');
expect(ui).toContain('Pair watch');
});
