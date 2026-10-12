import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'docs/ELDERCAREAI_DATABASE_DESIGN.dbml'), 'utf8');
const tables = new Map();
let current = null;
let inIndexes = false;

for (const line of source.split(/\r?\n/)) {
  const table = line.match(/^Table ([\w.]+) \{$/);
  if (table) {
    current = table[1];
    tables.set(current, []);
    inIndexes = false;
    continue;
  }
  if (!current) continue;
  if (line.trim() === 'indexes {') { inIndexes = true; continue; }
  if (line.trim() === '}') {
    if (inIndexes) inIndexes = false;
    else current = null;
    continue;
  }
  if (inIndexes) continue;
  const field = line.match(/^  ([a-z][a-z0-9_]*)\s+(.+)$/);
  if (field) tables.get(current).push({ name: field[1], pk: /\[.*\bpk\b/.test(field[2]), fk: false });
}

const refs = [...source.matchAll(/^Ref: ([\w.]+)\.([\w]+) > ([\w.]+)\.([\w]+)$/gm)]
  .map((match) => ({ child: match[1], field: match[2], parent: match[3], parentField: match[4] }));
tables.set('user_access', [
  { name: 'user_id', pk: true, fk: true }, { name: 'role' },
  { name: 'status' }, { name: 'updated_at' },
]);
tables.set('admin_audit_log', [
  { name: 'id', pk: true }, { name: 'actor_id', fk: true },
  { name: 'action' }, { name: 'target_type' }, { name: 'target_id' },
  { name: 'details' }, { name: 'created_at' },
]);
refs.push(
  { child: 'user_access', field: 'user_id', parent: 'auth.users', parentField: 'id' },
  { child: 'admin_audit_log', field: 'actor_id', parent: 'auth.users', parentField: 'id' },
);
for (const ref of refs) {
  const field = tables.get(ref.child)?.find((item) => item.name === ref.field);
  if (field) field.fk = true;
}

const pages = [
  {
    id: 'care-records', name: '1 Care records', title: 'ElderCareAI | Care records',
    subtitle: 'Caregiver, patient, vital, alert, notification, and emergency data',
    grid: [
      ['caregivers', 'elderly_profiles', 'vital_sign_logs'],
      ['caregiver_notifications', 'health_alerts', 'emergency_events'],
    ],
    relations: [
      ['caregivers', 'elderly_profiles', 'cares for', 'M'],
      ['elderly_profiles', 'vital_sign_logs', 'logs vitals', 'M'],
      ['caregivers', 'caregiver_notifications', 'receives', 'M'],
      ['elderly_profiles', 'health_alerts', 'triggers', 'M'],
      ['elderly_profiles', 'emergency_events', 'experiences', 'M'],
      ['health_alerts', 'caregiver_notifications', 'prompts', '0..M'],
    ],
  },
  {
    id: 'care-plan', name: '2 Care plan and Elle', title: 'ElderCareAI | Care plan and Elle',
    subtitle: 'Medication, appointments, notes, doctor contacts, and assistant conversations',
    grid: [
      ['caregivers', 'elderly_profiles', 'doctor_contacts'],
      ['medication_schedules', 'ai_chatbot_sessions', 'appointments'],
      ['medication_logs', 'ai_chatbot_messages', 'caregiver_notes'],
    ],
    relations: [
      ['caregivers', 'elderly_profiles', 'cares for', 'M'],
      ['elderly_profiles', 'doctor_contacts', 'has contact', '0..1'],
      ['elderly_profiles', 'medication_schedules', 'prescribed', 'M'],
      ['elderly_profiles', 'ai_chatbot_sessions', 'discussed in', 'M'],
      ['elderly_profiles', 'appointments', 'attends', 'M'],
      ['medication_schedules', 'medication_logs', 'tracks doses', 'M'],
      ['ai_chatbot_sessions', 'ai_chatbot_messages', 'contains', 'M'],
    ],
  },
  {
    id: 'identity-sync', name: '3 Identity and sync', title: 'ElderCareAI | Identity and sync',
    subtitle: 'Authentication, Google Health connections, locations, and admin access',
    grid: [
      ['profiles', 'user_access', 'admin_audit_log'],
      ['onboarding_progress', 'auth.users', 'google_health_tokens'],
      ['google_health_oauth_states', 'wearable_sync_locations', 'caregivers'],
    ],
    relations: [
      ['auth.users', 'profiles', 'has profile', '0..1'],
      ['auth.users', 'user_access', 'grants access', '1'],
      ['auth.users', 'admin_audit_log', 'performs', '0..M'],
      ['auth.users', 'onboarding_progress', 'onboards', '0..1'],
      ['auth.users', 'google_health_tokens', 'connects', '0..1', 'logical'],
      ['auth.users', 'google_health_oauth_states', 'authorizes', 'M'],
      ['auth.users', 'wearable_sync_locations', 'records', 'M'],
      ['auth.users', 'caregivers', 'caregiver account', '0..1', 'logical'],
    ],
  },
];

const shownTables = new Set(pages.flatMap((page) => page.grid.flat().filter(Boolean)));
for (const name of tables.keys()) {
  if (!shownTables.has(name)) throw new Error(`Table omitted from ERD: ${name}`);
}
for (const page of pages) {
  for (const [parent, child, , , kind] of page.relations) {
    if (kind !== 'logical' && !refs.some((ref) => ref.parent === parent && ref.child === child)) {
      throw new Error(`Relationship has no declared FK: ${parent} -> ${child}`);
    }
  }
}

const xml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const colX = [70, 830, 1590];
const rowY = [180, 700, 1220];
const entityStyle = 'rounded=0;whiteSpace=wrap;html=1;fillColor=#F7FAF9;strokeColor=#263A3D;strokeWidth=1.6;fontFamily=Arial;fontSize=14;fontStyle=1;fontColor=#15292B;align=center;verticalAlign=middle;';
const attributeStyle = (field) => `ellipse;whiteSpace=wrap;html=1;fillColor=${field.fk ? '#EEF6F3' : '#FFFFFF'};strokeColor=#59716F;strokeWidth=1;fontFamily=Arial;fontSize=11;fontStyle=${field.pk ? 4 : 0};fontColor=#233436;align=center;verticalAlign=middle;`;
const diamondStyle = (logical) => `rhombus;whiteSpace=wrap;html=1;fillColor=${logical ? '#EDF3F5' : '#FFF0A8'};strokeColor=#263A3D;strokeWidth=1.3;fontFamily=Arial;fontSize=11;fontStyle=1;fontColor=#1F2B2B;align=center;verticalAlign=middle;`;
const lineStyle = 'edgeStyle=none;html=1;strokeColor=#728581;strokeWidth=0.9;endArrow=none;';
const relationshipStyle = (logical, arrow) => `edgeStyle=none;html=1;strokeColor=${logical ? '#809397' : '#334C4C'};strokeWidth=${logical ? 1.2 : 1.5};${logical ? 'dashed=1;dashPattern=6 4;' : ''}endArrow=${arrow ? 'classicThin' : 'none'};endFill=1;fontFamily=Arial;fontSize=11;fontStyle=1;fontColor=#263A3D;labelBackgroundColor=#FFFFFF;`;
const textStyle = (size, bold = false) => `text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;rounded=0;strokeColor=none;fillColor=none;fontFamily=Arial;fontSize=${size};fontStyle=${bold ? 1 : 0};fontColor=#1B2E30;`;

function vertex(id, value, style, x, y, width, height) {
  return `<mxCell id="${xml(id)}" value="${xml(value)}" style="${xml(style)}" vertex="1" parent="1"><mxGeometry as="geometry" x="${x}" y="${y}" width="${width}" height="${height}" /></mxCell>`;
}
function edge(id, source, target, style, value = '', points = []) {
  const bends = points.length
    ? `<Array as="points">${points.map(([x, y]) => `<mxPoint x="${x}" y="${y}" />`).join('')}</Array>`
    : '';
  return `<mxCell id="${xml(id)}" value="${xml(value)}" style="${xml(style)}" edge="1" parent="1" source="${xml(source)}" target="${xml(target)}"><mxGeometry as="geometry" relative="1">${bends}</mxGeometry></mxCell>`;
}

function diagram(page) {
  const positions = new Map();
  const vertices = [
    vertex(`${page.id}-title`, page.title, textStyle(29, true), 70, 35, 2000, 44),
    vertex(`${page.id}-subtitle`, page.subtitle, textStyle(14), 70, 84, 1900, 30),
    vertex(`${page.id}-legend`, 'Rectangles: entities   |   Ovals: columns   |   Underlined: PK   |   Mint ovals: FK   |   Yellow diamonds: declared relationships   |   Gray diamonds: logical links', textStyle(11), 70, 125, 2200, 30),
  ];
  const edges = [];

  page.grid.forEach((row, rowIndex) => row.forEach((name, colIndex) => {
    if (!name) return;
    const fields = tables.get(name);
    if (!fields) throw new Error(`Unknown table ${name}`);
    const baseX = colX[colIndex];
    const baseY = rowY[rowIndex];
    const entityId = `${page.id}-${name.replaceAll('.', '-')}`;
    positions.set(name, { id: entityId, cx: baseX + 315, cy: baseY + 170 });
    vertices.push(vertex(entityId, name, entityStyle, baseX + 205, baseY + 146, 220, 48));
      const topCount = Math.ceil(fields.length / 2);
      const topRows = Math.ceil(topCount / 2);
    fields.forEach((field, index) => {
      const top = index < topCount;
      const level = top ? index : index - topCount;
      const x = baseX + (level % 2 === 0 ? 0 : 340);
      const y = baseY + (top
        ? 12 + (4 - topRows + Math.floor(level / 2)) * 34
        : 216 + Math.floor(level / 2) * 34);
      const id = `${entityId}-${field.name}`;
      const key = `${field.name}${field.pk ? '  PK' : ''}${field.fk ? '  FK' : ''}`;
      vertices.push(vertex(id, key, attributeStyle(field), x, y, 290, 28));
      edges.push(edge(`${id}-line`, entityId, id, lineStyle));
    });
  }));

  page.relations.forEach(([parent, child, label, cardinality, kind], index) => {
    const from = positions.get(parent);
    const to = positions.get(child);
    if (!from || !to) throw new Error(`Missing relation endpoint: ${parent} -> ${child}`);
    const logical = kind === 'logical';
    const x = Math.round((from.cx + to.cx) / 2 - 55);
    const y = Math.round((from.cy + to.cy) / 2 - 33);
    const id = `${page.id}-relationship-${index}`;
    vertices.push(vertex(id, label, diamondStyle(logical), x, y, 110, 66));
    const diamondY = y + 33;
    const diagonal = from.cx !== to.cx && from.cy !== to.cy;
    edges.push(edge(`${id}-one`, from.id, id, relationshipStyle(logical, false), '1',
      diagonal ? [[from.cx, diamondY]] : []));
    edges.push(edge(`${id}-many`, id, to.id, relationshipStyle(logical, true), cardinality,
      diagonal ? [[to.cx, diamondY]] : []));
  });

  const note = page.id === 'identity-sync'
    ? 'Admin extension: user_access and admin_audit_log are defined in the pending admin migration. Caregiver and Google Health token account links are logical, not declared FKs.'
    : page.id === 'care-plan'
      ? 'Caregiver notes have caregiver_id and elderly_id foreign keys. See the companion Full Schema page for every declared FK arrow.'
      : 'Every oval is sourced from the data dictionary. Additional caregiver and patient FK arrows appear in the companion Full Schema diagram.';
  vertices.push(vertex(`${page.id}-note`, note, textStyle(11), 70, rowY[page.grid.length - 1] + 390, 2200, 34));
  const height = rowY[page.grid.length - 1] + 490;
  return `<diagram id="${page.id}" name="${xml(page.name)}"><mxGraphModel dx="1600" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="2350" pageHeight="${height}" math="0" shadow="0"><root><mxCell id="0" /><mxCell id="1" parent="0" />${edges.join('')}${vertices.join('')}</root></mxGraphModel></diagram>`;
}

const output = `<?xml version="1.0" encoding="UTF-8"?><mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="ElderCareAI Chen ERD" version="24.7.17" type="device">${pages.map(diagram).join('')}</mxfile>`;
writeFileSync(resolve(root, 'docs/ELDERCAREAI_CHEN_ERD.drawio'), output, 'utf8');
console.log('Generated docs/ELDERCAREAI_CHEN_ERD.drawio with 3 editable pages.');
