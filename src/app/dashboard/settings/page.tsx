import { createClient } from '@/lib/supabase/server'
import { Settings, Mail, Key, Bell, Globe } from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Manage your account and application preferences.
        </p>
      </div>

      {/* Profile */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex items-center gap-3 mb-5">
          <Mail className="w-5 h-5 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Account</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Email Address</label>
            <div className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300">
              {user?.email ?? '—'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">User ID</label>
            <div className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-400 font-mono">
              {user?.id ?? '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications placeholder */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-5 h-5 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Notifications</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Notification preferences — coming soon.
        </p>
      </div>

      {/* API Keys placeholder */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Key className="w-5 h-5 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">API & Integrations</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage API keys and third-party integrations — coming soon.
        </p>
      </div>
    </div>
  )
}
