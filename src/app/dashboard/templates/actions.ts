'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createTemplate(data: { template_name: string; subject: string; display_name: string; body: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Not authenticated' }

  const { error } = await supabase
    .from('email_templates')
    .insert({ ...data, user_id: user.id })

  if (error) return { success: false as const, error: error.message }

  await supabase.from('activity_logs').insert({
    action: 'template_created',
    user_id: user.id,
    details: `${data.template_name} template created`
  })

  revalidatePath('/dashboard/templates')
  return { success: true as const, error: null }
}

export async function updateTemplate(id: string, data: { template_name: string; subject: string; display_name: string; body: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Not authenticated' }

  const { error } = await supabase
    .from('email_templates')
    .update(data)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { success: false as const, error: error.message }

  await supabase.from('activity_logs').insert({
    action: 'template_updated',
    user_id: user.id,
    details: `${data.template_name} template updated`
  })

  revalidatePath('/dashboard/templates')
  return { success: true as const, error: null }
}

export async function deleteTemplate(id: string, template_name: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Not authenticated' }

  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { success: false as const, error: error.message }

  await supabase.from('activity_logs').insert({
    action: 'template_deleted',
    user_id: user.id,
    details: `${template_name} template deleted`
  })

  revalidatePath('/dashboard/templates')
  return { success: true as const, error: null }
}
