'use client'

import { useState, useRef } from 'react'
import { Plus, Edit2, Copy, Trash2, Eye, X, Bold, Italic, Underline, List, ListOrdered, Sparkles, Send } from 'lucide-react'
import { toast } from 'sonner'
import { createTemplate, updateTemplate, deleteTemplate, sendTestEmail } from './actions'

type Template = {
  id: string
  template_name: string
  subject: string
  display_name: string
  body: string
  is_draft?: boolean
  is_system_default?: boolean
  created_at: string
}

export default function TemplatesClient({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Rich Text Editor & Preview Tab States
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write')
  const [testRecipient, setTestRecipient] = useState('')
  const [isSendingTest, setIsSendingTest] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  // Form state
  const [formData, setFormData] = useState({
    template_name: '',
    subject: '',
    display_name: '',
    body: '',
    is_draft: false
  })

  // Mock template variables substitution for preview
  const mockVariables = {
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    company: 'Acme Corporation',
    phone_number: '+1 (555) 123-4567',
    source: 'LinkedIn Referral'
  }

  const replaceVariables = (text: string) => {
    return (text || '')
      .replace(/{{name}}/g, mockVariables.name)
      .replace(/{{email}}/g, mockVariables.email)
      .replace(/{{company}}/g, mockVariables.company)
      .replace(/{{phone_number}}/g, mockVariables.phone_number)
      .replace(/{{source}}/g, mockVariables.source)
  }

  const openModal = (template?: Template, isDuplicate = false) => {
    const initialBody = template ? template.body : ''
    setFormData({
      template_name: (isDuplicate && template) ? `${template.template_name} (Copy)` : (template ? template.template_name : ''),
      subject: template ? template.subject : '',
      display_name: template ? (template.display_name || '') : '',
      body: initialBody,
      is_draft: (isDuplicate && template) ? false : (template ? (template.is_draft || false) : false)
    })
    setEditingTemplate(isDuplicate ? null : (template || null))
    setActiveTab('write')
    setIsModalOpen(true)

    // Wait for the modal editor DOM to mount before loading HTML
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = initialBody
      }
    }, 50)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingTemplate(null)
  }

  const openPreview = (template: Template) => {
    setPreviewTemplate(template)
    setIsPreviewOpen(true)
  }

  const closePreview = () => {
    setPreviewTemplate(null)
    setIsPreviewOpen(false)
  }

  const handleEditorInput = () => {
    if (editorRef.current) {
      setFormData(prev => ({ ...prev, body: editorRef.current!.innerHTML }))
    }
  }

  const format = (command: string, value: string = '') => {
    document.execCommand(command, false, value)
    handleEditorInput()
  }

  const insertVariable = (variable: string) => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      const textNode = document.createTextNode(variable)
      range.insertNode(textNode)
      range.setStartAfter(textNode)
      range.setEndAfter(textNode)
      sel.removeAllRanges()
      sel.addRange(range)
    } else {
      if (editorRef.current) {
        editorRef.current.innerHTML += variable
      }
    }
    handleEditorInput()
  }

  const insertRecruiterLayout = () => {
    if (!confirm('This will replace the current template body with a professional recruiter blueprint. Continue?')) return
    const blueprint = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <h2 style="color: #4f46e5; margin-top: 0; font-size: 20px;">Hello {{name}},</h2>
  <p style="margin-bottom: 16px;">I hope this email finds you well.</p>
  <p style="margin-bottom: 16px;">I recently reviewed your professional background and was highly impressed by your experience. We are currently scouting for exceptional talents for open opportunities that align perfectly with your skillset.</p>
  <p style="margin-bottom: 20px;">Specifically, your previous projects and experience make you a strong candidate. I would love to connect briefly to discuss how we can work together.</p>
  <div style="margin: 24px 0; text-align: left;">
    <a href="https://example.com/schedule" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Schedule a Brief Chat</a>
  </div>
  <p style="margin-top: 24px; margin-bottom: 4px; color: #64748b;">Best regards,</p>
  <p style="margin-top: 0; font-weight: bold;">[Your Name]<br><span style="font-size: 12px; color: #94a3b8; font-weight: normal;">Recruitment Consultant</span></p>
</div>`
    if (editorRef.current) {
      editorRef.current.innerHTML = blueprint
      setFormData(prev => ({ ...prev, body: blueprint }))
    }
  }

  const handleSendTest = async () => {
    if (!testRecipient) return toast.error('Please enter a test recipient email')
    setIsSendingTest(true)
    try {
      const res = await sendTestEmail({
        toEmail: testRecipient,
        subject: formData.subject,
        body: formData.body,
        displayName: formData.display_name
      })
      if (!res.success) throw new Error(res.error || 'Failed to send test email')
      toast.success('Test email sent successfully to ' + testRecipient)
    } catch (err: any) {
      toast.error(err.message || 'Error sending test email')
    } finally {
      setIsSendingTest(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent, forceDraft = false) => {
    if (e) e.preventDefault()
    setIsSubmitting(true)
    
    const finalFormData = {
      ...formData,
      is_draft: forceDraft
    }

    try {
      if (editingTemplate) {
        const res = await updateTemplate(editingTemplate.id, finalFormData)
        if (!res.success) throw new Error(res.error)
        setTemplates(templates.map(t => t.id === editingTemplate.id ? { ...t, ...finalFormData } : t))
        toast.success('Template saved successfully')
      } else {
        const res = await createTemplate(finalFormData)
        if (!res.success) throw new Error(res.error)
        toast.success('Template created successfully')
        window.location.reload() 
      }
      closeModal()
    } catch (err: any) {
      toast.error(err.message || 'Error saving template')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return
    try {
      const res = await deleteTemplate(id, name)
      if (!res.success) throw new Error(res.error)
      setTemplates(templates.filter(t => t.id !== id))
      toast.success('Template deleted')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete template')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4 flex-wrap">
        <button 
          onClick={() => openModal()} 
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Template
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-6 py-3">Template Name</th>
                <th className="px-6 py-3">Subject</th>
                <th className="px-6 py-3">Display Name</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <span>{template.template_name}</span>
                    {template.is_system_default && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-800 rounded dark:bg-blue-900/30 dark:text-blue-400">
                        System Default
                      </span>
                    )}
                    {template.is_draft && !template.is_system_default && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-yellow-100 text-yellow-800 rounded dark:bg-yellow-900/30 dark:text-yellow-400">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">{template.subject}</td>
                  <td className="px-6 py-4">{template.display_name || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => openPreview(template)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" title="Preview">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => openModal(template)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => openModal(template, true)} className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300" title="Duplicate">
                        <Copy className="w-4 h-4" />
                      </button>
                      {!template.is_system_default && (
                        <button onClick={() => handleDelete(template.id, template.template_name)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No templates found. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white font-bold">
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Tabs */}
            <div className="px-4 border-b border-gray-200 dark:border-gray-700 flex gap-4 text-sm font-medium">
              <button 
                type="button" 
                onClick={() => setActiveTab('write')} 
                className={`pt-3 pb-2 border-b-2 transition-colors ${activeTab === 'write' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Write Template
              </button>
              <button 
                type="button" 
                onClick={() => setActiveTab('preview')} 
                className={`pt-3 pb-2 border-b-2 transition-colors ${activeTab === 'preview' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Live Preview
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 max-h-[60vh]">
              {activeTab === 'write' ? (
                <form id="template-form" onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name</label>
                    <input required type="text" value={formData.template_name} onChange={(e) => setFormData({...formData, template_name: e.target.value})} className="w-full px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700 dark:text-white text-sm" placeholder="e.g. AI Services Welcome" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                    <div className="flex gap-2">
                      <input 
                        required 
                        type="text" 
                        value={formData.subject} 
                        onChange={(e) => setFormData({...formData, subject: e.target.value})} 
                        className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700 dark:text-white text-sm" 
                        placeholder="e.g. Custom Software Development Services" 
                      />
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            setFormData({...formData, subject: e.target.value})
                            e.target.value = ''
                          }
                        }}
                        className="px-2 py-2 border rounded-md text-xs dark:bg-gray-900 dark:border-gray-700 dark:text-white outline-none cursor-pointer max-w-[130px]"
                      >
                        <option value="">💡 Suggestions</option>
                        <option value="Reviewing your application for Open Positions">Reviewing your application</option>
                        <option value="Opportunities at {{company}} - Interview Invitation">Opportunities at {"{{company}}"}</option>
                        <option value="Hi {{name}} - Quick question regarding your profile">Hi {"{{name}}"} - Profile review</option>
                        <option value="Connecting regarding open roles at {{company}}">Connecting regarding roles</option>
                        <option value="Job Opportunity: Consultant Position at {{company}}">Opportunity at {"{{company}}"}</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name (Optional)</label>
                    <input type="text" value={formData.display_name} onChange={(e) => setFormData({...formData, display_name: e.target.value})} className="w-full px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700 dark:text-white text-sm" placeholder="e.g. Aravind Solutions" />
                  </div>

                  {/* WYSIWYG Rich Text Editor Component */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 font-semibold">
                      Email Body
                    </label>
                    
                    {/* Toolbar */}
                    <div className="flex flex-wrap gap-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-t-md items-center">
                      <button type="button" onClick={() => format('bold')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-200" title="Bold"><Bold className="w-4 h-4" /></button>
                      <button type="button" onClick={() => format('italic')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-200" title="Italic"><Italic className="w-4 h-4" /></button>
                      <button type="button" onClick={() => format('underline')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-200" title="Underline"><Underline className="w-4 h-4" /></button>
                      <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-750 mx-1" />
                      
                      <button type="button" onClick={() => format('formatBlock', '<h1>')} className="px-1.5 py-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-200 text-[10px] font-bold" title="Heading 1">H1</button>
                      <button type="button" onClick={() => format('formatBlock', '<h2>')} className="px-1.5 py-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-200 text-[10px] font-bold" title="Heading 2">H2</button>
                      <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-750 mx-1" />
                      
                      <button type="button" onClick={() => format('insertUnorderedList')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-200" title="Bullet List"><List className="w-4 h-4" /></button>
                      <button type="button" onClick={() => format('insertOrderedList')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-200" title="Numbered List"><ListOrdered className="w-4 h-4" /></button>
                      <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-750 mx-1" />
                      
                      {/* Variables Tags */}
                      <button type="button" onClick={() => insertVariable('{{name}}')} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 dark:bg-gray-800 border border-slate-250 dark:border-slate-700 rounded text-[9px] font-mono text-indigo-600 dark:text-indigo-400" title="Recipient Name">{"{{name}}"}</button>
                      <button type="button" onClick={() => insertVariable('{{company}}')} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 dark:bg-gray-800 border border-slate-250 dark:border-slate-700 rounded text-[9px] font-mono text-indigo-600 dark:text-indigo-400" title="Company Name">{"{{company}}"}</button>
                      <button type="button" onClick={() => insertVariable('{{email}}')} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 dark:bg-gray-800 border border-slate-250 dark:border-slate-700 rounded text-[9px] font-mono text-indigo-600 dark:text-indigo-400" title="Recipient Email">{"{{email}}"}</button>
                      <button type="button" onClick={() => insertVariable('{{phone_number}}')} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 dark:bg-gray-800 border border-slate-250 dark:border-slate-700 rounded text-[9px] font-mono text-indigo-600 dark:text-indigo-400" title="Recipient Phone">{"{{phone_number}}"}</button>
                      <button type="button" onClick={() => insertVariable('{{source}}')} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 dark:bg-gray-800 border border-slate-250 dark:border-slate-700 rounded text-[9px] font-mono text-indigo-600 dark:text-indigo-400" title="Recipient Source">{"{{source}}"}</button>
                      
                      <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-750 mx-1" />
                      
                      <button 
                        type="button" 
                        onClick={insertRecruiterLayout} 
                        className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 rounded flex items-center gap-1 border border-indigo-200 dark:border-indigo-850"
                        title="Prefill recruiter email template"
                      >
                        <Sparkles className="w-3 h-3" /> Recruiter Layout
                      </button>
                    </div>
                    
                    {/* Visual Edit Area */}
                    <div 
                      ref={editorRef}
                      contentEditable
                      onInput={handleEditorInput}
                      className="relative w-full min-h-[250px] p-4 border border-t-0 border-slate-200 dark:border-slate-700 rounded-b-md bg-transparent text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 overflow-y-auto text-sm leading-relaxed"
                      data-placeholder="Hello {{name}}, welcome to our platform..."
                    />
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  {/* Subject and Sender Mock Preview */}
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm space-y-2">
                    <div>
                      <span className="font-semibold text-slate-500 dark:text-slate-400">From Name:</span>{' '}
                      <span className="text-slate-800 dark:text-slate-200">{formData.display_name || 'Default Sender'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500 dark:text-slate-400">Subject:</span>{' '}
                      <span className="text-slate-800 dark:text-slate-200 font-medium">{replaceVariables(formData.subject)}</span>
                    </div>
                  </div>

                  {/* Body Mock Preview */}
                  <div className="border border-slate-200 dark:border-slate-700 p-6 rounded-xl bg-white dark:bg-slate-950 overflow-auto max-h-[350px]">
                    <div 
                      className="prose dark:prose-invert max-w-none text-sm leading-relaxed" 
                      dangerouslySetInnerHTML={{ __html: replaceVariables(formData.body) || '<p class="text-slate-400 italic">No email content yet. Go back to edit tab.</p>' }} 
                    />
                  </div>

                  {/* Send Test Email Action */}
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Send a Real Test Email</h4>
                    <div className="flex gap-2">
                      <input 
                        type="email" 
                        placeholder="test-recipient@domain.com" 
                        value={testRecipient} 
                        onChange={(e) => setTestRecipient(e.target.value)} 
                        className="flex-1 px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button 
                        type="button" 
                        onClick={handleSendTest} 
                        disabled={isSendingTest || !testRecipient.trim()} 
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        {isSendingTest ? 'Sending...' : 'Send Test'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Modal Actions */}
            <div className="p-4 border-t dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <button onClick={closeModal} type="button" className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 text-sm">Cancel</button>
              <div className="flex gap-3">
                <button type="button" onClick={(e) => handleSubmit(e, true)} disabled={isSubmitting} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50 text-sm">
                  Save as Draft
                </button>
                <button form="template-form" type="submit" disabled={isSubmitting} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm">
                  {isSubmitting ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Table Preview Modal */}
      {isPreviewOpen && previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white font-bold">Preview: {previewTemplate.template_name}</h2>
              <button onClick={closePreview} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                <div className="text-gray-500 font-medium">From:</div>
                <div className="text-gray-900 dark:text-white">{previewTemplate.display_name ? `${previewTemplate.display_name} <sender@domain.com>` : 'Default Sender'}</div>
                
                <div className="text-gray-500 font-medium">Subject:</div>
                <div className="text-gray-900 dark:text-white font-medium">{replaceVariables(previewTemplate.subject)}</div>
              </div>
              <div className="border-t dark:border-gray-700 pt-4 mt-4">
                <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: replaceVariables(previewTemplate.body) }} />
              </div>

              {/* Send Test Email Section inside eye preview modal */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 mt-4">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Send a Real Test Email</h4>
                <div className="flex gap-2">
                  <input 
                    type="email" 
                    placeholder="test-recipient@domain.com" 
                    value={testRecipient} 
                    onChange={(e) => setTestRecipient(e.target.value)} 
                    className="flex-1 px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button 
                    type="button" 
                    onClick={async () => {
                      if (!testRecipient) return toast.error('Recipient email required')
                      setIsSendingTest(true)
                      try {
                        const res = await sendTestEmail({
                          toEmail: testRecipient,
                          subject: previewTemplate.subject,
                          body: previewTemplate.body,
                          displayName: previewTemplate.display_name
                        })
                        if (!res.success) throw new Error(res.error || 'Failed')
                        toast.success('Test email sent to ' + testRecipient)
                      } catch (err: any) {
                        toast.error(err.message || 'Error sending test email')
                      } finally {
                        setIsSendingTest(false)
                      }
                    }} 
                    disabled={isSendingTest || !testRecipient.trim()} 
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    {isSendingTest ? 'Sending...' : 'Send Test'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
