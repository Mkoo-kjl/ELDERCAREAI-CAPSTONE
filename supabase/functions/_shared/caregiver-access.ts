import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export async function isActiveCaregiver(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin.from('user_access').select('role, status').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.role === 'caregiver' && data.status === 'active';
}
