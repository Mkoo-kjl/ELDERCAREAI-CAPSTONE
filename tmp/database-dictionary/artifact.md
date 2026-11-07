# Database dictionary artifact contract

Reference: C:/ELDERCAREAI-CAPSTONE/docs/ELDERCAREAI_DATABASE_DICTIONARY.docx
Reference SHA256: 5f0b51c8cfffb4fe408e31002becd95396e1085f4f049631efb5db19a1f4a667
Rendered reference: tmp/database-dictionary/reference-render; seven pages, all inspected.

Page system: one A4 portrait section, 11909 x 16834 twips. Margins top/bottom 893, left/right 806; header/footer distance 720. Preserve section and footer relationships exactly.

Typography: Times New Roman. Normal text 9 pt. Source table header and body 8 pt, captions bold 9 pt centered. Use source Title style for the new black 14 pt document title. All added prose and captions black. Original table borders black with 0.75 pt rules; retain reference styling. No decorative lines or added header.

Tables: retain the seven columns Column Name, Data Type, U, Description, Nullable, PK, FK. Grid widths 1872, 1411, 547, 3960, 979, 648, 648 twips. Preserve cell padding (65 top/bottom; 80 left/right), centered vertical alignment, left-aligned identifiers and descriptions, other values centered. Clone the first real table component; repeat header at page breaks, permit natural row height and prevent individual rows splitting. Long identifiers may wrap as in the source.

Recurring component: existing right-aligned footer ElderCareAI | PAGE, unchanged. No figures, rich content controls, external relationships or opaque content are editable.

Content flow: short introductory title, verified date, scope and legend followed by the 18 core patient-care table dictionaries. Each dictionary has a source-like Table caption, readable table heading, purpose, all actual columns and key/behavior notes. Internal, provider-status, platform and legacy tables omitted per the user. Retain starting caption number 23.

Editable slots: word/document.xml body content except sectPr; replace source table content and repeat source patterns for the selected main tables. word/settings.xml updateFields may be enabled. All other ZIP members and relationships must remain byte-for-byte identical; inventory is reference-parts.json.

Accuracy gates: exact column type/nullable/PK/FK from the live metadata; distinguish conditional/composite uniqueness; no invented foreign keys; identify sparse vital logs and non-medical stress; describe evidence JSON references separately from physical FKs. Include no patient records or credential values.

Fidelity gates: retained reference hash, section geometry, table grid, font sizes, source footer and preserve-only member hashes. Render each final page through Word PDF export plus packaged render_docx rasterization and inspect every PNG before delivery.
