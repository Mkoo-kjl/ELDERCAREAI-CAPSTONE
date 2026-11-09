export type LocalCareNotice = {
  id: string;
  title: string;
  body: string;
  elderly_id: string;
  sent_at: string;
  data: {care_kind: 'medication' | 'appointment'; url: string; entityId: string};
};

/** Only locally scheduled, account-scoped reminders may bypass remote registration. */
export function localCareNotice(notification: {
  date: number;
  request: {identifier: string; content: {title?: string | null; body?: string | null; data?: Record<string, unknown>}};
}, caregiver: string, patient: string): LocalCareNotice | null {
  const {request, date} = notification, data = request.content.data;
  if (data?.care_local_version !== 3 || data.caregiver_id !== caregiver || data.elderly_id !== patient
    || !['medication', 'appointment'].includes(String(data.care_kind))
    || typeof data.entityId !== 'string' || !data.entityId || !request.identifier
    || !Number.isFinite(date) || !request.content.title || !request.content.body) return null;
  const kind = data.care_kind as 'medication' | 'appointment';
  return {
    // Repeating alarms have one request ID but a different delivery date each day.
    id: `local:${request.identifier}:${date}`,
    title: request.content.title,
    body: request.content.body,
    elderly_id: patient,
    sent_at: new Date(date).toISOString(),
    data: {care_kind: kind, entityId: data.entityId, url: kind === 'medication' ? '/care?tab=Medications' : '/care?tab=Appointments'},
  };
}
