import { supabase } from '@/src/lib/supabase';

function getCallbackParams(url: string) {
  const query = url.includes('?') ? url.split('?')[1]?.split('#')[0] : '';
  const hash = url.includes('#') ? url.split('#')[1] : '';
  return new URLSearchParams([query, hash].filter(Boolean).join('&'));
}

export async function createSessionFromUrl(url: string) {
  const params = getCallbackParams(url);
  const errorDescription = params.get('error_description') ?? params.get('error');

  if (errorDescription) {
    throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
  }

  const code = params.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }

  // This fallback also supports an implicit-flow callback if a Supabase project
  // has not yet been switched to PKCE.
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return data.session;
  }

  return null;
}
