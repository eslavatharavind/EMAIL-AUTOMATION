import { createClient } from '@/lib/supabase/server'
import CampaignsClientPage from './client-page'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch campaigns with their templates — gracefully handle if table doesn't exist yet
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select(`
      *,
      email_templates ( id, template_name )
    `)
    .order('created_at', { ascending: false })

  // If the table doesn't exist, show the migration banner
  const tablesMissing = !!campaignsError && (
    campaignsError.message.includes('does not exist') ||
    campaignsError.message.includes('schema cache') ||
    campaignsError.code === '42P01'
  )

  // Fetch templates for the "Create Campaign" dropdown
  const { data: templates } = await supabase
    .from('email_templates')
    .select('id, template_name, is_draft, is_system_default, user_id')

  const filteredTemplates = (templates || []).filter(t => 
    !t.is_system_default || (user && t.user_id === user.id)
  )

  if (tablesMissing) {
    return (
      <CampaignsClientPage
        campaigns={[]}
        templates={filteredTemplates}
        migrationRequired={true}
      />
    )
  }

  // Fetch basic stats for each campaign
  const campaignsWithStats = await Promise.all((campaigns || []).map(async (camp) => {
    const { count: total } = await supabase
      .from('campaign_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', camp.id)
    const { count: sent } = await supabase
      .from('campaign_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', camp.id)
      .eq('status', 'sent')
    const { count: failed } = await supabase
      .from('campaign_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', camp.id)
      .eq('status', 'failed')

    return {
      ...camp,
      total_contacts: total || 0,
      sent_count: sent || 0,
      failed_count: failed || 0,
    }
  }))

  return (
    <CampaignsClientPage
      campaigns={campaignsWithStats || []}
      templates={filteredTemplates}
      migrationRequired={false}
    />
  )
}
