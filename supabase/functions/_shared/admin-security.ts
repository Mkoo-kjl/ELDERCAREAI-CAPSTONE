const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error('Invalid record ID.');
  return value;
}

export function normalizeAdminEmail(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Enter a valid admin email.');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email)) {
    throw new Error('Enter a valid admin email.');
  }
  return email;
}

export function adminPortalRedirect(value: string | undefined): string {
  try {
    if (!value) throw new Error('Missing portal URL.');
    const url = new URL(value);
    if (url.protocol === 'https:' && url.pathname === '/edcadmin/' && !url.username && !url.password && !url.search && !url.hash) {
      return url.toString();
    }
  } catch { /* Missing or malformed deployment URL. */ }
  throw new Error('Configure a valid admin portal URL before inviting an administrator.');
}

export function patientPhotoPath(photoUrl: string | null, caregiverId: string, projectUrl: string): string | null {
  if (!photoUrl) return null;
  try {
    const photo = new URL(photoUrl);
    if (photo.origin !== new URL(projectUrl).origin) return null;
    const prefix = `/storage/v1/object/public/profile-photos/${caregiverId}/`;
    if (!photo.pathname.startsWith(prefix)) return null;
    const name = decodeURIComponent(photo.pathname.slice(prefix.length));
    return /^elderly-[a-zA-Z0-9.-]+$/.test(name) ? `${caregiverId}/${name}` : null;
  } catch { return null; }
}

export function cleanText(value: unknown, max: number, required = false): string | null {
  if (value !== null && value !== undefined && typeof value !== 'string') throw new Error('Invalid text value.');
  const text = (value ?? '').trim();
  if (text.length > max || (required && !text)) throw new Error(required ? 'A valid name is required.' : 'Text is too long.');
  return text || null;
}

export function safeDateRange(from: unknown, to: unknown): { from: string; to: string } {
  if (typeof from !== 'string' || typeof to !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error('Choose a valid start and end date.');
  }
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T23:59:59.999Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)
    || new Date(start).toISOString().slice(0, 10) !== from
    || new Date(end).toISOString().slice(0, 10) !== to
    || end < start || end - start >= 90 * 86400000) {
    throw new Error('Reports must cover no more than 90 days.');
  }
  return { from: new Date(start).toISOString(), to: new Date(end).toISOString() };
}

export function editableCaregiver(input: Record<string, unknown>) {
  return {
    full_name: cleanText(input.full_name, 120, true),
    phone: cleanText(input.phone, 40),
  };
}

export function editableElderly(input: Record<string, unknown>) {
  const age = input.age === '' || input.age === null || input.age === undefined ? null : Number(input.age);
  if (age !== null && (!Number.isInteger(age) || age < 0 || age > 125)) throw new Error('Age must be between 0 and 125.');
  return {
    full_name: cleanText(input.full_name, 120, true),
    age,
    gender: cleanText(input.gender, 40),
    emergency_contact: cleanText(input.emergency_contact, 120),
    emergency_contact_phone: cleanText(input.emergency_contact_phone, 40),
    medical_conditions: cleanText(input.medical_conditions, 2000),
  };
}
