const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://uxrqhcxqxuojrstgehbq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4cnFoY3hxeHVvanJzdGdlaGJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI5MzY2OCwiZXhwIjoyMDkzODY5NjY4fQ.TdYkUMoZMHX-NzFcQCUV7G_73Hf73SPG3XglM-7TlNI'
const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

async function del() {
  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .delete()
    .eq('is_system_default', true)
  
  console.log('Deleted system defaults:', data, error)
}
del()
