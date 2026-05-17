'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import StatCard from './StatCard'
import AnalyticsCharts from './AnalyticsCharts'
import EmailTable from './EmailTable'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface Contact {
  id: string
  name: string
  email: string
  phone_number?: string
  company?: string
  subject?: string
  status: string
  created_at: string
  sent_at?: string
}

interface DashboardClientProps {
  initialContacts: Contact[]
}

const staggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07 },
  },
}

export default function DashboardClient({ initialContacts }: DashboardClientProps) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts)
  const [loading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const supabase = createClient()

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('contacts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setContacts((prev) => [payload.new as Contact, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setContacts((prev) =>
              prev.map((c) => (c.id === (payload.new as Contact).id ? (payload.new as Contact) : c))
            )
          } else if (payload.eventType === 'DELETE') {
            setContacts((prev) => prev.filter((c) => c.id !== (payload.old as Contact).id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setContacts(data)
      toast.success('Dashboard refreshed')
    } catch {
      toast.error('Failed to refresh')
    } finally {
      setRefreshing(false)
    }
  }

  // Stats
  const total = contacts.length
  const sent = contacts.filter((c) => c.status === 'sent').length
  const failed = contacts.filter((c) => c.status === 'failed').length
  const pending = contacts.filter((c) => c.status === 'pending').length
  const delivered = contacts.filter((c) => c.status === 'delivered').length
  const spam = contacts.filter((c) => c.status === 'spam').length

  const stats = [
    {
      title: 'Total Emails',
      value: total,
      icon: Mail,
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50',
      trend: 12,
    },
    {
      title: 'Sent',
      value: sent,
      icon: Send,
      iconColor: 'text-sky-600',
      iconBg: 'bg-sky-50',
      trend: 8,
    },
    {
      title: 'Delivered',
      value: delivered || sent,
      icon: CheckCircle2,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      trend: 5,
    },
    {
      title: 'Pending',
      value: pending,
      icon: Clock,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      trend: -3,
    },
    {
      title: 'Failed',
      value: failed,
      icon: XCircle,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-50',
      trend: -7,
    },
    {
      title: 'Spam',
      value: spam,
      icon: AlertTriangle,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-50',
      trend: 0,
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Welcome back! Here&apos;s what&apos;s happening with your emails.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-5 space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          {stats.map((stat, i) => (
            <StatCard key={stat.title} {...stat} delay={i * 0.07} />
          ))}
        </motion.div>
      )}

      {/* Charts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <AnalyticsCharts contacts={contacts} />
      </motion.div>

      {/* Email Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Email History</h2>
          <span className="text-sm text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-400 px-2.5 py-1 rounded-full">
            {contacts.length} total
          </span>
        </div>
        <EmailTable contacts={contacts} />
      </motion.div>
    </div>
  )
}
