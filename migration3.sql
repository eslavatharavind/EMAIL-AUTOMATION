-- Migration 3: Shared Team Workspace Architecture

-- 1. Drop existing user-isolated policies
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.contacts;

DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can insert their own activity logs" ON public.activity_logs;

DROP POLICY IF EXISTS "Users can view their own email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can insert their own email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can update their own email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can delete their own email templates" ON public.email_templates;

DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can insert their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON public.campaigns;

DROP POLICY IF EXISTS "Users can view their own campaign contacts" ON public.campaign_contacts;
DROP POLICY IF EXISTS "Users can insert their own campaign contacts" ON public.campaign_contacts;
DROP POLICY IF EXISTS "Users can update their own campaign contacts" ON public.campaign_contacts;
DROP POLICY IF EXISTS "Users can delete their own campaign contacts" ON public.campaign_contacts;

DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;


-- 2. Create shared RLS policies (allow any authenticated user to select/insert/update/delete)

-- Contacts
CREATE POLICY "Authenticated users can view contacts" ON public.contacts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert contacts" ON public.contacts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update contacts" ON public.contacts FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete contacts" ON public.contacts FOR DELETE USING (auth.uid() IS NOT NULL);

-- Activity Logs
CREATE POLICY "Authenticated users can view activity logs" ON public.activity_logs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert activity logs" ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Email Templates
CREATE POLICY "Authenticated users can view email templates" ON public.email_templates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert email templates" ON public.email_templates FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update email templates" ON public.email_templates FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete email templates" ON public.email_templates FOR DELETE USING (auth.uid() IS NOT NULL);

-- Campaigns
CREATE POLICY "Authenticated users can view campaigns" ON public.campaigns FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert campaigns" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update campaigns" ON public.campaigns FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete campaigns" ON public.campaigns FOR DELETE USING (auth.uid() IS NOT NULL);

-- Campaign Contacts
CREATE POLICY "Authenticated users can view campaign contacts" ON public.campaign_contacts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert campaign contacts" ON public.campaign_contacts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update campaign contacts" ON public.campaign_contacts FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete campaign contacts" ON public.campaign_contacts FOR DELETE USING (auth.uid() IS NOT NULL);

-- User Settings
CREATE POLICY "Authenticated users can view user settings" ON public.user_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert user settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update user settings" ON public.user_settings FOR UPDATE USING (auth.uid() IS NOT NULL);
