import { createClient } from '@/lib/supabase/server'
import SettingsClient from './client-page'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let initialSettings = null
  if (user) {
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    
    initialSettings = data || null
  }

  const { data: templates } = await supabase
    .from('email_templates')
    .select('*')
    .order('template_name', { ascending: true })

  return <SettingsClient user={user} initialSettings={initialSettings} templates={templates || []} />
}
