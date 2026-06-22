'use client'

import { useState } from 'react'
import { Mail, Settings as SettingsIcon, Save } from 'lucide-react'
import { toast } from 'sonner'
import { updateUserSettings } from './actions'

type UserSettings = {
  default_template_id: string | null;
  company_name: string | null;
  display_name: string | null;
  sender_email: string | null;
  company_website: string | null;
  company_phone: string | null;
  company_logo_url: string | null;
  primary_color: string | null;
}

export default function SettingsClient({ 
  user, 
  initialSettings, 
  templates 
}: { 
  user: any; 
  initialSettings: UserSettings | null; 
  templates: any[] 
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    default_template_id: initialSettings?.default_template_id || '',
    company_name: initialSettings?.company_name || '',
    display_name: initialSettings?.display_name || '',
    sender_email: initialSettings?.sender_email || '',
    company_website: initialSettings?.company_website || '',
    company_phone: initialSettings?.company_phone || '',
    company_logo_url: initialSettings?.company_logo_url || '',
    primary_color: initialSettings?.primary_color || '#4f46e5',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const dataToSave = {
        ...formData,
        default_template_id: formData.default_template_id || null
      }
      const res = await updateUserSettings(dataToSave)
      if (!res.success) throw new Error(res.error)
      toast.success('Settings saved successfully')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Manage your account and application preferences.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Account Details */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <div className="flex items-center gap-3 mb-5">
            <Mail className="w-5 h-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Account Info</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* Global Template & Sender Settings */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <div className="flex items-center gap-3 mb-5">
            <SettingsIcon className="w-5 h-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Email Preferences</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Global Default Template</label>
              <p className="text-xs text-slate-500 mb-2">This template will be used for any contact that does not have a specific template assigned.</p>
              <select 
                value={formData.default_template_id}
                onChange={e => setFormData({...formData, default_template_id: e.target.value})}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white text-sm"
              >
                <option value="">-- Use System Default Professional Template --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.template_name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sender Name (Default)</label>
                <input 
                  type="text" 
                  value={formData.display_name} 
                  onChange={e => setFormData({...formData, display_name: e.target.value})} 
                  placeholder="e.g. The MailFlow Team"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white text-sm" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Name</label>
                <input 
                  type="text" 
                  value={formData.company_name} 
                  onChange={e => setFormData({...formData, company_name: e.target.value})} 
                  placeholder="e.g. Acme Corp"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white text-sm" 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sender Email Override</label>
                <input 
                  type="email" 
                  value={formData.sender_email} 
                  onChange={e => setFormData({...formData, sender_email: e.target.value})} 
                  placeholder="e.g. no-reply@example.com"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white text-sm" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Primary Color (Hex)</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={formData.primary_color} 
                    onChange={e => setFormData({...formData, primary_color: e.target.value})} 
                    className="h-9 w-9 rounded border border-slate-200 dark:border-slate-700 cursor-pointer" 
                  />
                  <input 
                    type="text" 
                    value={formData.primary_color} 
                    onChange={e => setFormData({...formData, primary_color: e.target.value})} 
                    className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white text-sm font-mono" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button 
            type="submit" 
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
