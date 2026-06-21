'use server'

import { createClient } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in',
  port: 465,
  secure: true, // true for 465
  auth: {
    user: process.env.ZOHO_EMAIL,
    pass: process.env.ZOHO_PASSWORD,
  },
})

export async function sendEmail(
  contactId: string | 'custom', 
  options?: {
    toEmail?: string,
    toName?: string,
    subject?: string,
    displayName?: string,
    html?: string,
    attachments?: { filename: string; content: string; contentType?: string }[]
  }
) {
  const supabase = await createClient()

  // 1. Fetch user to verify auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let contact: any = null

  if (contactId !== 'custom') {
    // 2. Fetch the contact by ID
    const { data, error: fetchError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .eq('user_id', user.id)
      .single()
    if (fetchError || !data) throw new Error('Contact not found')
    contact = data
  } else {
    // We are sending to a custom email address
    if (!options?.toEmail) throw new Error('Recipient email is required for custom sending')
    
    // Check if the contact already exists
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('email', options.toEmail)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingContact) {
      contact = existingContact
    } else {
      // Create the contact dynamically so we can track status!
      const { data: newContact, error: createErr } = await supabase
        .from('contacts')
        .insert({
          name: options.toName || options.toEmail.split('@')[0],
          email: options.toEmail,
          user_id: user.id,
          status: 'pending',
          source: 'Direct Compose'
        })
        .select()
        .single()
      
      if (createErr || !newContact) throw new Error('Failed to create dynamic contact: ' + (createErr?.message || ''))
      contact = newContact
    }
  }

  // 3. Process Template Variables
  const replaceVariables = (text: string) => {
    return text
      .replace(/{{name}}/g, contact.name || '')
      .replace(/{{email}}/g, contact.email || '')
      .replace(/{{company}}/g, contact.company || '')
      .replace(/{{phone_number}}/g, contact.phone_number || '')
      .replace(/{{source}}/g, contact.source || '')
  }

  const finalSubject = options?.subject 
    ? replaceVariables(options.subject) 
    : `Hello ${contact.name} - Welcome to MailFlow!`
    
  const finalHtml = options?.html 
    ? replaceVariables(options.html) 
    : `<p>Hi ${contact.name},</p><p>We are excited to connect with you from ${contact.company || 'your company'}!</p><br><p>Best,<br>MailFlow Team</p>`
    
  const fromName = options?.displayName 
    ? `"${options.displayName}" <${process.env.ZOHO_EMAIL}>` 
    : process.env.ZOHO_EMAIL

  const plainTextFallback = finalHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')

  // 4. Send via Nodemailer
  let status = 'sent'
  let details = 'Email sent manually'
  try {
    await transporter.sendMail({
      from: fromName,
      to: contact.email,
      subject: finalSubject,
      html: finalHtml,
      text: plainTextFallback,
      attachments: options?.attachments?.length ? options.attachments.map(att => ({
        filename: att.filename,
        content: Buffer.from(att.content, 'base64'),
        contentType: att.contentType
      })) : undefined
    })
  } catch (err: any) {
    status = 'failed'
    details = `Failed: ${err.message}`
  }

  // 5. Update contact status
  await supabase
    .from('contacts')
    .update({ 
      status,
      sent_at: status === 'sent' ? new Date().toISOString() : null
    })
    .eq('id', contact.id)

  // 6. Create activity log
  await supabase.from('activity_logs').insert({
    action: 'email_sent',
    contact_email: contact.email,
    user_id: user.id,
    details
  })

  return { success: status === 'sent', status, details }
}

export async function createContact(data: { name: string; email: string; phone_number?: string; company?: string; source?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase.from('contacts').insert({ ...data, user_id: user.id })
  if (error) return { success: false, error: error.message }

  await supabase.from('activity_logs').insert({
    action: 'contact_created',
    user_id: user.id,
    details: `Manual contact created successfully`
  })

  return { success: true }
}

export async function updateContact(id: string, data: { name: string; email: string; phone_number?: string; company?: string; source?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase.from('contacts').update(data).eq('id', id).eq('user_id', user.id)
  if (error) return { success: false, error: error.message }

  await supabase.from('activity_logs').insert({
    action: 'contact_updated',
    user_id: user.id,
    details: `Manual contact updated successfully`
  })

  return { success: true }
}

export async function deleteContact(id: string, email: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase.from('contacts').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { success: false, error: error.message }

  await supabase.from('activity_logs').insert({
    action: 'contact_deleted',
    user_id: user.id,
    details: `Contact ${email} deleted successfully`
  })

  return { success: true }
}
