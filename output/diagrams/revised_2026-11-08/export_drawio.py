"""Export the connected ElderCareAI workflows as editable draw.io XML."""

from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

from flowchart_renderer import (
    ADMIN_EDGES, ADMIN_NODES, PROGRAM_EDGES, PROGRAM_NODES,
)

HERE = Path(__file__).resolve().parent


def cell_style(kind):
    common = (
        'html=1;whiteSpace=wrap;align=center;verticalAlign=middle;'
        'fontFamily=Segoe UI;fontSize=21;fontColor=#142D31;'
        'strokeColor=#173D42;strokeWidth=3;'
    )
    if kind == 'terminal':
        return 'ellipse;' + common + 'fillColor=#AAEF9B;fontStyle=1;'
    if kind == 'decision':
        return 'rhombus;' + common + 'fillColor=#FFFFFF;'
    return 'rounded=0;' + common + 'fillColor=#FFFFFF;'


def port(node, point):
    x, y = point
    left = node['x'] - node['w'] / 2
    top = node['y'] - node['h'] / 2
    return ((x-left)/node['w'], (y-top)/node['h'])


def add_page(mxfile, diagram_id, title, nodes, edges, width, height):
    diagram = ET.SubElement(mxfile, 'diagram', {'id': diagram_id, 'name': title})
    model = ET.SubElement(diagram, 'mxGraphModel', {
        'dx': '1800', 'dy': '1200', 'grid': '1', 'gridSize': '10',
        'guides': '1', 'tooltips': '1', 'connect': '1', 'arrows': '1',
        'fold': '1', 'page': '1', 'pageScale': '1',
        'pageWidth': str(width), 'pageHeight': str(height),
        'math': '0', 'shadow': '0',
    })
    root = ET.SubElement(model, 'root')
    ET.SubElement(root, 'mxCell', {'id': '0'})
    ET.SubElement(root, 'mxCell', {'id': '1', 'parent': '0'})

    heading = ET.SubElement(root, 'mxCell', {
        'id': 'heading', 'value': f'ElderCareAI {title}',
        'style': 'text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;'
                 'rounded=0;fillColor=none;strokeColor=none;'
                 'fontFamily=Segoe UI;fontSize=38;fontStyle=1;fontColor=#142D31;',
        'vertex': '1', 'parent': '1',
    })
    ET.SubElement(heading, 'mxGeometry', {
        'x': '190', 'y': '38', 'width': str(width-250), 'height': '72', 'as': 'geometry',
    })

    for key, spec in nodes.items():
        cell = ET.SubElement(root, 'mxCell', {
            'id': key, 'value': spec['label'], 'style': cell_style(spec['kind']),
            'vertex': '1', 'parent': '1',
        })
        ET.SubElement(cell, 'mxGeometry', {
            'x': str(spec['x']-spec['w']/2),
            'y': str(spec['y']-spec['h']/2),
            'width': str(spec['w']), 'height': str(spec['h']), 'as': 'geometry',
        })

    for index, spec in enumerate(edges, 1):
        source, target = nodes[spec['src']], nodes[spec['dst']]
        sx, sy = port(source, spec['points'][0])
        tx, ty = port(target, spec['points'][-1])
        style = (
            'edgeStyle=none;orthogonal=1;rounded=0;html=1;'
            'endArrow=block;endFill=1;strokeColor=#263B3F;strokeWidth=3;'
            'fontFamily=Segoe UI;fontSize=19;fontStyle=1;fontColor=#174F5A;'
            'labelBackgroundColor=#FFFFFF;'
            f'exitX={sx:.4f};exitY={sy:.4f};exitDx=0;exitDy=0;'
            f'entryX={tx:.4f};entryY={ty:.4f};entryDx=0;entryDy=0;'
        )
        cell = ET.SubElement(root, 'mxCell', {
            'id': f'edge-{index}', 'value': spec['label'], 'style': style,
            'edge': '1', 'parent': '1',
            'source': spec['src'], 'target': spec['dst'],
        })
        geometry = ET.SubElement(cell, 'mxGeometry', {'relative': '1', 'as': 'geometry'})
        if len(spec['points']) > 2:
            waypoints = ET.SubElement(geometry, 'Array', {'as': 'points'})
            for x, y in spec['points'][1:-1]:
                ET.SubElement(waypoints, 'mxPoint', {'x': str(x), 'y': str(y)})


def write_file(path, pages):
    mxfile = ET.Element('mxfile', {
        'host': 'app.diagrams.net',
        'modified': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'agent': 'ElderCareAI Codex', 'version': '24.7.17', 'type': 'device',
    })
    for args in pages:
        add_page(mxfile, *args)
    ET.indent(mxfile, space='  ')
    tree = ET.ElementTree(mxfile)
    tree.write(path, encoding='utf-8', xml_declaration=True)
    print(path)


if __name__ == '__main__':
    program = ('program', 'Program Workflow', PROGRAM_NODES, PROGRAM_EDGES, 2000, 3400)
    admin = ('admin', 'Administrator Workflow', ADMIN_NODES, ADMIN_EDGES, 1900, 1970)
    write_file(HERE / 'ElderCareAI_Program_and_Admin_Workflows.drawio', [program, admin])
    write_file(HERE / 'program-workflow.drawio', [program])
    write_file(HERE / 'admin-workflow.drawio', [admin])
