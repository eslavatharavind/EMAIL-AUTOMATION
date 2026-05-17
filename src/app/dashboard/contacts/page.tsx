import { createClient } from '@/lib/supabase/server'
import ContactsClient from './client-page'

export default async function ContactsPage() {
  const supabase = await createClient()

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })

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
      <ContactsClient initialContacts={contacts || []} />
    </div>
  )
}
