'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import { toast } from 'sonner'
import { Upload, RefreshCw, Send, Download } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { sendEmail } from './actions'

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone_number: z.string().optional().default(''),
  company: z.string().optional().default(''),
  source: z.string().optional().default('Excel Upload'),
})

export default function ContactsClient({ initialContacts }: { initialContacts: any[] }) {
  const [contacts, setContacts] = useState(initialContacts)
  const [isUploading, setIsUploading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const handleSendEmail = async (contactId: string) => {
    setSendingId(contactId)
    try {
      const res = await sendEmail(contactId)
      if (res.success) {
        toast.success('Email sent successfully!')
      } else {
        toast.error(res.details || 'Failed to send email')
      }
      
      // Update contact status in local state
      setContacts(contacts.map(c => c.id === contactId ? { ...c, status: res.status } : c))
    } catch (err: any) {
      toast.error(err.message || 'Error sending email')
    } finally {
      setSendingId(null)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws)

      const validContacts = []
      let errors = 0

      for (const row of data as any[]) {
        const parsed = contactSchema.safeParse({
          name: row.name || row.Name,
          email: row.email || row.Email,
          phone_number: String(row.phone_number || row.Phone || ''),
          company: row.company || row.Company || '',
          source: row.source || row.Source || 'Excel Upload'
        })

        if (parsed.success) {
          validContacts.push({ ...parsed.data, user_id: user.id })
        } else {
          errors++
        }
      }

      if (validContacts.length === 0) {
        toast.error('No valid contacts found in file')
        return
      }

      const { error } = await supabase
        .from('contacts')
        .upsert(validContacts, { onConflict: 'email', ignoreDuplicates: true })

      if (error) throw error

      await supabase.from('activity_logs').insert({
        action: 'import',
        user_id: user.id,
        details: `Imported ${validContacts.length} contacts (${errors} errors skipped)`
      })

      toast.success(`Imported ${validContacts.length} contacts`)
      
      // Refresh list
      const { data: updated } = await supabase.from('contacts').select('*').order('created_at', { ascending: false })
      if (updated) setContacts(updated)
      
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload')
    } finally {
      setIsUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleProcessQueue = async () => {
    setIsSending(true)
    try {
      const res = await fetch('/api/cron/send-emails')
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Failed to process emails')
      
      if (data.total === 0) {
        toast.info('No pending contacts to process.')
      } else {
        toast.success(`Processed ${data.total} emails (${data.sent} sent, ${data.failed} failed).`)
        // Refresh list
        const { data: updated } = await supabase.from('contacts').select('*').order('created_at', { ascending: false })
        if (updated) setContacts(updated)
      }
    } catch (err: any) {
      toast.error(err.message || 'Error processing queue')
    } finally {
      setIsSending(false)
    }
  }

  const exportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(contacts)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Contacts")
    XLSX.writeFile(wb, "contacts-export.csv", { bookType: "csv" })
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4 flex-wrap">
        <label className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 cursor-pointer transition-colors">
          <Upload className="w-4 h-4" />
          {isUploading ? 'Uploading...' : 'Upload Excel'}
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
        </label>
        
        <button 
          onClick={handleProcessQueue} 
          disabled={isSending}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSending ? 'animate-spin' : ''}`} />
          {isSending ? 'Processing...' : 'Process Pending Queue'}
        </button>

        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <Download className="w-4 h-4" />
          Export CSV
        </button>

        <a href="/template.xlsx" download className="flex items-center gap-2 px-4 py-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors">
          Download Template
        </a>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Company</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{contact.name}</td>
                  <td className="px-6 py-4">{contact.email}</td>
                  <td className="px-6 py-4">{contact.company || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      contact.status === 'sent' ? 'bg-green-100 text-green-800' :
                      contact.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {contact.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleSendEmail(contact.id)}
                      disabled={sendingId === contact.id || contact.status === 'sent'}
                      className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50"
                    >
                      {sendingId === contact.id ? 'Sending...' : contact.status === 'sent' ? 'Sent' : 'Send Email'}
                    </button>
                  </td>
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No contacts found. Upload an Excel file to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
