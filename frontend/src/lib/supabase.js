import { createClient } from '@supabase/supabase-js'

// Only the public anon key is used here. It is safe in the browser because Row Level Security protects the data.
// NEVER put the service_role key in frontend code or in any VITE_ variable.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && key)
export const supabase = isConfigured ? createClient(url, key) : null
