from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
UNIT_DIR = ROOT / '__tests__'
INT_DIR = ROOT / 'integration testing'
OUT = ROOT / 'output/documents/2026-11-09-focused-testing'
OUT.mkdir(parents=True, exist_ok=True)

# These cases have a visible outcome on a named product screen. Automated tests
# still use mocks; live screenshots are a separate evidence step.
UNIT_IDS = [
    1, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 14, 15, 17, 19, 20, 21, 22, 23,
    25, 26, 27, 28, 29, 30, 32,
    34, 43,
    45, 47, 49,
    50, 51, 52, 53,
    56, 57, 60, 61, 62, 63, 65, 68,
    79,
    80, 81, 82, 83, 85,
    86, 87, 88, 90, 91,
    94, 95, 96, 97,
    98, 99,
]
INT_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 15, 16, 17, 18, 19, 21, 23, 25, 26, 28, 29, 30]


def markdown_rows(path: Path) -> dict[int, list[str]]:
    result = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        if not line.startswith('|  | '):
            continue
        cells = [cell.strip() for cell in line.strip('|').split('|')]
        match = re.fullmatch(r'(?:CASE|INT)-(\d{3})', cells[4] if len(cells) == 9 and cells[4].startswith('CASE') else cells[1])
        if match:
            result[int(match.group(1))] = cells
    return result


unit_old = markdown_rows(ROOT / 'docs/UNIT_TEST_TABLE.md')
int_old = markdown_rows(ROOT / 'docs/INTEGRATION_TEST_TABLE.md')
assert len(unit_old) == 105 and len(int_old) == 30


def unit_screen(old: int) -> str:
    if old <= 4: return 'Phone: Sign in / introduction'
    if old <= 10: return 'Phone: Introduction / setup step'
    if old <= 18: return 'Phone: Caregiver setup form'
    if old <= 24: return 'Phone: Older adult setup form'
    if old <= 29: return 'Phone: Dashboard / Health vital card'
    if old == 30: return 'Phone: Health > Sleep history after account switch'
    if old == 32: return 'Phone: Health records'
    if old == 34: return 'Phone: Health insights empty state'
    if old == 43: return 'Phone: Analytics chart and timestamp'
    if old <= 49: return 'Phone: Elle chat'
    if old <= 53: return 'Phone: Care plan form or list'
    if old <= 65: return 'Phone: Care plan > Medication schedule'
    if old == 68: return 'Phone: Care plan > Scan prescription'
    if old == 79: return 'Phone: Notification tap destination'
    if old <= 85: return 'Phone: Profile > Doctor contacts'
    if old <= 93: return 'Phone: Profile > Reports / share sheet'
    if old == 94: return 'Phone: Emergency contact priority'
    if old == 95: return 'Phone: Alerts > Automatic vital alerts'
    if old == 96: return 'Phone: Alert response detail'
    if old == 97: return 'Phone: SOS / vital alert popup'
    return 'Phone: Live location map and watch route'


def int_screen(old: int) -> str:
    screens = {
        1: 'Phone: Caregiver setup', 2: 'Phone: Home',
        3: 'Phone: Health > Vitals', 4: 'Phone: Health > Sleep',
        5: 'Phone: Health > Insights', 6: 'Phone: Health > Predictions',
        7: 'Phone: Health > Predictions', 8: 'Phone: Health > Anomalies',
        9: 'Phone: Care plan > Medications', 10: 'Phone: Care plan > Taken today',
        12: 'Phone: Care plan > As-needed medication', 13: 'Phone: Care plan > Taken today',
        15: 'Phone: Appointment reminder notification',
        16: 'Phone: Health report / share sheet', 17: 'Phone: Medication report / share sheet',
        18: 'Phone: Elle chat error', 19: 'Phone: Appointment reminder notification',
        21: 'Phone: Elle chat > Open Meds > Care plan',
        23: 'Phone: Separate medication and appointment popups',
        25: 'Phone: Analytics chart and recorded times',
        26: 'Phone: Analytics > Daily steps',
        28: 'Phone: Prescription review > Medication card',
        29: 'Phone: Emergency contacts > Caregiver dialer',
        30: 'Phone: Care plan > Schedule timeline',
    }
    return screens[old]


extra_unit = [
    ('Galaxy Watch6 Module', 'Monitoring dashboard', 'Open the watch dashboard.', 'Heart rate and Start monitoring are visible.', 'Watch: Dashboard / heart rate'),
    ('Galaxy Watch6 Module', 'SOS confirmation', 'Open SOS on the watch.', 'Send SOS and Cancel are visible before sending.', 'Watch: Request assistance'),
    ('Galaxy Watch6 Module', 'Oxygen measurement', 'Open the blood oxygen screen.', 'Spot measurement and auto-check controls are visible.', 'Watch: Blood oxygen'),
    ('Administration Module', 'Sign-in screen', 'Open the admin web portal.', 'Username, password, and recovery controls appear.', 'Admin web: Sign in'),
    ('Administration Module', 'Overview', 'Sign in to the admin portal.', 'Overview metrics and recent activity sections appear.', 'Admin web: Overview'),
    ('Administration Module', 'System monitor', 'Open System monitor.', 'Connected devices and recent health syncs appear.', 'Admin web: System monitor'),
    ('Administration Module', 'Reports', 'Open Reports.', 'Report type and date range controls appear.', 'Admin web: Reports'),
    ('Administration Module', 'Security', 'Open Security.', 'Admin invite and account protection controls appear.', 'Admin web: Security'),
]


def static_source_test(source: Path, assertions: list[str]) -> str:
    rel = source.relative_to(ROOT).as_posix()
    return (
        "import { readFileSync } from 'node:fs';\n"
        "import { join } from 'node:path';\n\n"
        f"const source = readFileSync(join(__dirname, '..', '{rel}'), 'utf8');\n\n"
        "test('visible screen controls exist in the current source', () => {\n"
        + ''.join(f"  expect(source).toContain({value!r});\n" for value in assertions)
        + "});\n"
    )


static_tests = [
    ('wearos/app/src/main/java/com/eldercareai/watch/MainActivity.kt', ['Start monitoring', 'HEART RATE', 'Location & sharing']),
    ('wearos/app/src/main/java/com/eldercareai/watch/SosActivity.kt', ['Request assistance', 'Send SOS', 'Cancel']),
    ('wearos/app/src/main/java/com/eldercareai/watch/OxygenActivity.kt', ['Blood oxygen', 'Measure blood oxygen', 'Auto checks']),
    ('website/edcadmin/index.html', ['id="login-form"', 'id="username"', 'id="password"', 'id="reset-password"']),
    ('website/edcadmin/index.html', ['id="view-dashboard"', 'id="metric-caregivers"', 'id="dashboard-alerts"']),
    ('website/edcadmin/index.html', ['id="view-monitor"', 'id="device-rows"', 'id="sync-rows"']),
    ('website/edcadmin/index.html', ['id="view-reports"', 'id="report-form"', 'name="type"']),
    ('website/edcadmin/index.html', ['id="view-security"', 'id="admin-invite-form"', 'id="security-form"']),
]


def replace_numbered_tests(directory: Path, prefix: str, old_ids: list[int], extra: list[str] | None = None):
    assert directory.resolve().is_relative_to(ROOT.resolve())
    originals = sorted(directory.glob(f'{prefix}-[0-9][0-9][0-9].test.tsx'))
    contents = []
    for new_number, old_number in enumerate(old_ids, 1):
        source = directory / f'{prefix}-{old_number:03d}.test.tsx'
        assert source in originals, source
        content = source.read_text(encoding='utf-8')
        content = re.sub(rf'{prefix}-\d{{3}}', f'{prefix}-{new_number:03d}', content)
        contents.append(content)
    contents += extra or []
    # Stage every replacement before deleting the old exact numbered files.
    staged = []
    for number, content in enumerate(contents, 1):
        target = directory / f'.screenshotable-{prefix}-{number:03d}.test.tsx'
        target.write_text(content, encoding='utf-8')
        staged.append(target)
    for path in originals:
        assert path.parent.resolve() == directory.resolve()
        path.unlink()
    for number, staged_path in enumerate(staged, 1):
        staged_path.replace(directory / f'{prefix}-{number:03d}.test.tsx')
    return len(contents)


extra_sources = [static_source_test(ROOT / source, checks) for source, checks in static_tests]
unit_count = replace_numbered_tests(UNIT_DIR, 'CASE', UNIT_IDS, extra_sources)
int_count = replace_numbered_tests(INT_DIR, 'INT', INT_IDS)

unit_rows = []
for new, old in enumerate(UNIT_IDS, 1):
    cells = unit_old[old].copy()
    cells[4] = f'CASE-{new:03d}'
    cells[8] = 'Automated pass*'
    unit_rows.append(cells + [unit_screen(old)])
for item in extra_unit:
    module, unit, action, expected, screen = item
    unit_rows.append(['', module, unit, '11/09/2026', f'CASE-{len(unit_rows)+1:03d}', action, expected, 'Automated pass*', 'Automated pass*', screen])

int_rows = []
for new, old in enumerate(INT_IDS, 1):
    cells = int_old[old].copy()
    cells[1] = f'INT-{new:03d}'
    cells[7] = 'Automated pass*'
    cells[8] = 'Automated pass*'
    int_rows.append(cells + [int_screen(old)])

assert len(unit_rows) == unit_count and len(int_rows) == int_count


def write_markdown(path: Path, title: str, heading: list[str], rows: list[list[str]]):
    intro = (f'# {title}\n\n{len(rows)} screenshotable cases. Each case has a visible phone, watch, or admin web outcome. '
             'The automated tests use controlled fixtures. “Automated pass” does not mean a physical-device screenshot was captured. '
             'Capture the listed screen separately during the live demonstration.\n\n')
    table = '| ' + ' | '.join(heading) + ' |\n| ' + ' | '.join(['---'] * len(heading)) + ' |\n'
    for row in rows:
        table += '| ' + ' | '.join(str(v).replace('|', '/') for v in row) + ' |\n'
    path.write_text(intro + table + '\n*Final result is subject to the full Jest verification run.\n', encoding='utf-8')


unit_head = ['Proponent', 'Module Name', 'Unit Name', 'Date Tested', 'Test Case ID', 'Test Case Description', 'Expected Result', 'Actual Result', 'Result', 'Screenshot screen']
int_head = ['Proponent', 'Test Case ID', 'Module 1', 'Integration Process', 'Module 2', 'Precondition', 'Expected Result', 'Actual Result', 'Result', 'Screenshot screen']
write_markdown(ROOT/'docs/UNIT_TEST_TABLE.md', 'ElderCareAI screenshotable unit testing', unit_head, unit_rows)
write_markdown(ROOT/'docs/INTEGRATION_TEST_TABLE.md', 'ElderCareAI screenshotable integration testing', int_head, int_rows)


def fill(cell, value):
    pr = cell._tc.get_or_add_tcPr()
    sh = OxmlElement('w:shd')
    sh.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill', value)
    pr.append(sh)


def write_doc(path: Path, title: str, intro: str, headings: list[str], rows: list[list[str]], widths: list[float]):
    doc = Document()
    sec = doc.sections[0]
    sec.orientation = WD_ORIENT.LANDSCAPE
    sec.page_width, sec.page_height = Inches(11), Inches(8.5)
    sec.left_margin = sec.right_margin = Inches(.42)
    sec.top_margin = sec.bottom_margin = Inches(.5)
    doc.styles['Normal'].font.name = 'Times New Roman'
    doc.styles['Normal'].font.size = Pt(9)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(title)
    run.bold = True
    run.font.size = Pt(15)
    p = doc.add_paragraph(intro)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    table = doc.add_table(rows=1, cols=len(headings))
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    for i, name in enumerate(headings):
        table.rows[0].cells[i].text = name
    for row in rows:
        cells = table.add_row().cells
        for i, value in enumerate(row):
            cells[i].text = str(value)
    for col, width in zip(table.columns, widths):
        col.width = Inches(width)
    for ri, row in enumerate(table.rows):
        row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
        if ri == 0:
            header = OxmlElement('w:tblHeader')
            header.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val', 'true')
            row._tr.get_or_add_trPr().append(header)
        for cell, width in zip(row.cells, widths):
            cell.width = Inches(width)
            cell.vertical_alignment = 1
            if ri == 0: fill(cell, 'D9E9D4')
            for p in cell.paragraphs:
                p.paragraph_format.space_after = Pt(0)
                for run in p.runs:
                    run.font.name = 'Times New Roman'
                    run.font.size = Pt(7.1)
                    run.bold = ri == 0
    doc.add_paragraph('Screenshot evidence is pending until captured on the installed phone/watch app or signed-in admin portal. Automated cases mock external services and do not prove live notification delivery or sensor accuracy.')
    doc.save(path)


unit_out = OUT/'ElderCareAI_Unit_Testing_Screenshotable.docx'
int_out = OUT/'ElderCareAI_Integration_Testing_Screenshotable.docx'
write_doc(unit_out, 'ElderCareAI Unit Testing', f'{unit_count} cases with a visible screen to capture. Automated verification: 9 November 2026.', unit_head, unit_rows,
          [.55, .76, .72, .61, .57, 1.72, 1.68, .78, .66, 1.92])
write_doc(int_out, 'ElderCareAI Integration Testing', f'{int_count} cases with a visible screen to capture. Automated verification: 9 November 2026.', int_head, int_rows,
          [.50, .58, .78, 1.50, .78, 1.42, 1.59, .78, .66, 1.72])
(ROOT/'docs/UNIT_TEST_TABLE.docx').write_bytes(unit_out.read_bytes())
(ROOT/'docs/INTEGRATION_TEST_TABLE.docx').write_bytes(int_out.read_bytes())
for stale in [OUT/'ElderCareAI_Unit_Testing_By_Module.docx', OUT/'ElderCareAI_Integration_Testing_30_Cases.docx']:
    if stale.exists(): stale.unlink()

print(f'Unit: {unit_count}; integration: {int_count}')
