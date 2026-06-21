'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import nodemailer from 'nodemailer'

export async function createTemplate(data: { template_name: string; subject: string; display_name: string; body: string; is_draft?: boolean }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Not authenticated' }

  const { error } = await supabase
    .from('email_templates')
    .insert({ ...data, user_id: user.id })

  if (error) return { success: false as const, error: error.message }

  await supabase.from('activity_logs').insert({
    action: 'template_created',
    user_id: user.id,
    details: `${data.template_name} template created${data.is_draft ? ' as draft' : ''}`
  })

  revalidatePath('/dashboard/templates')
  return { success: true as const, error: null }
}

export async function updateTemplate(id: string, data: { template_name: string; subject: string; display_name: string; body: string; is_draft?: boolean }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Not authenticated' }

  const { error } = await supabase
    .from('email_templates')
    .update(data)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { success: false as const, error: error.message }

  await supabase.from('activity_logs').insert({
    action: 'template_updated',
    user_id: user.id,
    details: `${data.template_name} template updated`
  })

  revalidatePath('/dashboard/templates')
  return { success: true as const, error: null }
}

export async function deleteTemplate(id: string, template_name: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Not authenticated' }

  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { success: false as const, error: error.message }

  await supabase.from('activity_logs').insert({
    action: 'template_deleted',
    user_id: user.id,
    details: `${template_name} template deleted`
  })

  revalidatePath('/dashboard/templates')
  return { success: true as const, error: null }
}

export async function sendTestEmail(options: {
  toEmail: string
  subject: string
  body: string
  displayName?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Not authenticated' }

  const zohoEmail = process.env.ZOHO_EMAIL
  const zohoPassword = process.env.ZOHO_PASSWORD
  const zohoHost = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in'

  if (!zohoEmail || !zohoPassword) {
    return { success: false as const, error: 'Missing Zoho SMTP credentials in environment variables.' }
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

  const mockVariables = {
    name: 'Jane Doe',
    email: options.toEmail,
    company: 'Acme Corporation',
    phone_number: '+1 (555) 123-4567',
    source: 'LinkedIn Referral'
  }

  const replaceVariables = (text: string) => {
    return text
      .replace(/{{name}}/g, mockVariables.name)
      .replace(/{{email}}/g, mockVariables.email)
      .replace(/{{company}}/g, mockVariables.company)
      .replace(/{{phone_number}}/g, mockVariables.phone_number)
      .replace(/{{source}}/g, mockVariables.source)
  }

  const finalSubject = `[TEST] ${replaceVariables(options.subject)}`
  const finalHtml = replaceVariables(options.body)
  const plainTextFallback = finalHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')

  const fromName = options.displayName 
    ? `"${options.displayName}" <${zohoEmail}>` 
    : zohoEmail

  let status = 'sent'
  let details = 'Test email sent successfully'
  try {
    await transporter.sendMail({
      from: fromName,
      to: options.toEmail,
      subject: finalSubject,
      html: finalHtml,
      text: plainTextFallback
    })
  } catch (err: any) {
    status = 'failed'
    details = `Test Failed: ${err.message}`
    return { success: false as const, error: err.message }
  }

  await supabase.from('activity_logs').insert({
    action: 'test_email_sent',
    contact_email: options.toEmail,
    user_id: user.id,
    details: `Test email sent for subject: "${options.subject}" (Status: ${status})`
  })

  return { success: true as const, error: null }
}

