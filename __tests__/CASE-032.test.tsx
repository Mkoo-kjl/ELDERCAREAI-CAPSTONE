import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const ui=readFileSync(join(__dirname,'..','src/components/MetricCard.tsx'),'utf8');
test('visible UI contract',()=>{
expect(ui).toContain('timestamp');
expect(ui).toContain('styles.timestamp');
});
