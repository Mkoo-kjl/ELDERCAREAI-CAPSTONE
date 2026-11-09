import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const first=readFileSync(join(__dirname,'..','src/components/SafeZonePanel.tsx'),'utf8');
const second=readFileSync(join(__dirname,'..','src/components/LiveLocationMap.tsx'),'utf8');
test('visible integration controls',()=>{
expect(first).toContain('radius');
expect(second).toContain('Follow location');
});
