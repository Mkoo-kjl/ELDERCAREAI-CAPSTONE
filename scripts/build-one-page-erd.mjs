import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'docs/ELDERCAREAI_DATABASE_DESIGN.dbml'), 'utf8');
const tables = new Map();
let current = null;
let inIndexes = false;

for (const line of source.split(/\r?\n/)) {
  const start = line.match(/^Table ([\w.]+) \{$/);
  if (start) {
    current = start[1];
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
  const match = line.match(/^  ([a-z][a-z0-9_]*)\s+(.+)$/);
  if (match) tables.get(current).push({ name: match[1], pk: /\[.*\bpk\b/.test(match[2]), fk: false, logical: false, unique: /\[.*\bunique\b/.test(match[2]) });
}

tables.set('user_access', [
  { name: 'user_id', pk: true }, { name: 'role' },
  { name: 'status' }, { name: 'updated_at' },
]);
tables.set('admin_audit_log', [
  { name: 'id', pk: true }, { name: 'actor_id' }, { name: 'action' },
  { name: 'target_type' }, { name: 'target_id' }, { name: 'details' },
  { name: 'created_at' },
]);

const refs = [...source.matchAll(/^Ref: ([\w.]+)\.([\w]+) > ([\w.]+)\.([\w]+)$/gm)]
  .map((match) => ({ child: match[1], field: match[2], parent: match[3], parentField: match[4], logical: false }));
refs.push(
  { child: 'user_access', field: 'user_id', parent: 'auth.users', parentField: 'id', logical: false },
  { child: 'admin_audit_log', field: 'actor_id', parent: 'auth.users', parentField: 'id', logical: false },
  { child: 'caregivers', field: 'id', parent: 'auth.users', parentField: 'id', logical: true },
  { child: 'google_health_tokens', field: 'user_id', parent: 'auth.users', parentField: 'id', logical: true },
);
for (const ref of refs) {
  const child = tables.get(ref.child)?.find((field) => field.name === ref.field);
  const parent = tables.get(ref.parent)?.find((field) => field.name === ref.parentField);
  if (!child || !parent) throw new Error(`Unknown relationship ${ref.child}.${ref.field} -> ${ref.parent}.${ref.parentField}`);
  child[ref.logical ? 'logical' : 'fk'] = true;
}

const grid = [
  ['google_health_tokens', 'google_health_oauth_states', 'auth.users', 'profiles', 'user_access', 'admin_audit_log'],
  ['onboarding_progress', 'caregivers', 'elderly_profiles', 'wearable_sync_locations', 'vital_sign_logs', 'health_alerts'],
  ['caregiver_notifications', 'emergency_events', 'doctor_contacts', 'medication_schedules', 'medication_logs', 'appointments'],
  [null, 'caregiver_notes', 'ai_chatbot_sessions', 'ai_chatbot_messages', null, null],
];
const shown = grid.flat().filter(Boolean);
if (shown.length !== tables.size || new Set(shown).size !== tables.size || shown.some((name) => !tables.has(name))) {
  throw new Error('Each table must appear exactly once on the one-page ERD.');
}

const labels = {
  'ai_chatbot_messages.session_id': 'contains',
  'google_health_oauth_states.user_id': 'authorizes',
  'onboarding_progress.user_id': 'onboards',
  'profiles.id': 'has profile',
  'wearable_sync_locations.user_id': 'records',
  'ai_chatbot_sessions.caregiver_id': 'starts chat',
  'appointments.caregiver_id': 'books',
  'caregiver_notes.caregiver_id': 'writes',
  'caregiver_notifications.caregiver_id': 'receives',
  'doctor_contacts.caregiver_id': 'saves doctor',
  'elderly_profiles.caregiver_id': 'cares for',
  'emergency_events.responded_by': 'responds to',
  'health_alerts.resolved_by': 'resolves',
  'medication_logs.recorded_by': 'records dose',
  'medication_schedules.caregiver_id': 'manages',
  'ai_chatbot_sessions.elderly_id': 'discusses',
  'appointments.elderly_id': 'attends',
  'caregiver_notes.elderly_id': 'about',
  'caregiver_notifications.elderly_id': 'about',
  'doctor_contacts.elderly_id': 'doctor for',
  'emergency_events.elderly_id': 'experiences',
  'health_alerts.elderly_id': 'triggers',
  'medication_logs.elderly_id': 'tracks dose',
  'medication_schedules.elderly_id': 'prescribed',
  'vital_sign_logs.elderly_id': 'measured for',
  'wearable_sync_locations.elderly_id': 'located for',
  'caregiver_notifications.alert_id': 'prompts',
  'medication_logs.schedule_id': 'dose of',
  'user_access.user_id': 'has access',
  'admin_audit_log.actor_id': 'performs',
  'caregivers.id': 'account of',
  'google_health_tokens.user_id': 'connects',
};
if (refs.some((ref) => !labels[`${ref.child}.${ref.field}`])) throw new Error('A relationship is missing its diamond label.');

const pageWidth = 4400;
const pageHeight = 2570;
const left = 70;
const top = 200;
const colPitch = 710;
const rowPitch = 600;
const clusterWidth = 616;
const ovalWidth = 286;
const ovalHeight = 30;
const entityWidth = 210;
const entityHeight = 46;
const diamondWidth = 130;
const diamondHeight = 64;
const xml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const vertices = [];
const attributeEdges = [];
const relationshipEdges = [];
const positions = new Map();
const occupied = [];
const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${pageHeight}" viewBox="0 0 ${pageWidth} ${pageHeight}">`,
  '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" fill="#287238" /></marker><marker id="logical-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" fill="#478B56" /></marker></defs>',
  `<rect width="${pageWidth}" height="${pageHeight}" fill="#FFFFFF" />`,
];
const svgLinks = [];
const svgShapes = [];

function vertex(id, value, style, x, y, width, height) {
  vertices.push(`<mxCell id="${xml(id)}" value="${xml(value)}" style="${xml(style)}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry" /></mxCell>`);
}

function edge(id, sourceId, targetId, style, points = []) {
  const bends = points.length ? `<Array as="points">${points.map(([x, y]) => `<mxPoint x="${x}" y="${y}" />`).join('')}</Array>` : '';
  return `<mxCell id="${xml(id)}" value="" style="${xml(style)}" edge="1" parent="1" source="${xml(sourceId)}" target="${xml(targetId)}"><mxGeometry relative="1" as="geometry">${bends}</mxGeometry></mxCell>`;
}

function overlap(a, b, pad = 8) {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x
    && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}

vertex('title', 'ElderCareAI Database ERD', 'text;html=1;strokeColor=none;fillColor=none;align=left;fontFamily=Arial;fontSize=31;fontStyle=1;fontColor=#174D24;', left, 30, 2400, 44);
vertex('subtitle', 'Chen notation  |  21 entities  |  208 attributes  |  32 relationships', 'text;html=1;strokeColor=none;fillColor=none;align=left;fontFamily=Arial;fontSize=17;fontColor=#356E3F;', left, 77, 3100, 28);
vertex('legend', 'Rectangle = entity     Oval = attribute     Underlined = primary key     Darker oval = foreign key     Diamond = relationship (parent : child)     Arrow points to parent     Dashed = logical link', 'text;html=1;strokeColor=none;fillColor=none;align=left;fontFamily=Arial;fontSize=15;fontColor=#356E3F;', left, 118, 4200, 30);
svg.push(`<text x="${left}" y="69" font-family="Arial" font-size="31" font-weight="700" fill="#174D24">ElderCareAI Database ERD</text>`);
svg.push(`<text x="${left}" y="101" font-family="Arial" font-size="17" fill="#356E3F">Chen notation  |  21 entities  |  208 attributes  |  32 relationships</text>`);
svg.push(`<text x="${left}" y="139" font-family="Arial" font-size="15" fill="#356E3F">Rectangle = entity     Oval = attribute     Underlined = primary key     Darker oval = foreign key     Diamond = relationship (parent : child)     Arrow points to parent     Dashed = logical link</text>`);

const sections = ['IDENTITY AND ACCESS', 'PEOPLE AND HEALTH', 'CARE PLAN AND EVENTS', 'NOTES AND ELLE'];
grid.forEach((row, rowIndex) => {
  const baseY = top + rowIndex * rowPitch;
  vertex(`section-${rowIndex}`, sections[rowIndex], 'text;html=1;strokeColor=none;fillColor=none;align=left;fontFamily=Arial;fontSize=18;fontStyle=1;fontColor=#1D642B;', left, baseY - 35, 1800, 26);
  svgShapes.push(`<text x="${left}" y="${baseY - 15}" font-family="Arial" font-size="18" font-weight="700" fill="#1D642B">${sections[rowIndex]}</text>`);
  row.forEach((name, colIndex) => {
    if (!name) return;
    const fields = tables.get(name).map((field, index) => ({ ...field, index }))
      .sort((a, b) => Number(b.pk) - Number(a.pk) || Number(b.fk) - Number(a.fk) || a.index - b.index);
    const baseX = left + colIndex * colPitch;
    const entityX = baseX + 205;
    const entityY = baseY + 230;
    const id = `entity-${name.replaceAll('.', '-')}`;
    const entity = { x: entityX, y: entityY, w: entityWidth, h: entityHeight };
    occupied.push(entity);
    positions.set(name, { id, baseX, baseY, rowIndex, colIndex, cx: entityX + entityWidth / 2, cy: entityY + entityHeight / 2, entity });
    const entityStyle = 'rounded=0;whiteSpace=wrap;html=1;fillColor=#ABD99F;strokeColor=#237231;strokeWidth=2;align=center;verticalAlign=middle;fontFamily=Arial;fontSize=17;fontStyle=1;fontColor=#173F21;';
    vertex(id, name, entityStyle, entityX, entityY, entityWidth, entityHeight);
    svgShapes.push(`<rect x="${entityX}" y="${entityY}" width="${entityWidth}" height="${entityHeight}" fill="#ABD99F" stroke="#237231" stroke-width="2" />`);
    svgShapes.push(`<text x="${entityX + entityWidth / 2}" y="${entityY + 30}" text-anchor="middle" font-family="Arial" font-size="17" font-weight="700" fill="#173F21">${xml(name)}</text>`);

    const topCount = Math.ceil(fields.length / 2);
    fields.forEach((field, index) => {
      const isTop = index < topCount;
      const local = isTop ? index : index - topCount;
      const x = baseX + (local % 2 ? 330 : 0);
      const y = baseY + (isTop ? 18 : 310) + Math.floor(local / 2) * 35;
      const box = { x, y, w: ovalWidth, h: ovalHeight };
      occupied.push(box);
      if (x + ovalWidth > pageWidth - 30 || y + ovalHeight > pageHeight - 30) throw new Error(`Attribute outside page: ${name}.${field.name}`);
      const attrId = `${id}-${field.name}`;
      const marker = `${field.pk ? ' PK' : ''}${field.fk ? ' FK' : ''}${field.logical ? ' LINK' : ''}`;
      const fill = field.fk || field.logical ? '#D3EECB' : field.pk ? '#E3F4DF' : '#F1FAEF';
      const ovalStyle = `ellipse;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=#318044;strokeWidth=1.4;align=center;verticalAlign=middle;fontFamily=Arial;fontSize=14;fontStyle=${field.pk ? 4 : 0};fontColor=#193E24;`;
      vertex(attrId, `${field.name}${marker}`, ovalStyle, x, y, ovalWidth, ovalHeight);
      attributeEdges.push(edge(`attr-${name}-${field.name}`, id, attrId, 'edgeStyle=none;html=1;strokeColor=#82AD86;strokeWidth=1;endArrow=none;'));
      svgLinks.push(`<path d="M ${entityX + entityWidth / 2} ${isTop ? entityY : entityY + entityHeight} L ${x + ovalWidth / 2} ${isTop ? y + ovalHeight : y}" fill="none" stroke="#82AD86" stroke-width="1" />`);
      svgShapes.push(`<ellipse cx="${x + ovalWidth / 2}" cy="${y + ovalHeight / 2}" rx="${ovalWidth / 2}" ry="${ovalHeight / 2}" fill="${fill}" stroke="#318044" stroke-width="1.4" />`);
      svgShapes.push(`<text x="${x + ovalWidth / 2}" y="${y + 20}" text-anchor="middle" font-family="Arial" font-size="14" ${field.pk ? 'text-decoration="underline" font-weight="700"' : ''} fill="#193E24">${xml(field.name + marker)}</text>`);
    });
  });
});

function placeDiamond(ref) {
  const child = positions.get(ref.child);
  const parent = positions.get(ref.parent);
  const adjacent = child.rowIndex === parent.rowIndex && Math.abs(child.colIndex - parent.colIndex) === 1;
  const preferredX = (child.cx + parent.cx) / 2;
  const preferredY = adjacent ? child.cy : top + Math.min(child.rowIndex, parent.rowIndex) * rowPitch + 520;
  const shifts = [0];
  for (let step = 1; step <= 26; step++) shifts.push(-step * 138, step * 138);
  for (const yShift of [0, -35, 35, -70, 70]) {
    for (const xShift of shifts) {
      const x = Math.round(preferredX + xShift - diamondWidth / 2);
      const y = Math.round(preferredY + yShift - diamondHeight / 2);
      const box = { x, y, w: diamondWidth, h: diamondHeight };
      if (x < 35 || y < 165 || x + diamondWidth > pageWidth - 35 || y + diamondHeight > pageHeight - 30) continue;
      if (occupied.some((other) => overlap(box, other))) continue;
      occupied.push(box);
      return { ...box, cx: x + diamondWidth / 2, cy: y + diamondHeight / 2 };
    }
  }
  throw new Error(`No clear space for relationship ${ref.child}.${ref.field}`);
}

function routeBetween(entity, diamond, offset, direct) {
  const right = diamond.cx >= entity.cx;
  const startX = right ? entity.entity.x + entityWidth : entity.entity.x;
  const endX = right ? diamond.x : diamond.x + diamondWidth;
  if (direct) return [[startX, entity.cy], [endX, diamond.cy]];
  const busX = right ? entity.baseX + clusterWidth + offset : entity.baseX - offset;
  return [[startX, entity.cy], [busX, entity.cy], [busX, diamond.cy], [endX, diamond.cy]];
}

const orderedRefs = refs.map((ref, index) => ({ ...ref, index })).sort((a, b) => {
  const aChild = positions.get(a.child); const aParent = positions.get(a.parent);
  const bChild = positions.get(b.child); const bParent = positions.get(b.parent);
  const aDistance = Math.abs(aChild.rowIndex - aParent.rowIndex) * 10 + Math.abs(aChild.colIndex - aParent.colIndex);
  const bDistance = Math.abs(bChild.rowIndex - bParent.rowIndex) * 10 + Math.abs(bChild.colIndex - bParent.colIndex);
  return aDistance - bDistance || a.index - b.index;
});
for (const ref of orderedRefs) {
  const child = positions.get(ref.child);
  const parent = positions.get(ref.parent);
  const diamond = placeDiamond(ref);
  const id = `relationship-${ref.index}`;
  const field = tables.get(ref.child).find((item) => item.name === ref.field);
  const cardinality = field.pk || field.unique ? '1 : 1' : '1 : M';
  const label = labels[`${ref.child}.${ref.field}`];
  const fill = ref.logical ? '#E9F8E6' : '#D9F1D0';
  const diamondStyle = `rhombus;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=#237231;strokeWidth=1.8;align=center;verticalAlign=middle;fontFamily=Arial;fontSize=13;fontStyle=1;fontColor=#173F21;`;
  vertex(id, `${label}<br/>${cardinality}`, diamondStyle, diamond.x, diamond.y, diamondWidth, diamondHeight);
  svgShapes.push(`<polygon points="${diamond.cx},${diamond.y} ${diamond.x + diamondWidth},${diamond.cy} ${diamond.cx},${diamond.y + diamondHeight} ${diamond.x},${diamond.cy}" fill="${fill}" stroke="#237231" stroke-width="1.8" />`);
  svgShapes.push(`<text x="${diamond.cx}" y="${diamond.cy - 3}" text-anchor="middle" font-family="Arial" font-size="13" font-weight="700" fill="#173F21">${xml(label)}</text>`);
  svgShapes.push(`<text x="${diamond.cx}" y="${diamond.cy + 14}" text-anchor="middle" font-family="Arial" font-size="12" fill="#356E3F">${cardinality}</text>`);

  const direct = child.rowIndex === parent.rowIndex && Math.abs(child.colIndex - parent.colIndex) === 1 && diamond.cy === child.cy;
  const toDiamond = routeBetween(child, diamond, 25 + (ref.index % 4) * 8, direct);
  const fromDiamond = routeBetween(parent, diamond, 25 + ((ref.index + 2) % 4) * 8, direct).reverse();
  const color = ref.logical ? '#478B56' : '#287238';
  const common = `edgeStyle=none;html=1;strokeColor=${color};strokeWidth=${ref.logical ? 1.5 : 1.2};${ref.logical ? 'dashed=1;dashPattern=6 4;' : ''}`;
  relationshipEdges.push(edge(`${id}-child`, child.id, id, `${common}endArrow=none;`, toDiamond.slice(1, -1)));
  relationshipEdges.push(edge(`${id}-parent`, id, parent.id, `${common}endArrow=classicThin;endFill=1;`, fromDiamond.slice(1, -1)));
  const svgPath = (points) => points.map(([x, y], index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ');
  svgLinks.push(`<path d="${svgPath(toDiamond)}" fill="none" stroke="${color}" stroke-width="${ref.logical ? 1.5 : 1.2}" ${ref.logical ? 'stroke-dasharray="6 4"' : ''} />`);
  svgLinks.push(`<path d="${svgPath(fromDiamond)}" fill="none" stroke="${color}" stroke-width="${ref.logical ? 1.5 : 1.2}" ${ref.logical ? 'stroke-dasharray="6 4"' : ''} marker-end="url(#${ref.logical ? 'logical-arrow' : 'arrow'})" />`);
}

const model = `<mxGraphModel dx="1600" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${pageWidth}" pageHeight="${pageHeight}" math="0" shadow="0"><root><mxCell id="0" /><mxCell id="1" parent="0" />${attributeEdges.join('')}${relationshipEdges.join('')}${vertices.join('')}</root></mxGraphModel>`;
const drawio = `<?xml version="1.0" encoding="UTF-8"?><mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="ElderCareAI one-page Chen ERD" version="24.7.17" type="device"><diagram id="one-page-chen" name="ElderCareAI Chen ERD">${model}</diagram></mxfile>`;
writeFileSync(resolve(root, 'docs/ELDERCAREAI_ERD_ONE_PAGE.drawio'), drawio, 'utf8');
writeFileSync(resolve(root, 'docs/ELDERCAREAI_ERD_ONE_PAGE.svg'), [...svg, ...svgLinks, ...svgShapes, '</svg>'].join(''), 'utf8');
console.log(`Generated one-page Chen ERD: ${tables.size} entities, ${[...tables.values()].reduce((sum, fields) => sum + fields.length, 0)} oval attributes, ${refs.length} diamond relationships.`);
