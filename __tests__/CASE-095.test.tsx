import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(__dirname, '..', 'website/edcadmin/index.html'), 'utf8');

test('visible screen controls exist in the current source', () => {
  expect(source).toContain('id="view-monitor"');
  expect(source).toContain('id="device-rows"');
  expect(source).toContain('id="sync-rows"');
});
