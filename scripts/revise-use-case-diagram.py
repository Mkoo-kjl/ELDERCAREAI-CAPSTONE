from __future__ import annotations

import math
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Users\vence\OneDrive\Pictures\Camera Roll\mamaamam.docx")
OUTPUT = ROOT / "output" / "ElderCareAI_Current_Use_Case_Diagram_Verb_Noun.docx"

NAVY = "#173B4F"
BLUE = "#2D607A"
TEAL = "#2B8A78"
PALE_TEAL = "#EEF8F6"
PALE_BLUE = "#EDF4FB"
AMBER = "#B57720"
PALE_AMBER = "#FFF7E8"
INK = "#263F4C"
GRID = "#C9D7DF"

FONT_REGULAR = Path(r"C:\Windows\Fonts\arial.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")
FONT_ITALIC = Path(r"C:\Windows\Fonts\ariali.ttf")


def font(size: int, *, bold: bool = False, italic: bool = False):
    selected = FONT_BOLD if bold else FONT_ITALIC if italic else FONT_REGULAR
    return ImageFont.truetype(str(selected), size=size)


def wrap_label(draw: ImageDraw.ImageDraw, text: str, face, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        bbox = draw.textbbox((0, 0), candidate, font=face)
        if bbox[2] - bbox[0] <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def centered_text(draw: ImageDraw.ImageDraw, box, text: str, face, fill=INK, max_width=None):
    x1, y1, x2, y2 = box
    width = max_width or int(x2 - x1 - 30)
    lines = wrap_label(draw, text, face, width)
    line_gap = max(4, int(face.size * 0.16))
    heights = []
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=face)
        heights.append(bbox[3] - bbox[1])
    total = sum(heights) + line_gap * max(0, len(lines) - 1)
    y = y1 + (y2 - y1 - total) / 2
    for line, height in zip(lines, heights):
        bbox = draw.textbbox((0, 0), line, font=face)
        text_width = bbox[2] - bbox[0]
        draw.text((x1 + (x2 - x1 - text_width) / 2, y), line, font=face, fill=fill)
        y += height + line_gap


def actor(draw: ImageDraw.ImageDraw, x: int, y: int, label: str):
    draw.ellipse((x - 20, y - 95, x + 20, y - 55), outline=INK, width=5)
    draw.line((x, y - 55, x, y + 15), fill=INK, width=5)
    draw.line((x - 42, y - 30, x + 42, y - 30), fill=INK, width=5)
    draw.line((x, y + 15, x - 40, y + 75), fill=INK, width=5)
    draw.line((x, y + 15, x + 40, y + 75), fill=INK, width=5)
    centered_text(draw, (x - 95, y + 82, x + 95, y + 135), label, font(27, bold=True), NAVY)


def arrow_head(draw: ImageDraw.ImageDraw, start, end, fill=INK, size=14):
    x1, y1 = start
    x2, y2 = end
    angle = math.atan2(y2 - y1, x2 - x1)
    left = (x2 - size * math.cos(angle - math.pi / 6), y2 - size * math.sin(angle - math.pi / 6))
    right = (x2 - size * math.cos(angle + math.pi / 6), y2 - size * math.sin(angle + math.pi / 6))
    draw.polygon([(x2, y2), left, right], fill=fill)


def dashed_arrow(draw: ImageDraw.ImageDraw, start, end, label: str = ""):
    x1, y1 = start
    x2, y2 = end
    distance = math.hypot(x2 - x1, y2 - y1)
    if distance == 0:
        return
    ux, uy = (x2 - x1) / distance, (y2 - y1) / distance
    cursor = 0.0
    while cursor < distance - 12:
        seg_end = min(cursor + 18, distance - 12)
        draw.line((x1 + ux * cursor, y1 + uy * cursor, x1 + ux * seg_end, y1 + uy * seg_end), fill=BLUE, width=4)
        cursor += 31
    arrow_head(draw, (x1, y1), (x2, y2), BLUE, 16)
    if label:
        face = font(22, italic=True)
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        bbox = draw.textbbox((0, 0), label, font=face)
        draw.rounded_rectangle((mx - (bbox[2] - bbox[0]) / 2 - 8, my - 30,
                                mx + (bbox[2] - bbox[0]) / 2 + 8, my + 5), radius=7, fill="white")
        draw.text((mx - (bbox[2] - bbox[0]) / 2, my - 28), label, font=face, fill=BLUE)


def dashed_polyline(draw: ImageDraw.ImageDraw, points, fill=BLUE):
    for start, end in zip(points, points[1:]):
        x1, y1 = start
        x2, y2 = end
        distance = math.hypot(x2 - x1, y2 - y1)
        if distance == 0:
            continue
        ux, uy = (x2 - x1) / distance, (y2 - y1) / distance
        cursor = 0.0
        while cursor < distance:
            seg_end = min(cursor + 18, distance)
            draw.line((x1 + ux * cursor, y1 + uy * cursor,
                       x1 + ux * seg_end, y1 + uy * seg_end), fill=fill, width=4)
            cursor += 31
    arrow_head(draw, points[-2], points[-1], fill, 16)


def ellipse(draw, center, label, fill, outline, radius=(155, 54)):
    cx, cy = center
    rx, ry = radius
    box = (cx - rx, cy - ry, cx + rx, cy + ry)
    draw.ellipse(box, fill=fill, outline=outline, width=4)
    centered_text(draw, box, label, font(28, bold=True), INK, max_width=rx * 2 - 34)
    return box


def draw_use_case_overview(path: Path):
    width, height = 1200, 1900
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)

    boundary = (305, 25, 895, 1870)
    draw.rectangle(boundary, fill="white", outline="black", width=4)
    centered_text(draw, (420, 38, 780, 78), "ElderCareAI", font(28, bold=True), "black")

    caregiver_labels = [
        "Authenticate Caregiver",
        "Complete Onboarding",
        "View Dashboard",
        "Synchronize Health Data",
        "Review Health Insights",
        "Analyze Health Trends",
        "Review Health Alerts",
        "Activate SOS Emergency",
        "Consult Elle Assistant",
        "Manage User Profiles",
        "Manage Health Records",
        "Manage Care Plans",
        "Export Care Reports",
        "Configure App Settings",
        "View Sync Location",
    ]
    admin_labels = [
        "Authenticate Administrator",
        "Recover Admin Password",
        "View System Overview",
        "Manage Caregiver Accounts",
        "Monitor System Data",
        "Review Emergency Records",
        "Export Admin Reports",
        "Manage System Security",
    ]
    labels = caregiver_labels + admin_labels
    centers = [(600, 115 + index * 76) for index in range(len(labels))]
    rx, ry = 218, 29

    caregiver_point = (165, 650)
    admin_point = (1035, 1215)
    google_point = (165, 1510)

    # Draw the association fan first so each oval masks lines that would cross its text.
    for cx, cy in centers[:len(caregiver_labels)]:
        draw.line((*caregiver_point, cx - rx, cy), fill="black", width=3)
    for cx, cy in centers[len(caregiver_labels):]:
        draw.line((*admin_point, cx + rx, cy), fill="black", width=3)
    for index in (1, 3):
        cx, cy = centers[index]
        draw.line((*google_point, cx - rx, cy), fill="black", width=3)

    for center, label in zip(centers, labels):
        cx, cy = center
        box = (cx - rx, cy - ry, cx + rx, cy + ry)
        draw.ellipse(box, fill="white", outline="black", width=3)
        centered_text(draw, box, label, font(22), "black", max_width=rx * 2 - 34)

    # Match the reference's directed association appearance without crossing labels.
    for cx, cy in centers[:len(caregiver_labels)]:
        arrow_head(draw, caregiver_point, (cx - rx, cy), "black", 11)
    for cx, cy in centers[len(caregiver_labels):]:
        arrow_head(draw, admin_point, (cx + rx, cy), "black", 11)
    for index in (1, 3):
        cx, cy = centers[index]
        arrow_head(draw, google_point, (cx - rx, cy), "black", 11)

    def monochrome_actor(x: int, y: int, label: str):
        draw.ellipse((x - 17, y - 75, x + 17, y - 41), outline="black", width=3)
        draw.line((x, y - 41, x, y + 18), fill="black", width=3)
        draw.line((x - 35, y - 18, x + 35, y - 18), fill="black", width=3)
        draw.line((x, y + 18, x - 31, y + 67), fill="black", width=3)
        draw.line((x, y + 18, x + 31, y + 67), fill="black", width=3)
        centered_text(draw, (x - 100, y + 72, x + 100, y + 120), label, font(21), "black")

    monochrome_actor(*caregiver_point, "Caregiver")
    monochrome_actor(*admin_point, "Administrator")
    monochrome_actor(*google_point, "Google Health")

    image.save(path, format="PNG", optimize=True)


def rounded_box(draw, box, text, *, fill, outline, face=None):
    draw.rounded_rectangle(box, radius=18, fill=fill, outline=outline, width=4)
    centered_text(draw, box, text, face or font(28, bold=True), INK)


def solid_arrow(draw, start, end, fill=INK, width=5):
    draw.line((*start, *end), fill=fill, width=width)
    arrow_head(draw, start, end, fill, 18)


def draw_application_flow(path: Path):
    width, height = 2400, 1600
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    centered_text(draw, (500, 20, 1900, 90), "Current Authentication Onboarding and Operational Flow", font(42, bold=True), NAVY)
    centered_text(draw, (80, 95, 600, 145), "CAREGIVER MOBILE APPLICATION", font(27, bold=True), BLUE)

    launch = (60, 170, 310, 280)
    sign_in = (555, 170, 870, 280)
    load_status = (1000, 170, 1320, 280)
    for box, label in ((launch, "Launch App"), (sign_in, "Google OAuth Sign In"), (load_status, "Load Onboarding Status")):
        rounded_box(draw, box, label, fill=PALE_TEAL, outline=TEAL)
    solid_arrow(draw, (320, 225), (385, 225))

    draw.polygon([(455, 160), (525, 225), (455, 290), (385, 225)], fill=PALE_AMBER, outline=AMBER)
    centered_text(draw, (395, 185, 515, 260), "Session", font(23, bold=True), INK)
    solid_arrow(draw, (525, 225), (545, 225))
    centered_text(draw, (500, 285, 565, 325), "No", font(21, bold=True), AMBER)
    solid_arrow(draw, (880, 225), (990, 225))
    draw.line((455, 160, 455, 125, 1160, 125, 1160, 160), fill=TEAL, width=5)
    arrow_head(draw, (1160, 125), (1160, 160), TEAL, 18)
    centered_text(draw, (650, 88, 940, 128), "Yes existing session", font(21, italic=True), TEAL)

    draw.polygon([(1455, 160), (1535, 225), (1455, 290), (1375, 225)], fill=PALE_AMBER, outline=AMBER)
    centered_text(draw, (1382, 182, 1528, 265), "Onboarding Complete", font(21, bold=True), INK)
    solid_arrow(draw, (1330, 225), (1365, 225), BLUE)

    onboarding = [
        "Introduction",
        "Caregiver Profile",
        "Older Adult Profile",
        "Connect or Skip Google Health",
        "Allow or Skip Phone Location",
    ]
    xs = [35, 425, 815, 1205, 1595]
    on_boxes = []
    for x, label in zip(xs, onboarding):
        box = (x, 395, x + 345, 510)
        on_boxes.append(box)
        rounded_box(draw, box, label, fill=PALE_BLUE, outline="#476F9D", face=font(25, bold=True))
    for left, right in zip(on_boxes, on_boxes[1:]):
        solid_arrow(draw, (left[2] + 8, 452), (right[0] - 8, 452), BLUE)
    draw.line((1455, 290, 1455, 340, 207, 340, 207, 385), fill=BLUE, width=5)
    arrow_head(draw, (207, 340), (207, 385), BLUE, 18)
    centered_text(draw, (600, 300, 980, 345), "No route to first incomplete step", font(21, italic=True), BLUE)

    home_box = (2030, 395, 2355, 510)
    rounded_box(draw, home_box, "Home", fill=PALE_TEAL, outline=TEAL, face=font(30, bold=True))
    solid_arrow(draw, (1948, 452), (2020, 452), TEAL)
    draw.line((1535, 225, 2192, 225, 2192, 385), fill=TEAL, width=5)
    arrow_head(draw, (2192, 225), (2192, 385), TEAL, 18)
    centered_text(draw, (1640, 180, 2060, 225), "Yes open the protected app", font(21, italic=True), TEAL)

    tabs = ["Home", "Health", "Alerts and SOS", "Elle", "Care", "Settings"]
    tab_xs = [75, 460, 845, 1230, 1615, 2000]
    for x, label in zip(tab_xs, tabs):
        box = (x, 665, x + 300, 770)
        rounded_box(draw, box, label, fill="#FFFFFF", outline=BLUE, face=font(27, bold=True))
        solid_arrow(draw, (2192, 520), (x + 150, 655), "#8799A3", 3)

    sync_boxes = [
        ((75, 885, 525, 1000), "Manual Startup Foreground Timed or Webhook Trigger"),
        ((675, 885, 1050, 1000), "Google Health API v4"),
        ((1200, 885, 1575, 1000), "Supabase Sync and Storage"),
        ((1725, 885, 2325, 1000), "Realtime Dashboard and Health Update"),
    ]
    for box, label in sync_boxes:
        rounded_box(draw, box, label, fill=PALE_AMBER, outline=AMBER, face=font(25, bold=True))
    for left, right in zip(sync_boxes, sync_boxes[1:]):
        solid_arrow(draw, (left[0][2] + 10, 942), (right[0][0] - 10, 942), AMBER)
    draw.line((2025, 875, 2025, 820, 995, 820, 995, 780), fill=AMBER, width=5)
    arrow_head(draw, (995, 820), (995, 780), AMBER, 18)

    # Separate administrator lane, intentionally isolated from mobile onboarding.
    draw.line((75, 1080, 2325, 1080), fill=GRID, width=3)
    centered_text(draw, (80, 1095, 560, 1145), "ADMINISTRATOR WEB PORTAL", font(27, bold=True), BLUE)
    admin_flow = [
        ((75, 1190, 410, 1305), "Open Admin Portal"),
        ((535, 1190, 870, 1305), "Enter Credentials"),
        ((995, 1190, 1395, 1305), "Verify Session Role and Active Status"),
        ((1520, 1190, 1820, 1305), "Open Overview"),
        ((1945, 1190, 2325, 1305), "Accounts Monitor Alerts Reports Security"),
    ]
    for box, label in admin_flow:
        rounded_box(draw, box, label, fill=PALE_BLUE, outline="#476F9D", face=font(24, bold=True))
    for left, right in zip(admin_flow, admin_flow[1:]):
        solid_arrow(draw, (left[0][2] + 10, 1247), (right[0][0] - 10, 1247), BLUE)
    recovery = (535, 1420, 995, 1525)
    rounded_box(draw, recovery, "Email Code Password Recovery", fill=PALE_AMBER, outline=AMBER, face=font(24, bold=True))
    dashed_arrow(draw, (765, 1410), (765, 1315), "optional recovery")

    image.save(path, format="PNG", optimize=True)


def set_run_font(run, *, name="Times New Roman", size=12, bold=False, italic=False, color="000000"):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = RGBColor.from_string(color)
    fonts = run._element.get_or_add_rPr().get_or_add_rFonts()
    fonts.set(qn("w:ascii"), name)
    fonts.set(qn("w:hAnsi"), name)


def set_alt_text(inline_shape, title: str, description: str):
    doc_pr = inline_shape._inline.docPr
    doc_pr.set("title", title)
    doc_pr.set("descr", description)


def clear_body(document: Document):
    body = document._element.body
    for child in list(body):
        if child.tag != qn("w:sectPr"):
            body.remove(child)


def keep_with_next(paragraph):
    p_pr = paragraph._p.get_or_add_pPr()
    keep = OxmlElement("w:keepNext")
    p_pr.append(keep)


def add_caption(document: Document, number: int, title: str):
    paragraph = document.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.space_before = Pt(3)
    paragraph.paragraph_format.space_after = Pt(8)
    run = paragraph.add_run(f"Figure {number}. {title}")
    set_run_font(run, size=10.5, italic=True)


def add_body(document: Document, text: str):
    paragraph = document.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(7)
    paragraph.paragraph_format.line_spacing = 1.08
    set_run_font(paragraph.add_run(text), size=11.5)
    return paragraph


def build_document(overview_path: Path, flow_path: Path):
    document = Document(SOURCE)
    clear_body(document)
    section = document.sections[0]
    section.top_margin = Inches(0.7)
    section.bottom_margin = Inches(0.7)
    section.left_margin = Inches(0.8)
    section.right_margin = Inches(0.8)

    normal = document.styles["Normal"]
    normal.font.name = "Times New Roman"
    normal.font.size = Pt(11.5)
    normal._element.rPr.rFonts.set(qn("w:ascii"), "Times New Roman")
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Times New Roman")

    title_style = document.styles["Title"]
    title_style.font.name = "Times New Roman"
    title_style.font.size = Pt(20)
    title_style.font.bold = True
    title_style.font.color.rgb = RGBColor(0, 0, 0)
    title_style._element.rPr.rFonts.set(qn("w:ascii"), "Times New Roman")
    title_style._element.rPr.rFonts.set(qn("w:hAnsi"), "Times New Roman")

    for style_name, size in (("Heading 1", 16), ("Heading 2", 13)):
        style = document.styles[style_name]
        style.font.name = "Times New Roman"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor(0, 0, 0)
        style._element.rPr.rFonts.set(qn("w:ascii"), "Times New Roman")
        style._element.rPr.rFonts.set(qn("w:hAnsi"), "Times New Roman")

    title = document.add_paragraph(style="Title")
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_after = Pt(8)
    title.add_run("ElderCareAI Current Use Case Diagram")

    add_body(document,
             "This diagram reflects the caregiver application and the separate administrator portal. The older adult is a managed profile, "
             "not an actor, because the current application provides no older-adult login or interface. Google Health supports onboarding "
             "and health-data synchronization.")

    picture_paragraph = document.add_paragraph()
    picture_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    picture_paragraph.paragraph_format.space_after = Pt(1)
    shape = picture_paragraph.add_run().add_picture(str(overview_path), width=Inches(5.0))
    set_alt_text(shape, "ElderCareAI current use case diagram",
                 "A classic UML diagram with vertically stacked use cases inside the ElderCareAI boundary and Caregiver, Administrator, and Google Health actors outside the system.")
    add_caption(document, 1, "ElderCareAI current use case diagram")

    heading = document.add_paragraph("Current Application Flow", style="Heading 1")
    heading.paragraph_format.page_break_before = True
    heading.paragraph_format.space_after = Pt(7)
    flow_paragraph = document.add_paragraph()
    flow_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    flow_paragraph.paragraph_format.space_after = Pt(1)
    shape = flow_paragraph.add_run().add_picture(str(flow_path), width=Inches(6.65))
    set_alt_text(shape, "ElderCareAI authentication onboarding and operational flow",
                 "App launch and session routing, ordered onboarding steps, protected main tabs, Google Health synchronization, and the separate administrator portal flow.")
    add_caption(document, 2, "Authentication onboarding and operational flow")

    add_body(document,
             "On launch, the app routes an authenticated caregiver to the first incomplete onboarding step or directly to Home. "
             "Onboarding proceeds through the introduction, caregiver profile, older-adult profile, optional Google Health connection, and optional foreground phone-location consent. "
             "After completion, the protected Home, Health, Alerts, Elle, Care, and Settings tabs become available.")
    add_body(document,
             "Health data is reconciled from Google Health after manual, startup, foreground, timed active-app, or supported webhook triggers. "
             "Supabase stores the authorized records and sends database updates to the caregiver interface. The application does not directly pair with the tracker or continuously stream measurements from it.")

    correction = document.add_paragraph("Corrections to the Previous Diagram", style="Heading 2")
    correction.paragraph_format.space_before = Pt(5)
    correction.paragraph_format.space_after = Pt(4)
    corrections = [
        "The older adult is represented as a managed profile rather than an application actor.",
        "Direct tracker pairing and Fetch Vitals are replaced by Google Health authorization and synchronization.",
        "Real-time location is replaced by the caregiver phone's last saved foreground synchronization location.",
        "Health predictions are non-diagnostic statistical trends and require sufficient synchronized history.",
        "Caregiver reports are generated as shareable PDFs, while administrator reports are exported as CSV files.",
    ]
    for text in corrections:
        paragraph = document.add_paragraph()
        paragraph.paragraph_format.left_indent = Inches(0.28)
        paragraph.paragraph_format.first_line_indent = Inches(-0.18)
        paragraph.paragraph_format.space_after = Pt(2)
        paragraph.paragraph_format.line_spacing = 1.02
        set_run_font(paragraph.add_run("• "), size=11)
        set_run_font(paragraph.add_run(text), size=11)

    core = document.core_properties
    core.title = "ElderCareAI Current Use Case Diagram"
    core.subject = "Revised use case and application flow aligned with the implemented application"
    core.author = "ElderCareAI Project Team"
    core.keywords = "ElderCareAI, use case diagram, caregiver, administrator, Google Health"
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document.save(OUTPUT)


def main():
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)
    with tempfile.TemporaryDirectory(prefix="eldercare_use_case_") as tmp:
        tmp_path = Path(tmp)
        overview = tmp_path / "current-use-case-overview.png"
        flow = tmp_path / "current-application-flow.png"
        draw_use_case_overview(overview)
        draw_application_flow(flow)
        build_document(overview, flow)
    print(OUTPUT)


if __name__ == "__main__":
    main()
