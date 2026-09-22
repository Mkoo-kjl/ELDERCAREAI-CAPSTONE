export function relativeTime(value?: string | null) {
  if (!value) return 'No reading';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Read just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Read ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Read ${hours}h ago`;
  return `Read ${Math.floor(hours / 24)}d ago`;
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}
