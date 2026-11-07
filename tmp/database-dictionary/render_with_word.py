"""Use Word's read-only PDF export when Windows has no bundled LibreOffice.

The packaged render_docx.py still performs page sizing and PNG rasterization.
"""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys

skill=Path(r'C:\Users\cedri\.codex\plugins\cache\openai-primary-runtime\documents\26.1105.12137\skills\documents')
runtime=Path(r'C:\Users\cedri\.cache\codex-runtimes\codex-primary-runtime\dependencies')
poppler=list((runtime/'native'/'poppler').rglob('pdftoppm.exe'))
if not poppler:raise RuntimeError('Bundled Poppler missing')
os.environ['PATH']=str(poppler[0].parent)+os.pathsep+str(runtime/'python')+os.pathsep+os.environ.get('PATH','')
spec=importlib.util.spec_from_file_location('packaged_docx_renderer',skill/'render_docx.py')
renderer=importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)

def word_pdf(doc_path,user_profile,convert_tmp_dir,stem,verbose=False):
    pdf=Path(convert_tmp_dir)/(stem+'.pdf')
    script=Path(__file__).with_name('word_to_pdf.ps1')
    result=subprocess.run(['powershell.exe','-NoProfile','-File',str(script),'-InputDoc',str(Path(doc_path).resolve()),'-OutputPdf',str(pdf)],capture_output=True,text=True,timeout=180)
    if result.returncode or not pdf.exists():raise RuntimeError(result.stdout+'\n'+result.stderr)
    print(result.stdout.strip(),flush=True)
    return str(pdf),result.stdout

renderer.convert_to_pdf=word_pdf
renderer.main()
