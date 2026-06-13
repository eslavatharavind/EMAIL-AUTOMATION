'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import { toast } from 'sonner'
import { Upload, RefreshCw, Send, Download, Plus, Edit2, Trash2, X, Paperclip, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { sendEmail, createContact, updateContact, deleteContact } from './actions'

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone_number: z.string().optional().default(''),
  company: z.string().optional().default(''),
  source: z.string().optional().default('Excel Upload'),
})

type Template = {
  id: string
  template_name: string
  subject: string
  display_name: string
  body: string
}

export default function ContactsClient({ initialContacts, templates }: { initialContacts: any[], templates: Template[] }) {
  const [contacts, setContacts] = useState(initialContacts)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessingQueue, setIsProcessingQueue] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  // Contact Modal State
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<any>(null)
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone_number: '', company: '', source: 'Manual Entry' })
  const [isSavingContact, setIsSavingContact] = useState(false)

  // Send Email Modal State
  const [isSendModalOpen, setIsSendModalOpen] = useState(false)
  const [sendingContact, setSendingContact] = useState<any>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [emailForm, setEmailForm] = useState({ subject: '', display_name: '', html: '' })
  const [attachments, setAttachments] = useState<File[]>([])
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)

  // Contact Modal Handlers
  const openContactModal = (contact: any = null) => {
    if (contact) {
      setContactForm({
        name: contact.name || '',
        email: contact.email || '',
        phone_number: contact.phone_number || '',
        company: contact.company || '',
        source: contact.source || 'Manual Entry'
      })
      setEditingContact(contact)
    } else {
      setContactForm({ name: '', email: '', phone_number: '', company: '', source: 'Manual Entry' })
      setEditingContact(null)
    }
    setIsContactModalOpen(true)
  }

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingContact(true)
    try {
      const parsed = contactSchema.parse(contactForm)
      if (editingContact) {
        const res = await updateContact(editingContact.id, parsed)
        if (!res.success) throw new Error(res.error)
        setContacts(contacts.map(c => c.id === editingContact.id ? { ...c, ...parsed } : c))
        toast.success('Contact updated')
      } else {
        const res = await createContact(parsed)
        if (!res.success) throw new Error(res.error)
        toast.success('Contact created')
        const { data } = await supabase.from('contacts').select('*').order('created_at', { ascending: false })
        if (data) setContacts(data)
      }
      setIsContactModalOpen(false)
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast.error('Invalid contact data')
      } else {
        toast.error(err.message || 'Error saving contact')
      }
    } finally {
      setIsSavingContact(false)
    }
  }

  const handleDeleteContact = async (id: string, email: string) => {
    if (!confirm(`Delete contact ${email}?`)) return
    try {
      const res = await deleteContact(id, email)
      if (!res.success) throw new Error(res.error)
      setContacts(contacts.filter(c => c.id !== id))
      toast.success('Contact deleted')
    } catch (err: any) {
      toast.error(err.message || 'Error deleting contact')
    }
  }

  // Send Email Modal Handlers
  const openSendModal = (contact: any) => {
    setSendingContact(contact)
    setSelectedTemplateId('')
    setEmailForm({ subject: '', display_name: '', html: '' })
    setAttachments([])
    setIsPreviewMode(false)
    setIsSendModalOpen(true)
  }

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tempId = e.target.value
    setSelectedTemplateId(tempId)
    const template = templates.find(t => t.id === tempId)
    if (template) {
      setEmailForm({
        subject: template.subject,
        display_name: template.display_name || '',
        html: template.body
      })
    }
  }

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = error => reject(error)
  })

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sendingContact) return
    setIsSendingEmail(true)
    
    try {
      const parsedAttachments = await Promise.all(attachments.map(async file => ({
        filename: file.name,
        content: await fileToBase64(file),
        contentType: file.type
      })))

      const res = await sendEmail(sendingContact.id, {
        subject: emailForm.subject,
        displayName: emailForm.display_name,
        html: emailForm.html,
        attachments: parsedAttachments
      })
      
      if (res.success) {
        toast.success('Email sent successfully!')
        setContacts(contacts.map(c => c.id === sendingContact.id ? { ...c, status: res.status } : c))
        setIsSendModalOpen(false)
      } else {
        toast.error(res.details || 'Failed to send email')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error sending email')
    } finally {
      setIsSendingEmail(false)
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
    setIsProcessingQueue(true)
    try {
      const res = await fetch('/api/cron/send-emails')
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Failed to process emails')
      
      if (data.total === 0) {
        toast.info('No pending contacts to process.')
      } else {
        toast.success(`Processed ${data.total} emails (${data.sent} sent, ${data.failed} failed).`)
        const { data: updated } = await supabase.from('contacts').select('*').order('created_at', { ascending: false })
        if (updated) setContacts(updated)
      }
    } catch (err: any) {
      toast.error(err.message || 'Error processing queue')
    } finally {
      setIsProcessingQueue(false)
    }
  }

  const exportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(contacts)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Contacts")
    XLSX.writeFile(wb, "contacts-export.csv", { bookType: "csv" })
  }

  const replaceVariables = (text: string, contact: any) => {
    return text
      .replace(/{{name}}/g, contact.name || '')
      .replace(/{{email}}/g, contact.email || '')
      .replace(/{{company}}/g, contact.company || '')
      .replace(/{{phone_number}}/g, contact.phone_number || '')
      .replace(/{{source}}/g, contact.source || '')
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4 flex-wrap">
        <label className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 cursor-pointer transition-colors">
          <Upload className="w-4 h-4" />
          {isUploading ? 'Uploading...' : 'Upload Excel'}
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
        </label>
        
        <button onClick={() => openContactModal()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" />
          Manual Contact
        </button>

        <button 
          onClick={handleProcessQueue} 
          disabled={isProcessingQueue}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isProcessingQueue ? 'animate-spin' : ''}`} />
          {isProcessingQueue ? 'Processing...' : 'Process Pending Queue'}
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
                <th className="px-6 py-3 text-right">Actions</th>
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
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => openSendModal(contact)}
                        disabled={contact.status === 'sent'}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50"
                        title="Send Email"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button onClick={() => openContactModal(contact)} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteContact(contact.id, contact.email)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No contacts found. Upload an Excel file or add manually to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Contact Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingContact ? 'Edit Contact' : 'New Contact'}
              </h2>
              <button onClick={() => setIsContactModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <form id="contact-form" onSubmit={handleSaveContact} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input required type="text" value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} className="w-full px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input required type="email" value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} className="w-full px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number (Optional)</label>
                  <input type="text" value={contactForm.phone_number} onChange={e => setContactForm({...contactForm, phone_number: e.target.value})} className="w-full px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company (Optional)</label>
                  <input type="text" value={contactForm.company} onChange={e => setContactForm({...contactForm, company: e.target.value})} className="w-full px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source</label>
                  <input type="text" value={contactForm.source} onChange={e => setContactForm({...contactForm, source: e.target.value})} className="w-full px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700 dark:text-white" />
                </div>
              </form>
            </div>
            <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50">
              <button type="button" onClick={() => setIsContactModalOpen(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600">Cancel</button>
              <button form="contact-form" type="submit" disabled={isSavingContact} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
                {isSavingContact ? 'Saving...' : 'Save Contact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Email Modal */}
      {isSendModalOpen && sendingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Send Email to {sendingContact.email}
              </h2>
              <button onClick={() => setIsSendModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              {!isPreviewMode ? (
                <form id="send-email-form" onSubmit={handleSendEmail} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Template (Optional)</label>
                    <select value={selectedTemplateId} onChange={handleTemplateChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700 dark:text-white">
                      <option value="">-- No Template --</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.template_name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                    <input type="text" value={emailForm.subject} onChange={e => setEmailForm({...emailForm, subject: e.target.value})} className="w-full px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700 dark:text-white" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name (Sender)</label>
                    <input type="text" value={emailForm.display_name} onChange={e => setEmailForm({...emailForm, display_name: e.target.value})} className="w-full px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700 dark:text-white" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Body</label>
                    <textarea value={emailForm.html} onChange={e => setEmailForm({...emailForm, html: e.target.value})} rows={6} className="w-full px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700 dark:text-white font-mono text-sm" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Attachments</label>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm">
                        <Paperclip className="w-4 h-4" />
                        Add Files
                        <input type="file" multiple className="hidden" onChange={e => {
                          if (e.target.files) {
                            setAttachments([...attachments, ...Array.from(e.target.files)])
                          }
                          e.target.value = ''
                        }} />
                      </label>
                    </div>
                    {attachments.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {attachments.map((file, i) => (
                          <li key={i} className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                            <span className="truncate max-w-[80%]">{file.name}</span>
                            <button type="button" onClick={() => setAttachments(attachments.filter((_, index) => index !== i))} className="text-red-500 hover:text-red-700">
                              <X className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                    <div className="text-gray-500 font-medium">To:</div>
                    <div className="text-gray-900 dark:text-white">{sendingContact.name} &lt;{sendingContact.email}&gt;</div>
                    
                    <div className="text-gray-500 font-medium">From:</div>
                    <div className="text-gray-900 dark:text-white">{emailForm.display_name ? `"${emailForm.display_name}" <sender@domain.com>` : 'Default Sender'}</div>
                    
                    <div className="text-gray-500 font-medium">Subject:</div>
                    <div className="text-gray-900 dark:text-white font-medium">{replaceVariables(emailForm.subject, sendingContact)}</div>
                  </div>
                  {attachments.length > 0 && (
                    <div className="flex gap-2 items-center text-sm text-gray-500">
                      <Paperclip className="w-4 h-4" /> {attachments.length} attachment(s)
                    </div>
                  )}
                  <div className="border-t dark:border-gray-700 pt-4 mt-4">
                    <div className="prose dark:prose-invert max-w-none text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: replaceVariables(emailForm.html, sendingContact) || '<p>Hi ' + sendingContact.name + ', ... (Default content)</p>' }} />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <button 
                type="button" 
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                {isPreviewMode ? <Edit2 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {isPreviewMode ? 'Edit' : 'Preview'}
              </button>
              
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsSendModalOpen(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600">Cancel</button>
                <button form="send-email-form" type="submit" disabled={isSendingEmail} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
                  {isSendingEmail ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
