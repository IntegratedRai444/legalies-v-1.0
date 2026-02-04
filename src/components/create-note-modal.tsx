'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { QUICK_TEMPLATES } from '@/lib/types'
import { toast } from 'sonner'

interface CreateNoteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  initialCaseId?: string
}

export function CreateNoteModal({ open, onOpenChange, onSuccess, initialCaseId }: CreateNoteModalProps) {
  const [loading, setLoading] = useState(false)
  const [cases, setCases] = useState<Array<{ id: string; case_uid: string; case_title: string }>>([])
  const [form, setForm] = useState({
    case_id: initialCaseId || '',
    note_date: format(new Date(), 'yyyy-MM-dd'),
    note_text: '',
    priority: 'medium' as 'low' | 'medium' | 'high'
  })

  useEffect(() => {
    if (open && !initialCaseId) {
      fetchCases()
    }
    if (initialCaseId) {
      setForm(f => ({ ...f, case_id: initialCaseId }))
    }
  }, [open, initialCaseId])

  const fetchCases = async () => {
    try {
      const res = await fetch('/api/cases?status=Active', {
        credentials: 'include'
      })
      const data = await res.json()
      if (Array.isArray(data)) {
        setCases(data)
      }
    } catch {
      console.error('Failed to fetch cases')
    }
  }

  const handleSubmit = async () => {
    if (!form.note_text.trim()) {
      toast.error('Please enter journal entry text')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/diary', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          note_date: form.note_date || new Date().toISOString().split('T')[0]
        })
      })

      if (!res.ok) throw new Error()
      
      toast.success('Journal entry added successfully!')
      onOpenChange(false)
      setForm({
        case_id: initialCaseId || '',
        note_date: format(new Date(), 'yyyy-MM-dd'),
        note_text: '',
        priority: 'medium'
      })
      onSuccess?.()
    } catch {
      toast.error('Failed to add journal entry')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Journal Entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Journal Entry Date</Label>
            <Input
              type="date"
              value={form.note_date}
              onChange={(e) => setForm({ ...form, note_date: e.target.value })}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label>Quick Templates</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_TEMPLATES.slice(0, 6).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm({ ...form, note_text: t })}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Journal Entry *</Label>
            <Textarea
              placeholder="Internal journal entries about the case..."
              value={form.note_text}
              onChange={(e) => setForm({ ...form, note_text: e.target.value })}
              rows={5}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as any })}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!initialCaseId && (
              <div className="space-y-2">
                <Label>Link to Case (optional)</Label>
                <Select value={form.case_id} onValueChange={(v) => setForm({ ...form, case_id: v })}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="No case" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No case</SelectItem>
                    {cases.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.case_uid}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <Button onClick={handleSubmit} className="w-full h-12 legal-gradient" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
