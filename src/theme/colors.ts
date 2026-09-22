export const palette = {
  primary: '#38BDF8',
  primaryDark: '#2DA3DC',
  accent: '#14CD2F',
  accentDark: '#10B526',
  background: '#FFFFFF',
  backgroundDark: '#0F172A',
  card: '#F1F5F9',
  cardDark: '#1E293B',
  cardElevated: '#FFFFFF',
  cardElevatedDark: '#243049',
  text: '#0F172A',
  textDark: '#F1F5F9',
  subtitle: '#64748B',
  subtitleDark: '#94A3B8',
  border: '#E2E8F0',
  borderDark: '#334155',
  error: '#EF4444',
  warning: '#F59E0B',
  purple: '#8B5CF6',
  pink: '#EC4899',
  google: '#4285F4',
  googleDark: '#3367D6',
} as const;

export function getTheme(isDark: boolean) {
  return {
    background: isDark ? palette.backgroundDark : palette.background,
    card: isDark ? palette.cardDark : palette.card,
    cardElevated: isDark ? palette.cardElevatedDark : palette.cardElevated,
    text: isDark ? palette.textDark : palette.text,
    subtitle: isDark ? palette.subtitleDark : palette.subtitle,
    border: isDark ? palette.borderDark : palette.border,
  };
}
