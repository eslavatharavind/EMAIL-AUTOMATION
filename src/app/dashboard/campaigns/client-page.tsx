'use client'

import { useState } from 'react'
import { Megaphone, Plus, Play, Pause, Trash2, Settings, Search, AlertTriangle, CheckCircle2, Loader2, Copy, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createCampaign, deleteCampaign, updateCampaign } from './actions'
import { toast } from 'sonner'
import Link from 'next/link'

const MIGRATION_SQL = `-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  template_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'completed', 'failed', 'paused')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Ensure template_id is correctly mapped as a foreign key
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_template_id_fkey;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.email_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS campaigns_user_id_idx ON campaigns(user_id);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own campaigns" ON public.campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own campaigns" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own campaigns" ON public.campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own campaigns" ON public.campaigns FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.campaign_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID,
  contact_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, contact_id)
);
-- Ensure campaign_id and contact_id are correctly mapped as foreign keys
ALTER TABLE public.campaign_contacts DROP CONSTRAINT IF EXISTS campaign_contacts_campaign_id_fkey;
ALTER TABLE public.campaign_contacts ADD CONSTRAINT campaign_contacts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;

ALTER TABLE public.campaign_contacts DROP CONSTRAINT IF EXISTS campaign_contacts_contact_id_fkey;
ALTER TABLE public.campaign_contacts ADD CONSTRAINT campaign_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;

ALTER TABLE public.campaign_contacts ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaign_contacts ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.campaign_contacts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS campaign_contacts_campaign_id_idx ON campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_contacts_status_idx ON campaign_contacts(status);
ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own campaign contacts" ON public.campaign_contacts FOR SELECT USING (EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = campaign_contacts.campaign_id AND campaigns.user_id = auth.uid()));
CREATE POLICY "Users can insert their own campaign contacts" ON public.campaign_contacts FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = campaign_contacts.campaign_id AND campaigns.user_id = auth.uid()));
CREATE POLICY "Users can update their own campaign contacts" ON public.campaign_contacts FOR UPDATE USING (EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = campaign_contacts.campaign_id AND campaigns.user_id = auth.uid()));
CREATE POLICY "Users can delete their own campaign contacts" ON public.campaign_contacts FOR DELETE USING (EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = campaign_contacts.campaign_id AND campaigns.user_id = auth.uid()));`

function MigrationBanner() {
  const [copied, setCopied] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [migrated, setMigrated] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(MIGRATION_SQL)
    setCopied(true)
    toast.success('SQL copied to clipboard!')
    setTimeout(() => setCopied(false), 3000)
  }

  const handleMigrate = async () => {
    setMigrating(true)
    try {
      const res = await fetch('/api/campaigns/migrate', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setMigrated(true)
        toast.success('Migration successful! Refreshing...')
        setTimeout(() => window.location.reload(), 1500)
      } else {
        toast.error(data.message || 'Auto-migration failed. Please run the SQL manually.')
      }
    } catch {
      toast.error('Auto-migration failed. Please copy the SQL and run it manually.')
    } finally {
      setMigrating(false)
    }
  }

  if (migrated) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-400">
        <CheckCircle2 className="w-5 h-5 shrink-0" />
        <span className="font-medium">Migration complete! Refreshing the page...</span>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
      <div className="flex items-start gap-4 p-6 bg-amber-50 dark:bg-amber-900/20">
        <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900 dark:text-amber-300 text-lg mb-1">
            Database Migration Required
          </h3>
          <p className="text-sm text-amber-800 dark:text-amber-400 mb-4">
            The <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded text-xs">campaigns</code> and{' '}
            <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded text-xs">campaign_contacts</code> tables
            don't exist in your Supabase project yet. Choose one of the options below:
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleMigrate}
              disabled={migrating}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {migrating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running Migration...</>
              ) : (
                <><Database className="w-4 h-4 mr-2" /> Auto-Run Migration</>
              )}
            </Button>
            <Button variant="outline" onClick={handleCopy} className="border-amber-300 dark:border-amber-700">
              {copied ? (
                <><CheckCircle2 className="w-4 h-4 mr-2 text-green-600" /> Copied!</>
              ) : (
                <><Copy className="w-4 h-4 mr-2" /> Copy SQL</>
              )}
            </Button>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-amber-300 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
            >
              Open Supabase SQL Editor ↗
            </a>
          </div>
        </div>
      </div>

      <div className="p-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium uppercase tracking-wide">SQL to run manually:</p>
        <pre className="text-xs bg-slate-950 text-green-400 p-4 rounded-lg overflow-x-auto max-h-64 leading-relaxed whitespace-pre-wrap font-mono">
          {MIGRATION_SQL}
        </pre>
      </div>
    </div>
  )
}

export default function CampaignsClientPage({
  campaigns,
  templates,
  migrationRequired = false,
}: {
  campaigns: any[]
  templates: any[]
  migrationRequired?: boolean
}) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newCampaignName, setNewCampaignName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await createCampaign({ name: newCampaignName, template_id: selectedTemplate || undefined })
      if (!res.success) throw new Error(res.error ?? 'Unknown error')
      toast.success('Campaign created')
      setIsCreateModalOpen(false)
      setNewCampaignName('')
      setSelectedTemplate('')
      window.location.reload()
    } catch (err: any) {
      toast.error(err.message || 'Error creating campaign')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete campaign "${name}"?`)) return
    try {
      const res = await deleteCampaign(id, name)
      if (!res.success) throw new Error(res.error ?? 'Unknown error')
      toast.success('Campaign deleted')
      window.location.reload()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      if (status === 'running') {
        toast.loading('Starting campaign...', { id: 'trigger' })
        const triggerRes = await fetch('/api/campaigns/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId: id })
        })
        const triggerData = await triggerRes.json()
        toast.dismiss('trigger')
        if (!triggerRes.ok || triggerData.error) {
          throw new Error(triggerData.error || 'Failed to start campaign')
        }
        toast.success(`Campaign completed successfully! Sent: ${triggerData.sent ?? 0}, Failed: ${triggerData.failed ?? 0}`)
      } else {
        const res = await updateCampaign(id, { status })
        if (!res.success) throw new Error(res.error ?? 'Unknown error')
        toast.success(`Campaign paused successfully`)
      }

      window.location.reload()
    } catch (err: any) {
      toast.dismiss('trigger')
      toast.error(err.message)
    }
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      running: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      scheduled: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      draft: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? map.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Campaigns</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage and run your email campaigns.
          </p>
        </div>
        {!migrationRequired && (
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            New Campaign
          </Button>
        )}
      </div>

      {/* Migration Banner */}
      {migrationRequired && <MigrationBanner />}

      {/* Search */}
      {!migrationRequired && campaigns.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full max-w-sm pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      )}

      {/* Empty state */}
      {!migrationRequired && filteredCampaigns.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No campaigns yet</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-6">
            Create your first email campaign and start reaching your audience.
          </p>
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Create Campaign
          </Button>
        </div>
      )}

      {/* Campaigns Table */}
      {!migrationRequired && filteredCampaigns.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 uppercase">
                <tr>
                  <th className="px-6 py-4 font-medium">Campaign Name</th>
                  <th className="px-6 py-4 font-medium">Template</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-center">Audience</th>
                  <th className="px-6 py-4 font-medium text-center">Sent</th>
                  <th className="px-6 py-4 font-medium text-center">Failed</th>
                  <th className="px-6 py-4 font-medium text-center">Delivery</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredCampaigns.map((camp) => {
                  const deliveryRate = camp.total_contacts > 0
                    ? Math.round((camp.sent_count / camp.total_contacts) * 100)
                    : 0

                  return (
                    <tr key={camp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        <Link href={`/dashboard/campaigns/${camp.id}`} className="hover:underline">
                          {camp.name}
                        </Link>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {new Date(camp.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        {camp.email_templates?.template_name ?? (
                          <span className="text-amber-500 text-xs">No template</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(camp.status)}
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-slate-700 dark:text-slate-300">
                        {camp.total_contacts}
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-green-600">
                        {camp.sent_count}
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-red-500">
                        {camp.failed_count}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-semibold ${deliveryRate >= 80 ? 'text-green-600' : deliveryRate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                          {deliveryRate}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/dashboard/campaigns/${camp.id}`}>
                            <Button variant="outline" size="sm" className="h-8">
                              <Settings className="w-4 h-4 mr-1.5" />
                              Manage
                            </Button>
                          </Link>
                          {(camp.status === 'draft' || camp.status === 'paused') && (
                            <Button
                              size="sm"
                              className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => handleUpdateStatus(camp.id, 'running')}
                              disabled={!camp.template_id || camp.total_contacts === 0}
                              title={!camp.template_id ? 'Select a template first' : camp.total_contacts === 0 ? 'Add contacts first' : 'Run campaign'}
                            >
                              <Play className="w-4 h-4 mr-1.5" />
                              Run
                            </Button>
                          )}
                          {camp.status === 'running' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                              onClick={() => handleUpdateStatus(camp.id, 'paused')}
                            >
                              <Pause className="w-4 h-4 mr-1.5" />
                              Pause
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => handleDelete(camp.id, camp.name)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Campaign Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">New Campaign</h2>
              <p className="text-sm text-slate-500 mt-1">Create an email campaign to send to your audience.</p>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Campaign Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCampaignName}
                  onChange={e => setNewCampaignName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Q3 Newsletter, Product Launch"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email Template <span className="text-slate-400">(optional — can set later)</span>
                </label>
                <select
                  value={selectedTemplate}
                  onChange={e => setSelectedTemplate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- Select a Template --</option>
                  {templates.filter(t => !t.is_draft).map(t => (
                    <option key={t.id} value={t.id}>{t.template_name}</option>
                  ))}
                </select>
                {templates.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No templates yet.{' '}
                    <Link href="/dashboard/templates" className="underline">Create one first</Link>.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting || !newCampaignName.trim()}>
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>
                  ) : 'Create Campaign'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
