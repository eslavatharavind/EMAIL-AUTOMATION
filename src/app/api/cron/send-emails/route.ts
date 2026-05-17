import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"

// We define the handler function first, but we DON'T initialize clients globally.
// This prevents Next.js from executing server-side code during `npm run build`.
async function handler(request: Request) {
  try {
    // 1. Initialize Supabase Admin strictly inside the function body
    // This ensures environment variables are only checked at runtime, not build time.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase environment variables");
      return NextResponse.json({ error: "Configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // 2. Initialize Nodemailer strictly inside the function body
    const zohoEmail = process.env.ZOHO_EMAIL;
    const zohoPassword = process.env.ZOHO_PASSWORD;
    const zohoHost = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in';

    if (!zohoEmail || !zohoPassword) {
      console.error("Missing Zoho SMTP environment variables");
      return NextResponse.json({ error: "Configuration error" }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: zohoHost,
      port: 465, // 465 is the standard port for secure SMTP (SSL/TLS)
      secure: true, 
      auth: {
        user: zohoEmail,
        pass: zohoPassword,
      },
    });

    // 3. Fetch pending contacts from the database
    const { data: pendingContacts, error: fetchError } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('status', 'pending')
      .limit(50) 

    if (fetchError) throw fetchError

    // 4. Early exit if the queue is empty
    if (!pendingContacts || pendingContacts.length === 0) {
      return NextResponse.json({ message: 'No pending contacts found', sent: 0 })
    }

    let sentCount = 0
    let failedCount = 0

    // 5. Iterate through each pending contact and attempt to send the email
    for (const contact of pendingContacts) {
      try {
        let sendError = null;
        
        // Attempt to send the email via Nodemailer
        try {
          await transporter.sendMail({
            from: zohoEmail,
            to: contact.email,
            subject: `Hello ${contact.name} - Welcome to our SaaS`,
            html: `<p>Hi ${contact.name},</p><p>We saw you work at ${contact.company || 'your company'}. We'd love to connect!</p>`
          });
        } catch (error) {
          sendError = error; 
        }

        const status = sendError ? 'failed' : 'sent'
        
        // 6. Update the contact record in Supabase
        await supabaseAdmin
          .from('contacts')
          .update({ 
            status,
            sent_at: status === 'sent' ? new Date().toISOString() : null
          })
          .eq('id', contact.id)

        // 7. Create an audit log entry
        await supabaseAdmin.from('activity_logs').insert({
          action: 'cron_send',
          contact_email: contact.email,
          details: status === 'sent' ? 'Email sent via cron' : `Failed: ${(sendError as Error)?.message || 'Unknown error'}`
        })

        if (status === 'sent') sentCount++
        else failedCount++
      } catch (e) {
        failedCount++
      }
    }

    // 8. Return a summary of the batch processing
    return NextResponse.json({ sent: sentCount, failed: failedCount, total: pendingContacts.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Ensure the route is dynamic and prevents static generation during build
export const dynamic = 'force-dynamic';

export async function POST(request: Request, ...args: any[]) {
  // In development, bypass signature verification so we can test manually
  if (process.env.NODE_ENV === 'development') {
    return handler(request);
  }
  
  // In production, instantiate the QStash wrapper dynamically
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
