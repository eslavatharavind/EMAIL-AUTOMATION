import { createClient } from '@/lib/supabase/server'
import TemplatesClient from './client-page'

export default async function TemplatesPage() {
  const supabase = await createClient()

  const { data: templates } = await supabase
    .from('email_templates')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Email Templates</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your reusable email templates.
          </p>
        </div>
      </div>
      <TemplatesClient initialTemplates={templates || []} />
    </div>
  )
}
