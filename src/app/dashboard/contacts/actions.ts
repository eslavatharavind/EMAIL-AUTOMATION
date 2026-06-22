'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveTemplate, sendSharedEmail } from '@/lib/email-service'

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
    // 2. Fetch the contact by ID along with its template
    const { data, error: fetchError } = await supabase
      .from('contacts')
      .select('*, email_templates ( id, template_name, subject, display_name, body )')
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
      .select('*, email_templates ( id, template_name, subject, display_name, body )')
      .eq('email', options.toEmail)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingContact) {
      contact = existingContact
    } else {
      // Create the contact dynamically
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

  // Fetch user settings
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('*, email_templates ( id, template_name, subject, display_name, body )')
    .eq('user_id', user.id)
    .maybeSingle()

  const globalDefaultTemplate = userSettings?.email_templates

  const { data: systemDefaultTemplate } = await supabase
    .from('email_templates')
    .select('id, template_name, subject, display_name, body')
    .eq('user_id', user.id)
    .eq('is_system_default', true)
    .maybeSingle()

  let templateOptions
  if (options?.subject || options?.html) {
    // Manual override from compose modal
    templateOptions = {
      subject: options.subject || `Hello ${contact.name} - Welcome to MailFlow!`,
      body: options.html || `<p>Hi ${contact.name},</p><p>We are excited to connect with you from ${contact.company || 'your company'}!</p><br><p>Best,<br>MailFlow Team</p>`,
      display_name: options.displayName || userSettings?.display_name || '',
      source: 'assigned' as const // Treating manual override as 'assigned' level
    }
  } else {
    templateOptions = await resolveTemplate(
      null, // No campaign
      contact?.email_templates,
      globalDefaultTemplate,
      systemDefaultTemplate
    )
  }

  const res = await sendSharedEmail({
    contact,
    templateOptions,
    userId: user.id,
    userSettings: userSettings || {},
    attachments: options?.attachments ? options.attachments.map(att => ({
      filename: att.filename,
      content: Buffer.from(att.content, 'base64'),
      contentType: att.contentType
    })) : []
  })

  return { success: res.success, status: res.status, details: res.error || 'Email sent manually' }
}

export async function createContact(data: { name: string; email: string; phone_number?: string; company?: string; source?: string; template_id?: string | null }) {
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

export async function updateContact(id: string, data: { name: string; email: string; phone_number?: string; company?: string; source?: string; template_id?: string | null }) {
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

export async function bulkAssignTemplate(contactIds: string[], templateId: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('contacts')
    .update({ template_id: templateId })
    .in('id', contactIds)
    .eq('user_id', user.id)

  if (error) return { success: false, error: error.message }

  await supabase.from('activity_logs').insert({
    action: 'contact_updated',
    user_id: user.id,
    details: `Bulk updated template assignment for ${contactIds.length} contacts`
  })

  return { success: true }
}
