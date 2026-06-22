// Import the createBrowserClient function from the Supabase Server-Side Rendering (SSR) package.
// This function is specifically designed to create a safe Supabase client for use in the browser environment.
import { createBrowserClient } from '@supabase/ssr'

// Export a function named 'createClient' so it can be imported and used in other files across the app.
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    throw new Error('Environment variable NEXT_PUBLIC_SUPABASE_URL is missing.')
  }
  if (!supabaseAnonKey) {
    throw new Error('Environment variable NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.')
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
