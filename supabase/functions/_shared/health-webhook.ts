const watchedDataTypes = new Set([
  'heart-rate',
  'oxygen-saturation',
  'daily-oxygen-saturation',
  'sleep',
  'steps',
  'daily-sleep-temperature-derivations',
  'heart-rate-variability',
]);

export function webhookHealthUsers(payload: unknown) {
  const notifications = Array.isArray(payload) ? payload : [payload];
  const users = new Set<string>();
  for (const notification of notifications) {
    const data = notification?.data;
    if ((data?.operation === 'UPSERT' || data?.operation === 'DELETE')
      && watchedDataTypes.has(data?.dataType)
      && typeof data?.healthUserId === 'string'
      && data.healthUserId.length > 0) {
      users.add(data.healthUserId);
    }
  }
  return [...users];
}

export function matchesWebhookSecret(received: string | null, expected: string) {
  if (!received || !expected) return false;
  const left = new TextEncoder().encode(received);
  const right = new TextEncoder().encode(expected);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}
