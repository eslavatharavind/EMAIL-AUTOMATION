'use server'

import { createClient } from '@/lib/supabase/server'

export async function updateUserSettings(data: {
  default_template_id?: string | null;
  company_name?: string;
  display_name?: string;
  sender_email?: string;
  company_website?: string;
  company_phone?: string;
  company_logo_url?: string;
  primary_color?: string;
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Check if any settings exist in the system (since it's a shared workspace)
  const { data: existing } = await supabase
    .from('user_settings')
    .select('user_id')
    .limit(1)
    .maybeSingle()

  let error;
  
  if (existing) {
    const { error: updateErr } = await supabase
      .from('user_settings')
      .update(data)
      .eq('user_id', existing.user_id)
    error = updateErr
  } else {
    const { error: insertErr } = await supabase
      .from('user_settings')
      .insert({ user_id: user.id, ...data })
    error = insertErr
  }

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
