// Import the Metadata type from Next.js to provide typing for our SEO tags
import type { Metadata } from "next";
// Import Google Fonts (Geist and Geist Mono) from the next/font/google package
import { Geist, Geist_Mono } from "next/font/google";
// Import the global CSS file which contains Tailwind directives and global styles
import "./globals.css";
// Import the Toaster component from the 'sonner' library to display toast notifications
import { Toaster } from 'sonner'
import { verifyEnvVariables } from '@/lib/env-check'

// Configure the Geist Sans font
const geistSans = Geist({
  // Set a CSS variable name so we can reference it in Tailwind or CSS
  variable: "--font-geist-sans",
  // Specify that we only want the Latin character subset to reduce bundle size
  subsets: ["latin"],
});

// Configure the Geist Mono font for monospaced text
const geistMono = Geist_Mono({
  // Set a CSS variable name for the mono font
  variable: "--font-geist-mono",
  // Specify the Latin subset
  subsets: ["latin"],
});

// Export the metadata object which Next.js will use to generate <head> tags
export const metadata: Metadata = {
  // Set the default page title
  title: "EMAIL AUTOMATION | AI-Powered Email Workflow Platform",
  // Set the default meta description for SEO
  description: "AI-powered Email Automation platform designed to simplify email communication and workflow management. Features include smart email generation, automated sending, responsive dashboard UI, secure authentication, and real-time email delivery integration using React, Supabase, and Resend API.",
  // Set keywords to help search engines understand the page content
  keywords: "Email Automation, AI Email Generator, React Email App, Supabase, Resend API, Email Workflow Platform, AI Automation",
  // Set the author of the page
  authors: [{ name: "RecruiterVibe" }]
};

// Export the default RootLayout component, which wraps every page in the application
export default function RootLayout({
  // Destructure the 'children' prop which represents the nested pages
  children,
// Define the TypeScript types for the props: children must be a valid React Node
}: Readonly<{
  children: React.ReactNode;
}>) {
  verifyEnvVariables();

  // Return the base HTML structure
  return (
    // Render the <html> tag, set language to English
    <html
      lang="en"
      // Apply the font CSS variables, ensure full height, and apply antialiasing for smoother fonts
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Render the <body> tag, ensuring it takes at least the full viewport height and uses flexbox */}
      <body className="min-h-full flex flex-col">
        {/* Render the child pages/components inside the body */}
        {children}
        {/* Render the Toaster component in the top-right corner so notifications can appear anywhere */}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
