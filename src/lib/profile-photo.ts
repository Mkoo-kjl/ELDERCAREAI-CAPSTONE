import { supabase } from '@/src/lib/supabase';
import type { LocalPhoto } from '@/src/components/ProfilePhotoPicker';

export async function uploadProfilePhoto(userId: string, kind: 'caregiver' | 'elderly' | 'doctor', photo: LocalPhoto) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error('Profile photo upload failed: your session expired. Please sign in again.');
  }
  if (authData.user.id !== userId) {
    throw new Error('Profile photo upload failed: the active account does not own this profile.');
  }

  const mimeType = photo.mimeType ?? 'image/jpeg';
  const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const path = `${authData.user.id}/${kind}-${Date.now()}.${extension}`;
  const response = await fetch(photo.uri);
  if (!response.ok) throw new Error('Profile photo upload failed: the selected image could not be read.');
  const arrayBuffer = await response.arrayBuffer();

  // Every photo uses a new path, so this is a plain INSERT. Setting upsert=true
  // unnecessarily makes Storage evaluate SELECT/UPDATE permissions as well.
  const { error } = await supabase.storage.from('profile-photos').upload(path, arrayBuffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw new Error(`Profile photo upload failed: ${error.message}`);

  return supabase.storage.from('profile-photos').getPublicUrl(path).data.publicUrl;
}
