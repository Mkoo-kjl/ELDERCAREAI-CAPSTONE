from pathlib import Path
import importlib.util
import os
from pypdf import PdfReader

work=Path(r'C:\ELDERCAREAI-CAPSTONE\tmp\specification-reference-format')
renderer_path=Path(r'C:\Users\cedri\.codex\plugins\cache\openai-primary-runtime\documents\26.1026.10807\skills\documents\render_docx.py')
poppler=Path(r'C:\Users\cedri\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin')
os.environ['PATH']=str(poppler)+os.pathsep+os.environ['PATH']
spec=importlib.util.spec_from_file_location('packaged_renderer',renderer_path)
renderer=importlib.util.module_from_spec(spec); spec.loader.exec_module(renderer)
# Prior run diagnosed the bundled converter: soffice.exe is unavailable.
# Retain the packaged rasterizer; use the hidden Word instance's PDF export.
renderer.convert_to_pdf=lambda *args,**kwargs:(str(work/'word-render.pdf'),'Microsoft Word PDF export')
paths=renderer.rasterize(r'C:\ELDERCAREAI-CAPSTONE\output\documents\ElderCareAI_Revised_Specifications_Reference_Format.docx',str(work/'qa'),150,verbose=True,emit_pdf=True)
pages=PdfReader(work/'word-render.pdf').pages
all_text=[]
for n,pg in enumerate(pages,1):
    t=pg.extract_text(); all_text.append(f'=== PAGE {n} ===\n{t}')
    lines=[x.strip() for x in t.splitlines() if x.strip()]
    print(f'Page {n}: {len(lines)} lines; {lines[:3]} ... {lines[-3:]}')
(work/'rendered-text.txt').write_text('\n\n'.join(all_text),encoding='utf-8')
print(f'PNG pages: {len(paths)}')
