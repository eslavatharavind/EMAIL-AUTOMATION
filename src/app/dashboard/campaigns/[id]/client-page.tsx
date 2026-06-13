'use client'

import { useState } from 'react'
import { ArrowLeft, Play, Pause, Save, UserPlus, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { toast } from 'sonner'
import { updateCampaign, addContactsToCampaign, removeContactFromCampaign } from '../actions'

export default function CampaignDetailsClient({ campaign, campaignContacts, allContacts, templates }: { campaign: any, campaignContacts: any[], allContacts: any[], templates: any[] }) {
  const [selectedTemplate, setSelectedTemplate] = useState(campaign.template_id || '')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isManageAudienceOpen, setIsManageAudienceOpen] = useState(false)
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])

  // Analytics
  const total = campaignContacts.length
  const sent = campaignContacts.filter(c => c.status === 'sent').length
  const failed = campaignContacts.filter(c => c.status === 'failed').length
  const pending = campaignContacts.filter(c => c.status === 'pending').length
  const deliveryRate = total > 0 ? Math.round((sent / total) * 100) : 0

  const handleSaveSettings = async () => {
    setIsUpdating(true)
    try {
      const res = await updateCampaign(campaign.id, { template_id: selectedTemplate || null })
      if (!res.success) throw new Error(res.error)
      toast.success('Campaign settings saved')
      window.location.reload()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleStatusChange = async (status: string) => {
    setIsUpdating(true)
    try {
      const res = await updateCampaign(campaign.id, { status })
      if (!res.success) throw new Error(res.error)

      if (status === 'running') {
        toast.loading('Campaign started — sending emails now...', { id: 'run-campaign' })
        // Immediately trigger the email processor so emails begin sending right away
        const triggerRes = await fetch('/api/campaigns/trigger', { method: 'POST' })
        const triggerData = await triggerRes.json()
        toast.dismiss('run-campaign')
        toast.success(`Campaign running! Sent: ${triggerData.sent ?? 0}, Failed: ${triggerData.failed ?? 0} in this batch.`)
      } else {
        toast.success(`Campaign ${status}`)
      }

      window.location.reload()
    } catch (err: any) {
      toast.dismiss('run-campaign')
      toast.error(err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAddAllContacts = async () => {
    if (!confirm('Add ALL contacts to this campaign?')) return
    try {
      const res = await addContactsToCampaign(campaign.id, 'all')
      if (!res.success) throw new Error(res.error)
      toast.success('All contacts added')
      window.location.reload()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleAddSelectedContacts = async () => {
    if (selectedContacts.length === 0) return toast.error('No contacts selected')
    try {
      const res = await addContactsToCampaign(campaign.id, selectedContacts)
      if (!res.success) throw new Error(res.error)
      toast.success('Selected contacts added')
      setIsManageAudienceOpen(false)
      setSelectedContacts([])
      window.location.reload()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleRemoveContact = async (contactId: string) => {
    try {
      const res = await removeContactFromCampaign(campaign.id, contactId)
      if (!res.success) throw new Error(res.error)
      toast.success('Contact removed from campaign')
      window.location.reload()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Get contacts not already in the campaign
  const existingContactIds = new Set(campaignContacts.map(c => c.contact_id))
  const availableContacts = allContacts.filter(c => !existingContactIds.has(c.id))

  const toggleContactSelection = (id: string) => {
    setSelectedContacts(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id])
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Running</span>
      case 'completed': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Completed</span>
      case 'failed': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Failed</span>
      case 'paused': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Paused</span>
      case 'scheduled': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Scheduled</span>
      default: return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Draft</span>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/campaigns">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{campaign.name}</h1>
              {getStatusBadge(campaign.status)}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Created on {new Date(campaign.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          {(campaign.status === 'draft' || campaign.status === 'paused') ? (
            <Button 
              variant="primary" 
              className="bg-blue-600 hover:bg-blue-700" 
              onClick={() => handleStatusChange('running')}
              disabled={isUpdating || !campaign.template_id || total === 0}
            >
              <Play className="w-4 h-4 mr-1.5" />
              Run Campaign
            </Button>
          ) : campaign.status === 'running' ? (
            <Button 
              variant="outline" 
              className="text-yellow-600 border-yellow-200 hover:bg-yellow-50" 
              onClick={() => handleStatusChange('paused')}
              disabled={isUpdating}
            >
              <Pause className="w-4 h-4 mr-1.5" />
              Pause Campaign
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-500 mb-1">Total Contacts</div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">{total}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-500 mb-1">Delivered</div>
          <div className="text-3xl font-bold text-green-600">{sent}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-500 mb-1">Failed</div>
          <div className="text-3xl font-bold text-red-600">{failed}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-500 mb-1">Delivery Rate</div>
          <div className="text-3xl font-bold text-blue-600">{deliveryRate}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 h-fit">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Template</label>
              <select 
                value={selectedTemplate} 
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent"
                disabled={campaign.status === 'running'}
              >
                <option value="">Select a template...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.template_name}</option>
                ))}
              </select>
            </div>
            <Button 
              className="w-full" 
              onClick={handleSaveSettings} 
              disabled={isUpdating || campaign.template_id === selectedTemplate}
            >
              <Save className="w-4 h-4 mr-1.5" />
              Save Settings
            </Button>
          </div>
        </div>

        {/* Audience Panel */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Audience ({pending} pending)</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsManageAudienceOpen(true)}>
                <UserPlus className="w-4 h-4 mr-1.5" />
                Add Contacts
              </Button>
            </div>
          </div>
          
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Attempts</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {campaignContacts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No contacts in this campaign. Add some to get started.
                    </td>
                  </tr>
                ) : campaignContacts.map(cc => (
                  <tr key={cc.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">{cc.contacts?.name || 'Unknown'}</div>
                      <div className="text-xs text-slate-500">{cc.contacts?.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {cc.status === 'sent' ? <span className="text-green-600 font-medium">Sent</span> : 
                       cc.status === 'failed' ? <span className="text-red-600 font-medium">Failed</span> : 
                       <span className="text-slate-500 font-medium">Pending</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{cc.attempts} / 3</td>
                    <td className="px-4 py-3 text-xs text-red-500 max-w-[200px] truncate" title={cc.error_message}>
                      {cc.error_message}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {cc.status === 'pending' && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleRemoveContact(cc.contact_id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Audience Manager Modal */}
      {isManageAudienceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Contacts to Campaign</h2>
              <Button variant="outline" size="sm" onClick={handleAddAllContacts}>
                <Users className="w-4 h-4 mr-1.5" />
                Add All My Contacts
              </Button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {availableContacts.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  All your contacts are already in this campaign!
                </div>
              ) : (
                <div className="space-y-2">
                  {availableContacts.map(c => (
                    <label key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedContacts.includes(c.id)} 
                        onChange={() => toggleContactSelection(c.id)}
                        className="rounded border-slate-300"
                      />
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.email}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
              <Button variant="outline" onClick={() => { setIsManageAudienceOpen(false); setSelectedContacts([]) }}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleAddSelectedContacts} disabled={selectedContacts.length === 0}>
                Add {selectedContacts.length} Contacts
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
