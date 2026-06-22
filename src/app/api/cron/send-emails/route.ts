import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"

async function handler(request: Request) {
  try {
    console.log("[CRON] Cron started: send-emails cron process started");
    console.log("[CRON] Incoming request details:", {
      method: request.method,
      url: request.url,
      headers: {
        host: request.headers.get("host"),
        "user-agent": request.headers.get("user-agent"),
        "x-upstash-signature": request.headers.get("x-upstash-signature") ? "present" : "missing"
      }
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("[CRON] Verifying Supabase Configuration...");
    if (!supabaseUrl || !supabaseKey) {
      console.error("[CRON] ERROR: Supabase credentials missing");
      return NextResponse.json({ error: "Configuration Error: Supabase credentials missing" }, { status: 500 });
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const zohoEmail = process.env.ZOHO_EMAIL;
    const zohoPassword = process.env.ZOHO_PASSWORD;
    const zohoHost = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in';

    console.log("[CRON] Verifying Zoho SMTP Configuration...");
    if (!zohoEmail || !zohoPassword) {
      console.error("[CRON] ERROR: Zoho SMTP credentials missing");
      return NextResponse.json({ error: "Configuration Error: Zoho SMTP credentials missing" }, { status: 500 });
    }

    let transporter;
    try {
      transporter = nodemailer.createTransport({
        host: zohoHost,
        port: 465,
        secure: true, 
        auth: { user: zohoEmail, pass: zohoPassword },
      });
      await transporter.verify();
      console.log("[CRON] Zoho SMTP transport verified successfully!");
    } catch (verifyError: any) {
      console.error("[CRON] ERROR: Zoho SMTP Verification Failed:", verifyError.message);
      return NextResponse.json({ error: `Zoho SMTP Verification Failed: ${verifyError.message}` }, { status: 500 });
    }

    console.log("[CRON] Fetching pending campaign contacts (limit 50)...");
    let campaignContacts: any[] = [];
    try {
      const { data, error: fetchError } = await supabaseAdmin
        .from('campaign_contacts')
        .select(`
          id, campaign_id, contact_id, attempts, status,
          campaigns!inner ( id, name, status, user_id, email_templates ( id, template_name, subject, display_name, body ) ),
          contacts!inner ( id, name, email, company, phone_number, source )
        `)
        .eq('campaigns.status', 'running')
        .in('status', ['pending', 'failed'])
        .lt('attempts', 3)
        .limit(50);

      if (fetchError) throw fetchError;
      campaignContacts = data || [];
      console.log(`[CRON] Found ${campaignContacts.length} pending campaign contacts.`);
    } catch (dbError: any) {
      console.error("[CRON] ERROR: Failed to fetch campaign contacts:", dbError.message);
      return NextResponse.json({ error: `Database fetch failed: ${dbError.message}` }, { status: 500 });
    }

    console.log("[CRON] Fetching global pending contacts (limit 50)...");
    let globalContacts: any[] = [];
    try {
      const { data, error: fetchGlobalError } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('status', 'pending')
        .limit(50);
        
      if (fetchGlobalError) throw fetchGlobalError;
      globalContacts = data || [];
      console.log(`[CRON] Found ${globalContacts.length} global pending contacts.`);
    } catch (dbError: any) {
      console.error("[CRON] ERROR: Failed to fetch global contacts:", dbError.message);
    }

    // Auto-complete empty campaigns if no campaign contacts are pending
    if (campaignContacts.length === 0) {
      console.log("[CRON] Scanning for active campaigns to auto-complete...");
      try {
        const { data: runningCampaigns } = await supabaseAdmin.from('campaigns').select('id, name, user_id').eq('status', 'running');
        if (runningCampaigns && runningCampaigns.length > 0) {
          for (const camp of runningCampaigns) {
            const { count } = await supabaseAdmin
              .from('campaign_contacts')
              .select('*', { count: 'exact', head: true })
              .eq('campaign_id', camp.id)
              .in('status', ['pending', 'failed'])
              .lt('attempts', 3);
            if (count === 0) {
              console.log(`[CRON] Campaign "${camp.name}" (${camp.id}) has 0 pending contacts. Auto-marking as completed.`);
              await supabaseAdmin.from('campaigns').update({ status: 'completed' }).eq('id', camp.id);
              await supabaseAdmin.from('activity_logs').insert({
                action: 'campaign_completed',
                user_id: camp.user_id,
                details: `Campaign completed automatically`
              });
            }
          }
        }
      } catch (completionErr: any) {
        console.error("[CRON] ERROR: Scanning active campaigns failed:", completionErr.message);
      }
    }

    if (campaignContacts.length === 0 && globalContacts.length === 0) {
      return NextResponse.json({ message: 'No pending contacts found to process', sent: 0, failed: 0, total: 0 });
    }

    let sentCount = 0;
    let failedCount = 0;

    const replaceVariables = (text: string, contact: any) => {
      const nameParts = (contact.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      return text
        .replace(/{{name}}/g, contact.name || '')
        .replace(/{{first_name}}/g, firstName)
        .replace(/{{last_name}}/g, lastName)
        .replace(/{{email}}/g, contact.email || '')
        .replace(/{{company}}/g, contact.company || '')
        .replace(/{{phone_number}}/g, contact.phone_number || '')
        .replace(/{{source}}/g, contact.source || '');
    };

    // 1. Process Campaign Contacts
    for (const item of campaignContacts) {
      const contact = Array.isArray(item.contacts) ? item.contacts[0] : item.contacts;
      const campaign = Array.isArray(item.campaigns) ? item.campaigns[0] : item.campaigns;
      
      if (!contact || !campaign) continue;
      
      const templateRaw = campaign.email_templates;
      const template = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw;
      if (!template) continue;

      const finalSubject = replaceVariables(template.subject || '', contact);
      const finalHtml = replaceVariables(template.body || '', contact);
      const plainTextFallback = finalHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
      const fromName = template.display_name ? `"${template.display_name}" <${zohoEmail}>` : zohoEmail;

      let sendError = null;
      try {
        console.log(`[CRON] Sending campaign email to: ${contact.email} (Campaign: ${campaign.name})...`);
        await transporter.sendMail({ from: fromName, to: contact.email, subject: finalSubject, html: finalHtml, text: plainTextFallback });
        console.log(`[CRON] SUCCESS: Sent campaign email to ${contact.email}`);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        sendError = error; 
        console.error(`[CRON] SMTP ERROR sending to ${contact.email}:`, error.message);
      }

      const newStatus = sendError ? 'failed' : 'sent';
      const newAttempts = (item.attempts || 0) + 1;
      
      try {
        await supabaseAdmin.from('campaign_contacts').update({ 
          status: newStatus, attempts: newAttempts, error_message: sendError ? sendError.message : null, sent_at: newStatus === 'sent' ? new Date().toISOString() : null
        }).eq('id', item.id);
        
        await supabaseAdmin.from('contacts').update({
          status: newStatus, sent_at: newStatus === 'sent' ? new Date().toISOString() : null
        }).eq('id', contact.id);
        console.log(`[CRON] Database updated for ${contact.email} -> ${newStatus}`);
      } catch (err: any) {
        console.error(`[CRON] DB UPDATE ERROR for ${contact.email}:`, err.message);
      }

      await supabaseAdmin.from('activity_logs').insert({
        action: newStatus === 'sent' ? 'email_sent' : 'email_failed',
        contact_email: contact.email,
        user_id: campaign.user_id,
        details: newStatus === 'sent' ? `Campaign: ${campaign.name}` : `Campaign: ${campaign.name} - Failed (Attempt ${newAttempts}/3): ${sendError?.message || 'Unknown'}`
      });

      if (newStatus === 'sent') sentCount++; else failedCount++;
    }

    // 2. Process Global Pending Contacts (No Campaign)
    for (const contact of globalContacts) {
      const finalSubject = `Hello ${contact.name} - Welcome to MailFlow!`;
      const finalHtml = `<p>Hi ${contact.name},</p><p>We are excited to connect with you from ${contact.company || 'your company'}!</p><br><p>Best,<br>MailFlow Team</p>`;
      const plainTextFallback = finalHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
      
      let sendError = null;
      try {
        console.log(`[CRON] Sending global fallback email to: ${contact.email}...`);
        await transporter.sendMail({ from: zohoEmail, to: contact.email, subject: finalSubject, html: finalHtml, text: plainTextFallback });
        console.log(`[CRON] SUCCESS: Sent global fallback email to ${contact.email}`);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        sendError = error;
        console.error(`[CRON] SMTP ERROR sending global email to ${contact.email}:`, error.message);
      }

      const newStatus = sendError ? 'failed' : 'sent';
      try {
        await supabaseAdmin.from('contacts').update({
          status: newStatus, sent_at: newStatus === 'sent' ? new Date().toISOString() : null
        }).eq('id', contact.id);
        console.log(`[CRON] Global database updated for ${contact.email} -> ${newStatus}`);
      } catch (err: any) {
        console.error(`[CRON] DB UPDATE ERROR for global ${contact.email}:`, err.message);
      }

      await supabaseAdmin.from('activity_logs').insert({
        action: newStatus === 'sent' ? 'email_sent' : 'email_failed',
        contact_email: contact.email,
        user_id: contact.user_id,
        details: newStatus === 'sent' ? `Global Contact Welcome Email Sent` : `Global Contact Welcome Failed: ${sendError?.message || 'Unknown'}`
      });

      if (newStatus === 'sent') sentCount++; else failedCount++;
    }

    return NextResponse.json({ sent: sentCount, failed: failedCount, total: campaignContacts.length + globalContacts.length });
  } catch (error: any) {
    console.error("[CRON] Fatal unhandled error in cron send-emails handler:", error.message);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request, ...args: any[]) {
  try {
    console.log("[CRON] POST request received at /api/cron/send-emails");
    if (process.env.NODE_ENV === 'development') {
      return await handler(request);
    }
    
    if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
      console.error("[CRON] ERROR: QStash signing keys are missing in production environment!");
      return NextResponse.json({ error: "QStash Configuration Error: Missing signing keys." }, { status: 500 });
    }

    try {
      const wrapped = verifySignatureAppRouter(handler);
      return await wrapped(request, ...args);
    } catch (sigErr: any) {
      console.error("[CRON] QStash Signature Verification Failed. Error:", sigErr.message);
      console.error("[CRON] Ensure your Vercel Environment Variables exactly match your QStash Dashboard Keys.");
      return NextResponse.json({ error: "Unauthorized: QStash Signature Verification Failed" }, { status: 401 });
    }
  } catch (error: any) {
    console.error("[CRON] ERROR: Exception caught in POST router:", error.message);
    return NextResponse.json({ error: error.message || "Internal Server Error in POST router" }, { status: 500 });
  }
}

export async function GET(request: Request, ...args: any[]) {
  return POST(request, ...args);
}
