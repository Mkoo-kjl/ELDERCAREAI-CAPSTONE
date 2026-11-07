"""Build the Word integration test matrix from its reviewable Markdown source."""

from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "INTEGRATION_TEST_TABLE.md"
OUTPUT = ROOT / "docs" / "INTEGRATION_TEST_TABLE.docx"
HEADERS = [
    "Proponent", "Test Case ID", "Module 1", "Integration Process", "Module 2",
    "Pre-condition", "Expected Result", "Result", "Remarks",
]
WIDTHS = [0.70, 0.70, 1.05, 1.55, 1.05, 1.25, 2.25, 0.95, 0.60]


def read_rows() -> list[list[str]]:
    lines = [line for line in SOURCE.read_text(encoding="utf-8").splitlines() if line.startswith("|")]
    rows = [[cell.strip() for cell in line.strip("|").split("|")] for line in lines]
    if rows[0] != HEADERS or len(rows[0]) != len(WIDTHS):
        raise ValueError("Integration table headings do not match the Word template")
    data = rows[2:]
    if len(data) != 25:
        raise ValueError(f"Expected 25 integration cases, found {len(data)}")
    for number, row in enumerate(data, 1):
        if len(row) != len(HEADERS) or row[1] != f"INT-{number:03d}":
            raise ValueError(f"Invalid integration case row {number}")
        if row[0]:
            raise ValueError("Proponent must remain blank for the final report")
    return data


def add_cell_property(cell, name: str, value: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    element = OxmlElement(f"w:{name}")
    element.set(qn("w:val" if name == "shd" else "w:w"), value)
    tc_pr.append(element)


def style_cell(cell, text: str, column: int, header: bool = False) -> None:
    cell.text = text
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    tc_pr = cell._tc.get_or_add_tcPr()
    margins = OxmlElement("w:tcMar")
    for edge, amount in (("top", "65"), ("bottom", "65"), ("left", "70"), ("right", "70")):
        item = OxmlElement(f"w:{edge}")
        item.set(qn("w:w"), amount)
        item.set(qn("w:type"), "dxa")
        margins.append(item)
    tc_pr.append(margins)
    borders = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        item = OxmlElement(f"w:{edge}")
        item.set(qn("w:val"), "single")
        item.set(qn("w:sz"), "4")
        item.set(qn("w:color"), "000000")
        borders.append(item)
    tc_pr.append(borders)
    if header:
        shading = OxmlElement("w:shd")
        shading.set(qn("w:fill"), "D9EAD3")
        tc_pr.append(shading)
    paragraph = cell.paragraphs[0]
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER if header or column in (0, 1, 7, 8) else WD_ALIGN_PARAGRAPH.LEFT
    paragraph.paragraph_format.space_before = Pt(0)
    paragraph.paragraph_format.space_after = Pt(0)
    paragraph.paragraph_format.line_spacing = 1.04
    for run in paragraph.runs:
        run.font.name = "Times New Roman"
        run.font.size = Pt(8 if header else 7.7)
        run.font.bold = header
        run.font.color.rgb = RGBColor(0, 0, 0)


def row_property(row, name: str) -> None:
    row._tr.get_or_add_trPr().append(OxmlElement(f"w:{name}"))


def add_body_paragraph(document, content: str) -> None:
    paragraph = document.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(5)
    paragraph.paragraph_format.line_spacing = 1.08
    run = paragraph.add_run(content)
    run.font.name = "Times New Roman"
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(0, 0, 0)


def build() -> None:
    data = read_rows()
    document = Document()
    section = document.sections[0]
    section.orientation = WD_ORIENT.LANDSCAPE
    section.page_width = Inches(11)
    section.page_height = Inches(8.5)
    section.left_margin = Inches(0.45)
    section.right_margin = Inches(0.45)
    section.top_margin = Inches(0.50)
    section.bottom_margin = Inches(0.40)

    title = document.add_paragraph(style="Title")
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_after = Pt(8)
    title_border = OxmlElement("w:pBdr")
    bottom_border = OxmlElement("w:bottom")
    bottom_border.set(qn("w:val"), "nil")
    title_border.append(bottom_border)
    title._p.get_or_add_pPr().append(title_border)
    run = title.add_run("ElderCareAI Integration Testing")
    run.font.name = "Times New Roman"
    run.font.size = Pt(15)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0, 0, 0)

    add_body_paragraph(document, "Integration testing checks how ElderCareAI modules work together in caregiver workflows. These 25 Jest and React Native Testing Library cases connect authentication to onboarding, health readings to analysis, care entries to reminders, and saved data to reports and Elle. Every case passed in the automated run.")
    add_body_paragraph(document, "Supabase responses, the AI endpoint, and native notification, printing, and sharing services use controlled test doubles. The results verify the interfaces and behavior asserted below; they do not establish live service availability, device delivery, security policy enforcement, or performance under load. Proponent is blank for the final report.")

    table = document.add_table(rows=1, cols=len(HEADERS))
    table.autofit = False
    for column, width in zip(table.columns, WIDTHS):
        column.width = Inches(width)
    for index, heading in enumerate(HEADERS):
        table.rows[0].cells[index].width = Inches(WIDTHS[index])
        style_cell(table.rows[0].cells[index], heading, index, header=True)
    row_property(table.rows[0], "tblHeader")
    row_property(table.rows[0], "cantSplit")
    for source_row in data:
        row = table.add_row()
        row_property(row, "cantSplit")
        for index, value in enumerate(source_row):
            row.cells[index].width = Inches(WIDTHS[index])
            style_cell(row.cells[index], value, index)

    document.save(OUTPUT)
    print(f"Created {OUTPUT} with {len(data)} integration cases")


if __name__ == "__main__":
    build()
