import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

/**
 * POST /api/queue/process
 * 
 * Manual "Process Pending Queue" endpoint for the dashboard.
 * Protected by Supabase session auth (user must be logged in).
 * This is separate from /api/cron/send-emails which requires QStash signature.
 */
export async function POST(request: Request) {
  try {
    // 1. Verify the user is authenticated via Supabase session
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Set up Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server configuration error: Supabase credentials missing' }, { status: 500 })
    }
    const supabaseAdmin = createSupabaseAdmin(supabaseUrl, supabaseKey)

    // 3. Set up Zoho SMTP transporter
    const zohoEmail = process.env.ZOHO_EMAIL
    const zohoPassword = process.env.ZOHO_PASSWORD
    const zohoHost = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in'

    if (!zohoEmail || !zohoPassword) {
      return NextResponse.json({ error: 'Server configuration error: Zoho SMTP credentials missing' }, { status: 500 })
    }

    const transporter = nodemailer.createTransport({
      host: zohoHost,
      port: 465,
      secure: true,
      auth: { user: zohoEmail, pass: zohoPassword },
    })

    try {
      await transporter.verify()
    } catch (verifyError: any) {
      return NextResponse.json({ error: `Zoho SMTP connection failed: ${verifyError.message}` }, { status: 500 })
    }

    // 4. Fetch pending campaign contacts (only for this user's campaigns)
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

    if (!campaignContacts || campaignContacts.length === 0) {
      return NextResponse.json({ message: 'No pending campaign contacts found', sent: 0, total: 0 })
    }

    // 5. Process and send emails
    let sentCount = 0
    let failedCount = 0

    const replaceVariables = (text: string, contact: any) => {
      const nameParts = (contact.name || '').split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''
      return text
        .replace(/{{name}}/g, contact.name || '')
        .replace(/{{first_name}}/g, firstName)
        .replace(/{{last_name}}/g, lastName)
        .replace(/{{email}}/g, contact.email || '')
        .replace(/{{company}}/g, contact.company || '')
        .replace(/{{phone_number}}/g, contact.phone_number || '')
        .replace(/{{source}}/g, contact.source || '')
    }

    for (const item of campaignContacts as any[]) {
      const contact = Array.isArray(item.contacts) ? item.contacts[0] : item.contacts
      const campaign = Array.isArray(item.campaigns) ? item.campaigns[0] : item.campaigns
      if (!contact || !campaign) continue

      const templateRaw = campaign.email_templates
      const template = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw
      if (!template) continue

      const finalSubject = replaceVariables(template.subject || '', contact)
      const finalHtml = replaceVariables(template.body || '', contact)
      const plainText = finalHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
      const fromName = template.display_name ? `"${template.display_name}" <${zohoEmail}>` : zohoEmail

      let sendError = null
      try {
        await transporter.sendMail({ from: fromName, to: contact.email, subject: finalSubject, html: finalHtml, text: plainText })
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (err: any) {
        sendError = err
      }

      const newStatus = sendError ? 'failed' : 'sent'
      const newAttempts = (item.attempts || 0) + 1

      // Update campaign_contacts status
      await supabaseAdmin
        .from('campaign_contacts')
        .update({ status: newStatus, attempts: newAttempts, error_message: sendError?.message || null, sent_at: newStatus === 'sent' ? new Date().toISOString() : null })
        .eq('id', item.id)

      // Also sync global contacts table
      await supabaseAdmin
        .from('contacts')
        .update({ status: newStatus, sent_at: newStatus === 'sent' ? new Date().toISOString() : null })
        .eq('id', contact.id)

      // Log the activity
      await supabaseAdmin.from('activity_logs').insert({
        action: newStatus === 'sent' ? 'email_sent' : 'email_failed',
        contact_email: contact.email,
        user_id: campaign.user_id,
        details: newStatus === 'sent'
          ? `Campaign: ${campaign.name}`
          : `Campaign: ${campaign.name} - Failed (Attempt ${newAttempts}/3): ${sendError?.message || 'Unknown'}`
      })

      if (newStatus === 'sent') sentCount++
      else failedCount++
    }

    return NextResponse.json({ sent: sentCount, failed: failedCount, total: campaignContacts.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

// Also support GET for convenience (same logic)
export async function GET(request: Request) {
  return POST(request)
}
