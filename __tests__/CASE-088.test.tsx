import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(__dirname, '..', 'wearos/app/src/main/java/com/eldercareai/watch/MainActivity.kt'), 'utf8');

test('visible screen controls exist in the current source', () => {
  expect(source).toContain('Start monitoring');
  expect(source).toContain('HEART RATE');
  expect(source).toContain('Location & sharing');
});
