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

export async function sendEmail(contactId: string) {
  const supabase = await createClient()

  // 1. Fetch user to verify auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // 2. Fetch the contact
  const { data: contact, error: fetchError } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !contact) throw new Error('Contact not found')

  // 3. Send via Nodemailer
  let status = 'sent'
  let details = 'Email sent manually'
  try {
    await transporter.sendMail({
      from: process.env.ZOHO_EMAIL,
      to: contact.email,
      subject: `Hello ${contact.name} - Welcome to MailFlow!`,
      html: `<p>Hi ${contact.name},</p><p>We are excited to connect with you from ${contact.company || 'your company'}!</p><br><p>Best,<br>MailFlow Team</p>`
    })
  } catch (err: any) {
    status = 'failed'
    details = `Failed: ${err.message}`
  }

  // 4. Update contact status
  await supabase
    .from('contacts')
    .update({ 
      status,
      sent_at: status === 'sent' ? new Date().toISOString() : null
    })
    .eq('id', contactId)

  // 5. Create activity log
  await supabase.from('activity_logs').insert({
    action: 'manual_send',
    contact_email: contact.email,
    user_id: user.id,
    details
  })

  return { success: status === 'sent', status, details }
}
