import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { isConfigured, supabase } from '../lib/supabase.js'
import { useI18n, translate } from '../i18n/index.jsx'

const AuthContext = createContext(null)

// Auth requests are single-flight. No automatic retry/backoff is performed here:
// a second attempt must be an explicit user action after the first one settles.
const authInFlight = { signUp: false, signIn: false, signOut: false, resetPassword: false, updatePassword: false }

async function singleAuthRequest(kind, message, request) {
  if (authInFlight[kind]) throw new Error(message)
  authInFlight[kind] = true
  try {
    return await request()
  } finally {
    authInFlight[kind] = false
  }
}

function friendlyAuthError(error) {
  const m = (error?.message || '').toLowerCase()
  if (m.includes('invalid login')) return translate('Email or password is incorrect.')
  if (m.includes('already registered') || m.includes('already been registered')) return translate('An account with this email already exists.')
  if (m.includes('email not confirmed')) return translate('Confirm your email first. Check your inbox.')
  if (m.includes('password') && m.includes('characters')) return translate('Use a stronger password (at least 8 characters).')
  if (m.includes('rate limit') || m.includes('too many')) return translate('Too many attempts. Wait a minute and try again.')
  if (m.includes('fetch') || m.includes('network')) return translate('Network problem. Check your connection and try again.')
  return translate('Something went wrong. Try again.')
}

export function AuthProvider({ children }) {
  const { t } = useI18n()
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [loading, setLoading] = useState(isConfigured)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    if (!isConfigured) return undefined
    let active = true
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setProfileError(t('Unable to restore your session. Please refresh or sign in again.'))
        setSession(data?.session ?? null)
      })
      .catch(() => {
        if (active) setProfileError(t('Unable to connect to authentication. Check your connection and retry.'))
      })
      .finally(() => { if (active) setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  const userId = session?.user?.id
  useEffect(() => {
    if (!isConfigured || !userId) { setProfile(null); setProfileLoading(false); setProfileError(''); return }
    let active = true
    setProfileLoading(true)
    setProfileError('')
    supabase.from('profiles').select('*').eq('id', userId).single()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setProfile(null)
          setProfileError(t('Your account profile could not be loaded. Please retry.'))
        } else setProfile(data)
      })
      .catch(() => {
        if (active) { setProfile(null); setProfileError(t('Your account profile could not be loaded. Please retry.')) }
      })
      .finally(() => { if (active) setProfileLoading(false) })
    return () => { active = false }
  }, [userId])

  const value = useMemo(() => ({
    configured: isConfigured,
    loading,
    user: session?.user ?? null,
    profile,
    profileLoading,
    profileError,
    isAdmin: profile?.role === 'admin',
    isSuspended: Boolean(profile?.is_suspended),
    recovery,
    async signUp({ name, email, password }) {
      return singleAuthRequest('signUp', t('A signup request is already in progress. Please wait for it to finish.'), async () => {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: `${window.location.origin}/login` },
        })
        if (error) throw new Error(friendlyAuthError(error))
        return { needsConfirmation: !data.session }
      })
    },
    async signIn({ email, password }) {
      return singleAuthRequest('signIn', t('A login request is already in progress. Please wait for it to finish.'), async () => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw new Error(friendlyAuthError(error))
      })
    },
    async signOut() {
      return singleAuthRequest('signOut', t('A sign-out request is already in progress. Please wait for it to finish.'), async () => {
        await supabase.auth.signOut()
      })
    },
    async resetPassword(email) {
      return singleAuthRequest('resetPassword', t('A password reset request is already in progress. Please wait for it to finish.'), async () => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` })
        if (error) {
          // Preserve account-enumeration protection while surfacing operational failures.
          if (/user not found|email not found|no user/i.test(error.message || '')) return
          throw new Error(friendlyAuthError(error))
        }
        // Same result whether or not the email exists, so the form can't be used to discover accounts.
      })
    },
    async updatePassword(password) {
      return singleAuthRequest('updatePassword', t('A password update is already in progress. Please wait for it to finish.'), async () => {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw new Error(friendlyAuthError(error))
        setRecovery(false)
      })
    },
    async refreshProfile() {
      if (!userId) return false
      setProfileLoading(true)
      setProfileError('')
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) {
        setProfile(null)
        setProfileError(t('Your account profile could not be loaded. Please retry.'))
        setProfileLoading(false)
        return false
      }
      setProfile(data)
      setProfileLoading(false)
      return true
    },
  }), [session, profile, profileLoading, profileError, loading, recovery, userId, t])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
