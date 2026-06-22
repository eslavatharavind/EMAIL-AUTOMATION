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
    if (existing) {
      console.log('Already has system template:', existing.id)
      continue;
    }

    const { data: res, error: insErr } = await supabaseAdmin
      .from('email_templates')
      .insert({
        user_id: user.id,
        template_name: 'Professional Default Template',
        subject: 'Test Subject',
        display_name: 'Test Display',
        body: '<p>Test</p>',
        is_system_default: true,
        is_draft: false
      })
      .select('id')
    
    if (insErr) {
      console.error('Insert error for user', user.id, ':', insErr)
    } else {
      console.log('Successfully provisioned:', res)
    }
  }
}

test()
