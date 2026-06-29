const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://uxrqhcxqxuojrstgehbq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4cnFoY3hxeHVvanJzdGdlaGJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI5MzY2OCwiZXhwIjoyMDkzODY5NjY4fQ.TdYkUMoZMHX-NzFcQCUV7G_73Hf73SPG3XglM-7TlNI'
const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: users, error: uErr } = await supabaseAdmin.auth.admin.listUsers()
  if (uErr) { console.error('uErr', uErr); return; }
  
  for (const user of users.users) {
    console.log(`Checking user: ${user.id} (${user.email})`)
    const { data: existing, error: eErr } = await supabaseAdmin
      .from('email_templates')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_system_default', true)
      .maybeSingle()
      
    if (eErr) console.error('eErr:', eErr)
    const subject = `Simplify Your Hiring Process with RecruiterVibe AI`
    const body = `<p>Hello {{name}},</p>
<p>I noticed your team has been actively hiring, so I thought I'd reach out.</p>
<p>We understand that hiring can be time-consuming, from reviewing hundreds of resumes and coordinating interviews to evaluating candidates. We built RecruiterVibe AI to automate much of that process.</p>
<p>Our platform helps with:</p>
<ul>
  <li>Resume Screening</li>
  <li>Candidate Outreach Automation</li>
  <li>Interview Scheduling and Reminders</li>
  <li>Smart AI Interviewing</li>
  <li>Evaluation Scores and Reports</li>
</ul>
<p>This allows your team to spend less time on repetitive tasks and spend more time engaging with the best candidates.</p>
<p>You can explore the platform here:</p>
<p><a href="https://recruitervibe.in/">https://recruitervibe.in/</a></p>
<p>Or watch a quick demo:</p>
<p><a href="https://www.youtube.com/watch?v=htIaRIu35NI">https://www.youtube.com/watch?v=htIaRIu35NI</a></p>
<p>If you'd like, I'd be happy to arrange a short demo or answer any questions.</p>
<p>Best regards,</p>
<p>RecruiterVibe AI<br>
RecruiterVibe AI Team</p>`

    if (existing) {
      console.log('Updating existing system template for user:', user.id)
      const { data: updateRes, error: upErr } = await supabaseAdmin
        .from('email_templates')
        .update({
          template_name: 'RecruiterVibe AI Outreach',
          subject,
          display_name: 'RecruiterVibe AI',
          body
        })
        .eq('id', existing.id)
        .select('id')
      if (upErr) console.error('Update error:', upErr)
      else console.log('Successfully updated template:', updateRes)
      continue;
    }

    const { data: res, error: insErr } = await supabaseAdmin
      .from('email_templates')
      .insert({
        user_id: user.id,
        template_name: 'RecruiterVibe AI Outreach',
        subject,
        display_name: 'RecruiterVibe AI',
        body,
        is_system_default: true,
        is_draft: false
      })
      .select('id')
    
    if (insErr) {
      console.error('Insert error for user', user.id, ':', insErr)
    } else {
      console.log('Successfully provisioned real template:', res)
    }
  }
}

test()
