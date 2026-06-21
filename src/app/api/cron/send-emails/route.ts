import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"

async function handler(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase environment variables");
      return NextResponse.json({ error: "Configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const zohoEmail = process.env.ZOHO_EMAIL;
    const zohoPassword = process.env.ZOHO_PASSWORD;
    const zohoHost = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in';

    if (!zohoEmail || !zohoPassword) {
      console.error("Missing Zoho SMTP environment variables");
      return NextResponse.json({ error: "Configuration error" }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: zohoHost,
      port: 465,
      secure: true, 
      auth: {
        user: zohoEmail,
        pass: zohoPassword,
      },
    });

    // 1. Fetch up to 50 campaign_contacts that are pending or failed (with attempts < 3), 
    // where the parent campaign is currently 'running'.
    const { data: campaignContacts, error: fetchError } = await supabaseAdmin
      .from('campaign_contacts')
      .select(`
        id, campaign_id, contact_id, attempts, status,
        campaigns!inner ( id, name, status, user_id, email_templates ( subject, display_name, body ) ),
        contacts!inner ( id, name, email, company, phone_number, source )
      `)
      .eq('campaigns.status', 'running')
      .in('status', ['pending', 'failed'])
      .lt('attempts', 3)
      .limit(50)

    if (fetchError) throw fetchError

    // 2. Early exit if the queue is empty
    if (!campaignContacts || campaignContacts.length === 0) {
      // Check if there are running campaigns that have no more pending/failed contacts
      const { data: runningCampaigns } = await supabaseAdmin
        .from('campaigns')
        .select('id, user_id')
        .eq('status', 'running')
      
      if (runningCampaigns && runningCampaigns.length > 0) {
        for (const camp of runningCampaigns) {
          const { count } = await supabaseAdmin
            .from('campaign_contacts')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', camp.id)
            .in('status', ['pending', 'failed'])
            .lt('attempts', 3)
          
          if (count === 0) {
            await supabaseAdmin.from('campaigns').update({ status: 'completed' }).eq('id', camp.id)
            await supabaseAdmin.from('activity_logs').insert({
              action: 'campaign_completed',
              user_id: camp.user_id,
              details: `Campaign completed automatically`
            })
          }
        }
      }

      return NextResponse.json({ message: 'No pending campaign contacts found', sent: 0 })
    }

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

    // 3. Iterate through each contact
    for (const item of (campaignContacts as any[])) {
      const contact = Array.isArray(item.contacts) ? item.contacts[0] : item.contacts
      const campaign = Array.isArray(item.campaigns) ? item.campaigns[0] : item.campaigns
      if (!contact || !campaign) continue
      
      const templateRaw = campaign.email_templates
      const template = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw
      
      if (!contact || !campaign || !template) continue

      const finalSubject = replaceVariables(template.subject, contact)
      const finalHtml = replaceVariables(template.body, contact)
      const fromName = template.display_name 
        ? `"${template.display_name}" <${zohoEmail}>` 
        : zohoEmail

      let sendError = null;
      
      const plainTextFallback = finalHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')

      try {
        await transporter.sendMail({
          from: fromName,
          to: contact.email,
          subject: finalSubject,
          html: finalHtml,
          text: plainTextFallback
        });
        
        // Artificial delay of 500ms between emails within the batch to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error: any) {
        sendError = error; 
      }

      const newStatus = sendError ? 'failed' : 'sent'
      const newAttempts = item.attempts + 1
      
      await supabaseAdmin
        .from('campaign_contacts')
        .update({ 
          status: newStatus,
          attempts: newAttempts,
          error_message: sendError ? sendError.message : null,
          sent_at: newStatus === 'sent' ? new Date().toISOString() : null
        })
        .eq('id', item.id)

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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request, ...args: any[]) {
  if (process.env.NODE_ENV === 'development') {
    return handler(request);
  }
  const wrapped = verifySignatureAppRouter(handler);
  return wrapped(request, ...args);
}

export async function GET(request: Request, ...args: any[]) {
  if (process.env.NODE_ENV === 'development') {
    return handler(request);
  }
  const wrapped = verifySignatureAppRouter(handler);
  return wrapped(request, ...args);
}
