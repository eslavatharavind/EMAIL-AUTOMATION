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

    const subject = `Are you spending too much time outreaching candidates?`
    const body = `<p>Hello {{name}},</p>
<p>I noticed your team has been actively hiring, so I thought I'd reach out.</p>
<p>We understand that hiring can be time-consuming – from reviewing hundreds of resumes and coordinating interviews to evaluating candidates. We built <strong>RecruiterVibe AI</strong> to automate your hiring process.</p>
<p><strong>Our platform helps with:</strong><br>
- Resume screening<br>
- Outreaching candidates<br>
- Interview scheduling and Reminding<br>
- Smart Interviewing<br>
- Evaluation Scores and Reports</p>
<p>This allows your team to spend less time on repetitive tasks and spend more time engaging with the best candidates.</p>
<p><strong>Explore our platform</strong><br>
<a href="https://www.recruitervibe.in/">https://www.recruitervibe.in/</a></p>
<p><strong>Watch a quick demo</strong><br>
<a href="https://www.youtube.com/watch?v=htIaRIu35NI">https://www.youtube.com/watch?v=htIaRIu35NI</a></p>
<p>If you'd like, I'd be happy to arrange a short demo or answer any questions.</p>
<p>Best regards,<br>
{{name}}<br>
RecruiterVibe AI Team,</p>`


    const { data: newTemplate, error: insertError } = await supabaseAdmin
      .from('email_templates')
      .insert({
        user_id: userId,
        template_name: 'Default Template',
        subject,
        display_name: 'Aravind From RecruiterVibe AI',
        body,
        is_system_default: true,
        is_draft: false
      })
      .select('id')
      .single()

    if (insertError) {
      console.error(`[TEMPLATE - PROVISIONING] Error inserting system default template for user ${userId}: `, insertError.message);
      return null;
    }

    console.log(`[TEMPLATE - PROVISIONING] Successfully provisioned system default template: ${newTemplate.id} for user ${userId}`);
    return newTemplate.id;

  } catch (error: any) {
    console.error(`[TEMPLATE - PROVISIONING] Exception caught while provisioning for user ${userId}: `, error.message);
    return null;
  }
}
