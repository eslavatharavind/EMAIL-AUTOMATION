import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { resolveTemplate, sendSharedEmail } from '@/lib/email-service'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server configuration error: Supabase credentials missing' }, { status: 500 })
    }
    const supabaseAdmin = createSupabaseAdmin(supabaseUrl, supabaseKey)

    // Fetch user settings and global default template
    const { data: userSettings } = await supabaseAdmin
      .from('user_settings')
      .select('*, email_templates ( id, template_name, subject, display_name, body )')
      .eq('user_id', user.id)
      .maybeSingle()

    const globalDefaultTemplate = userSettings?.email_templates

    const { data: systemDefaultTemplate } = await supabaseAdmin
      .from('email_templates')
      .select('id, template_name, subject, display_name, body')
      .eq('user_id', user.id)
      .eq('is_system_default', true)
      .maybeSingle()

    // 1. Fetch pending campaign contacts
    const { data: campaignContacts, error: fetchError } = await supabaseAdmin
      .from('campaign_contacts')
      .select(`
        id, campaign_id, contact_id, attempts, status,
        campaigns!inner ( id, name, status, user_id, email_templates ( id, template_name, subject, display_name, body ) ),
        contacts!inner ( id, name, email, company, phone_number, source )
      `)
      .eq('campaigns.status', 'running')
      .eq('campaigns.user_id', user.id)
      .in('status', ['pending', 'failed'])
      .lt('attempts', 3)
      .limit(50)

    if (fetchError) {
      return NextResponse.json({ error: `Database error: ${fetchError.message}` }, { status: 500 })
    }

    // 2. Fetch global pending contacts
    const { data: globalContacts, error: globalErr } = await supabaseAdmin
      .from('contacts')
      .select(`
        id, name, email, company, phone_number, source, user_id,
        email_templates ( id, template_name, subject, display_name, body )
      `)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .limit(50)

    if (globalErr) {
      return NextResponse.json({ error: `Database error: ${globalErr.message}` }, { status: 500 })
    }

    const cc = campaignContacts || []
    const gc = globalContacts || []

    if (cc.length === 0 && gc.length === 0) {
      return NextResponse.json({ message: 'No pending contacts found', sent: 0, failed: 0, total: 0 })
    }

    let sentCount = 0
    let failedCount = 0

    // Process Campaign Contacts
    for (const item of cc as any[]) {
      const contact = Array.isArray(item.contacts) ? item.contacts[0] : item.contacts
      const campaign = Array.isArray(item.campaigns) ? item.campaigns[0] : item.campaigns
      if (!contact || !campaign) continue

      const templateRaw = campaign.email_templates
      const campaignTemplate = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw

      const templateOptions = await resolveTemplate(
        campaignTemplate,
        null, // Campaign overrides contact assigned template
        globalDefaultTemplate,
        systemDefaultTemplate
      )

      const res = await sendSharedEmail({
        contact,
        campaignId: campaign.id,
        campaignContactId: item.id,
        templateOptions,
        userId: user.id,
        userSettings
      })

      if (res.success) sentCount++; else failedCount++;
    }

    // Process Global Pending Contacts
    for (const contact of gc as any[]) {
      const contactTemplate = contact.email_templates

      const templateOptions = await resolveTemplate(
        null, // No campaign
        contactTemplate,
        globalDefaultTemplate,
        systemDefaultTemplate
      )

      const res = await sendSharedEmail({
        contact,
        templateOptions,
        userId: user.id,
        userSettings
      })

      if (res.success) sentCount++; else failedCount++;
    }

    return NextResponse.json({ sent: sentCount, failed: failedCount, total: cc.length + gc.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
