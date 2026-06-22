import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"
import { resolveTemplate, sendSharedEmail } from '@/lib/email-service'

async function handler(request: Request) {
  try {
    console.log("[CRON] Cron started: send-emails cron process started");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("[CRON] ERROR: Supabase credentials missing");
      return NextResponse.json({ error: "Configuration Error: Supabase credentials missing" }, { status: 500 });
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

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
    } catch (dbError: any) {
      console.error("[CRON] ERROR: Failed to fetch campaign contacts:", dbError.message);
      return NextResponse.json({ error: `Database fetch failed: ${dbError.message}` }, { status: 500 });
    }

    console.log("[CRON] Fetching global pending contacts (limit 50)...");
    let globalContacts: any[] = [];
    try {
      const { data, error: fetchGlobalError } = await supabaseAdmin
        .from('contacts')
        .select(`
          id, name, email, company, phone_number, source, user_id,
          email_templates ( id, template_name, subject, display_name, body )
        `)
        .eq('status', 'pending')
        .limit(50);
        
      if (fetchGlobalError) throw fetchGlobalError;
      globalContacts = data || [];
    } catch (dbError: any) {
      console.error("[CRON] ERROR: Failed to fetch global contacts:", dbError.message);
    }

    if (campaignContacts.length === 0 && globalContacts.length === 0) {
      return NextResponse.json({ message: 'No pending contacts found to process', sent: 0, failed: 0, total: 0 });
    }

    // Pre-fetch user settings for all unique users involved
    const userIds = new Set<string>()
    campaignContacts.forEach(c => {
      const camp = Array.isArray(c.campaigns) ? c.campaigns[0] : c.campaigns
      if (camp?.user_id) userIds.add(camp.user_id)
    })
    globalContacts.forEach(c => { if (c.user_id) userIds.add(c.user_id) })

    const userSettingsMap: Record<string, any> = {}
    if (userIds.size > 0) {
      const { data: settings } = await supabaseAdmin
        .from('user_settings')
        .select('*, email_templates ( id, template_name, subject, display_name, body )')
        .in('user_id', Array.from(userIds))
      if (settings) {
        settings.forEach(s => userSettingsMap[s.user_id] = s)
      }
    }

    let sentCount = 0;
    let failedCount = 0;

    // 1. Process Campaign Contacts
    for (const item of campaignContacts) {
      const contact = Array.isArray(item.contacts) ? item.contacts[0] : item.contacts;
      const campaign = Array.isArray(item.campaigns) ? item.campaigns[0] : item.campaigns;
      
      if (!contact || !campaign) continue;
      
      const templateRaw = campaign.email_templates;
      const campaignTemplate = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw;
      const userSettings = userSettingsMap[campaign.user_id] || {}
      const globalDefaultTemplate = userSettings.email_templates

      const templateOptions = await resolveTemplate(
        campaignTemplate,
        null, // Campaign overrides contact assigned template
        globalDefaultTemplate,
        contact,
        userSettings
      )

      const res = await sendSharedEmail({
        contact,
        campaignId: campaign.id,
        campaignContactId: item.id,
        templateOptions,
        userId: campaign.user_id,
        userSettings
      })

      if (res.success) sentCount++; else failedCount++;
    }

    // 2. Process Global Pending Contacts (No Campaign)
    for (const contact of globalContacts) {
      const userSettings = userSettingsMap[contact.user_id] || {}
      const globalDefaultTemplate = userSettings.email_templates
      const contactTemplate = contact.email_templates

      const templateOptions = await resolveTemplate(
        null, // No campaign
        contactTemplate,
        globalDefaultTemplate,
        contact,
        userSettings
      )

      const res = await sendSharedEmail({
        contact,
        templateOptions,
        userId: contact.user_id,
        userSettings
      })

      if (res.success) sentCount++; else failedCount++;
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
