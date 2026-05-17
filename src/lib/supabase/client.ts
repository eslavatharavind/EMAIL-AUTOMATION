// Import the createBrowserClient function from the Supabase Server-Side Rendering (SSR) package.
// This function is specifically designed to create a safe Supabase client for use in the browser environment.
import { createBrowserClient } from '@supabase/ssr'

// Export a function named 'createClient' so it can be imported and used in other files across the app.
export function createClient() {
  // Call the createBrowserClient function and return its result, which is an authenticated Supabase client instance.
  return createBrowserClient(
    // Pass the Supabase project URL from the environment variables. The '!' tells TypeScript we are sure this value exists.
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // Pass the Supabase anonymous key from the environment variables. The '!' again tells TypeScript it's not null.
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) // Close the createBrowserClient function call.
} // Close the createClient function block.
