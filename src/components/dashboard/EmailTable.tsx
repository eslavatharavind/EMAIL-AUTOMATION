'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import * as XLSX from 'xlsx'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  SortAsc,
  SortDesc,
  ArrowUpDown,
  Mail,
  Building2,
  Phone,
  User,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

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

interface EmailTableProps {
  contacts: Contact[]
  loading?: boolean
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info' | 'purple'; icon: React.ReactNode; label: string }> = {
    sent: { variant: 'success', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Sent' },
    failed: { variant: 'danger', icon: <XCircle className="w-3 h-3" />, label: 'Failed' },
    pending: { variant: 'warning', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
    spam: { variant: 'purple', icon: <Mail className="w-3 h-3" />, label: 'Spam' },
    delivered: { variant: 'info', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Delivered' },
  }
  const cfg = map[status] ?? { variant: 'secondary' as const, icon: null, label: status }
  return (
    <Badge variant={cfg.variant} className="flex items-center gap-1 w-fit">
      {cfg.icon}
      {cfg.label}
    </Badge>
  )
}

type SortField = keyof Contact | null
type SortDir = 'asc' | 'desc'

export default function EmailTable({ contacts, loading }: EmailTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const companies = useMemo(() => {
    const set = new Set(contacts.map((c) => c.company).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [contacts])

  const filtered = useMemo(() => {
    let data = [...contacts]

    if (search) {
      const q = search.toLowerCase()
      data = data.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.phone_number?.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') data = data.filter((c) => c.status === statusFilter)
    if (companyFilter !== 'all') data = data.filter((c) => c.company === companyFilter)

    if (startDate) data = data.filter((c) => new Date(c.created_at) >= new Date(startDate))
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      data = data.filter((c) => new Date(c.created_at) <= end)
    }

    if (sortField) {
      data.sort((a, b) => {
        const av = a[sortField] ?? ''
        const bv = b[sortField] ?? ''
        return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
      })
    }

    return data
  }, [contacts, search, statusFilter, companyFilter, startDate, endDate, sortField, sortDir])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('asc') }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
    return sortDir === 'asc' ? <SortAsc className="w-3.5 h-3.5 text-indigo-500" /> : <SortDesc className="w-3.5 h-3.5 text-indigo-500" />
  }

  const exportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(filtered)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts')
    XLSX.writeFile(wb, 'contacts-export.csv', { bookType: 'csv' })
  }

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts')
    XLSX.writeFile(wb, 'contacts-export.xlsx')
  }

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setCompanyFilter('all')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const columns = [
    { key: 'name', label: 'Name', icon: <User className="w-3.5 h-3.5" /> },
    { key: 'email', label: 'Email', icon: <Mail className="w-3.5 h-3.5" /> },
    { key: 'phone_number', label: 'Phone', icon: <Phone className="w-3.5 h-3.5" /> },
    { key: 'company', label: 'Company', icon: <Building2 className="w-3.5 h-3.5" /> },
    { key: 'subject', label: 'Subject', icon: <FileText className="w-3.5 h-3.5" /> },
    { key: 'status', label: 'Status', icon: null },
    { key: 'created_at', label: 'Sent At', icon: <Calendar className="w-3.5 h-3.5" /> },
  ] as const

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search name, email, company..."
              className="pl-8"
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="spam">Spam</SelectItem>
            </SelectContent>
          </Select>

          <Select value={companyFilter} onValueChange={(v) => { setCompanyFilter(v); setPage(1) }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map((co) => (
                <SelectItem key={co} value={co}>{co}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
              className="w-[150px] text-sm"
            />
            <span className="text-slate-400 text-sm">–</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
              className="w-[150px] text-sm"
            />
          </div>

          <Button variant="outline" size="sm" onClick={resetFilters}>Reset</Button>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-700 dark:text-slate-200">{filtered.length}</span> contacts
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-3.5 h-3.5 mr-1" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <Download className="w-3.5 h-3.5 mr-1" />
              Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
                    onClick={() => handleSort(col.key as SortField)}
                  >
                    <div className="flex items-center gap-1.5">
                      {col.icon}
                      {col.label}
                      <SortIcon field={col.key as SortField} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        <Mail className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 font-medium">No contacts found</p>
                      <p className="text-sm text-slate-400">Try adjusting your filters or uploading new contacts.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {paginated.map((contact, i) => (
                    <motion.tr
                      key={contact.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{contact.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{contact.email}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{contact.phone_number || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{contact.company || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[180px] truncate">{contact.subject || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={contact.status} /></td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {contact.sent_at ? formatDateTime(contact.sent_at) : formatDateTime(contact.created_at)}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Rows per page:</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
                <SelectTrigger className="h-7 w-[65px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 mr-2">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
