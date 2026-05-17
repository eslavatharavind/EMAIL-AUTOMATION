'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return redirect('/login?error=Email and password are required')
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  if (!email || !password) {
    return redirect('/login?error=Email and password are required')
  }

  if (password.length < 6) {
    return redirect('/login?error=Password must be at least 6 characters')
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: undefined,
    },
  })

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  // Case 1: Email confirmation is DISABLED in Supabase → user gets a session immediately
  if (data.session) {
    // Since the user requested to stay on the login page after signup instead of going to dashboard:
    const supabaseClient = await createClient()
    await supabaseClient.auth.signOut() // Sign them out so they are forced to log in manually
    return redirect(`/login?message=${encodeURIComponent('Successfully signed up! Please sign in.')}`)
  }

  // Case 2: Email confirmation is ENABLED → Supabase sends a confirmation email first
  // identities array will be empty if user already exists but isn't confirmed
  if (data.user?.identities && data.user.identities.length === 0) {
    return redirect(
      `/login?error=${encodeURIComponent('This email is already registered. Check your inbox to confirm, or try logging in.')}`
    )
  }

  // Normal case: new user, email confirmation sent
  redirect(
    `/login?message=${encodeURIComponent('Account created! Check your email for a confirmation link before signing in.')}`
  )
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
