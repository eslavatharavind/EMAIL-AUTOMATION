import { createClient } from '@/lib/supabase/server'
import SettingsClient from './client-page'
import { ensureSystemDefaultTemplate } from '@/lib/email-service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let initialSettings = null
  if (user) {
    await ensureSystemDefaultTemplate(user.id)

    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .limit(1)
      .maybeSingle()
    
    initialSettings = data || null
  }

  const { data: templates } = await supabase
    .from('email_templates')
    .select('*')
    .order('template_name', { ascending: true })

  const filteredTemplates = (templates || []).filter(t => 
    !t.is_system_default || (user && t.user_id === user.id)
  )

  return <SettingsClient user={user} initialSettings={initialSettings} templates={filteredTemplates} />
}
