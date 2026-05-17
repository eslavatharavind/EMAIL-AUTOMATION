import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"

/**
 * We initialize a Supabase Admin client here using the SERVICE_ROLE_KEY.
 * Unlike the standard client which uses an ANON_KEY and relies on the user's active session,
 * the admin client can bypass Row Level Security (RLS) policies.
 * This is crucial for cron jobs because they run in the background without a logged-in user context.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Initialize the Nodemailer transport using Zoho Mail's SMTP settings.
 * This object is responsible for actually dispatching the email over the network.
 */
const transporter = nodemailer.createTransport({
  host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in',
  port: 465, // 465 is the standard port for secure SMTP (SSL/TLS)
  secure: true, 
  auth: {
    user: process.env.ZOHO_EMAIL,
    pass: process.env.ZOHO_PASSWORD,
  },
})

/**
 * Main handler function for processing the pending email queue.
 * This function gets triggered by an external cron job (Upstash QStash) every hour.
 */
async function handler(request: Request) {
  try {
    // 1. Fetch pending contacts from the database
    // We use a limit to process emails in batches. This prevents the serverless function
    // from timing out if there are thousands of emails to send at once.
    const { data: pendingContacts, error: fetchError } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('status', 'pending')
      .limit(50) 

    if (fetchError) throw fetchError

    // 2. Early exit if the queue is empty
    if (!pendingContacts || pendingContacts.length === 0) {
      return NextResponse.json({ message: 'No pending contacts found', sent: 0 })
    }

    let sentCount = 0
    let failedCount = 0

    // 3. Iterate through each pending contact and attempt to send the email
    for (const contact of pendingContacts) {
      try {
        let sendError = null;
        
        // Attempt to send the email via Nodemailer
        try {
          await transporter.sendMail({
            from: process.env.ZOHO_EMAIL,
            to: contact.email,
            subject: `Hello ${contact.name} - Welcome to our SaaS`,
            html: `<p>Hi ${contact.name},</p><p>We saw you work at ${contact.company || 'your company'}. We'd love to connect!</p>`
          });
        } catch (error) {
          sendError = error; // Capture the error if delivery fails but don't crash the entire loop
        }

        // Determine final status based on whether an error occurred
        const status = sendError ? 'failed' : 'sent'
        
        // 4. Update the contact record in Supabase with the new status and timestamp
        await supabaseAdmin
          .from('contacts')
          .update({ 
            status,
            sent_at: status === 'sent' ? new Date().toISOString() : null
          })
          .eq('id', contact.id)

        // 5. Create an audit log entry for the action
        await supabaseAdmin.from('activity_logs').insert({
          action: 'cron_send',
          contact_email: contact.email,
          details: status === 'sent' ? 'Email sent via cron' : `Failed: ${(sendError as Error)?.message || 'Unknown error'}`
        })

        // Tally results
        if (status === 'sent') sentCount++
        else failedCount++
      } catch (e) {
        // Fallback catch in case database updates fail
        failedCount++
      }
    }

    // 6. Return a summary of the batch processing
    return NextResponse.json({ sent: sentCount, failed: failedCount, total: pendingContacts.length })
  } catch (error: any) {
    // Top-level error catch (e.g., database connection issues)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Route Exports
 * 
 * In development mode, we expose the raw handler so you can trigger it manually via a button click or Postman.
 * In production, we wrap the handler with `verifySignatureAppRouter`. This middleware ensures that 
 * the request is cryptographically signed by Upstash QStash, preventing unauthorized users from triggering your emails.
 */
export async function POST(request: Request, ...args: any[]) {
  // In development, bypass signature verification so we can test manually
  if (process.env.NODE_ENV === 'development') {
    return handler(request);
  }
  
  // In production, instantiate the QStash wrapper dynamically to prevent build-time evaluation errors
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
