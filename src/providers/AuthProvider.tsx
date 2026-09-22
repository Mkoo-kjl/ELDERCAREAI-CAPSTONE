import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { createSessionFromUrl } from '@/src/lib/auth-callback';
import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URI = Linking.createURL('auth/callback', { scheme: 'eldercareai' });

export type OnboardingProgress = {
  user_id: string;
  caregiver_completed_at: string | null;
  elderly_completed_at: string | null;
  wearable_status: 'not_started' | 'connected' | 'authorized_no_device' | 'skipped' | 'error';
  paired_device_count: number;
  wearable_completed_at: string | null;
  location_permission: 'not_requested' | 'granted' | 'denied';
  location_consent_at: string | null;
  completed_at: string | null;
};

type AuthContextValue = {
  session: Session | null;
  onboarding: OnboardingProgress | null;
  isLoading: boolean;
  isOnboardingLoading: boolean;
  isSigningIn: boolean;
  authError: string | null;
  redirectUri: string;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshOnboarding: () => Promise<OnboardingProgress | null>;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function syncAuthenticatedUser(session: Session) {
  const { user } = session;
  const metadata = user.user_metadata ?? {};
  const fullName = metadata.full_name ?? metadata.name ?? user.email?.split('@')[0] ?? 'Caregiver';
  const avatarUrl = metadata.avatar_url ?? metadata.picture ?? null;

  const { data: existingCaregiver } = await supabase
    .from('caregivers')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  const caregiverWrite = existingCaregiver
    ? supabase.from('caregivers').update({
      email: user.email,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id)
    : supabase.from('caregivers').insert({
      id: user.id,
      email: user.email,
      full_name: fullName,
      photo_url: avatarUrl,
      updated_at: new Date().toISOString(),
    });

  const [profileResult, caregiverResult, progressResult] = await Promise.all([
    supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: fullName,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' }),
    caregiverWrite,
    supabase.from('onboarding_progress').upsert({ user_id: user.id }, { onConflict: 'user_id' }),
  ]);

  [profileResult.error, caregiverResult.error, progressResult.error].forEach((error) => {
    if (error) console.warn('Authenticated user sync warning:', error.message);
  });
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const handledUrls = useRef(new Set<string>());
  const sessionRef = useRef<Session | null>(null);

  const loadOnboarding = useCallback(async (activeSession: Session | null) => {
    if (!activeSession) {
      setOnboarding(null);
      setIsOnboardingLoading(false);
      return null;
    }

    setIsOnboardingLoading(true);
    const { data, error } = await supabase
      .from('onboarding_progress')
      .select('user_id, caregiver_completed_at, elderly_completed_at, wearable_status, paired_device_count, wearable_completed_at, location_permission, location_consent_at, completed_at')
      .eq('user_id', activeSession.user.id)
      .maybeSingle();

    if (error) {
      console.warn('Unable to load onboarding progress:', error.message);
      setOnboarding(null);
    } else {
      setOnboarding((data as OnboardingProgress | null) ?? null);
    }
    setIsOnboardingLoading(false);
    return (data as OnboardingProgress | null) ?? null;
  }, []);

  const refreshOnboarding = useCallback(
    () => loadOnboarding(sessionRef.current),
    [loadOnboarding],
  );

  const initializeSession = useCallback(async (nextSession: Session | null) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
    if (nextSession) await syncAuthenticatedUser(nextSession);
    await loadOnboarding(nextSession);
    setIsLoading(false);
  }, [loadOnboarding]);

  const handleCallbackUrl = useCallback(async (url: string) => {
    if (!url || handledUrls.current.has(url)) return;
    handledUrls.current.add(url);
    try {
      setAuthError(null);
      await createSessionFromUrl(url);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to complete sign in.');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) setAuthError(error.message);
      void initializeSession(data.session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setTimeout(() => void initializeSession(nextSession), 0);
    });

    Linking.getInitialURL().then((url) => {
      if (url) void handleCallbackUrl(url);
    });
    const linkingListener = Linking.addEventListener('url', ({ url }) => {
      void handleCallbackUrl(url);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      linkingListener.remove();
    };
  }, [handleCallbackUrl, initializeSession]);

  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setAuthError('Add your Supabase URL and publishable key to .env, then restart Expo.');
      return false;
    }
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: REDIRECT_URI,
          skipBrowserRedirect: true,
          queryParams: { access_type: 'offline', prompt: 'consent select_account' },
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error('Supabase did not return an OAuth URL.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI, { showInRecents: true });
      if (result.type === 'success') {
        await handleCallbackUrl(result.url);
        return true;
      }
      if (result.type !== 'cancel' && result.type !== 'dismiss') {
        throw new Error('Google sign in did not complete. Please try again.');
      }
      return false;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign in with Google.');
      return false;
    } finally {
      setIsSigningIn(false);
    }
  }, [handleCallbackUrl]);

  const signOut = useCallback(async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError(error.message);
  }, []);

  const value = useMemo(() => ({
    session,
    onboarding,
    isLoading,
    isOnboardingLoading,
    isSigningIn,
    authError,
    redirectUri: REDIRECT_URI,
    signInWithGoogle,
    signOut,
    refreshOnboarding,
    clearAuthError: () => setAuthError(null),
  }), [authError, isLoading, isOnboardingLoading, isSigningIn, onboarding, refreshOnboarding, session, signInWithGoogle, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
