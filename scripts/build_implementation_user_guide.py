"""Build the ElderCareAI implementation and caregiver guide Word documents."""

from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
SOURCES = (
    "ELDERCAREAI_IMPLEMENTATION_DEPLOYMENT_PHASE",
    "ELDERCAREAI_USER_GUIDE",
)


def add_inline(paragraph, value: str) -> None:
    """Add plain text plus Markdown-style bold spans to a paragraph."""
    pieces = re.split(r"(\*\*[^*]+\*\*)", value)
    for piece in pieces:
        if not piece:
            continue
        if piece.startswith("**") and piece.endswith("**"):
            paragraph.add_run(piece[2:-2]).bold = True
        else:
            paragraph.add_run(piece.replace("`", ""))


def add_page_field(paragraph) -> None:
    run = paragraph.add_run()
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), "PAGE")
    run._r.addnext(field)


def make_document(source: Path, destination: Path) -> None:
    doc = Document()
    sec = doc.sections[0]
    sec.page_width = Inches(8.5)
    sec.page_height = Inches(11)
    sec.left_margin = Inches(0.85)
    sec.right_margin = Inches(0.85)
    sec.top_margin = Inches(0.7)
    sec.bottom_margin = Inches(0.7)
    sec.header_distance = Inches(0.35)
    sec.footer_distance = Inches(0.36)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Times New Roman"
    normal.font.size = Pt(11)
    normal.font.color.rgb = RGBColor(25, 25, 25)
    normal.paragraph_format.space_after = Pt(7)
    normal.paragraph_format.line_spacing = 1.14

    title = styles["Title"]
    title.font.name = "Times New Roman"
    title.font.size = Pt(16)
    title.font.bold = True
    title.font.color.rgb = RGBColor(0, 0, 0)
    title.paragraph_format.space_after = Pt(13)
    title_ppr = title.element.get_or_add_pPr()
    for border in title_ppr.findall(qn("w:pBdr")):
        title_ppr.remove(border)

    heading = styles["Heading 1"]
    heading.font.name = "Times New Roman"
    heading.font.size = Pt(12)
    heading.font.bold = True
    heading.font.color.rgb = RGBColor(0, 0, 0)
    heading.paragraph_format.space_before = Pt(12)
    heading.paragraph_format.space_after = Pt(5)
    heading.paragraph_format.keep_with_next = True

    foot = sec.footer.paragraphs[0]
    foot.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    foot.style = normal
    foot.add_run("ElderCareAI  |  Page ").font.size = Pt(8)
    add_page_field(foot)

    figure_count = 0
    for line in source.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        if line.startswith("# "):
            p = doc.add_paragraph(style="Title")
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            ppr = p._p.get_or_add_pPr()
            borders = OxmlElement("w:pBdr")
            bottom = OxmlElement("w:bottom")
            bottom.set(qn("w:val"), "nil")
            borders.append(bottom)
            ppr.append(borders)
            p.add_run(line[2:])
        elif line.startswith("## "):
            p = doc.add_paragraph(style="Heading 1")
            if source.stem == "ELDERCAREAI_IMPLEMENTATION_DEPLOYMENT_PHASE" and line == "## Deployment Procedure":
                p.paragraph_format.page_break_before = True
            p.add_run(line[3:])
        elif line.startswith("*Insert screenshot here:") and line.endswith("*"):
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.keep_with_next = True
            run = p.add_run("[Screenshot to insert: " + line[len("*Insert screenshot here:") : -1].strip() + "]")
            run.italic = True
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(95, 95, 95)
        elif line.startswith("**Figure ") and line.endswith("**"):
            figure_count += 1
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(7)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(line[2:-2])
            run.bold = True
            run.font.size = Pt(10)
        elif line.startswith("- "):
            p = doc.add_paragraph(style="List Bullet")
            p.paragraph_format.left_indent = Inches(0.28)
            p.paragraph_format.first_line_indent = Inches(-0.16)
            p.paragraph_format.space_after = Pt(4)
            add_inline(p, line[2:])
        elif re.match(r"^\d+\. ", line):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.28)
            p.paragraph_format.first_line_indent = Inches(-0.28)
            p.paragraph_format.space_after = Pt(6)
            add_inline(p, line)
        else:
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            add_inline(p, line)

    if source.stem == "ELDERCAREAI_USER_GUIDE" and figure_count != 22:
        raise ValueError(f"Expected 22 figures, got {figure_count}")
    doc.core_properties.title = source.stem.replace("_", " ").title()
    doc.core_properties.subject = "ElderCareAI project documentation"
    doc.save(destination)
    print(f"Created {destination} ({figure_count} figure captions)")


if __name__ == "__main__":
    for stem in SOURCES:
        make_document(DOCS / f"{stem}.md", DOCS / f"{stem}.docx")
