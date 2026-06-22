import { createClient } from '@/lib/supabase/server'
import ContactsClient from './client-page'

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*, email_templates(template_name)')
    .order('created_at', { ascending: false })

  const { data: templates } = await supabase
    .from('email_templates')
    .select('*')
    .order('created_at', { ascending: false })

  const filteredTemplates = (templates || []).filter(t => 
    !t.is_system_default || (user && t.user_id === user.id)
  )

  let globalDefaultTemplateId = null
  if (user) {
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('default_template_id')
      .limit(1)
      .maybeSingle()
    globalDefaultTemplateId = userSettings?.default_template_id || null
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contacts</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage and send emails to your contacts.
          </p>
        </div>
      </div>
      <ContactsClient 
        initialContacts={contacts || []} 
        templates={filteredTemplates} 
        globalDefaultTemplateId={globalDefaultTemplateId}
      />
    </div>
  )
}
