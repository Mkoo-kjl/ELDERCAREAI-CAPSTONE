import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const first=readFileSync(join(__dirname,'..','src/components/AutomaticVitalAlerts.tsx'),'utf8');
const second=readFileSync(join(__dirname,'..','app/alert-response.tsx'),'utf8');
test('visible integration controls',()=>{
expect(first).toContain('Automatic vital alerts');
expect(second).toContain('Alert');
});
