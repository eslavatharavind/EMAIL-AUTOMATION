import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAdmin = createSupabaseAdmin(supabaseUrl, supabaseKey)

export async function provisionTemplateForUser(userId: string) {
  console.log(`[TEMPLATE-PROVISIONING] Started checking system default template for user: ${userId}`);
  
  try {
    // Check if system default template exists for this user
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('email_templates')
      .select('id')
      .eq('user_id', userId)
      .eq('is_system_default', true)
      .maybeSingle()

    if (checkError) {
      console.error(`[TEMPLATE-PROVISIONING] Error checking existing template for user ${userId}:`, checkError.message);
      throw checkError;
    }

    if (existing) {
      console.log(`[TEMPLATE-PROVISIONING] System default template already exists: ${existing.id} for user ${userId}`);
      return existing.id;
    }

    console.log(`[TEMPLATE-PROVISIONING] No system default template found. Creating one for user: ${userId}`);

    const subject = `Welcome to {{company}}, {{name}}!`
    const body = `
<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 32px 20px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
  <!-- Header -->
  <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 32px;">
    <h1 style="color: {{primary_color}}; margin: 0 0 20px 0; font-size: 24px;">{{company}}</h1>
  </div>
  <!-- Body -->
  <h2 style="color: #0f172a; font-size: 20px; font-weight: 600; margin-top: 0;">Hello {{name}},</h2>
  <p style="margin-bottom: 16px; font-size: 16px;">We are absolutely thrilled to connect with you. At {{company}}, we believe in fostering strong relationships and driving innovation.</p>
  <p style="margin-bottom: 24px; font-size: 16px;">We noticed your exceptional background and would love to explore how we can collaborate. Our platform is designed to streamline your workflows and elevate your business.</p>
  <!-- CTA -->
  <div style="text-align: center; margin: 32px 0;">
    <a href="{{company_website}}" style="background-color: {{primary_color}}; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; transition: opacity 0.2s;">Get Started Today</a>
  </div>
  <!-- Footer -->
  <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9; color: #64748b; font-size: 14px;">
    <p style="margin: 0 0 4px 0;">Best Regards,</p>
    <p style="margin: 0; font-weight: 600; color: #334155;">{{display_name}}</p>
    <p style="margin: 0;">{{company}}</p>
    <p style="margin: 0;">{{company_phone}}</p>
    <p style="margin: 0;">
      <a href="mailto:{{sender_email}}" style="color: {{primary_color}}; text-decoration: none;">{{sender_email}}</a>
    </p>
  </div>
</div>`

    const { data: newTemplate, error: insertError } = await supabaseAdmin
      .from('email_templates')
      .insert({
        user_id: userId,
        template_name: 'Professional Default Template',
        subject,
        display_name: '{{display_name}}',
        body,
        is_system_default: true,
        is_draft: false
      })
      .select('id')
      .single()

    if (insertError) {
      console.error(`[TEMPLATE-PROVISIONING] Error inserting system default template for user ${userId}:`, insertError.message);
      return null;
    }

    console.log(`[TEMPLATE-PROVISIONING] Successfully provisioned system default template: ${newTemplate.id} for user ${userId}`);
    return newTemplate.id;

  } catch (error: any) {
    console.error(`[TEMPLATE-PROVISIONING] Exception caught while provisioning for user ${userId}:`, error.message);
    return null;
  }
}
