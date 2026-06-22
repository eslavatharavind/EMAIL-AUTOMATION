export function verifyEnvVariables() {
  const variables = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'QSTASH_TOKEN',
    'QSTASH_CURRENT_SIGNING_KEY',
    'QSTASH_NEXT_SIGNING_KEY',
    'ZOHO_EMAIL',
    'ZOHO_PASSWORD'
  ];

  console.log('--- Environment Variables Check ---');
  variables.forEach(v => {
    const exists = !!process.env[v];
    console.log(`[ENV CHECK] ${v}: ${exists ? '✅ Present' : '❌ Missing'}`);
  });
  console.log('-----------------------------------');
}
