from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

path = Path('output/diagrams/revised_2026-11-08/flowchart_renderer.py')
spec = spec_from_file_location('flowchart_renderer', path)
module = module_from_spec(spec)
spec.loader.exec_module(module)
for name, nodes, edges in [
    ('admin', module.ADMIN_NODES, module.ADMIN_EDGES),
    ('program', module.PROGRAM_NODES, module.PROGRAM_EDGES),
]:
    seen = {'start'}
    queue = ['start']
    while queue:
        current = queue.pop()
        for edge in edges:
            assert edge['src'] in nodes and edge['dst'] in nodes
            if edge['src'] == current and edge['dst'] not in seen:
                seen.add(edge['dst'])
                queue.append(edge['dst'])
    print(name, 'nodes', len(nodes), 'edges', len(edges), 'unreachable', sorted(set(nodes)-seen), 'finish', 'finish' in seen)
    assert set(nodes) == seen
    assert 'finish' in seen
