import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(__dirname, '..', 'wearos/app/src/main/java/com/eldercareai/watch/SosActivity.kt'), 'utf8');

test('visible screen controls exist in the current source', () => {
  expect(source).toContain('Request assistance');
  expect(source).toContain('Send SOS');
  expect(source).toContain('Cancel');
});
