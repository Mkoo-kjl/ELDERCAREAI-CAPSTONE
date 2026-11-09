from pathlib import Path

root=Path('C:/ELDERCAREAI-CAPSTONE')
unit=root/'__tests__'
integ=root/'integration testing'
extra=[88,90,91,93,94,97,101,103,106,107,114,125,127]
unit_map={old:new for new,old in enumerate(extra,88)}
keep_unit=set(range(1,88))|set(extra)
keep_integ=[n for n in range(1,34) if n not in (9,19,23)]
integ_map={old:new for new,old in enumerate(keep_integ,1)}

def rebuild(folder,prefix,keep,mapping):
    files={int(p.stem.split('-')[1].split('.')[0]):p for p in folder.glob(f'{prefix}-*.test.tsx')}
    assert len(files)==(127 if prefix=='CASE' else 33),len(files)
    for number,p in files.items():
        p.rename(folder/f'.selected-{prefix}-{number:03d}.tmp')
    for number,p in files.items():
        source=folder/f'.selected-{prefix}-{number:03d}.tmp'
        if number not in keep:
            source.unlink()
            continue
        new=mapping.get(number,number)
        dest=folder/f'{prefix}-{new:03d}.test.tsx'
        assert not dest.exists(),dest
        source.rename(dest)
    result=list(folder.glob(f'{prefix}-*.test.tsx'))
    assert len(result)==len(keep),(prefix,len(result),len(keep))
    print(prefix,len(result),'files, IDs 001 through',len(result))

rebuild(unit,'CASE',keep_unit,unit_map)
rebuild(integ,'INT',set(keep_integ),integ_map)
