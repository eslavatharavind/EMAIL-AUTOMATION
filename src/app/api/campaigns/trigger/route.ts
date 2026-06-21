import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Parse campaignId from body
    let campaignId = ''
    try {
      const body = await request.json()
      campaignId = body.campaignId
    } catch (e) {
      // ignore
    }

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    }

    // 1. Fetch campaign and verify ownership
    const { data: campaign, error: campErr } = await supabase
      .from('campaigns')
      .select('*, email_templates ( id, template_name, subject, display_name, body )')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (campErr || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // 2. Fetch contacts assigned to the campaign
    const { data: campaignContacts, error: ccErr } = await supabase
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

    // Check if there is an email template
    const template = Array.isArray(campaign.email_templates) 
      ? campaign.email_templates[0] 
      : campaign.email_templates

    if (!campaign.template_id || !template) {
      return NextResponse.json({ error: 'No template selected for this campaign.' }, { status: 400 })
    }

    // Update campaign status to 'running'
    await supabase.from('campaigns').update({ status: 'running' }).eq('id', campaignId)
    await supabase.from('activity_logs').insert({
      action: 'campaign_started',
      user_id: user.id,
      details: `Campaign "${campaign.name}" started`
    })

    // 3. Setup Nodemailer
    const zohoEmail = process.env.ZOHO_EMAIL
    const zohoPassword = process.env.ZOHO_PASSWORD
    const zohoHost = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in'

    if (!zohoEmail || !zohoPassword) {
      return NextResponse.json({ error: 'Missing Zoho SMTP credentials in environment.' }, { status: 500 })
    }

    const transporter = nodemailer.createTransport({
      host: zohoHost,
      port: 465,
      secure: true,
      auth: {
        user: zohoEmail,
        pass: zohoPassword,
      },
    })

    let sentCount = 0
    let failedCount = 0

    const replaceVariables = (text: string, contact: any) => {
      const nameParts = (contact.name || '').split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''

      return (text || '')
        .replace(/{{name}}/g, contact.name || '')
        .replace(/{{first_name}}/g, firstName)
        .replace(/{{last_name}}/g, lastName)
        .replace(/{{email}}/g, contact.email || '')
        .replace(/{{company}}/g, contact.company || '')
        .replace(/{{phone_number}}/g, contact.phone_number || '')
        .replace(/{{source}}/g, contact.source || '')
    }

    // 4. Send emails to pending or failed contacts (attempts < 3)
    const targetContacts = campaignContacts.filter(cc => 
      cc.status === 'pending' || (cc.status === 'failed' && cc.attempts < 3)
    )

    // Send the first 5 contacts synchronously in the trigger endpoint to give quick feedback
    const batchToProcess = targetContacts.slice(0, 5)

    for (const item of batchToProcess) {
      const contact = Array.isArray(item.contacts) ? item.contacts[0] : item.contacts
      if (!contact) continue

      const finalSubject = replaceVariables(template.subject, contact)
      const finalHtml = replaceVariables(template.body, contact)
      const plainTextFallback = finalHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
      const fromName = template.display_name 
        ? `"${template.display_name}" <${zohoEmail}>` 
        : zohoEmail

      let sendError = null
      try {
        await transporter.sendMail({
          from: fromName,
          to: contact.email,
          subject: finalSubject,
          html: finalHtml,
          text: plainTextFallback
        })
        await new Promise(resolve => setTimeout(resolve, 300)) // small spacing between emails
      } catch (err: any) {
        sendError = err
      }

      const newStatus = sendError ? 'failed' : 'sent'
      const newAttempts = item.attempts + 1

      await supabase
        .from('campaign_contacts')
        .update({
          status: newStatus,
          attempts: newAttempts,
          error_message: sendError ? sendError.message : null,
          sent_at: newStatus === 'sent' ? new Date().toISOString() : null
        })
        .eq('id', item.id)

      await supabase.from('activity_logs').insert({
        action: newStatus === 'sent' ? 'email_sent' : 'email_failed',
        contact_email: contact.email,
        user_id: user.id,
        details: newStatus === 'sent' 
          ? `Campaign: ${campaign.name}` 
          : `Campaign: ${campaign.name} - Failed (Attempt ${newAttempts}/3): ${sendError?.message || 'Unknown'}`
      })

      if (newStatus === 'sent') sentCount++
      else failedCount++
    }

    const remainingPendingCount = targetContacts.length - batchToProcess.length

    if (remainingPendingCount === 0) {
      // If we finished processing all contacts in this trigger call, set status to completed
      await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaignId)
      await supabase.from('activity_logs').insert({
        action: 'campaign_completed',
        user_id: user.id,
        details: `Campaign "${campaign.name}" completed`
      })
    } else {
      console.log(`[TRIGGER] Campaign "${campaign.name}" has ${remainingPendingCount} remaining contacts. Leaving in 'running' status for QStash cron.`);
    }

    return NextResponse.json({ success: true, sent: sentCount, failed: failedCount, remaining: remainingPendingCount })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
