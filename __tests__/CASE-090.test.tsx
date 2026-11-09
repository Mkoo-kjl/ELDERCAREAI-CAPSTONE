import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(__dirname, '..', 'wearos/app/src/main/java/com/eldercareai/watch/OxygenActivity.kt'), 'utf8');

test('visible screen controls exist in the current source', () => {
  expect(source).toContain('Blood oxygen');
  expect(source).toContain('Measure blood oxygen');
  expect(source).toContain('Auto checks');
});
