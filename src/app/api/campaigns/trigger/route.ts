import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { resolveTemplate, sendSharedEmail } from '@/lib/email-service'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    let campaignId = ''
    try {
      const body = await request.json()
      campaignId = body.campaignId
    } catch (e) { }

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 })
    }
    const supabaseAdmin = createSupabaseAdmin(supabaseUrl, supabaseKey)

    const supabaseSession = await createClient()
    const { data: { user } } = await supabaseSession.auth.getUser()

    let query = supabaseAdmin
      .from('campaigns')
      .select('*, email_templates ( id, template_name, subject, display_name, body )')
      .eq('id', campaignId)

    if (user) {
      query = query.eq('user_id', user.id)
    }

    const { data: campaign, error: campErr } = await query.single()

    if (campErr || !campaign) {
      return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 })
    }

    const effectiveUserId = user?.id || campaign.user_id

    const { data: campaignContacts, error: ccErr } = await supabaseAdmin
      .from('campaign_contacts')
      .select(`
        id, campaign_id, contact_id, attempts, status,
        contacts ( id, name, email, company, phone_number, source )
      `)
      .eq('campaign_id', campaignId)

    if (ccErr) {
      return NextResponse.json({ error: ccErr.message }, { status: 500 })
    }

    if (!campaignContacts || campaignContacts.length === 0) {
      return NextResponse.json({ error: 'No contacts available for this campaign.' }, { status: 400 })
    }

    const templateRaw = campaign.email_templates
    const campaignTemplate = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw

    if (!campaign.template_id || !campaignTemplate) {
      return NextResponse.json({ error: 'No template selected for this campaign.' }, { status: 400 })
    }

    await supabaseAdmin.from('campaigns').update({ status: 'running' }).eq('id', campaignId)
    await supabaseAdmin.from('activity_logs').insert({
      action: 'campaign_started',
      user_id: effectiveUserId,
      details: `Campaign "${campaign.name}" started`
    })

    // Fetch user settings
    const { data: userSettings } = await supabaseAdmin
      .from('user_settings')
      .select('*, email_templates ( id, template_name, subject, display_name, body )')
      .eq('user_id', effectiveUserId)
      .maybeSingle()

    const globalDefaultTemplate = userSettings?.email_templates

    const { data: systemDefaultTemplate } = await supabaseAdmin
      .from('email_templates')
      .select('id, template_name, subject, display_name, body')
      .eq('user_id', effectiveUserId)
      .eq('is_system_default', true)
      .maybeSingle()

    let sentCount = 0
    let failedCount = 0

    const targetContacts = campaignContacts.filter(cc => 
      cc.status === 'pending' || (cc.status === 'failed' && cc.attempts < 3)
    )

    const batchToProcess = targetContacts.slice(0, 5)

    for (const item of batchToProcess) {
      const contact = Array.isArray(item.contacts) ? item.contacts[0] : item.contacts
      if (!contact) continue

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
        userId: effectiveUserId,
        userSettings: userSettings || {}
      })

      if (res.success) sentCount++
      else failedCount++
    }

    const remainingPendingCount = targetContacts.length - batchToProcess.length

    if (remainingPendingCount === 0) {
      await supabaseAdmin.from('campaigns').update({ status: 'completed' }).eq('id', campaignId)
      await supabaseAdmin.from('activity_logs').insert({
        action: 'campaign_completed',
        user_id: effectiveUserId,
        details: `Campaign "${campaign.name}" completed`
      })
    } else {
      console.log(`[TRIGGER] Campaign "${campaign.name}" has ${remainingPendingCount} remaining contacts.`);
    }

    return NextResponse.json({ success: true, sent: sentCount, failed: failedCount, remaining: remainingPendingCount })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
