from pathlib import Path
from docx import Document

root=Path('C:/ELDERCAREAI-CAPSTONE')
for filename,heading in [('UNIT_TEST_TABLE','Unit testing'),('INTEGRATION_TEST_TABLE','Integration testing')]:
    rows=[[c.text.replace('|','\\|').replace('\n',' ') for c in row.cells] for row in Document(root/'docs'/f'{filename}.docx').tables[0].rows]
    lines=[f'# ElderCareAI {heading}', '',f'{len(rows)-1} selected cases, verified 9 November 2026. Each ID matches one numbered `.test.tsx` file.','',
           '| '+' | '.join(rows[0])+' |','| '+' | '.join(['---']*len(rows[0]))+' |']
    lines.extend('| '+' | '.join(row)+' |' for row in rows[1:])
    lines.extend(['','See [testing instructions](../output/documents/2026-11-09-focused-testing/TESTING_INSTRUCTIONS.md) for individual and full-suite commands.',''])
    (root/'docs'/f'{filename}.md').write_text('\n'.join(lines),encoding='utf8')

for name,kind in [('UNIT_TEST_EVIDENCE','unit'),('INTEGRATION_TEST_EVIDENCE','integration')]:
    count=100 if kind=='unit' else 30
    prefix='CASE' if kind=='unit' else 'INT'
    folder='__tests__' if kind=='unit' else 'integration testing'
    text=f'''# {kind.title()} test evidence

The current {kind} table contains {count} selected cases. Each {prefix}-### row matches one file in `{folder}`. The full focused run passed 187 tests in 130 suites on 9 November 2026.

For one case, run `npm test -- --runTestsByPath "{folder}/{prefix}-001.test.tsx"` from the project root, replacing the number. Capture the terminal `PASS` result and, for a visible UI case, the corresponding screen from the installed app. Logic-only tests do not have a phone screenshot.

See the [detailed commands](../output/documents/2026-11-09-focused-testing/TESTING_INSTRUCTIONS.md) and the [user guide](ELDERCAREAI_USER_GUIDE.docx) for screenshot locations. Automated tests use controlled service fixtures, so watch GPS, sensors and phone push delivery need device evidence.
'''
    (root/'docs'/f'{name}.md').write_text(text,encoding='utf8')
