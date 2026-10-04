import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { ElderlyProfile, VitalLog } from '@/src/providers/HealthDataProvider';

type MedicationReportRow = {
  medication_name: string;
  dosage: string | null;
  form: string | null;
  frequency: string;
  times_of_day: string[] | null;
  start_date: string | null;
  end_date: string | null;
  instructions: string | null;
  prescribed_by: string | null;
  is_active: boolean | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
function shown(value: unknown, suffix = '') { return value === null || value === undefined || value === '' ? '—' : `${escapeHtml(value)}${suffix}`; }
let cachedLogoDataUri: string | null | undefined;
async function elderCareLogoDataUri() {
  if (cachedLogoDataUri !== undefined) return cachedLogoDataUri;
  try {
    const asset = Asset.fromModule(require('../../assets/images/eldercare-logo.png'));
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    cachedLogoDataUri = `data:image/png;base64,${base64}`;
  } catch {
    cachedLogoDataUri = null;
  }
  return cachedLogoDataUri;
}
function reportShell(title: string, subtitle: string, patient: ElderlyProfile, caregiverName: string, content: string, footnote: string, logoDataUri: string | null) {
  const generatedAt = new Date();
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    @page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#0F172A;margin:0;font-size:10px}.brand{display:flex;align-items:center;border-bottom:3px solid #38BDF8;padding-bottom:12px}.mark{width:50px;height:50px;border-radius:14px;background:#fff;border:1px solid #DCECF5;overflow:hidden;color:#38BDF8;font-size:24px;font-weight:800;display:flex;align-items:center;justify-content:center}.mark img{width:100%;height:100%;object-fit:contain}.brand-copy{margin-left:11px}.brand-name{font-size:20px;font-weight:800}.brand-name span{color:#38BDF8}.brand-tag{color:#64748B;margin-top:2px}.report-title{font-size:22px;font-weight:800;margin:22px 0 3px}.report-subtitle{font-size:11px;color:#64748B}.meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:15px 0 18px}.meta-card{background:#F1F5F9;border:1px solid #E2E8F0;border-radius:10px;padding:9px}.meta-label{font-size:7px;font-weight:800;letter-spacing:.8px;color:#64748B;text-transform:uppercase}.meta-value{font-size:10px;font-weight:700;margin-top:4px;line-height:1.35}.section-title{font-size:11px;font-weight:800;letter-spacing:.5px;margin:16px 0 7px;text-transform:uppercase}table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #CBD5E1;border-radius:9px;overflow:hidden}th{background:#162544;color:#fff;text-align:left;font-size:7px;letter-spacing:.35px;text-transform:uppercase;padding:7px 5px}td{padding:7px 5px;border-top:1px solid #E2E8F0;vertical-align:top;line-height:1.35}tr:nth-child(even) td{background:#F8FAFC}.status{font-weight:800}.normal{color:#0F9F2A}.warning{color:#D97706}.receipt{margin-top:16px;padding:12px;border:1px dashed #94A3B8;border-radius:10px;background:#F8FAFC}.receipt-row{display:flex;justify-content:space-between;padding:3px 0}.receipt-label{color:#64748B}.receipt-value{font-weight:700}.note{margin-top:16px;border-left:4px solid #F59E0B;padding:9px 11px;background:#FFFBEB;line-height:1.5}.footer{margin-top:22px;padding-top:9px;border-top:1px solid #E2E8F0;color:#64748B;font-size:8px;display:flex;justify-content:space-between}.nowrap{white-space:nowrap}
  </style></head><body><div class="brand"><div class="mark">${logoDataUri ? `<img src="${logoDataUri}" alt="ElderCareAI logo"/>` : 'E'}</div><div class="brand-copy"><div class="brand-name">ElderCare<span>AI</span></div><div class="brand-tag">Smart care for your loved ones</div></div></div><div class="report-title">${escapeHtml(title)}</div><div class="report-subtitle">${escapeHtml(subtitle)}</div><div class="meta"><div class="meta-card"><div class="meta-label">Older adult</div><div class="meta-value">${escapeHtml(patient.full_name)}<br>${shown(patient.age, ' years')} • ${shown(patient.gender)}</div></div><div class="meta-card"><div class="meta-label">Prepared by</div><div class="meta-value">${escapeHtml(caregiverName || 'Caregiver')}<br>${escapeHtml(generatedAt.toLocaleString())}</div></div><div class="meta-card"><div class="meta-label">Profile details</div><div class="meta-value">${shown(patient.blood_type)} blood type<br>${shown(patient.weight_kg, ' kg')} • ${shown(patient.height_cm, ' cm')}</div></div></div>${content}<div class="note">${escapeHtml(footnote)}</div><div class="footer"><span>ElderCareAI • Confidential caregiver report</span><span>Generated ${escapeHtml(generatedAt.toLocaleDateString())}</span></div></body></html>`;
}

async function sharePdf(html: string, dialogTitle: string) {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
  else await Print.printAsync({ uri });
}

export async function exportHealthReportPdf({ patient, caregiverName, history }: { patient: ElderlyProfile; caregiverName: string; history: VitalLog[] }) {
  const rows = history.map((item) => `<tr><td class="nowrap">${escapeHtml(new Date(item.recorded_at).toLocaleString())}</td><td>${shown(item.heart_rate_bpm)}</td><td>${shown(item.spo2_percent)}</td><td>${shown(item.sleep_hours)}</td><td>${shown(item.steps_count)}</td><td>${shown(item.skin_temp_celsius)}</td><td>${shown(item.hrv_rmssd_ms)}</td><td class="status ${item.overall_status === 'warning' ? 'warning' : 'normal'}">${escapeHtml(item.overall_status ?? '—')}</td></tr>`).join('');
  const latest = history[0];
  const content = `<div class="section-title">Synchronized vital history</div><table><thead><tr><th>Date & time</th><th>HR<br>bpm</th><th>SpO₂<br>%</th><th>Sleep<br>h</th><th>Steps<br>24h</th><th>Skin<br>°C</th><th>HRV<br>ms</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><div class="receipt"><div class="receipt-row"><span class="receipt-label">Records included</span><span class="receipt-value">${history.length}</span></div><div class="receipt-row"><span class="receipt-label">Latest synchronization</span><span class="receipt-value">${latest ? escapeHtml(new Date(latest.synced_at ?? latest.recorded_at).toLocaleString()) : '—'}</span></div><div class="receipt-row"><span class="receipt-label">Data source</span><span class="receipt-value">Google Health API v4</span></div></div>`;
  const logoDataUri = await elderCareLogoDataUri();
  await sharePdf(reportShell('Health Vitals Report', 'Organized history of synchronized wearable readings', patient, caregiverName, content, 'Wearable measurements and ElderCareAI statistical analysis are informational and are not a medical diagnosis. Overnight skin temperature is measured during sleep and is not a current body-temperature or fever reading.', logoDataUri), 'Share ElderCareAI health report');
}

export async function exportMedicationReportPdf({ patient, caregiverName, medications }: { patient: ElderlyProfile; caregiverName: string; medications: MedicationReportRow[] }) {
  const rows = medications.map((item) => `<tr><td><strong>${escapeHtml(item.medication_name)}</strong><br><span style="color:#64748B">${shown(item.form)}</span></td><td>${shown(item.dosage)}</td><td>${escapeHtml(item.frequency)}<br><span style="color:#64748B">${item.times_of_day?.length ? escapeHtml(item.times_of_day.join(', ')) : 'No times listed'}</span></td><td>${shown(item.start_date)}<br>to ${shown(item.end_date)}</td><td>${shown(item.instructions)}</td><td>${shown(item.prescribed_by)}</td><td class="status ${item.is_active ? 'normal' : ''}">${item.is_active ? 'Active' : 'Inactive'}</td></tr>`).join('');
  const activeCount = medications.filter((item) => item.is_active).length;
  const content = `<div class="section-title">Medication schedule</div><table><thead><tr><th>Medication</th><th>Dosage</th><th>Schedule</th><th>Date range</th><th>Instructions</th><th>Prescriber</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><div class="receipt"><div class="receipt-row"><span class="receipt-label">Medications listed</span><span class="receipt-value">${medications.length}</span></div><div class="receipt-row"><span class="receipt-label">Active schedules</span><span class="receipt-value">${activeCount}</span></div><div class="receipt-row"><span class="receipt-label">Inactive schedules</span><span class="receipt-value">${medications.length - activeCount}</span></div></div>`;
  const logoDataUri = await elderCareLogoDataUri();
  await sharePdf(reportShell('Medication Schedule', 'Caregiver-ready medication list and instructions', patient, caregiverName, content, 'Confirm this exported schedule against the medication label and current prescriber instructions. This report does not replace professional medication advice.', logoDataUri), 'Share ElderCareAI medication report');
}
