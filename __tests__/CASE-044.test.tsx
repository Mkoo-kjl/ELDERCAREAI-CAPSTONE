import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const ui=readFileSync(join(__dirname,'..','app/(tabs)/chatbot.tsx'),'utf8');
test('visible UI contract',()=>{
expect(ui).toContain('quickTopics');
expect(ui).toContain('Medication');
});
