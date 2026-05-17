import { FileText, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase.from('contacts').select('status').limit(1000)

  const total = contacts?.length ?? 0
  const sent = contacts?.filter((c) => c.status === 'sent').length ?? 0
  const failed = contacts?.filter((c) => c.status === 'failed').length ?? 0
  const pending = contacts?.filter((c) => c.status === 'pending').length ?? 0
  const deliveryRate = total > 0 ? ((sent / total) * 100).toFixed(1) : '0'
  const failureRate = total > 0 ? ((failed / total) * 100).toFixed(1) : '0'

  const reportCards = [
    { label: 'Total Emails', value: total, description: 'All time email records' },
    { label: 'Delivery Rate', value: `${deliveryRate}%`, description: 'Successfully sent emails' },
    { label: 'Failure Rate', value: `${failureRate}%`, description: 'Failed delivery attempts' },
    { label: 'Pending Queue', value: pending, description: 'Waiting to be sent' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Download and review campaign performance reports.
          </p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-1.5" />
          Export Report
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportCards.map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5"
          >
            <p className="text-sm text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{card.value}</p>
            <p className="text-xs text-slate-400 mt-1">{card.description}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
          <FileText className="w-7 h-7 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Detailed reports coming soon</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Advanced reporting with time-series and segment breakdowns.
        </p>
      </div>
    </div>
  )
}
