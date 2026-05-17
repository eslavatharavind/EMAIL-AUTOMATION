'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { motion } from 'framer-motion'

const COLORS = {
  sent: '#6366f1',
  failed: '#ef4444',
  pending: '#f59e0b',
  spam: '#8b5cf6',
  opened: '#10b981',
}

interface ChartContact {
  created_at: string
  status: string
  company?: string | null
}

function buildDailyData(contacts: ChartContact[]) {
  const map: Record<string, { date: string; sent: number; failed: number; pending: number }> = {}
  contacts.forEach((c) => {
    const date = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (!map[date]) map[date] = { date, sent: 0, failed: 0, pending: 0 }
    if (c.status === 'sent') map[date].sent++
    else if (c.status === 'failed') map[date].failed++
    else map[date].pending++
  })
  return Object.values(map).slice(-14)
}

function buildStatusData(contacts: ChartContact[]) {
  const sent = contacts.filter((c) => c.status === 'sent').length
  const failed = contacts.filter((c) => c.status === 'failed').length
  const pending = contacts.filter((c) => c.status === 'pending').length
  return [
    { name: 'Sent', value: sent, color: COLORS.sent },
    { name: 'Failed', value: failed, color: COLORS.failed },
    { name: 'Pending', value: pending, color: COLORS.pending },
  ].filter((d) => d.value > 0)
}

function buildCompanyData(contacts: ChartContact[]) {
  const map: Record<string, { company: string; sent: number; failed: number; total: number }> = {}
  contacts.forEach((c) => {
    const co = c.company || 'Unknown'
    if (!map[co]) map[co] = { company: co, sent: 0, failed: 0, total: 0 }
    map[co].total++
    if (c.status === 'sent') map[co].sent++
    else if (c.status === 'failed') map[co].failed++
  })
  return Object.values(map)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map((d) => ({ ...d, company: d.company.length > 12 ? d.company.slice(0, 12) + '…' : d.company }))
}

const TooltipStyle = {
  contentStyle: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#e2e8f0',
  },
}

interface ChartsProps {
  contacts: ChartContact[]
}

export default function AnalyticsCharts({ contacts }: ChartsProps) {
  const daily = buildDailyData(contacts)
  const statusPie = buildStatusData(contacts)
  const companyBar = buildCompanyData(contacts)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Line Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Email Activity</CardTitle>
            <CardDescription>Last 14 days — sent vs failed vs pending</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip {...TooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#64748b' }} />
                <Area type="monotone" dataKey="sent" stroke="#6366f1" fill="url(#sentGrad)" strokeWidth={2} dot={false} name="Sent" />
                <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={false} name="Failed" />
                <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} dot={false} name="Pending" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Pie Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email Status Distribution</CardTitle>
            <CardDescription>Overall breakdown by delivery status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusPie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip {...TooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#64748b' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Bar Chart - Company */}
      <motion.div
        className="lg:col-span-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company-wise Analytics</CardTitle>
            <CardDescription>Email performance segmented by company</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={companyBar} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="company" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip {...TooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#64748b' }} />
                <Bar dataKey="sent" fill="#6366f1" radius={[3, 3, 0, 0]} name="Sent" />
                <Bar dataKey="failed" fill="#ef4444" radius={[3, 3, 0, 0]} name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
