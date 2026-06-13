import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const MIGRATION_SQL = `
-- ============================================================
-- CAMPAIGNS MIGRATION — safe to run multiple times (IF NOT EXISTS)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  template_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'completed', 'failed', 'paused')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure template_id is correctly mapped as a foreign key
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_template_id_fkey;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.email_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS campaigns_user_id_idx ON campaigns(user_id);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Drop and recreate Campaign policies to avoid "already exists" errors
DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.campaigns;
CREATE POLICY "Users can view their own campaigns" ON public.campaigns FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own campaigns" ON public.campaigns;
CREATE POLICY "Users can insert their own campaigns" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own campaigns" ON public.campaigns;
CREATE POLICY "Users can update their own campaigns" ON public.campaigns FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own campaigns" ON public.campaigns;
CREATE POLICY "Users can delete their own campaigns" ON public.campaigns FOR DELETE USING (auth.uid() = user_id);


-- Campaign Contacts (No user_id column in database schema)
CREATE TABLE IF NOT EXISTS public.campaign_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID,
  contact_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  UNIQUE(campaign_id, contact_id)
);

-- Ensure campaign_id and contact_id are correctly mapped as foreign keys
ALTER TABLE public.campaign_contacts DROP CONSTRAINT IF EXISTS campaign_contacts_campaign_id_fkey;
ALTER TABLE public.campaign_contacts ADD CONSTRAINT campaign_contacts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;

ALTER TABLE public.campaign_contacts DROP CONSTRAINT IF EXISTS campaign_contacts_contact_id_fkey;
ALTER TABLE public.campaign_contacts ADD CONSTRAINT campaign_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;

-- Safely add missing columns if they don't exist
ALTER TABLE public.campaign_contacts ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaign_contacts ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.campaign_contacts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS campaign_contacts_campaign_id_idx ON campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_contacts_status_idx ON campaign_contacts(status);
ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;

-- Drop and recreate Campaign Contacts Policies (Secured via parent campaigns.user_id)
DROP POLICY IF EXISTS "Users can view their own campaign contacts" ON public.campaign_contacts;
CREATE POLICY "Users can view their own campaign contacts" ON public.campaign_contacts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE campaigns.id = campaign_contacts.campaign_id
      AND campaigns.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert their own campaign contacts" ON public.campaign_contacts;
CREATE POLICY "Users can insert their own campaign contacts" ON public.campaign_contacts FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE campaigns.id = campaign_contacts.campaign_id
      AND campaigns.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update their own campaign contacts" ON public.campaign_contacts;
CREATE POLICY "Users can update their own campaign contacts" ON public.campaign_contacts FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE campaigns.id = campaign_contacts.campaign_id
      AND campaigns.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete their own campaign contacts" ON public.campaign_contacts;
CREATE POLICY "Users can delete their own campaign contacts" ON public.campaign_contacts FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE campaigns.id = campaign_contacts.campaign_id
      AND campaigns.user_id = auth.uid()
  )
);
`

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Missing Supabase env variables' }, { status: 500 })
    }

    // Use service role key so we can run DDL statements
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Execute the migration via Supabase's rpc (pg_execute is only on Pro plans)
    // Instead, use the REST API's /rest/v1/rpc endpoint with a raw query function
    // For Supabase projects, the standard approach is to call .rpc('exec_sql', ...) 
    // but this requires a custom function. Instead we run individual statements.

    // Split into individual statements and run each one
    const statements = MIGRATION_SQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 10)

    const errors: string[] = []

    for (const statement of statements) {
      const { error } = await supabaseAdmin.rpc('exec_sql', { sql: statement + ';' }).single()
      if (error && !error.message.includes('already exists')) {
        // Non-fatal: log but continue
        errors.push(error.message)
      }
    }

    if (errors.length > 0) {
      // Fallback: try with pg_execute if exec_sql doesn't exist
      return NextResponse.json({ 
        success: false, 
        message: 'Could not auto-run migration. Please run the SQL manually in Supabase SQL Editor.',
        errors,
        sql: MIGRATION_SQL
      }, { status: 422 })
    }

    return NextResponse.json({ success: true, message: 'Migration completed successfully' })
  } catch (error: any) {
    return NextResponse.json({ 
      success: false,
      error: error.message,
      message: 'Please run the SQL migration manually in Supabase SQL Editor.',
    }, { status: 500 })
  }
}

export async function GET() {
  // Return the migration SQL for easy copy-paste
  return NextResponse.json({ sql: MIGRATION_SQL })
}
