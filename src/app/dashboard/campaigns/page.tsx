import { Megaphone, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Campaigns</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Create and manage your email campaigns.
          </p>
        </div>
        <Button variant="primary">
          <Plus className="w-4 h-4 mr-1.5" />
          New Campaign
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
          <Megaphone className="w-7 h-7 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No campaigns yet</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-6">
          Create your first email campaign and start reaching your audience.
        </p>
        <Button variant="primary">
          <Plus className="w-4 h-4 mr-1.5" />
          Create Campaign
        </Button>
      </div>
    </div>
  )
}
