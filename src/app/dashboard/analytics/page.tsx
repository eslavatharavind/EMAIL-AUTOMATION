import { createClient } from '@/lib/supabase/server'
import AnalyticsCharts from '@/components/dashboard/AnalyticsCharts'
import { BarChart3 } from 'lucide-react'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from('contacts')
    .select('status, company, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Visualize your email campaign performance.
        </p>
      </div>
      <AnalyticsCharts contacts={contacts || []} />
    </div>
  )
}
