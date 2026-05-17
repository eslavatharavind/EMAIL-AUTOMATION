import { createClient } from '@/lib/supabase/server'
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Activity, Import, Mail, Cpu } from 'lucide-react'

const actionMap: Record<string, { label: string; icon: React.ReactNode; badge: 'info' | 'success' | 'warning' | 'default' }> = {
  import: { label: 'Contact Import', icon: <Import className="w-4 h-4" />, badge: 'info' },
  manual_send: { label: 'Manual Email Send', icon: <Mail className="w-4 h-4" />, badge: 'success' },
  cron_send: { label: 'Automated Send (Cron)', icon: <Cpu className="w-4 h-4" />, badge: 'warning' },
}

export default async function ActivityLogsPage() {
  const supabase = await createClient()

  const { data: logs } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Activity Logs</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          A chronological record of all email actions.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {logs && logs.length > 0 ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {logs.map((log) => {
              const cfg = actionMap[log.action] ?? { label: log.action, icon: <Activity className="w-4 h-4" />, badge: 'default' as const }
              return (
                <li key={log.id} className="p-4 sm:px-6 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                        {cfg.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{cfg.label}</p>
                          <Badge variant={cfg.badge}>{log.action}</Badge>
                        </div>
                        {log.details && (
                          <p className="text-sm text-slate-500 dark:text-slate-400">{log.details}</p>
                        )}
                        {log.contact_email && (
                          <p className="text-xs text-slate-400 mt-0.5">{log.contact_email}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-3">
              <Activity className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium">No activity logs yet</p>
            <p className="text-sm text-slate-400 mt-1">Import contacts or send emails to see activity here.</p>
          </div>
        )}
      </div>
    </div>
  )
}
