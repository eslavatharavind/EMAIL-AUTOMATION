-- Migration: Advanced Template System & User Settings

-- 1. Create User Settings Table
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  company_name TEXT,
  display_name TEXT,
  sender_email TEXT,
  company_website TEXT,
  company_phone TEXT,
  company_logo_url TEXT,
  primary_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for User Settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Policies for User Settings
CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- 2. Add template_id to contacts
ALTER TABLE public.contacts 
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL;
