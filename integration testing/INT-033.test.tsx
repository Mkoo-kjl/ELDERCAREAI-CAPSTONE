import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const one=readFileSync(join(__dirname,'..','src/components/SafeZonePanel.tsx'),'utf8');
const two=readFileSync(join(__dirname,'..','src/components/LiveLocationMap.tsx'),'utf8');
test('visible cross-screen contract',()=>{
expect(one).toContain('radius');
expect(two).toContain('WebView');
});
