'use client'

import { useState } from 'react'
import { Plus, Edit2, Copy, Trash2, Eye, X } from 'lucide-react'
import { toast } from 'sonner'
import { createTemplate, updateTemplate, deleteTemplate } from './actions'

type Template = {
  id: string
  template_name: string
  subject: string
  display_name: string
  body: string
  created_at: string
}

export default function TemplatesClient({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    template_name: '',
    subject: '',
    display_name: '',
    body: ''
  })

  const openModal = (template?: Template, isDuplicate = false) => {
    if (template) {
      setFormData({
        template_name: isDuplicate ? `${template.template_name} (Copy)` : template.template_name,
        subject: template.subject,
        display_name: template.display_name || '',
        body: template.body
      })
      setEditingTemplate(isDuplicate ? null : template)
    } else {
      setFormData({ template_name: '', subject: '', display_name: '', body: '' })
      setEditingTemplate(null)
    }
    setIsModalOpen(true)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      if (editingTemplate) {
        const res = await updateTemplate(editingTemplate.id, formData)
        if (!res.success) throw new Error(res.error)
        setTemplates(templates.map(t => t.id === editingTemplate.id ? { ...t, ...formData } : t))
        toast.success('Template updated successfully')
      } else {
        const res = await createTemplate(formData)
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
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
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
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{template.template_name}</td>
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
                      <button onClick={() => handleDelete(template.id, template.template_name)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <form id="template-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name</label>
                  <input required type="text" value={formData.template_name} onChange={(e) => setFormData({...formData, template_name: e.target.value})} className="w-full px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700 dark:text-white" placeholder="e.g. AI Services Welcome" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                  <input required type="text" value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} className="w-full px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700 dark:text-white" placeholder="e.g. Custom Software Development Services" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name (Optional)</label>
                  <input type="text" value={formData.display_name} onChange={(e) => setFormData({...formData, display_name: e.target.value})} className="w-full px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700 dark:text-white" placeholder="e.g. Aravind Solutions" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Body (HTML/Text)</label>
                  <p className="text-xs text-gray-500 mb-2">You can use variables like {'{{name}}'}, {'{{company}}'}, {'{{email}}'}, {'{{phone_number}}'}, {'{{source}}'}</p>
                  <textarea required value={formData.body} onChange={(e) => setFormData({...formData, body: e.target.value})} rows={10} className="w-full px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700 dark:text-white font-mono text-sm" placeholder="Hello {{name}},&#10;&#10;Welcome to our services..." />
                </div>
              </form>
            </div>
            <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50">
              <button onClick={closeModal} type="button" className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600">Cancel</button>
              <button form="template-form" type="submit" disabled={isSubmitting} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
                {isSubmitting ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {isPreviewOpen && previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Preview: {previewTemplate.template_name}</h2>
              <button onClick={closePreview} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                <div className="text-gray-500 font-medium">From:</div>
                <div className="text-gray-900 dark:text-white">{previewTemplate.display_name ? `${previewTemplate.display_name} <sender@domain.com>` : 'Default Sender'}</div>
                
                <div className="text-gray-500 font-medium">Subject:</div>
                <div className="text-gray-900 dark:text-white font-medium">{previewTemplate.subject}</div>
              </div>
              <div className="border-t dark:border-gray-700 pt-4 mt-4">
                <div className="prose dark:prose-invert max-w-none text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: previewTemplate.body }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
