import { createClient } from '@/lib/supabase/server'
import CampaignDetailsClient from './client-page'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function CampaignDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select(`*, email_templates ( id, template_name, subject, body )`)
    .eq('id', id)
    .single()

  if (!campaign) redirect('/dashboard/campaigns')

  // Fetch campaign contacts
  const { data: campaignContacts } = await supabase
    .from('campaign_contacts')
    .select(`
      id, contact_id, status, attempts, error_message, sent_at,
      contacts ( id, name, email, company )
    `)
    .eq('campaign_id', id)

  // Fetch all user contacts (to be able to add them)
  const { data: allContacts } = await supabase
    .from('contacts')
    .select('id, name, email, company')

  // Fetch user templates
  const { data: templates } = await supabase
    .from('email_templates')
    .select('id, template_name, is_draft')

  return (
    <CampaignDetailsClient 
      campaign={campaign} 
      campaignContacts={campaignContacts || []}
      allContacts={allContacts || []}
      templates={templates || []}
    />
  )
}
