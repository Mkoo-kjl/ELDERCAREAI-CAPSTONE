from pathlib import Path
from docx import Document

root=Path('C:/ELDERCAREAI-CAPSTONE').resolve()
folder=(root/'__tests__').resolve()
assert folder.is_relative_to(root)
doc_path=root/'output/documents/2026-11-09-focused-testing/ElderCareAI_Unit_Testing_By_Module.docx'
doc=Document(doc_path)
rows=doc.tables[0].rows[1:]
assert len(rows)==105
old_ids=[int(row.cells[4].text.split('-')[1]) for row in rows]
assert sorted(old_ids)==list(range(1,106))
files={i:folder/f'CASE-{i:03d}.test.tsx' for i in range(1,106)}
assert all(path.exists() and path.resolve().is_relative_to(folder) for path in files.values())

# Temporary names avoid collisions while the case order changes.
for old,path in files.items():
    path.rename(folder/f'.case-reorder-{old:03d}.tmp')
for new,old in enumerate(old_ids,1):
    source=folder/f'.case-reorder-{old:03d}.tmp'
    source.rename(folder/f'CASE-{new:03d}.test.tsx')
    cell=rows[new-1].cells[4]
    if cell.paragraphs[0].runs:
        cell.paragraphs[0].runs[0].text=f'CASE-{new:03d}'
    else:
        cell.text=f'CASE-{new:03d}'

doc.save(doc_path)
doc.save(root/'docs/UNIT_TEST_TABLE.docx')
assert not list(folder.glob('.case-reorder-*.tmp'))
print('Aligned 105 flat test files with the module-grouped table order.')
