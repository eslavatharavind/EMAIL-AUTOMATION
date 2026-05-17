// Mark this component as a Next.js Client Component since it uses hooks like useState and useMemo
'use client'

// Import React hooks used for local state management and memoizing expensive calculations
import { useState, useMemo } from 'react'
// Import motion and AnimatePresence from framer-motion for smooth entry/exit animations of table rows
import { motion, AnimatePresence } from 'framer-motion'
// Import our custom UI components from the Shadcn UI library folder
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
// Import the XLSX library for exporting table data to Excel and CSV formats
import * as XLSX from 'xlsx'
// Import necessary SVG icons from lucide-react to visually enhance the UI
import {
  Search, ChevronLeft, ChevronRight, Download, SortAsc, SortDesc,
  ArrowUpDown, Mail, Building2, Phone, User, Calendar, FileText,
  CheckCircle2, XCircle, Clock,
} from 'lucide-react'
// Import our custom date formatting utility function
import { formatDateTime } from '@/lib/utils'

/**
 * Interface defining the shape of a single Contact object.
 * This matches the database schema for the 'contacts' table in Supabase.
 */
interface Contact {
  id: string // Unique identifier
  name: string // Contact's full name
  email: string // Contact's email address
  phone_number?: string // Optional phone number
  company?: string // Optional company name
  subject?: string // Optional email subject line
  status: string // Current delivery status (pending, sent, failed, etc.)
  created_at: string // ISO timestamp of when the contact was added
  sent_at?: string // Optional ISO timestamp of when the email was actually delivered
}

/**
 * Interface defining the props passed to the EmailTable component.
 */
interface EmailTableProps {
  contacts: Contact[] // Array of contacts to display
  loading?: boolean // Optional flag to show skeleton loaders while data is fetching
}

// Constant array defining the available options for pagination (rows per page)
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

/**
 * Helper component that renders a colored Badge based on the contact's email status.
 * @param status The string status ('sent', 'failed', 'pending', etc.)
 */
function StatusBadge({ status }: { status: string }) {
  // Define a mapping object that associates each status with a color variant, icon, and label
  const map: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info' | 'purple'; icon: React.ReactNode; label: string }> = {
    sent: { variant: 'success', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Sent' },
    failed: { variant: 'danger', icon: <XCircle className="w-3 h-3" />, label: 'Failed' },
    pending: { variant: 'warning', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
    spam: { variant: 'purple', icon: <Mail className="w-3 h-3" />, label: 'Spam' },
    delivered: { variant: 'info', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Delivered' },
  }
  // Lookup the config for the current status. If it doesn't exist, fallback to a default grey 'secondary' badge
  const cfg = map[status] ?? { variant: 'secondary' as const, icon: null, label: status }
  
  // Return the Badge component with the appropriate variant and icon
  return (
    <Badge variant={cfg.variant} className="flex items-center gap-1 w-fit">
      {cfg.icon}
      {cfg.label}
    </Badge>
  )
}

// Define specific types for sorting fields to ensure type safety
type SortField = keyof Contact | null // Can sort by any key of Contact, or null for no sorting
type SortDir = 'asc' | 'desc' // Direction is either ascending or descending

/**
 * Main EmailTable component exported as default.
 * Handles displaying, searching, filtering, sorting, paginating, and exporting contact data.
 */
export default function EmailTable({ contacts, loading }: EmailTableProps) {
  // --- STATE DEFINITIONS ---
  const [search, setSearch] = useState('') // Stores the text typed in the global search bar
  const [statusFilter, setStatusFilter] = useState('all') // Stores the selected status from the dropdown
  const [companyFilter, setCompanyFilter] = useState('all') // Stores the selected company from the dropdown
  const [startDate, setStartDate] = useState('') // Stores the selected start date filter
  const [endDate, setEndDate] = useState('') // Stores the selected end date filter
  const [page, setPage] = useState(1) // Stores the current pagination page (1-indexed)
  const [pageSize, setPageSize] = useState(10) // Stores the number of items per page
  const [sortField, setSortField] = useState<SortField>('created_at') // Stores the currently active column for sorting
  const [sortDir, setSortDir] = useState<SortDir>('desc') // Stores the current sort direction

  /**
   * Memoized array of unique companies extracted from the contacts list.
   * This prevents recalculating the unique list on every render unless 'contacts' changes.
   */
  const companies = useMemo(() => {
    // Extract company names, filter out null/undefined, put into a Set to ensure uniqueness, then convert back to an Array and sort alphabetically.
    const set = new Set(contacts.map((c) => c.company).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [contacts])

  /**
   * Memoized array of filtered and sorted contacts.
   * This is the core logic engine of the table. It recalculates only when dependencies change.
   */
  const filtered = useMemo(() => {
    // Create a shallow copy of contacts so we don't mutate the original prop
    let data = [...contacts]

    // 1. Apply Search Filter
    if (search) {
      const q = search.toLowerCase()
      // Keep only contacts whose name, email, company, or phone include the search query
      data = data.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.phone_number?.toLowerCase().includes(q)
      )
    }

    // 2. Apply Dropdown Filters
    if (statusFilter !== 'all') data = data.filter((c) => c.status === statusFilter)
    if (companyFilter !== 'all') data = data.filter((c) => c.company === companyFilter)

    // 3. Apply Date Range Filters
    if (startDate) data = data.filter((c) => new Date(c.created_at) >= new Date(startDate))
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999) // Set time to end of day to include all events on that day
      data = data.filter((c) => new Date(c.created_at) <= end)
    }

    // 4. Apply Sorting
    if (sortField) {
      data.sort((a, b) => {
        const av = a[sortField] ?? '' // fallback to empty string if null
        const bv = b[sortField] ?? ''
        // Use localeCompare for alphabetical sorting, reversing the order if 'desc'
        return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
      })
    }

    return data // Return the fully processed data set
  }, [contacts, search, statusFilter, companyFilter, startDate, endDate, sortField, sortDir])

  // --- PAGINATION CALCS ---
  // Total pages = total filtered items divided by items per page (rounded up)
  const totalPages = Math.ceil(filtered.length / pageSize)
  // Slice the filtered array to get only the items for the current page
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  /**
   * Function to handle clicking on a column header to change sorting.
   */
  const handleSort = (field: SortField) => {
    // If clicking the same column, toggle direction. Otherwise, set new column and default to ascending.
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('asc') }
  }

  /**
   * Helper component to render the correct sort arrow icon next to column headers.
   */
  const SortIcon = ({ field }: { field: SortField }) => {
    // If not the active sort column, show a neutral up/down arrow
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
    // If active, show an up or down arrow based on sortDir
    return sortDir === 'asc' ? <SortAsc className="w-3.5 h-3.5 text-indigo-500" /> : <SortDesc className="w-3.5 h-3.5 text-indigo-500" />
  }

  /**
   * Export the currently filtered data to a CSV file.
   */
  const exportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(filtered) // convert json to sheet
    const wb = XLSX.utils.book_new() // create new workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts') // append sheet
    XLSX.writeFile(wb, 'contacts-export.csv', { bookType: 'csv' }) // trigger download
  }

  /**
   * Export the currently filtered data to an Excel (.xlsx) file.
   */
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts')
    XLSX.writeFile(wb, 'contacts-export.xlsx') // trigger download
  }

  /**
   * Reset all filters back to their default states.
   */
  const resetFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setCompanyFilter('all')
    setStartDate('')
    setEndDate('')
    setPage(1) // Reset back to first page
  }

  // Define the table columns array. This makes the UI rendering loop much cleaner.
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
