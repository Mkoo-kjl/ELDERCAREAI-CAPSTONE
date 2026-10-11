import { adminPortalRedirect, cleanText, editableCaregiver, editableElderly, normalizeAdminEmail, patientPhotoPath, requireUuid, safeDateRange } from '@/supabase/functions/_shared/admin-security';

describe('admin request validation', () => {
  it('validates invited admin addresses and HTTPS portal redirects', () => {
    expect(normalizeAdminEmail('  JAWEPLANOS22@GMAIL.COM ')).toBe('jaweplanos22@gmail.com');
    expect(() => normalizeAdminEmail('not-an-email')).toThrow('Enter a valid admin email.');
    expect(adminPortalRedirect('https://eldercare.example/edcadmin/')).toBe('https://eldercare.example/edcadmin/');
    expect(() => adminPortalRedirect('http://eldercare.example/edcadmin/')).toThrow();
    expect(() => adminPortalRedirect('https://eldercare.example/not-admin/')).toThrow();
    expect(() => adminPortalRedirect('https://eldercare.example/edcadmin/?token=abc')).toThrow();
  });
  it('accepts record UUIDs and rejects arbitrary identifiers', () => {
    expect(requireUuid('a1b2c3d4-1234-4123-8123-123456789abc')).toBe('a1b2c3d4-1234-4123-8123-123456789abc');
    expect(() => requireUuid('all')).toThrow('Invalid record ID.');
    expect(() => requireUuid("' or true")).toThrow('Invalid record ID.');
  });

  it('only returns editable caregiver fields, not caller-supplied permissions', () => {
    expect(editableCaregiver({ full_name: '  Ana Cruz  ', phone: '', role: 'admin', status: 'active', id: 'other' }))
      .toEqual({ full_name: 'Ana Cruz', phone: null });
    expect(() => cleanText('', 120, true)).toThrow('A valid name is required.');
  });

  it('only returns editable patient fields and validates age', () => {
    expect(editableElderly({ full_name: 'Maria', age: '78', caregiver_id: 'other', medical_conditions: 'Hypertension' }))
      .toEqual({ full_name: 'Maria', age: 78, gender: null, emergency_contact: null, emergency_contact_phone: null, medical_conditions: 'Hypertension' });
    expect(() => editableElderly({ full_name: 'Maria', age: -1 })).toThrow('Age must be between 0 and 125.');
  });

  it('rejects malformed and oversized report ranges', () => {
    expect(safeDateRange('2026-10-01', '2026-10-07')).toEqual({ from: '2026-10-01T00:00:00.000Z', to: '2026-10-07T23:59:59.999Z' });
    expect(safeDateRange('2026-01-01', '2026-03-31').to).toBe('2026-03-31T23:59:59.999Z');
    expect(() => safeDateRange('2026-01-01', '2026-04-01')).toThrow('Reports must cover no more than 90 days.');
    expect(() => safeDateRange('2026-02-31', '2026-03-01')).toThrow();
    expect(() => safeDateRange('2026-01-01', '2026-06-01')).toThrow();
  });

  it('only selects an elderly photo in the correct caregiver folder and project', () => {
    const project = 'https://example.supabase.co';
    const folder = 'a1b2c3d4-1234-4123-8123-123456789abc';
    const photo = `${project}/storage/v1/object/public/profile-photos/${folder}/elderly-123.jpg`;
    expect(patientPhotoPath(photo, folder, project)).toBe(`${folder}/elderly-123.jpg`);
    expect(patientPhotoPath(photo, 'a1b2c3d4-1234-4123-8123-000000000000', project)).toBeNull();
    expect(patientPhotoPath(photo.replace(project, 'https://elsewhere.example'), folder, project)).toBeNull();
    expect(patientPhotoPath(photo.replace('elderly-123.jpg', 'caregiver-123.jpg'), folder, project)).toBeNull();
    expect(patientPhotoPath(null, folder, project)).toBeNull();
  });
});
