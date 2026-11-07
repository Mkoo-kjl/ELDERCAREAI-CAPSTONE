from pathlib import Path
import importlib.util
import os
from pypdf import PdfReader

work = Path(r'C:\ELDERCAREAI-CAPSTONE\tmp\eldercare-specification-doc')
renderer_path = Path(r'C:\Users\cedri\.codex\plugins\cache\openai-primary-runtime\documents\26.1026.10807\skills\documents\render_docx.py')
poppler = Path(r'C:\Users\cedri\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin')
os.environ['PATH'] = str(poppler) + os.pathsep + os.environ['PATH']
spec = importlib.util.spec_from_file_location('packaged_renderer', renderer_path)
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)

# The packaged converter was diagnosed: bundled soffice.exe is unavailable.
# Use the PDF exported by a separate, hidden Microsoft Word instance; retain
# the packaged renderer's complete Poppler PDF-to-PNG pipeline unchanged.
renderer.convert_to_pdf = lambda *args, **kwargs: (str(work / 'word-render.pdf'), 'Microsoft Word PDF export')
paths = renderer.rasterize(
    r'C:\ELDERCAREAI-CAPSTONE\output\documents\ElderCareAI_Revised_Implementation_and_System_Specifications.docx',
    str(work / 'qa'), 150, verbose=True, emit_pdf=True,
)
reader = PdfReader(work / 'word-render.pdf')
full_text = []
for n, pg in enumerate(reader.pages, 1):
    text = pg.extract_text()
    full_text.append(f'=== PAGE {n} ===\n{text}')
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    print(f'Page {n}: {len(lines)} lines; {lines[1:3]} ... {lines[-3:]}')
(work / 'rendered-text.txt').write_text('\n\n'.join(full_text), encoding='utf-8')
print(f'PNG pages: {len(paths)}')
