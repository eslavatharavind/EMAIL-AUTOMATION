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
        "x-upstash-signature": request.headers.get("x-upstash-signature") ? "present" : "missing",
        "x-vercel-protection-bypass": request.headers.get("x-vercel-protection-bypass") ? "present" : "missing"
      }
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("[CRON] Verifying Supabase Configuration...");
    if (!supabaseUrl) {
      console.error("[CRON] ERROR: NEXT_PUBLIC_SUPABASE_URL is missing!");
      return NextResponse.json({ error: "Configuration Error: NEXT_PUBLIC_SUPABASE_URL environment variable is missing" }, { status: 500 });
    }
    if (!supabaseUrl.startsWith("https://")) {
      console.error("[CRON] ERROR: NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL! Received:", supabaseUrl);
      return NextResponse.json({ error: "Configuration Error: NEXT_PUBLIC_SUPABASE_URL is not a valid HTTPS URL" }, { status: 500 });
    }

    if (!supabaseKey) {
      console.error("[CRON] ERROR: SUPABASE_SERVICE_ROLE_KEY is missing!");
      return NextResponse.json({ error: "Configuration Error: SUPABASE_SERVICE_ROLE_KEY environment variable is missing" }, { status: 500 });
    }
    if (supabaseKey.split('.').length !== 3) {
      console.error("[CRON] ERROR: SUPABASE_SERVICE_ROLE_KEY format check failed. It must be a valid JWT (three dot-separated parts).");
      return NextResponse.json({ error: "Configuration Error: SUPABASE_SERVICE_ROLE_KEY is not a valid JWT structure" }, { status: 500 });
    }

    console.log("[CRON] Supabase config verified successfully.");
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const zohoEmail = process.env.ZOHO_EMAIL;
    const zohoPassword = process.env.ZOHO_PASSWORD;
    const zohoHost = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in';

    console.log("[CRON] Verifying Zoho SMTP Configuration...");
    if (!zohoEmail) {
      console.error("[CRON] ERROR: ZOHO_EMAIL is missing!");
      return NextResponse.json({ error: "Configuration Error: ZOHO_EMAIL environment variable is missing" }, { status: 500 });
    }
    if (!zohoEmail.includes("@")) {
      console.error("[CRON] ERROR: ZOHO_EMAIL is not a valid email address! Received:", zohoEmail);
      return NextResponse.json({ error: "Configuration Error: ZOHO_EMAIL is not a valid email address format" }, { status: 500 });
    }

    if (!zohoPassword) {
      console.error("[CRON] ERROR: ZOHO_PASSWORD is missing!");
      return NextResponse.json({ error: "Configuration Error: ZOHO_PASSWORD environment variable is missing" }, { status: 500 });
    }

    console.log("[CRON] Zoho SMTP config verified successfully.");

    console.log("[CRON] Create Zoho transporter: Creating Nodemailer Zoho transporter...");
    let transporter;
    try {
      transporter = nodemailer.createTransport({
        host: zohoHost,
        port: 465,
        secure: true, 
        auth: {
          user: zohoEmail,
          pass: zohoPassword,
        },
      });
      console.log("[CRON] Create Zoho transporter: Zoho transporter created successfully.");
    } catch (transporterError: any) {
      console.error("[CRON] ERROR: Failed to create Zoho transporter:", transporterError.message);
      return NextResponse.json({ error: `transporter creation failed: ${transporterError.message}` }, { status: 500 });
    }

    console.log("[CRON] Verifying Nodemailer transporter connection...");
    try {
      await transporter.verify();
      console.log("[CRON] Zoho SMTP transport verified successfully!");
    } catch (verifyError: any) {
      console.error("[CRON] ERROR: Zoho SMTP transporter verification failed:", verifyError.message);
      return NextResponse.json({ 
        error: `Zoho SMTP Verification Failed: ${verifyError.message}`,
        reason: "Could not authenticate with Zoho SMTP. Check Zoho credentials, SMTP server status, and Zoho security settings (App Passwords might be required)."
      }, { status: 500 });
    }

    console.log("[CRON] Fetch pending contacts: Fetching pending campaign contacts (limit 50)...");
    let campaignContacts;
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

      if (fetchError) {
        throw fetchError;
      }
      campaignContacts = data;
      console.log(`[CRON] Fetch pending contacts: Fetch completed. Pending campaign contacts count: ${campaignContacts?.length || 0}`);
    } catch (dbError: any) {
      console.error("[CRON] ERROR: Failed to fetch campaign contacts from Supabase:", dbError.message);
      return NextResponse.json({ error: `Database fetch failed: ${dbError.message}` }, { status: 500 });
    }

    // Early exit if the queue is empty
    if (!campaignContacts || campaignContacts.length === 0) {
      console.log("[CRON] No pending campaign contacts found. Scanning for active campaigns to auto-complete...");
      try {
        const { data: runningCampaigns } = await supabaseAdmin
          .from('campaigns')
          .select('id, name, user_id')
          .eq('status', 'running');
        
        if (runningCampaigns && runningCampaigns.length > 0) {
          for (const camp of runningCampaigns) {
            const { count } = await supabaseAdmin
              .from('campaign_contacts')
              .select('*', { count: 'exact', head: true })
              .eq('campaign_id', camp.id)
              .in('status', ['pending', 'failed'])
              .lt('attempts', 3);
            
            if (count === 0) {
              console.log(`[CRON] Campaign "${camp.name}" (${camp.id}) has 0 pending/failed contacts. Auto-marking as completed.`);
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

      return NextResponse.json({ message: 'No pending campaign contacts found', sent: 0 });
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

    // Iterate through each contact
    for (const item of (campaignContacts as any[])) {
      const contact = Array.isArray(item.contacts) ? item.contacts[0] : item.contacts;
      const campaign = Array.isArray(item.campaigns) ? item.campaigns[0] : item.campaigns;
      
      if (!contact || !campaign) {
        console.warn("[CRON] Skipping item: contact or campaign details are missing", item);
        continue;
      }
      
      const templateRaw = campaign.email_templates;
      const template = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw;
      
      if (!template) {
        console.warn(`[CRON] Skipping item: template missing for campaign "${campaign.name}"`, item);
        continue;
      }

      console.log(`[CRON] Fetch template: Fetching template for contact: ${contact.email}. Name: "${template.template_name}", Subject: "${template.subject}"`);

      let finalSubject = "";
      let finalHtml = "";
      try {
        finalSubject = replaceVariables(template.subject || '', contact);
        finalHtml = replaceVariables(template.body || '', contact);
      } catch (replaceErr: any) {
        console.error(`[CRON] ERROR: Failed replacing template variables for ${contact.email}:`, replaceErr.message);
      }

      const fromName = template.display_name 
        ? `"${template.display_name}" <${zohoEmail}>` 
        : zohoEmail;

      let sendError = null;
      const plainTextFallback = finalHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');

      try {
        console.log(`[CRON] Send email: Sending email to: ${contact.email}...`);
        await transporter.sendMail({
          from: fromName,
          to: contact.email,
          subject: finalSubject,
          html: finalHtml,
          text: plainTextFallback
        });
        console.log(`[CRON] Send email: Email successfully sent to: ${contact.email}`);
        
        // Delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        sendError = error; 
        console.error(`[CRON] ERROR: Failed sending email to ${contact.email}:`, error.message);
      }

      const newStatus = sendError ? 'failed' : 'sent';
      const newAttempts = (item.attempts || 0) + 1;
      
      console.log(`[CRON] Update contact status: Updating campaign_contacts record ${item.id} for ${contact.email} to status: ${newStatus}`);
      try {
        const { error: updateError } = await supabaseAdmin
          .from('campaign_contacts')
          .update({ 
            status: newStatus,
            attempts: newAttempts,
            error_message: sendError ? sendError.message : null,
            sent_at: newStatus === 'sent' ? new Date().toISOString() : null
          })
          .eq('id', item.id);

        if (updateError) {
          throw updateError;
        }
        console.log(`[CRON] Update contact status: Successfully updated campaign_contacts record ${item.id} to status: ${newStatus}`);

        // Also update the global contacts table status
        await supabaseAdmin
          .from('contacts')
          .update({
            status: newStatus,
            sent_at: newStatus === 'sent' ? new Date().toISOString() : null
          })
          .eq('id', contact.id);
      } catch (updateError: any) {
        console.error(`[CRON] ERROR: Failed updating campaign_contacts record ${item.id}:`, updateError.message);
      }

      try {
        await supabaseAdmin.from('activity_logs').insert({
          action: newStatus === 'sent' ? 'email_sent' : 'email_failed',
          contact_email: contact.email,
          user_id: campaign.user_id,
          details: newStatus === 'sent' 
            ? `Campaign: ${campaign.name}` 
            : `Campaign: ${campaign.name} - Failed (Attempt ${newAttempts}/3): ${sendError?.message || 'Unknown'}`
        });
      } catch (logError: any) {
        console.error("[CRON] ERROR: Failed to insert activity log:", logError.message);
      }

      if (newStatus === 'sent') sentCount++;
      else failedCount++;
    }

    return NextResponse.json({ sent: sentCount, failed: failedCount, total: campaignContacts.length });
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
    
    // Check if signing keys are present before calling the middleware
    if (!process.env.QSTASH_CURRENT_SIGNING_KEY) {
      console.error("[CRON] ERROR: QStash current signing key (QSTASH_CURRENT_SIGNING_KEY) is missing in production environment!");
      return NextResponse.json({ 
        error: "QStash Configuration Error: Missing signing keys (QSTASH_CURRENT_SIGNING_KEY) in environment."
      }, { status: 500 });
    }

    const wrapped = verifySignatureAppRouter(handler);
    return await wrapped(request, ...args);
  } catch (error: any) {
    console.error("[CRON] ERROR: Exception caught in POST router:", error.message);
    return NextResponse.json({ error: error.message || "Internal Server Error in POST router" }, { status: 500 });
  }
}

export async function GET(request: Request, ...args: any[]) {
  try {
    console.log("[CRON] GET request received at /api/cron/send-emails");
    if (process.env.NODE_ENV === 'development') {
      return await handler(request);
    }
    
    // Check if signing keys are present before calling the middleware
    if (!process.env.QSTASH_CURRENT_SIGNING_KEY) {
      console.error("[CRON] ERROR: QStash current signing key (QSTASH_CURRENT_SIGNING_KEY) is missing in production environment!");
      return NextResponse.json({ 
        error: "QStash Configuration Error: Missing signing keys (QSTASH_CURRENT_SIGNING_KEY) in environment."
      }, { status: 500 });
    }

    const wrapped = verifySignatureAppRouter(handler);
    return await wrapped(request, ...args);
  } catch (error: any) {
    console.error("[CRON] ERROR: Exception caught in GET router:", error.message);
    return NextResponse.json({ error: error.message || "Internal Server Error in GET router" }, { status: 500 });
  }
}
