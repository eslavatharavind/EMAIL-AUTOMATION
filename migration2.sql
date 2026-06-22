-- Migration 2: Editable System Default Template

-- 1. Add is_system_default column to email_templates
ALTER TABLE public.email_templates 
  ADD COLUMN IF NOT EXISTS is_system_default BOOLEAN DEFAULT FALSE;

-- 2. Optional: Ensure unique index so a user only has ONE system default template
CREATE UNIQUE INDEX IF NOT EXISTS unique_system_default_per_user 
  ON public.email_templates (user_id) 
  WHERE is_system_default = TRUE;
