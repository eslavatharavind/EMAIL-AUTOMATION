import nodemailer from 'nodemailer'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAdmin = createSupabaseAdmin(supabaseUrl, supabaseKey)

const zohoEmail = process.env.ZOHO_EMAIL || ''
const zohoPassword = process.env.ZOHO_PASSWORD || ''
const zohoHost = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in'

const transporter = nodemailer.createTransport({
  host: zohoHost,
  port: 465,
  secure: true,
  auth: {
    user: zohoEmail,
    pass: zohoPassword,
  },
})

// Ensures the user has a System Default Professional Template
export async function ensureSystemDefaultTemplate(userId: string) {
  // Check if it exists
  const { data: existing } = await supabaseAdmin
    .from('email_templates')
    .select('id')
    .eq('user_id', userId)
    .eq('is_system_default', true)
    .maybeSingle()

  if (existing) return existing.id;

  const subject = `Welcome to {{company}}, {{name}}!`
  const body = `
<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 32px 20px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
  <!-- Header -->
  <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 32px;">
    <h1 style="color: {{primary_color}}; margin: 0 0 20px 0; font-size: 24px;">{{company}}</h1>
  </div>
  <!-- Body -->
  <h2 style="color: #0f172a; font-size: 20px; font-weight: 600; margin-top: 0;">Hello {{name}},</h2>
  <p style="margin-bottom: 16px; font-size: 16px;">We are absolutely thrilled to connect with you. At {{company}}, we believe in fostering strong relationships and driving innovation.</p>
  <p style="margin-bottom: 24px; font-size: 16px;">We noticed your exceptional background and would love to explore how we can collaborate. Our platform is designed to streamline your workflows and elevate your business.</p>
  <!-- CTA -->
  <div style="text-align: center; margin: 32px 0;">
    <a href="{{company_website}}" style="background-color: {{primary_color}}; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; transition: opacity 0.2s;">Get Started Today</a>
  </div>
  <!-- Footer -->
  <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9; color: #64748b; font-size: 14px;">
    <p style="margin: 0 0 4px 0;">Best Regards,</p>
    <p style="margin: 0; font-weight: 600; color: #334155;">{{display_name}}</p>
    <p style="margin: 0;">{{company}}</p>
    <p style="margin: 0;">{{company_phone}}</p>
    <p style="margin: 0;">
      <a href="mailto:{{sender_email}}" style="color: {{primary_color}}; text-decoration: none;">{{sender_email}}</a>
    </p>
  </div>
</div>`

  const { data: newTemplate, error } = await supabaseAdmin
    .from('email_templates')
    .insert({
      user_id: userId,
      template_name: 'Professional Default Template',
      subject,
      display_name: '{{display_name}}',
      body,
      is_system_default: true,
      is_draft: false
    })
    .select('id')
    .single()

  if (error) {
    console.error("[EMAIL-SERVICE] Error provisioning system template:", error.message)
    return null
  }

  return newTemplate.id
}

// Variables allowed: {{name}}, {{email}}, {{company}}, {{phone_number}}, {{source}}, {{display_name}}, {{sender_email}}, {{primary_color}}, {{company_website}}, {{company_phone}}
export function replaceVariables(text: string, contact: any, senderSettings: any = {}) {
  const nameParts = (contact.name || '').split(' ')
  const firstName = nameParts[0] || ''
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''

  const safeCompany = senderSettings.company_name || 'Our Company'
  const safeColor = senderSettings.primary_color || '#4f46e5'
  const safeWebsite = senderSettings.company_website || '#'
  const safePhone = senderSettings.company_phone || ''

  return (text || '')
    .replace(/{{name}}/g, contact.name || '')
    .replace(/{{first_name}}/g, firstName)
    .replace(/{{last_name}}/g, lastName)
    .replace(/{{email}}/g, contact.email || '')
    .replace(/{{company}}/g, safeCompany)
    .replace(/{{phone_number}}/g, contact.phone_number || '')
    .replace(/{{source}}/g, contact.source || '')
    .replace(/{{display_name}}/g, senderSettings.display_name || 'The Team')
    .replace(/{{sender_email}}/g, senderSettings.sender_email || zohoEmail)
    .replace(/{{primary_color}}/g, safeColor)
    .replace(/{{company_website}}/g, safeWebsite)
    .replace(/{{company_phone}}/g, safePhone)
}

export type TemplateOptions = {
  id?: string;
  subject: string;
  body: string;
  display_name: string;
  source: 'campaign' | 'assigned' | 'global_default' | 'system_default';
}

export async function resolveTemplate(
  campaignTemplate: any,
  contactTemplate: any,
  globalDefaultTemplate: any,
  systemDefaultTemplate: any
): Promise<TemplateOptions> {
  // 1. Campaign Template
  if (campaignTemplate) {
    return {
      id: campaignTemplate.id,
      subject: campaignTemplate.subject,
      body: campaignTemplate.body,
      display_name: campaignTemplate.display_name,
      source: 'campaign'
    }
  }

  // 2. Contact Assigned Template
  if (contactTemplate) {
    return {
      id: contactTemplate.id,
      subject: contactTemplate.subject,
      body: contactTemplate.body,
      display_name: contactTemplate.display_name,
      source: 'assigned'
    }
  }

  // 3. Global Default Template
  if (globalDefaultTemplate) {
    return {
      id: globalDefaultTemplate.id,
      subject: globalDefaultTemplate.subject,
      body: globalDefaultTemplate.body,
      display_name: globalDefaultTemplate.display_name,
      source: 'global_default'
    }
  }

  // 4. System Professional Template
  if (systemDefaultTemplate) {
    return {
      id: systemDefaultTemplate.id,
      subject: systemDefaultTemplate.subject,
      body: systemDefaultTemplate.body,
      display_name: systemDefaultTemplate.display_name,
      source: 'system_default'
    }
  }

  // Absolute Fail-safe Fallback (should never be hit if provisioning works)
  return {
    subject: "Hello {{name}}",
    body: "<p>Hello {{name}},</p><p>We are reaching out to connect with you.</p><p>Best,</p><p>{{display_name}}</p>",
    display_name: "{{display_name}}",
    source: 'system_default'
  }
}

export async function sendSharedEmail({
  contact,
  campaignId = null,
  campaignContactId = null,
  templateOptions,
  userId,
  userSettings = {},
  attachments = []
}: {
  contact: any;
  campaignId?: string | null;
  campaignContactId?: string | null;
  templateOptions: TemplateOptions;
  userId: string;
  userSettings?: any;
  attachments?: any[];
}) {
  console.log(`[EMAIL-SERVICE] Preparing to send to: ${contact.email} | Template Source: ${templateOptions.source} | Campaign: ${campaignId || 'None'}`);

  const finalSubject = replaceVariables(templateOptions.subject, contact, userSettings)
  const finalHtml = replaceVariables(templateOptions.body, contact, userSettings)
  const plainText = finalHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
  const fromNameText = templateOptions.display_name ? replaceVariables(templateOptions.display_name, contact, userSettings) : 'MailFlow Sender'
  const fromName = `"${fromNameText}" <${zohoEmail}>`

  let sendError: any = null
  try {
    await transporter.sendMail({
      from: fromName,
      to: contact.email,
      subject: finalSubject,
      html: finalHtml,
      text: plainText,
      attachments
    })
    console.log(`[EMAIL-SERVICE] SMTP SUCCESS: Sent to ${contact.email}`);
  } catch (error: any) {
    sendError = error
    console.error(`[EMAIL-SERVICE] SMTP ERROR: Failed to send to ${contact.email}:`, error.message);
  }

  const newStatus = sendError ? 'failed' : 'sent'
  
  // Update campaign_contacts if applicable
  if (campaignContactId) {
    try {
      const { data: ccRecord } = await supabaseAdmin.from('campaign_contacts').select('attempts').eq('id', campaignContactId).single()
      const newAttempts = (ccRecord?.attempts || 0) + 1
      await supabaseAdmin.from('campaign_contacts').update({
        status: newStatus,
        attempts: newAttempts,
        error_message: sendError?.message || null,
        sent_at: newStatus === 'sent' ? new Date().toISOString() : null
      }).eq('id', campaignContactId)
    } catch (dbErr: any) {
      console.error(`[EMAIL-SERVICE] DB ERROR updating campaign_contact:`, dbErr.message);
    }
  }

  // Always update global contacts table status
  try {
    await supabaseAdmin.from('contacts').update({
      status: newStatus,
      sent_at: newStatus === 'sent' ? new Date().toISOString() : null
    }).eq('id', contact.id)
  } catch (dbErr: any) {
    console.error(`[EMAIL-SERVICE] DB ERROR updating contact status:`, dbErr.message);
  }

  // Create Activity Log
  try {
    const details = sendError 
      ? `Email Failed. Source: ${templateOptions.source}. Error: ${sendError.message}` 
      : `Email Sent. Source: ${templateOptions.source}. Template: ${templateOptions.subject || 'Default'}`
    
    await supabaseAdmin.from('activity_logs').insert({
      action: newStatus === 'sent' ? 'email_sent' : 'email_failed',
      contact_email: contact.email,
      user_id: userId,
      details
    })
  } catch (logErr: any) {
    console.error(`[EMAIL-SERVICE] DB ERROR writing activity log:`, logErr.message);
  }

  return { success: !sendError, status: newStatus, error: sendError?.message }
}
