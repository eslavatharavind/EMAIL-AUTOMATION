# EMAIL AUTOMATION | AI-Powered Email Workflow Platform

![Email Automation](https://images.unsplash.com/photo-1596526131083-e8c633c948d2?auto=format&fit=crop&q=80&w=1200&h=400)

## Overview

**EMAIL AUTOMATION** is an AI-powered Email Automation platform designed to simplify email communication and workflow management. This powerful SaaS solution enables users to craft, schedule, and automate email campaigns with ease. 

Features include smart email generation, automated sending, a responsive and premium dashboard UI, secure multi-tenant authentication, and real-time email delivery integration using React, Supabase, and Resend API.

## ✨ Key Features

- **🤖 Smart AI Email Generation**: Leverage artificial intelligence to craft compelling and personalized email content effortlessly.
- **⚡ Automated Workflows**: Schedule and manage automated email sequences with reliable cron triggers.
- **📊 Responsive Dashboard UI**: A modern, premium, glassmorphic interface designed for ease of use across all devices.
- **🔒 Secure Authentication**: Built with secure, multi-tenant user isolation to ensure data privacy.
- **📈 Real-time Delivery Integration**: Reliable delivery and analytics tracking utilizing the Resend API (or Zoho Mail) and Supabase.
- **👥 Contact Management**: Easily import, manage, and segment your mailing lists.

## 🛠️ Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (React)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Email Delivery**: [Resend](https://resend.com/) / Zoho Mail
- **Cron Jobs / Scheduling**: [Upstash QStash](https://upstash.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites

- Node.js (v18 or higher)
- A Supabase account and project
- An API key from your Email Provider (e.g., Resend)
- An Upstash account for QStash (for background scheduling)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd next-email-saas
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Environment Variables**
   Create a `.env.local` file in the root directory and add your credentials. (See `.env.example` for reference).
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   RESEND_API_KEY=your_resend_api_key
   QSTASH_TOKEN=your_qstash_token
   # Add any additional keys required for your specific setup
   ```

4. **Initialize the Database**
   Run the provided `schema.sql` in your Supabase SQL editor to create the necessary tables, Row Level Security (RLS) policies, and triggers.

5. **Run the Development Server**
   ```bash
   npm run dev
   ```

6. **View the Application**
   Open [http://localhost:3000](http://localhost:3000) in your browser to see the app.

## 📁 Project Structure

```text
├── src/
│   ├── app/                # Next.js App Router pages and layouts
│   ├── components/         # Reusable React components (UI, Dashboard, etc.)
│   ├── lib/                # Utility functions, Supabase client, and constants
│   └── styles/             # Global CSS and Tailwind configurations
├── public/                 # Static assets (images, icons)
├── schema.sql              # Database schema for Supabase
└── README.md               # Project documentation
```

## 🤝 Contributing

Contributions are welcome! If you have ideas for new features or improvements, feel free to fork the repository and submit a pull request.

## 📄 License

This project is licensed under the MIT License.
