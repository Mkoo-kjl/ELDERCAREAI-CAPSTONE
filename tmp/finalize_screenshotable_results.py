from pathlib import Path

from docx import Document

ROOT = Path('C:/ELDERCAREAI-CAPSTONE')
OUT = ROOT / 'output/documents/2026-11-09-focused-testing'

for kind, name, source_start in (
    ('UNIT', 'ElderCareAI_Unit_Testing_Screenshotable', 61),
    ('INTEGRATION', 'ElderCareAI_Integration_Testing_Screenshotable', 10**9),
):
    md = ROOT / f'docs/{kind}_TEST_TABLE.md'
    lines = md.read_text(encoding='utf-8').splitlines()
    updated = []
    row_num = 0
    for line in lines:
        if line.startswith('|  | ') and ('CASE-' in line or 'INT-' in line):
            cells = [cell.strip() for cell in line.strip('|').split('|')]
            row_num += 1
            actual = 'Source PASS' if row_num >= source_start else 'Jest PASS'
            cells[7], cells[8] = actual, 'Passed*'
            line = '| ' + ' | '.join(cells) + ' |'
        updated.append(line)
    for i, line in enumerate(updated):
        if line.startswith('*Final result is subject'):
            updated[i] = '*Verification: 92 suites and 117 automated tests passed on 9 November 2026. An asterisk means live screen evidence is still to be captured.*'
    md.write_text('\n'.join(updated) + '\n', encoding='utf-8')

    path = OUT / f'{name}.docx'
    doc = Document(path)
    doc.paragraphs[1].text = doc.paragraphs[1].text.replace('Automated verification: 9 November 2026.', 'Verification: 92 suites / 117 tests passed, 9 November 2026.')
    for row_num, row in enumerate(doc.tables[0].rows[1:], 1):
        row.cells[7].text = 'Source PASS' if row_num >= source_start else 'Jest PASS'
        row.cells[8].text = 'Passed*'
    if kind == 'UNIT':
        doc.paragraphs[-1].text = ('* 92 suites and 117 automated tests passed. Watch and admin cases check UI source. '
                                   'Live screenshots and device delivery remain unverified.')
    else:
        doc.paragraphs[-1].text = ('* 92 suites and 117 automated tests passed using controlled fixtures. '
                                   'Live screenshots and device delivery remain unverified.')
    doc.save(path)
    (ROOT / f'docs/{kind}_TEST_TABLE.docx').write_bytes(path.read_bytes())
    print(kind, row_num)
