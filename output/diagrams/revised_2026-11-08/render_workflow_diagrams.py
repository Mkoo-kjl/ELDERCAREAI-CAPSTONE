"""Compatibility entry point for the current connected flowcharts."""

from flowchart_renderer import ADMIN_EDGES, ADMIN_NODES, PROGRAM_EDGES, PROGRAM_NODES, render

if __name__ == '__main__':
    render('admin-workflow', 'Administrator', ADMIN_NODES, ADMIN_EDGES, 1900, 1970)
    render('program-workflow', 'Program', PROGRAM_NODES, PROGRAM_EDGES, 2000, 3400)
