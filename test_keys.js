const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const fs = require('fs');

try {
  const env = fs.readFileSync('.env.local', 'utf8');
  env.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
} catch (e) {
  console.error("Could not read .env.local", e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const zohoEmail = process.env.ZOHO_EMAIL;
const zohoPassword = process.env.ZOHO_PASSWORD;
const zohoHost = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in';

async function test() {
  console.log("Checking Environment Variables...");
  console.log("NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "Present" : "Missing");
  console.log("SUPABASE_SERVICE_ROLE_KEY:", supabaseKey ? "Present" : "Missing");
  console.log("ZOHO_EMAIL:", zohoEmail ? "Present" : "Missing");
  console.log("ZOHO_PASSWORD:", zohoPassword ? "Present" : "Missing");

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase config invalid");
    process.exit(1);
  }

  try {
    console.log("Initializing Supabase Client...");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from('campaigns').select('id').limit(1);
    if (error) {
      console.error("Supabase query failed:", error);
    } else {
      console.log("Supabase connection successful! Campaigns sample:", data);
    }
  } catch (e) {
    console.error("Supabase initialization crashed:", e.message);
  }

  if (!zohoEmail || !zohoPassword) {
    console.error("Zoho config invalid");
    process.exit(1);
  }

  try {
    console.log("Initializing Zoho Mail Transporter...");
    const transporter = nodemailer.createTransport({
      host: zohoHost,
      port: 465,
      secure: true,
      auth: {
        user: zohoEmail,
        pass: zohoPassword,
      },
    });

    console.log("Verifying Zoho SMTP Transporter connection...");
    const success = await transporter.verify();
    console.log("Zoho SMTP Verification result:", success ? "SUCCESS" : "FAILED");
  } catch (e) {
    console.error("Zoho SMTP verification failed:", e.message);
  }
}

test();
